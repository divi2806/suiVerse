import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  Timestamp, 
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getFallbackChallenges } from './hardcodedChallenges';

// Import the API key from environment or use fallback
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyC9YKF89cnfSAAzM6TilPY29Ea9LeiIf8s';

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Add a timeout wrapper for the Gemini API call
const generateWithTimeout = async (prompt: string, timeoutMs = 10000): Promise<any> => {
  return new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Gemini API request timed out'));
    }, timeoutMs);
    
    try {
      const result = await model.generateContent(prompt);
      clearTimeout(timeoutId);
      resolve(result);
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
};

// Challenge types that will be rotated daily
export type ChallengeType = 
  | 'code_puzzle' 
  | 'quiz' 
  | 'bug_hunt' 
  | 'concept_review' 
  | 'security_audit' 
  | 'optimization'
  | 'defi_scenario'
  | 'nft_design'
  | 'math_puzzle';

// Interface for daily challenge
export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  type: ChallengeType;
  content: any; // Specific challenge content - structure varies by type
  difficulty: 'easy' | 'medium' | 'hard';
  xpReward: number;
  suiReward: number;
  tokenReward: number;
  dateCreated: Date | Timestamp;
  expiresAt: Date | Timestamp;
  completed?: boolean;
  progress?: number;
  lastUpdated?: Date | Timestamp;
  rewardClaimed?: boolean;
  rewardClaimedAt?: Date | Timestamp;
}

// Helper function to get today's date at midnight UTC
export const getTodayAtMidnightUTC = (): Date => {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now;
};

// Helper function to get tomorrow's date at midnight UTC
export const getTomorrowAtMidnightUTC = (): Date => {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow;
};

// Get a deterministic seed for daily challenges based on the date
// This ensures all users get the same challenges on a given day
export const getDailySeed = (): string => {
  const today = new Date();
  return `sui-daily-${today.getUTCFullYear()}-${today.getUTCMonth() + 1}-${today.getUTCDate()}`;
};

// Get challenge types for today based on the daily seed
export const getChallengeCategoriesForToday = (): ChallengeType[] => {
  const allTypes: ChallengeType[] = [
    'code_puzzle', 
    'quiz', 
    'bug_hunt', 
    'concept_review', 
    'security_audit', 
    'optimization',
    'defi_scenario',
    'nft_design',
    'math_puzzle'
  ];
  
  // Use the seed to select today's challenge types
  const seed = getDailySeed();
  const seedNum = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  
  // Select 3 challenge types for today
  const selectedTypes: ChallengeType[] = [];
  let tempTypes = [...allTypes];
  
  for (let i = 0; i < 3; i++) {
    const index = (seedNum + i * 7) % tempTypes.length;
    selectedTypes.push(tempTypes[index]);
    tempTypes = tempTypes.filter((_, j) => j !== index);
  }
  
  return selectedTypes;
};

// Generate challenge content using Gemini AI
export const generateChallengeContent = async (
  type: ChallengeType, 
  difficulty: 'easy' | 'medium' | 'hard'
): Promise<any> => {
  try {
    console.log(`Generating ${difficulty} ${type} challenge with Gemini API...`);
    const prompt = getPromptForChallengeType(type, difficulty);
    console.log("Prompt sent to Gemini:", prompt);
    
    const result = await generateWithTimeout(prompt, 15000); // 15 second timeout
    const text = result.response.text();
    
    console.log("===== RAW GEMINI RESPONSE =====");
    console.log(text);
    console.log("===============================");
    
    try {
      // First try to extract JSON from the response using various methods
      let parsedData = await extractJSON(text);
      
      console.log("===== CHALLENGE STRUCTURE DETAILS =====");
      console.log("Challenge type:", type);
      console.log("Challenge structure:", parsedData ? Object.keys(parsedData) : "No data parsed");
      
      if (parsedData) {
        // Log specific details based on challenge type
        switch (type) {
          case 'code_puzzle':
            console.log("Code puzzle details:");
            console.log("- Challenge prompt:", parsedData.challenge?.substring(0, 100) + "...");
            console.log("- Code template length:", parsedData.codeTemplate?.length || 0);
            console.log("- Solution provided:", !!parsedData.solution);
            break;
            
          case 'quiz':
            console.log("Quiz details:");
            console.log("- Question:", parsedData.question?.substring(0, 100) + "...");
            console.log("- Options count:", parsedData.options?.length || 0);
            console.log("- Correct answer index:", parsedData.correctAnswer);
            break;
            
          case 'bug_hunt':
            console.log("Bug hunt details:");
            console.log("- Scenario:", parsedData.scenario?.substring(0, 100) + "...");
            console.log("- Code length:", parsedData.buggyCode?.length || 0);
            console.log("- Bugs count:", parsedData.bugs?.length || 0);
            break;
            
          case 'concept_review':
            console.log("Concept review details:");
            console.log("- Concept:", parsedData.concept);
            console.log("- Description:", parsedData.description?.substring(0, 100) + "...");
            console.log("- Question prompt:", parsedData.questionPrompt?.substring(0, 100) + "...");
            console.log("- Key points count:", parsedData.keyPoints?.length || 0);
            break;
            
          default:
            console.log("Other challenge type, generic structure:", parsedData);
        }
      }
      console.log("====================================");
      
      // Validate the extracted content
      if (parsedData && isValidChallengeContent(parsedData, type)) {
        console.log("Successfully parsed and validated challenge content");
        return parsedData;
      } else {
        console.log("Generated content failed validation, using fallback...");
        return getFallbackContent(type, difficulty);
      }
    } catch (error) {
      console.error("Error parsing Gemini response:", error);
      return getFallbackContent(type, difficulty);
    }
  } catch (error) {
    console.error("Error generating challenge with Gemini:", error);
    return getFallbackContent(type, difficulty);
  }
};

// Helper function to extract JSON from text using multiple methods
const extractJSON = async (text: string): Promise<any | null> => {
  console.log("Attempting to parse Gemini response as JSON...");
  
  // Method 1: Look for JSON block between markdown code fences
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    console.log("Found JSON block in code fences, attempting to parse");
    const jsonText = jsonMatch[1].trim();
    try {
      const parsedJson = JSON.parse(jsonText);
      console.log("Successfully parsed JSON from code block");
      return parsedJson;
    } catch (e) {
      console.log("Failed to parse JSON from code block, trying to fix malformed JSON");
      console.log("Error:", e.message);
      console.log("Problematic JSON:", jsonText);
      
      // Try to fix common JSON issues (unescaped quotes, trailing commas)
      const fixedJson = fixMalformedJson(jsonText);
      console.log("Fixed JSON:", fixedJson);
      
      try {
        const parsedFixedJson = JSON.parse(fixedJson);
        console.log("Successfully parsed fixed JSON");
        return parsedFixedJson;
      } catch (e2) {
        console.log("Still failed to parse after fixing JSON:", e2.message);
      }
    }
  }
  
  // Method 2: Try to extract any JSON-like structure from the text
  console.log("No JSON block in code fences, trying to find JSON object in text");
  const jsonObjectMatch = text.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    const jsonText = jsonObjectMatch[0].trim();
    console.log("Found potential JSON object:", jsonText.substring(0, 100) + "...");
    
    try {
      const parsedJson = JSON.parse(jsonText);
      console.log("Successfully parsed JSON object from text");
      return parsedJson;
    } catch (e) {
      console.log("Failed to parse JSON object, trying to fix malformed JSON");
      console.log("Error:", e.message);
      
      const fixedJson = fixMalformedJson(jsonText);
      console.log("Fixed JSON:", fixedJson.substring(0, 100) + "...");
      
      try {
        const parsedFixedJson = JSON.parse(fixedJson);
        console.log("Successfully parsed fixed JSON object");
        return parsedFixedJson;
      } catch (e2) {
        console.log("Still failed to parse after fixing JSON object:", e2.message);
      }
    }
  }
  
  console.error("Could not extract valid JSON from response");
  return null;
};

// Helper function to fix common JSON parsing issues
const fixMalformedJson = (jsonText: string): string => {
  console.log("===== FIXING MALFORMED JSON =====");
  console.log("Original JSON:", jsonText.substring(0, 100) + (jsonText.length > 100 ? "..." : ""));
  
  let fixed = jsonText;
  
  // Fix unescaped quotes in strings
  const before1 = fixed;
  fixed = fixed.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) => {
    // Replace any unescaped quotes inside the string with escaped quotes
    return match.replace(/(?<!\\)"/g, '\\"');
  });
  if (before1 !== fixed) {
    console.log("Fixed unescaped quotes");
  }
  
  // Fix trailing commas in objects and arrays
  const before2 = fixed;
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  if (before2 !== fixed) {
    console.log("Fixed trailing commas");
  }
  
  // Fix missing quotes around property names
  const before3 = fixed;
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z0-9_$]+)(\s*:)/g, '$1"$2"$3');
  if (before3 !== fixed) {
    console.log("Fixed missing quotes around property names");
  }
  
  // Fix single quotes used instead of double quotes
  const before4 = fixed;
  fixed = fixed.replace(/'/g, '"');
  if (before4 !== fixed) {
    console.log("Fixed single quotes to double quotes");
  }
  
  // Remove any control characters that might break JSON
  const before5 = fixed;
  fixed = fixed.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  if (before5 !== fixed) {
    console.log("Removed control characters");
  }
  
  console.log("Fixed JSON:", fixed.substring(0, 100) + (fixed.length > 100 ? "..." : ""));
  console.log("===== END JSON FIXING =====");
  
  return fixed;
};

// Get the appropriate prompt for each challenge type
const getPromptForChallengeType = (type: ChallengeType, difficulty: 'easy' | 'medium' | 'hard'): string => {
  const difficultyLevel = difficulty === 'easy' ? 'beginner' : 
                        difficulty === 'medium' ? 'intermediate' : 'advanced';
  
  // Common prompt prefix that emphasizes proper JSON formatting
  const promptPrefix = `Create a ${difficultyLevel}-level challenge about Sui blockchain for educational purposes.

IMPORTANT: Your response MUST be a single, valid, properly formatted JSON object with no additional text or explanations.
Do not include backticks or 'json' markers in your response.
Use double quotes for strings and property names.
Ensure all JSON syntax is correct with proper commas, braces, and no trailing commas.

`;

  switch (type) {
    case 'code_puzzle':
      return promptPrefix + 
        'Create a Sui Move coding puzzle for ' + difficultyLevel + ' blockchain developers. ' +
        'Include a detailed explanation of the coding task, code template with TODOs, correct solution, and 2 hints.' +
        'Structure: challenge, codeTemplate, solution, hint1, hint2.';

    case 'quiz':
      return promptPrefix + 
        'Create a quiz question about Sui blockchain development for ' + difficultyLevel + ' level developers. ' +
        'Include a detailed question, 4 answer options, correct answer index (0-3), and explanation. ' +
        'Structure: question, options (array), correctAnswer (number), explanation.';

    case 'bug_hunt':
      return promptPrefix + 
        'Create a bug hunting challenge in Sui Move code for ' + difficultyLevel + ' blockchain developers. ' +
        'Include a scenario description, buggy code, and ' + (difficulty === 'easy' ? '1' : difficulty === 'medium' ? '2' : '3') + ' bugs with lineHint, description, and fix for each. ' +
        'Structure: scenario, buggyCode, bugs (array of objects with lineHint, description, fix).';

    case 'concept_review':
      return promptPrefix + 
        'Create a conceptual review challenge about Sui blockchain fundamentals for ' + difficultyLevel + ' developers. ' +
        'Include concept name, detailed explanation, question prompt, key points (array), and practical example. ' +
        'Structure: concept, description, questionPrompt, keyPoints (array), practicalExample.';

    case 'security_audit':
      return promptPrefix + 
        'Create a security audit challenge for a Sui Move smart contract for ' + difficultyLevel + ' developers. ' +
        'Include context, contract code, and ' + (difficulty === 'easy' ? '1-2' : difficulty === 'medium' ? '2-3' : '3-4') + ' security issues with severity, description, location, and recommendation. ' +
        'Structure: scenario, contractCode, securityIssues (array of objects with severity, description, location, recommendation).';

    default:
      return promptPrefix + 
        'Create an interactive challenge about Sui blockchain development for ' + difficultyLevel + ' developers. ' +
        'Include title, description, specific task, correct solution, and hints (array). ' +
        'Structure: title, description, task, solution, hints (array).';
  }
};

// Get fallback content in case generation fails
const getFallbackContent = (type: ChallengeType, difficulty: 'easy' | 'medium' | 'hard'): any => {
  switch (type) {
    case 'code_puzzle':
      return {
        challenge: "Create a function to transfer an NFT between two addresses",
        codeTemplate: "module example::nft_transfer {\n    // TODO: Implement transfer_nft function\n}",
        solution: "module example::nft_transfer {\n    use sui::transfer;\n    use sui::object::{Self, UID};\n    use sui::tx_context::{Self, TxContext};\n\n    public fun transfer_nft<T: key>(nft: T, recipient: address) {\n        transfer::transfer(nft, recipient);\n    }\n}",
        hint1: "Use the transfer module from the Sui framework",
        hint2: "You need to implement a generic function that works with any object type"
      };
      
    case 'quiz':
      return {
        question: "What is the purpose of the 'key' ability in Sui Move?",
        options: [
          "It allows a struct to be stored as a global state object",
          "It makes a struct immutable",
          "It enables a struct to be used as a generic parameter",
          "It restricts access to struct fields"
        ],
        correctAnswer: 0,
        explanation: "The 'key' ability in Sui Move allows a struct to be stored as a global state object with a unique ID. This is essential for creating objects that exist on-chain and can be transferred between addresses."
      };
      
    case 'bug_hunt':
      return {
        scenario: "This code is supposed to create and transfer an NFT",
        buggyCode: "module example::buggy_nft {\n    use sui::transfer;\n    use sui::object::{Self, UID};\n    use sui::tx_context::{Self, TxContext};\n\n    struct NFT has key {\n        id: UID,\n        name: string,\n        description: string,\n    }\n\n    public fun create_nft(name: string, description: string, ctx: &mut TxContext): NFT {\n        let nft = NFT {\n            id: object::new(ctx),\n            name,\n            description,\n        };\n        nft\n    }\n\n    public fun transfer_nft(nft: NFT, recipient: address) {\n        transfer::transfer(nft, recipient)\n    }\n}",
        bugs: [
          {
            lineHint: "In the struct definition",
            description: "The string type is used but not imported",
            fix: "Add 'use std::string::String;' and change 'string' to 'String'"
          }
        ]
      };
    
    case 'concept_review':
      return {
        concept: "Object Ownership in Sui",
        description: "In Sui, objects can have different ownership models: owned by an address, shared with everyone, or immutable.",
        questionPrompt: "Explain the differences between address-owned, shared, and immutable objects in Sui",
        keyPoints: [
          "Address-owned objects can only be used by their owner",
          "Shared objects can be accessed by anyone but require consensus",
          "Immutable objects can be used by anyone but cannot be modified"
        ],
        practicalExample: "A game item NFT might be address-owned, a marketplace might be shared, and game rules might be immutable"
      };
    
    default:
      return {
        title: "Sui Blockchain Challenge",
        description: "Complete this challenge to test your Sui knowledge",
        content: "Challenge content would appear here if generation succeeded",
        solution: "Solution would appear here"
      };
  }
};

// Check if the challenge content is valid
const isValidChallengeContent = (content: any, type: ChallengeType): boolean => {
  try {
    switch (type) {
      case 'code_puzzle':
        return (
          typeof content === 'object' &&
          typeof content.challenge === 'string' &&
          typeof content.codeTemplate === 'string' &&
          typeof content.solution === 'string'
        );
      
      case 'quiz':
        return (
          typeof content === 'object' &&
          typeof content.question === 'string' &&
          Array.isArray(content.options) &&
          typeof content.correctAnswer === 'number' &&
          typeof content.explanation === 'string'
        );
      
      case 'bug_hunt':
        return (
          typeof content === 'object' &&
          typeof content.scenario === 'string' &&
          typeof content.buggyCode === 'string' &&
          Array.isArray(content.bugs)
        );
      
      case 'concept_review':
        return (
          typeof content === 'object' &&
          typeof content.concept === 'string' &&
          typeof content.description === 'string' &&
          typeof content.questionPrompt === 'string' &&
          Array.isArray(content.keyPoints) &&
          typeof content.practicalExample === 'string'
        );
      
      default:
        return true; // For other types, just ensure we have an object
    }
  } catch (error) {
    console.error(`Error validating ${type} challenge content:`, error);
    return false;
  }
};

// Check if daily challenges exist for a user today, create if not
export const ensureDailyChallengesExist = async (walletAddress: string): Promise<DailyChallenge[]> => {
  try {
    // First check if there are already daily challenges for today
    const today = getTodayAtMidnightUTC();
    const tomorrow = getTomorrowAtMidnightUTC();
    
    const userChallengesRef = collection(db, 'dailyChallenges');
    const challengesQuery = query(
      userChallengesRef,
      where('walletAddress', '==', walletAddress),
      where('dateCreated', '>=', today),
      where('dateCreated', '<', tomorrow)
    );
    
    const challengesSnapshot = await getDocs(challengesQuery);
    
    // If challenges already exist for today, return them
    if (!challengesSnapshot.empty) {
      const challenges: DailyChallenge[] = [];
      challengesSnapshot.forEach(doc => {
        challenges.push({ 
          id: doc.id, 
          ...doc.data() 
        } as DailyChallenge);
      });
      return challenges;
    }
    
    // No challenges for today, generate new ones
    return await generateDailyChallenges(walletAddress);
  } catch (error) {
    console.error("Error ensuring daily challenges exist:", error);
    throw error;
  }
};

// Generate daily challenges and store in Firestore
export const generateDailyChallenges = async (walletAddress: string): Promise<DailyChallenge[]> => {
  try {
    // Get today's challenge categories
    const challengeTypes = getChallengeCategoriesForToday();
    
    // Get the global daily challenges document
    const globalChallengesRef = doc(db, 'globalChallenges', getTodayAtMidnightUTC().toISOString().split('T')[0]);
    const globalChallengesDoc = await getDoc(globalChallengesRef);
    
    let challenges: DailyChallenge[] = [];
    
    // Check if we already have global challenges for today
    if (globalChallengesDoc.exists()) {
      // Use the pre-generated global challenges
      challenges = globalChallengesDoc.data().challenges;
    } else {
      // Try to generate fresh challenges with Gemini
      let useHardcodedChallenges = false;
      
      try {
        // Generate fresh challenges
        const batch = writeBatch(db);
        challenges = [];
        
        // For each challenge type, generate content
        for (let i = 0; i < challengeTypes.length; i++) {
          const type = challengeTypes[i];
          // Determine difficulty based on position
          const difficulty = i === 0 ? 'easy' : i === 1 ? 'medium' : 'hard';
          
          // Generate challenge content with retry logic
          let content;
          let retryCount = 0;
          const maxRetries = 3;
          
          while (retryCount < maxRetries) {
            try {
              content = await generateChallengeContent(type, difficulty);
              // If we got here, generation succeeded
              break;
            } catch (error) {
              retryCount++;
              console.error(`Error generating challenge (attempt ${retryCount}/${maxRetries}):`, error);
              
              if (retryCount >= maxRetries) {
                // All retries failed, use fallback content
                console.warn(`Using fallback content for ${type} challenge after ${maxRetries} failed attempts`);
                content = getFallbackContent(type, difficulty);
              } else {
                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              }
            }
          }
          
          // Create challenge object
          const challenge: DailyChallenge = {
            id: `${type}-${getDailySeed()}-${i}`,
            title: getChallengeTitle(type, difficulty),
            description: getChallengeDescription(type, difficulty),
            type,
            content,
            difficulty,
            xpReward: getXpReward(difficulty),
            suiReward: getSuiReward(difficulty),
            tokenReward: 0.1, // Fixed token reward
            dateCreated: getTodayAtMidnightUTC(),
            expiresAt: getTomorrowAtMidnightUTC(),
          };
          
          challenges.push(challenge);
        }
      } catch (error) {
        console.error("Failed to generate challenges with Gemini:", error);
        useHardcodedChallenges = true;
      }
      
      // If we failed to generate challenges with Gemini, use hardcoded ones
      if (useHardcodedChallenges || challenges.length < 3) {
        console.log("Using hardcoded fallback challenges");
        challenges = getFallbackChallenges();
      }
      
      // Store the global challenges for other users
      await setDoc(globalChallengesRef, {
        challenges,
        dateCreated: getTodayAtMidnightUTC(),
        expiresAt: getTomorrowAtMidnightUTC()
      });
    }
    
    // Now assign these challenges to the user
    const userChallengesRef = collection(db, 'dailyChallenges');
    const batch = writeBatch(db);
    
    for (const challenge of challenges) {
      const userChallengeRef = doc(userChallengesRef);
      batch.set(userChallengeRef, {
        ...challenge,
        walletAddress,
        completed: false,
        progress: 0,
        lastUpdated: serverTimestamp()
      });
    }
    
    await batch.commit();
    
    // Add user challenges to user's progress tracking
    await updateDoc(doc(db, 'learningProgress', walletAddress), {
      lastChallengeGeneration: serverTimestamp(),
      totalDailyChallenges: challenges.length
    });
    
    return challenges;
  } catch (error) {
    console.error("Error generating daily challenges:", error);
    // Return fallback challenges even if storing to Firestore fails
    return getFallbackChallenges();
  }
};

// Helper functions for challenge creation
const getChallengeTitle = (type: ChallengeType, difficulty: 'easy' | 'medium' | 'hard'): string => {
  const titles: Record<ChallengeType, string[]> = {
    code_puzzle: ['Move Code Puzzle', 'Move Programming Challenge', 'Sui Contract Builder'],
    quiz: ['Sui Knowledge Test', 'Blockchain Quiz', 'Sui Concepts Quiz'],
    bug_hunt: ['Debug the Contract', 'Bug Hunter Challenge', 'Find the Bug'],
    concept_review: ['Concept Mastery', 'Blockchain Theory', 'Sui Fundamentals'],
    security_audit: ['Security Guardian', 'Contract Audit', 'Secure the Contract'],
    optimization: ['Optimize the Code', 'Gas Efficiency Quest', 'Performance Tune-up'],
    defi_scenario: ['DeFi Protocol Design', 'Financial Smartness', 'DeFi Solution'],
    nft_design: ['NFT Collection Creator', 'Digital Asset Designer', 'NFT Marketplace'],
    math_puzzle: ['Crypto Math Challenge', 'Blockchain Numerics', 'Algorithm Adventure']
  };
  
  // Use the daily seed to select a consistent title
  const seed = getDailySeed();
  const seedNum = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const index = seedNum % titles[type].length;
  
  // Add difficulty qualifier
  const diffPrefix = difficulty === 'easy' ? 'Basic' : 
                    difficulty === 'medium' ? 'Advanced' : 'Expert';
  
  return `${diffPrefix} ${titles[type][index]}`;
};

const getChallengeDescription = (type: ChallengeType, difficulty: 'easy' | 'medium' | 'hard'): string => {
  switch (type) {
    case 'code_puzzle':
      return "Solve this Sui Move coding puzzle to demonstrate your skills in blockchain programming.";
    case 'quiz':
      return "Test your knowledge of Sui blockchain concepts with this quiz challenge.";
    case 'bug_hunt':
      return "Find and fix the bugs in this Sui Move smart contract code.";
    case 'concept_review':
      return "Review and apply this key Sui blockchain concept in a practical context.";
    case 'security_audit':
      return "Audit this smart contract to identify and fix security vulnerabilities.";
    case 'optimization':
      return "Optimize this smart contract code to improve performance and reduce gas costs.";
    case 'defi_scenario':
      return "Design a DeFi protocol solution for this real-world financial scenario.";
    case 'nft_design':
      return "Create an NFT collection design following these specifications.";
    case 'math_puzzle':
      return "Solve this mathematical challenge related to blockchain algorithms.";
  }
};

const getXpReward = (difficulty: 'easy' | 'medium' | 'hard'): number => {
  switch (difficulty) {
    case 'easy': return 50;
    case 'medium': return 100;
    case 'hard': return 200;
  }
};

const getSuiReward = (difficulty: 'easy' | 'medium' | 'hard'): number => {
  switch (difficulty) {
    case 'easy': return 0.05;
    case 'medium': return 0.1;
    case 'hard': return 0.2;
  }
};

// Update challenge progress
export const updateChallengeProgress = async (
  challengeId: string,
  walletAddress: string,
  progress: number
): Promise<void> => {
  try {
    // Find the user's challenge
    const userChallengesRef = collection(db, 'dailyChallenges');
    const challengesQuery = query(
      userChallengesRef,
      where('id', '==', challengeId),
      where('walletAddress', '==', walletAddress)
    );
    
    const challengesSnapshot = await getDocs(challengesQuery);
    
    if (challengesSnapshot.empty) {
      throw new Error(`Challenge ${challengeId} not found for user ${walletAddress}`);
    }
    
    // Update the challenge progress
    const challengeDoc = challengesSnapshot.docs[0];
    await updateDoc(challengeDoc.ref, {
      progress,
      lastUpdated: serverTimestamp(),
      completed: progress >= 100
    });
    
    // If challenge is completed, update user stats
    if (progress >= 100) {
      const challengeData = challengeDoc.data() as DailyChallenge;
      
      // Update user's XP
      await updateDoc(doc(db, 'learningProgress', walletAddress), {
        xp: increment(challengeData.xpReward),
        totalXpEarned: increment(challengeData.xpReward),
        dailyChallengesCompleted: increment(1),
        lastUpdated: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Error updating challenge progress:", error);
    throw error;
  }
};

// Complete a challenge and claim rewards
export const completeChallengeAndClaimRewards = async (
  challengeId: string,
  walletAddress: string
): Promise<{ success: boolean, reward: number, xpReward: number }> => {
  try {
    console.log(`Claiming rewards for challenge ${challengeId} by wallet ${walletAddress}`);
    
    // Find the user's challenge
    const userChallengesRef = collection(db, 'dailyChallenges');
    const challengesQuery = query(
      userChallengesRef,
      where('id', '==', challengeId),
      where('walletAddress', '==', walletAddress)
    );
    
    const challengesSnapshot = await getDocs(challengesQuery);
    
    if (challengesSnapshot.empty) {
      console.error(`Challenge ${challengeId} not found for user ${walletAddress}`);
      throw new Error(`Challenge ${challengeId} not found for user ${walletAddress}`);
    }
    
    const challengeDoc = challengesSnapshot.docs[0];
    const challengeData = challengeDoc.data() as DailyChallenge;
    
    if (!challengeData.completed) {
      console.error(`Challenge ${challengeId} is not completed yet`);
      throw new Error(`Challenge ${challengeId} is not completed yet`);
    }
    
    // Check if rewards already claimed
    if (challengeData.rewardClaimed) {
      console.error(`Rewards for challenge ${challengeId} already claimed`);
      throw new Error(`Rewards for challenge ${challengeId} already claimed`);
    }
    
    console.log(`Processing rewards: ${challengeData.tokenReward} SUI and ${challengeData.xpReward} XP`);
    
    // Mark as rewards claimed
    await updateDoc(challengeDoc.ref, {
      rewardClaimed: true,
      rewardClaimedAt: serverTimestamp()
    });
    
    // Update user's SUI tokens
    await updateDoc(doc(db, 'learningProgress', walletAddress), {
      suiTokens: increment(challengeData.tokenReward),
      totalSuiEarned: increment(challengeData.tokenReward),
      xp: increment(challengeData.xpReward),      // Add XP directly
      totalXpEarned: increment(challengeData.xpReward),  // Update total XP earned
      lastUpdated: serverTimestamp()
    });
    
    console.log(`Updated user stats with ${challengeData.tokenReward} SUI and ${challengeData.xpReward} XP`);
    
    // Record the transaction
    await setDoc(doc(collection(db, 'transactions')), {
      walletAddress,
      amount: challengeData.tokenReward,
      xpAmount: challengeData.xpReward,
      reason: `Daily Challenge Reward: ${challengeData.title}`,
      type: 'challenge_reward',
      challengeId,
      timestamp: serverTimestamp()
    });
    
    return {
      success: true,
      reward: challengeData.tokenReward,
      xpReward: challengeData.xpReward
    };
  } catch (error) {
    console.error("Error completing challenge and claiming rewards:", error);
    throw error;
  }
};

// Get all daily challenges for a user
export const getUserDailyChallenges = async (walletAddress: string): Promise<DailyChallenge[]> => {
  try {
    // Ensure daily challenges exist
    try {
      await ensureDailyChallengesExist(walletAddress);
    } catch (error) {
      console.error("Error creating daily challenges:", error);
      // Return empty challenges instead of failing completely
      return [];
    }
    
    // Get today's challenges
    const today = getTodayAtMidnightUTC();
    const tomorrow = getTomorrowAtMidnightUTC();
    
    const userChallengesRef = collection(db, 'dailyChallenges');
    const challengesQuery = query(
      userChallengesRef,
      where('walletAddress', '==', walletAddress),
      where('dateCreated', '>=', today),
      where('dateCreated', '<', tomorrow)
    );
    
    const challengesSnapshot = await getDocs(challengesQuery);
    
    const challenges: DailyChallenge[] = [];
    challengesSnapshot.forEach(doc => {
      try {
        const data = doc.data();
        challenges.push({ 
          id: doc.id, 
          ...data 
        } as DailyChallenge);
      } catch (docError) {
        console.error("Error parsing challenge document:", docError);
        // Skip this document but continue with others
      }
    });
    
    return challenges;
  } catch (error) {
    console.error("Error getting user daily challenges:", error);
    // Return empty array instead of throwing to prevent UI breakage
    return [];
  }
}; 