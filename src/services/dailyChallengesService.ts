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
import { 
  ChallengeType, 
  DeprecatedChallengeType, 
  AnyHistoricalChallengeType,
  isValidChallengeType,
  getReplacementChallengeType
} from './challengeTypes';
import { sendSuiReward } from '@/utils/suiPaymentService';

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
// Always returns exactly 3 challenge types
export const getChallengeCategoriesForToday = (): ChallengeType[] => {
  const allTypes: ChallengeType[] = [
    'code_puzzle', 
    'quiz', 
    'concept_review', 
    'security_audit', 
    'optimization',
    'defi_scenario'
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
  
  // Ensure we always return exactly 3 types
  if (selectedTypes.length < 3) {
    // If somehow we got fewer than 3 (shouldn't happen), add some defaults
    const defaultTypes: ChallengeType[] = ['quiz', 'code_puzzle', 'concept_review'];
    for (let i = selectedTypes.length; i < 3; i++) {
      selectedTypes.push(defaultTypes[i % defaultTypes.length]);
    }
  }
  
  return selectedTypes.slice(0, 3); // Guarantee exactly 3 types
};

// Enhanced logging for Gemini API responses
const logGeminiResponse = (type: ChallengeType, prompt: string, response: string, parsedData: any) => {
  
  
  
  
  if (parsedData) {
    
    
    // Log specific properties based on challenge type
    switch (type as AnyHistoricalChallengeType) {
      case 'math_puzzle':
        
        
        
        
        
        
        
        break;
        
      case 'security_audit':
        
        
        
        
        break;
        
      // Add similar logging for other challenge types
    }
  } else {
    
  }
  
  
};

// Generate challenge content using Gemini AI
export const generateChallengeContent = async (
  type: ChallengeType, 
  difficulty: 'easy' | 'medium' | 'hard'
): Promise<any> => {
  try {
    
    const prompt = getPromptForChallengeType(type, difficulty);
    
    
    const result = await generateWithTimeout(prompt, 15000); // 15 second timeout
    const text = result.response.text();
    
    
    
    
    
    try {
      // First try to extract JSON from the response using various methods
      let parsedData = await extractJSON(text);
      
      
      
      
      // Log detailed information about the parsed challenge content
      if (parsedData) {
        
        
        // Log specific details based on challenge type
        switch (type as AnyHistoricalChallengeType) {
          case 'math_puzzle':
            
            
            
            
            
            
            
            
            break;
            
          case 'security_audit':
            
            
            
            
            break;
            
          case 'quiz':
            
            
            
            
            break;
            
          case 'optimization':
            
            
            
            
            break;
            
          default:
            
        }
      } else {
        
      }
      
      
      // Validate the extracted content
      if (parsedData && isValidChallengeContent(parsedData, type)) {
        
        return parsedData;
      } else {
        
        return getMultipleFallbackContent(type, difficulty);
      }
    } catch (error) {
      
      return getMultipleFallbackContent(type, difficulty);
    }
  } catch (error) {
    
    return getMultipleFallbackContent(type, difficulty);
  }
};

// Helper function to extract JSON from text using multiple methods
const extractJSON = async (text: string): Promise<any | null> => {
  
  
  // Method 1: Look for JSON block between markdown code fences
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    
    const jsonText = jsonMatch[1].trim();
    try {
      const parsedJson = JSON.parse(jsonText);
      
      return parsedJson;
    } catch (e) {
      
      
      
      
      // Try to fix common JSON issues (unescaped quotes, trailing commas)
      const fixedJson = fixMalformedJson(jsonText);
      
      
      try {
        const parsedFixedJson = JSON.parse(fixedJson);
        
        return parsedFixedJson;
      } catch (e2) {
        
      }
    }
  }
  
  // Method 2: Try to extract any JSON-like structure from the text
  
  const jsonObjectMatch = text.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    const jsonText = jsonObjectMatch[0].trim();
    
    
    try {
      const parsedJson = JSON.parse(jsonText);
      
      return parsedJson;
    } catch (e) {
      
      
      
      const fixedJson = fixMalformedJson(jsonText);
      
      
      try {
        const parsedFixedJson = JSON.parse(fixedJson);
        
        return parsedFixedJson;
      } catch (e2) {
        
      }
    }
  }
  
  
  return null;
};

// Helper function to fix common JSON parsing issues
const fixMalformedJson = (jsonText: string): string => {
  
  
  
  let fixed = jsonText;
  
  // Fix unescaped quotes in strings
  const before1 = fixed;
  fixed = fixed.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) => {
    // Replace any unescaped quotes inside the string with escaped quotes
    return match.replace(/(?<!\\)"/g, '\\"');
  });
  if (before1 !== fixed) {
    
  }
  
  // Fix trailing commas in objects and arrays
  const before2 = fixed;
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  if (before2 !== fixed) {
    
  }
  
  // Fix missing quotes around property names
  const before3 = fixed;
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z0-9_$]+)(\s*:)/g, '$1"$2"$3');
  if (before3 !== fixed) {
    
  }
  
  // Fix single quotes used instead of double quotes
  const before4 = fixed;
  fixed = fixed.replace(/'/g, '"');
  if (before4 !== fixed) {
    
  }
  
  // Remove any control characters that might break JSON
  const before5 = fixed;
  fixed = fixed.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  if (before5 !== fixed) {
    
  }
  
  
  
  
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

  switch (type as AnyHistoricalChallengeType) {
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

    case 'optimization':
      return promptPrefix + 
        'Create a code optimization challenge for Sui Move for ' + difficultyLevel + ' developers. ' +
        'Include a scenario, original inefficient code, optimization goals (array), hints (array), sample optimized solution, and ' +
        (difficulty === 'easy' ? '2-3' : difficulty === 'medium' ? '3-4' : '4-5') + ' optimization points with description and explanation. ' +
        'Structure: scenario, originalCode, optimizationGoals (array), hints (array), sampleSolution, optimizationPoints (array of objects with description, explanation).';

    case 'defi_scenario':
      return promptPrefix + 
        'Create a DeFi decision scenario challenge for ' + difficultyLevel + ' blockchain developers. ' +
        'Include a title, introduction, a map of steps (each with description and options), a firstStepId, and conclusion messages for success/failure. ' +
        'Each option should have id, text, outcome message, isCorrect flag, and optionally a nextStep id. ' +
        'Structure: title, introduction, steps (object map of step objects), firstStepId, conclusion (object with success and failure messages).';

    default:
      return promptPrefix + 
        'Create an interactive challenge about Sui blockchain development for ' + difficultyLevel + ' developers. ' +
        'Include title, description, specific task, correct solution, and hints (array). ' +
        'Structure: title, description, task, solution, hints (array).';
  }
};

// Get fallback content with multiple options for each challenge type
const getMultipleFallbackContent = (type: ChallengeType, difficulty: 'easy' | 'medium' | 'hard'): any => {
  // Get the daily seed to select a consistent fallback for the day
  const seed = getDailySeed();
  const seedNum = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  
  // Log that we're using fallback content
  
  
  // Define multiple fallback options based on challenge type
  let fallbackOptions: any[] = [];
  
  switch (type as AnyHistoricalChallengeType) {
    case 'math_puzzle':
      
      fallbackOptions = [
        // Option 1: Validator voting power
        {
          question: "In a Sui blockchain, a validator set has 10 validators with different voting powers. If a transaction requires at least 2/3 of the total voting power to reach consensus, and the voting powers (in stake units) are distributed as [100, 90, 80, 70, 60, 50, 40, 30, 20, 10], what is the minimum number of validators needed to reach consensus?",
          equation: "\\sum_{i=1}^{n} VP_i \\geq \\frac{2}{3} \\cdot \\sum_{i=1}^{10} VP_i",
          context: "In Sui blockchain, consensus requires at least 2/3 of the total voting power. The voting power of each validator is proportional to their staked SUI tokens. Understanding the minimum validator set needed for consensus is crucial for security analysis.",
          hint1: "First calculate the total voting power across all validators, then find the threshold needed for consensus (2/3 of total).",
          hint2: "Sort the validators by voting power (highest first) and add them up until you reach or exceed the threshold.",
          solution: "The total voting power is 100+90+80+70+60+50+40+30+20+10 = 550. The 2/3 threshold is 550 × (2/3) = 366.67. Starting with the highest voting powers: 100+90+80+70 = 340, which is less than the threshold. Adding the next validator: 340+60 = 400, which exceeds the threshold. Therefore, 5 validators are needed.",
          answer: "5"
        },
        // Option 2: Gas calculation
        {
          question: "A Sui Move transaction consumes gas based on computation, storage, and IO operations. If a transaction performs 5 computation units (10 gas each), 3 storage writes (20 gas each), and 2 IO operations (15 gas each), and the gas price is set at 0.5 SUI per 1000 gas units, how much will the transaction cost in SUI?",
          equation: "Cost = (Computation + Storage + IO) × GasPrice",
          context: "Gas fees in Sui blockchain compensate validators for the computational resources used to process transactions. Understanding gas calculations helps developers optimize their smart contracts for cost efficiency.",
          hint1: "Calculate the total gas units by summing all operations: computation (5 × 10), storage (3 × 20), and IO (2 × 15).",
          hint2: "Convert the total gas units to SUI by multiplying by the gas price (0.5 SUI per 1000 gas units).",
          solution: "Computation: 5 × 10 = 50 gas units\nStorage: 3 × 20 = 60 gas units\nIO: 2 × 15 = 30 gas units\nTotal gas: 50 + 60 + 30 = 140 gas units\nCost in SUI: 140 × (0.5/1000) = 0.07 SUI",
          answer: "0.07"
        },
        // Option 3: Merkle tree
        {
          question: "In a Merkle tree used for blockchain transaction verification, how many leaf nodes are needed to construct a balanced binary Merkle tree of height 4 (where the leaf nodes are at level 0)?",
          equation: "Leaf nodes = 2^h (where h is the height)",
          context: "Merkle trees are fundamental data structures in blockchains, allowing efficient verification of large data sets. In Sui, they're used for transaction verification and state proofs.",
          hint1: "In a balanced binary tree, each level l has 2^l nodes, with leaf nodes at level 0.",
          hint2: "For a tree of height h, the number of leaf nodes is 2^h.",
          solution: "In a binary Merkle tree of height 4, the leaf nodes are at level 0, and there are 2^4 = 16 leaf nodes. This allows the construction of a balanced tree with 8 nodes at level 1, 4 nodes at level 2, 2 nodes at level 3, and 1 root node at level 4.",
          answer: "16"
        }
      ];
      break;
      
    case 'security_audit':
      fallbackOptions = [
        // Option 1: Basic token with access control issues
        {
          scenario: "This smart contract implements a basic token with transfer functionality",
          contractCode: "module example::basic_token {\n    use sui::transfer;\n    use sui::object::{Self, UID};\n    use sui::tx_context::{Self, TxContext};\n\n    struct Token has key {\n        id: UID,\n        amount: u64,\n        owner: address\n    }\n\n    struct TokenCap has key {\n        id: UID\n    }\n\n    fun init(ctx: &mut TxContext) {\n        transfer::transfer(\n            TokenCap { id: object::new(ctx) },\n            tx_context::sender(ctx)\n        )\n    }\n\n    public fun create_token(amount: u64, recipient: address, ctx: &mut TxContext) {\n        let token = Token {\n            id: object::new(ctx),\n            amount,\n            owner: recipient\n        };\n        transfer::transfer(token, recipient);\n    }\n\n    public fun transfer_token(token: Token, recipient: address) {\n        token.owner = recipient;\n        transfer::transfer(token, recipient);\n    }\n}",
          securityIssues: [
            {
              severity: "high",
              description: "Anyone can create tokens without authorization",
              location: "create_token function has no access control",
              recommendation: "Add a TokenCap parameter to the create_token function to ensure only the capability holder can create tokens"
            },
            {
              severity: "medium",
              description: "Redundant owner field",
              location: "Token struct includes an owner field",
              recommendation: "Remove the owner field as Sui already tracks object ownership"
            }
          ]
        },
        // Option 2: NFT marketplace with vulnerabilities
        {
          scenario: "This smart contract implements a simple NFT marketplace where users can list and buy NFTs",
          contractCode: "module example::nft_marketplace {\n    use sui::transfer;\n    use sui::coin::{Self, Coin};\n    use sui::sui::SUI;\n    use sui::object::{Self, ID, UID};\n    use sui::tx_context::{Self, TxContext};\n    use std::option::{Self, Option};\n\n    struct Listing has key, store {\n        id: UID,\n        nft_id: ID,\n        price: u64,\n        owner: address\n    }\n\n    struct NFT has key, store {\n        id: UID,\n        name: std::string::String,\n        description: std::string::String,\n        url: std::string::String\n    }\n\n    public fun list_nft(nft: NFT, price: u64, ctx: &mut TxContext) {\n        let nft_id = object::id(&nft);\n        let listing = Listing {\n            id: object::new(ctx),\n            nft_id,\n            price,\n            owner: tx_context::sender(ctx)\n        };\n        transfer::public_share_object(listing);\n        transfer::public_share_object(nft);\n    }\n\n    public fun buy_nft(listing: &mut Listing, nft: NFT, payment: Coin<SUI>, ctx: &mut TxContext) {\n        assert!(object::id(&nft) == listing.nft_id, 0);\n        assert!(coin::value(&payment) >= listing.price, 1);\n        \n        transfer::public_transfer(nft, tx_context::sender(ctx));\n        transfer::public_transfer(payment, listing.owner);\n    }\n}",
          securityIssues: [
            {
              severity: "high",
              description: "No validation that NFT matches listing when buying",
              location: "buy_nft function assertion",
              recommendation: "Add proper validation to ensure the NFT being purchased matches the listing"
            },
            {
              severity: "high",
              description: "Missing refund for excess payment",
              location: "buy_nft function",
              recommendation: "If payment exceeds the price, the excess should be refunded to the buyer"
            },
            {
              severity: "medium",
              description: "NFTs become shared objects when listed",
              location: "list_nft function",
              recommendation: "Use a proper escrow pattern instead of making NFTs shared objects"
            }
          ]
        },
        // Option 3: Vulnerable staking contract
        {
          scenario: "This smart contract implements a staking mechanism for earning rewards",
          contractCode: "module example::staking {\n    use sui::balance::{Self, Balance};\n    use sui::coin::{Self, Coin};\n    use sui::object::{Self, UID};\n    use sui::sui::SUI;\n    use sui::transfer;\n    use sui::tx_context::{Self, TxContext};\n    use std::vector;\n\n    struct StakingPool has key {\n        id: UID,\n        staked_coins: Balance<SUI>,\n        reward_pool: Balance<SUI>,\n        stakers: vector<address>,\n        reward_rate: u64\n    }\n\n    struct StakeReceipt has key {\n        id: UID,\n        amount: u64,\n        timestamp: u64,\n        owner: address\n    }\n\n    public fun stake(pool: &mut StakingPool, coin: Coin<SUI>, ctx: &mut TxContext) {\n        let amount = coin::value(&coin);\n        let balance = coin::into_balance(coin);\n        balance::join(&mut pool.staked_coins, balance);\n        \n        vector::push_back(&mut pool.stakers, tx_context::sender(ctx));\n        \n        let receipt = StakeReceipt {\n            id: object::new(ctx),\n            amount,\n            timestamp: tx_context::epoch(ctx),\n            owner: tx_context::sender(ctx)\n        };\n        \n        transfer::transfer(receipt, tx_context::sender(ctx));\n    }\n\n    public fun unstake(pool: &mut StakingPool, receipt: StakeReceipt, ctx: &mut TxContext) {\n        let StakeReceipt { id, amount, timestamp, owner } = receipt;\n        object::delete(id);\n        \n        let current_epoch = tx_context::epoch(ctx);\n        let epochs_staked = current_epoch - timestamp;\n        let reward = (amount * pool.reward_rate * epochs_staked) / 10000;\n        \n        let principal = balance::split(&mut pool.staked_coins, amount);\n        let rewards = balance::split(&mut pool.reward_pool, reward);\n        \n        balance::join(&mut principal, rewards);\n        let return_coin = coin::from_balance(principal, ctx);\n        \n        transfer::transfer(return_coin, owner);\n    }\n}",
          securityIssues: [
            {
              severity: "critical",
              description: "No verification of receipt ownership",
              location: "unstake function",
              recommendation: "Verify that tx_context::sender(ctx) matches the receipt.owner to prevent theft of staked funds"
            },
            {
              severity: "high",
              description: "Possible arithmetic overflow",
              location: "reward calculation in unstake function",
              recommendation: "Use checked arithmetic or ensure the reward calculation cannot overflow"
            },
            {
              severity: "high",
              description: "No validation of reward pool balance",
              location: "unstake function",
              recommendation: "Check if the reward pool has sufficient balance before calculating rewards"
            },
            {
              severity: "medium",
              description: "Stakers vector grows unbounded",
              location: "stake function",
              recommendation: "Use a more efficient data structure or remove addresses when unstaking"
            }
          ]
        }
      ];
      break;
      
    // Add more challenge types here with multiple fallback options...
      
    default:
      // For other challenge types, just use the single fallback content
      fallbackOptions = [getFallbackContent(type, difficulty)];
      break;
  }
  
  // Select one fallback option based on the daily seed
  const selectedIndex = seedNum % fallbackOptions.length;
  const selectedFallback = fallbackOptions[selectedIndex];
  
  
  
  return selectedFallback;
};

// Keep the original getFallbackContent function as a fallback for challenge types without multiple options
const getFallbackContent = (type: ChallengeType, difficulty: 'easy' | 'medium' | 'hard'): any => {
  switch (type as AnyHistoricalChallengeType) {
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
    
    case 'security_audit':
      return {
        scenario: "This smart contract implements a basic token with transfer functionality",
        contractCode: "module example::basic_token {\n    use sui::transfer;\n    use sui::object::{Self, UID};\n    use sui::tx_context::{Self, TxContext};\n\n    struct Token has key {\n        id: UID,\n        amount: u64,\n        owner: address\n    }\n\n    struct TokenCap has key {\n        id: UID\n    }\n\n    fun init(ctx: &mut TxContext) {\n        transfer::transfer(\n            TokenCap { id: object::new(ctx) },\n            tx_context::sender(ctx)\n        )\n    }\n\n    public fun create_token(amount: u64, recipient: address, ctx: &mut TxContext) {\n        let token = Token {\n            id: object::new(ctx),\n            amount,\n            owner: recipient\n        };\n        transfer::transfer(token, recipient);\n    }\n\n    public fun transfer_token(token: Token, recipient: address) {\n        token.owner = recipient;\n        transfer::transfer(token, recipient);\n    }\n}",
        securityIssues: [
          {
            severity: "high",
            description: "Anyone can create tokens without authorization",
            location: "create_token function has no access control",
            recommendation: "Add a TokenCap parameter to the create_token function to ensure only the capability holder can create tokens"
          },
          {
            severity: "medium",
            description: "Redundant owner field",
            location: "Token struct includes an owner field",
            recommendation: "Remove the owner field as Sui already tracks object ownership"
          }
        ]
      };

    case 'optimization':
      return {
        scenario: "This smart contract implements a basic counter that can be incremented by anyone",
        originalCode: "module example::counter {\n    use sui::object::{Self, UID};\n    use sui::transfer;\n    use sui::tx_context::{Self, TxContext};\n\n    struct Counter has key {\n        id: UID,\n        value: u64,\n    }\n\n    public fun create(ctx: &mut TxContext) {\n        let counter = Counter {\n            id: object::new(ctx),\n            value: 0,\n        };\n        transfer::share_object(counter);\n    }\n\n    public fun increment(counter: &mut Counter) {\n        let current = counter.value;\n        let new_value = current + 1;\n        counter.value = new_value;\n    }\n\n    public fun get_value(counter: &Counter): u64 {\n        return counter.value;\n    }\n}",
        optimizationGoals: [
          "Improve the increment function efficiency",
          "Reduce unnecessary operations",
          "Optimize gas usage"
        ],
        hints: [
          "Look for redundant variable assignments",
          "Consider direct operations instead of intermediate variables"
        ],
        sampleSolution: "module example::counter {\n    use sui::object::{Self, UID};\n    use sui::transfer;\n    use sui::tx_context::{Self, TxContext};\n\n    struct Counter has key {\n        id: UID,\n        value: u64,\n    }\n\n    public fun create(ctx: &mut TxContext) {\n        transfer::share_object(Counter {\n            id: object::new(ctx),\n            value: 0,\n        });\n    }\n\n    public fun increment(counter: &mut Counter) {\n        counter.value = counter.value + 1;\n    }\n\n    public fun get_value(counter: &Counter): u64 {\n        counter.value\n    }\n}",
        optimizationPoints: [
          {
            description: "Eliminate intermediate variables in increment function",
            explanation: "The original code uses unnecessary temporary variables. Direct assignment is more efficient."
          },
          {
            description: "Remove explicit return statement in get_value function",
            explanation: "In Move, the last expression is automatically returned, making the return keyword redundant."
          },
          {
            description: "Inline Counter creation before sharing",
            explanation: "Creating the object inline reduces one variable assignment, making the code more concise."
          }
        ]
      };
      
    case 'defi_scenario':
      return {
        title: "Liquidity Pool Investment Decision",
        introduction: "You are a DeFi investor with 1,000 SUI tokens. You need to make decisions about investing in a new liquidity pool on a decentralized exchange.",
        steps: {
          "start": {
            id: "start",
            description: "A new DEX has launched on Sui with high APY rewards for early liquidity providers. You have 1,000 SUI tokens. What's your first move?",
            options: [
              {
                id: "option1",
                text: "Immediately invest all 1,000 SUI tokens to maximize early rewards",
                outcome: "You've committed all your funds but received the highest tier of early LP rewards. However, you now have zero liquidity for other opportunities.",
                isCorrect: false,
                nextStep: "market_change"
              },
              {
                id: "option2",
                text: "Research the protocol's security audits and team background first",
                outcome: "Smart move! You discover the protocol has passed three security audits and the team is doxxed with strong credentials.",
                isCorrect: true,
                nextStep: "invest_decision"
              },
              {
                id: "option3",
                text: "Ignore this opportunity and look for something else",
                outcome: "You missed a legitimate opportunity due to excessive caution.",
                isCorrect: false,
                nextStep: "missed_opportunity"
              }
            ]
          },
          "invest_decision": {
            id: "invest_decision",
            description: "Now that you've verified the protocol's security, how much will you invest?",
            options: [
              {
                id: "option1",
                text: "Invest 50% (500 SUI) as a balanced approach",
                outcome: "Good choice! You've balanced risk and opportunity by committing a significant amount while maintaining liquidity.",
                isCorrect: true,
                nextStep: "market_change"
              },
              {
                id: "option2",
                text: "Invest 10% (100 SUI) to test the waters",
                outcome: "A conservative approach that limits your exposure but also your potential gains.",
                isCorrect: false,
                nextStep: "market_change"
              },
              {
                id: "option3",
                text: "Invest 90% (900 SUI) to maximize returns",
                outcome: "You've committed most of your funds which increases your exposure to this single protocol.",
                isCorrect: false,
                nextStep: "market_change"
              }
            ]
          },
          "market_change": {
            id: "market_change",
            description: "Two weeks later, the market experiences volatility and SUI drops 20% in value. The pool is showing impermanent loss. What do you do?",
            options: [
              {
                id: "option1",
                text: "Panic and withdraw all your liquidity immediately",
                outcome: "You've realized your impermanent loss and missed the recovery that followed.",
                isCorrect: false,
                nextStep: null
              },
              {
                id: "option2",
                text: "Hold your position and wait for the market to stabilize",
                outcome: "Patient move! The market eventually recovers and your impermanent loss is reduced.",
                isCorrect: true,
                nextStep: null
              },
              {
                id: "option3",
                text: "Add more liquidity to dollar-cost average your position",
                outcome: "Bold move! While risky, this strategy paid off as the market recovered, allowing you to acquire more at a discount.",
                isCorrect: true,
                nextStep: null
              }
            ]
          },
          "missed_opportunity": {
            id: "missed_opportunity",
            description: "The protocol turns out to be legitimate and early investors earned 40% APY. You see another opportunity with similar characteristics. What now?",
            options: [
              {
                id: "option1",
                text: "Jump in immediately to avoid missing out again",
                outcome: "Without proper research, you've invested in a protocol that later experienced a security breach.",
                isCorrect: false,
                nextStep: null
              },
              {
                id: "option2",
                text: "Stick to your cautious approach and skip this one too",
                outcome: "You've missed another legitimate opportunity due to excessive caution.",
                isCorrect: false,
                nextStep: null
              },
              {
                id: "option3",
                text: "Conduct thorough research before making a decision",
                outcome: "Smart approach! Your research reveals this is another solid opportunity and you're able to participate with confidence.",
                isCorrect: true,
                nextStep: null
              }
            ]
          }
        },
        firstStepId: "start",
        conclusion: {
          success: "Congratulations! Your careful research and balanced investment approach has paid off. You've successfully navigated the DeFi liquidity pool opportunity while managing risk appropriately.",
          failure: "You've learned some valuable lessons about DeFi investing. Remember to always conduct thorough research, maintain liquidity for opportunities, and avoid emotional decisions during market volatility."
        }
      };
      
    case 'math_puzzle':
      return {
        question: "In a Sui blockchain, a validator set has 10 validators with different voting powers. If a transaction requires at least 2/3 of the total voting power to reach consensus, and the voting powers (in stake units) are distributed as [100, 90, 80, 70, 60, 50, 40, 30, 20, 10], what is the minimum number of validators needed to reach consensus?",
        equation: "\\sum_{i=1}^{n} VP_i \\geq \\frac{2}{3} \\cdot \\sum_{i=1}^{10} VP_i",
        context: "In Sui blockchain, consensus requires at least 2/3 of the total voting power. The voting power of each validator is proportional to their staked SUI tokens. Understanding the minimum validator set needed for consensus is crucial for security analysis.",
        hint1: "First calculate the total voting power across all validators, then find the threshold needed for consensus (2/3 of total).",
        hint2: "Sort the validators by voting power (highest first) and add them up until you reach or exceed the threshold.",
        solution: "The total voting power is 100+90+80+70+60+50+40+30+20+10 = 550. The 2/3 threshold is 550 × (2/3) = 366.67. Starting with the highest voting powers: 100+90+80+70 = 340, which is less than the threshold. Adding the next validator: 340+60 = 400, which exceeds the threshold. Therefore, 5 validators are needed.",
        answer: "5"
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
    if (!content || typeof content !== 'object') {
      
      return false;
    }

    let isValid = true;
    let missingFields: string[] = [];

    switch (type as AnyHistoricalChallengeType) {
      case 'math_puzzle':
        // Required fields for math_puzzle
        const requiredMathFields = ['question', 'context', 'hint1', 'hint2', 'solution', 'answer'];
        requiredMathFields.forEach(field => {
          if (!content[field]) {
            isValid = false;
            missingFields.push(field);
          }
        });
        
        // Special check for math_puzzle: ensure it's not a code sample or other challenge type
        if (content.solution && typeof content.solution === 'string') {
          const solutionText = content.solution.toLowerCase();
          // If solution contains code markers or code-related keywords, it's likely the wrong type
          if (solutionText.includes('```') || 
              solutionText.includes('module ') || 
              solutionText.includes('struct ') || 
              solutionText.includes('function ')) {
            isValid = false;
            
          }
        }
        
        if (!isValid) {
          
          
        }
        
        return (
          isValid &&
          typeof content.question === 'string' &&
          typeof content.context === 'string' &&
          typeof content.hint1 === 'string' &&
          typeof content.hint2 === 'string' &&
          typeof content.solution === 'string' &&
          (typeof content.answer === 'string' || typeof content.answer === 'number')
        );
      
      case 'quiz':
        // Required fields for quiz
        const requiredQuizFields = ['question', 'options', 'correctAnswer', 'explanation'];
        requiredQuizFields.forEach(field => {
          if (!content[field]) {
            isValid = false;
            missingFields.push(field);
          }
        });
        
        if (!isValid) {
          
        }
        
        return (
          isValid &&
          typeof content.question === 'string' &&
          Array.isArray(content.options) &&
          typeof content.correctAnswer === 'number' &&
          typeof content.explanation === 'string'
        );
      
      case 'bug_hunt':
        // Required fields for bug_hunt
        const requiredBugHuntFields = ['scenario', 'buggyCode', 'bugs'];
        requiredBugHuntFields.forEach(field => {
          if (!content[field]) {
            isValid = false;
            missingFields.push(field);
          }
        });
        
        if (!isValid) {
          
        }
        
        return (
          isValid &&
          typeof content.scenario === 'string' &&
          typeof content.buggyCode === 'string' &&
          Array.isArray(content.bugs)
        );
      
      case 'security_audit':
        // Required fields for security_audit
        const requiredSecurityFields = ['scenario', 'contractCode', 'securityIssues'];
        requiredSecurityFields.forEach(field => {
          if (!content[field]) {
            isValid = false;
            missingFields.push(field);
          }
        });
        
        if (!isValid) {
          
        }
        
        return (
          isValid &&
          typeof content.scenario === 'string' &&
          typeof content.contractCode === 'string' &&
          Array.isArray(content.securityIssues)
        );
        
      case 'code_puzzle':
        // Required fields for code_puzzle
        const requiredCodeFields = ['challenge', 'codeTemplate', 'solution'];
        requiredCodeFields.forEach(field => {
          if (!content[field]) {
            isValid = false;
            missingFields.push(field);
          }
        });
        
        if (!isValid) {
          
        }
        
        return (
          isValid &&
          typeof content.challenge === 'string' &&
          typeof content.codeTemplate === 'string' &&
          typeof content.solution === 'string'
        );
      
      case 'concept_review':
        // Required fields for concept_review
        const requiredConceptFields = ['concept', 'description', 'questionPrompt', 'keyPoints', 'practicalExample'];
        requiredConceptFields.forEach(field => {
          if (!content[field]) {
            isValid = false;
            missingFields.push(field);
          }
        });
        
        if (!isValid) {
          
        }
        
        return (
          isValid &&
          typeof content.concept === 'string' &&
          typeof content.description === 'string' &&
          typeof content.questionPrompt === 'string' &&
          Array.isArray(content.keyPoints) &&
          typeof content.practicalExample === 'string'
        );
      
      case 'optimization':
        // Required fields for optimization
        const requiredOptFields = ['scenario', 'originalCode', 'optimizationGoals', 'hints', 'sampleSolution', 'optimizationPoints'];
        requiredOptFields.forEach(field => {
          if (!content[field]) {
            isValid = false;
            missingFields.push(field);
          }
        });
        
        if (!isValid) {
          
        }
        
        return (
          isValid &&
          typeof content.scenario === 'string' &&
          typeof content.originalCode === 'string' &&
          Array.isArray(content.optimizationGoals) &&
          Array.isArray(content.hints) &&
          typeof content.sampleSolution === 'string' &&
          Array.isArray(content.optimizationPoints)
        );
        
      case 'defi_scenario':
        // Required fields for defi_scenario
        const requiredDefiFields = ['title', 'introduction', 'steps', 'firstStepId', 'conclusion'];
        requiredDefiFields.forEach(field => {
          if (!content[field]) {
            isValid = false;
            missingFields.push(field);
          }
        });
        
        if (!isValid) {
          
        }
        
        return (
          isValid &&
          typeof content.title === 'string' &&
          typeof content.introduction === 'string' &&
          typeof content.steps === 'object' &&
          typeof content.firstStepId === 'string' &&
          typeof content.conclusion === 'object' &&
          typeof content.conclusion.success === 'string' &&
          typeof content.conclusion.failure === 'string'
        );
      
      default:
        return true; // For other types, just ensure we have an object
    }
  } catch (error) {
    
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
    
    throw error;
  }
};

// Generate daily challenges and store in Firestore
export const generateDailyChallenges = async (walletAddress: string): Promise<DailyChallenge[]> => {
  try {
    // Get today's challenge categories - limit to exactly 3
    const challengeTypes = getChallengeCategoriesForToday().slice(0, 3);
    
    // Get today's date string in YYYY-MM-DD format for the document ID
    const todayString = getTodayAtMidnightUTC().toISOString().split('T')[0];
    
    // Get the global daily challenges document
    const globalChallengesRef = doc(db, 'globalChallenges', todayString);
    const globalChallengesDoc = await getDoc(globalChallengesRef);
    
    let challenges: DailyChallenge[] = [];
    
    // Check if we already have global challenges for today
    if (globalChallengesDoc.exists()) {
      // Use the pre-generated global challenges
      challenges = globalChallengesDoc.data().challenges;
      
      // Ensure we have exactly 3 challenges
      if (challenges.length > 3) {
        challenges = challenges.slice(0, 3);
      } else if (challenges.length < 3) {
        // Fill with fallback challenges if somehow we have fewer than 3
        const fallbackChallenges = getFallbackChallenges().slice(0, 3 - challenges.length);
        challenges = [...challenges, ...fallbackChallenges];
      }
      
      // Verify that challenge types are valid, replace invalid ones
      challenges = challenges.map(challenge => {
        if (!isValidChallengeType(challenge.type)) {
          const replacementType = getReplacementChallengeType(challenge.type);
          const difficulty = challenge.difficulty || 'medium';
          
          // Create replacement challenge with valid type
          return {
            ...challenge,
            type: replacementType,
            title: getChallengeTitle(replacementType, difficulty),
            description: getChallengeDescription(replacementType, difficulty),
            content: getMultipleFallbackContent(replacementType, difficulty)
          };
        }
        return challenge;
      });
    } else {
      // Try to generate fresh challenges with Gemini
      let useHardcodedChallenges = false;
      
      try {
        // Generate fresh challenges
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
              // Validate the content
              if (isValidChallengeContent(content, type)) {
                // If we got here, generation succeeded
                break;
              } else {
                throw new Error(`Invalid challenge content for type ${type}`);
              }
            } catch (error) {
              retryCount++;
              
              if (retryCount >= maxRetries) {
                // All retries failed, use fallback content
                content = getMultipleFallbackContent(type, difficulty);
              } else {
                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              }
            }
          }
          
          // Create challenge object with truly unique ID
          const randomSuffix = Math.floor(Math.random() * 1000000).toString(); // Add random number for uniqueness
          const challenge: DailyChallenge = {
            id: `${type}-${getDailySeed()}-${i}-${randomSuffix}`,
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
        
        // Ensure we have exactly 3 challenges
        if (challenges.length !== 3) {
          useHardcodedChallenges = true;
        }
      } catch (error) {
        useHardcodedChallenges = true;
      }
      
      // If we failed to generate challenges with Gemini, use hardcoded ones
      if (useHardcodedChallenges || challenges.length !== 3) {
        challenges = getFallbackChallenges().slice(0, 3); // Ensure exactly 3 challenges
      }
      
      // Store the global challenges for other users
      try {
        await setDoc(globalChallengesRef, {
          challenges,
          dateCreated: getTodayAtMidnightUTC(),
          expiresAt: getTomorrowAtMidnightUTC()
        });
      } catch (error) {
        // Continue with the generated challenges even if saving fails
      }
    }
    
    // Now assign these challenges to the user
    const userChallengesRef = collection(db, 'dailyChallenges');
    const batch = writeBatch(db);
    
    // Make sure we have exactly 3 challenges
    challenges = challenges.slice(0, 3);
    while (challenges.length < 3) {
      const fallback = getFallbackChallenges()[challenges.length % getFallbackChallenges().length];
      challenges.push(fallback);
    }
    
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
      totalDailyChallenges: 3 // Always set to exactly 3
    });
    
    return challenges;
  } catch (error) {
    // Return fallback challenges even if storing to Firestore fails
    return getFallbackChallenges().slice(0, 3); // Ensure exactly 3 challenges
  }
};

// Helper functions for challenge creation
const getChallengeTitle = (type: ChallengeType, difficulty: 'easy' | 'medium' | 'hard'): string => {
  const titles: Record<string, string[]> = {
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
  switch (type as AnyHistoricalChallengeType) {
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
    
    throw error;
  }
};

// Complete a challenge and claim rewards
export const completeChallengeAndClaimRewards = async (
  challengeId: string,
  walletAddress: string
): Promise<{ success: boolean, reward: number, xpReward: number }> => {
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
    
    const challengeDoc = challengesSnapshot.docs[0];
    const challengeData = challengeDoc.data() as DailyChallenge;
    
    if (!challengeData.completed) {
      
      throw new Error(`Challenge ${challengeId} is not completed yet`);
    }
    
    // Check if rewards already claimed
    if (challengeData.rewardClaimed) {
      
      throw new Error(`Rewards for challenge ${challengeId} already claimed`);
    }
    
    
    
    // Mark as rewards claimed
    await updateDoc(challengeDoc.ref, {
      rewardClaimed: true,
      rewardClaimedAt: serverTimestamp()
    });
    
    // Update user's SUI tokens in the database
    await updateDoc(doc(db, 'learningProgress', walletAddress), {
      suiTokens: increment(challengeData.tokenReward),
      totalSuiEarned: increment(challengeData.tokenReward),
      xp: increment(challengeData.xpReward),      // Add XP directly
      totalXpEarned: increment(challengeData.xpReward),  // Update total XP earned
      lastUpdated: serverTimestamp()
    });
    
    // Actually transfer SUI tokens to user's wallet
    const paymentResult = await sendSuiReward(
      walletAddress, 
      challengeData.suiReward, 
      `Daily Challenge Reward: ${challengeData.title}`
    );
    
    if (!paymentResult.success) {
      
      // Still continue as the database was updated, but log the error
    } else {
      
    }
    
    
    
    // Record the transaction
    await setDoc(doc(collection(db, 'transactions')), {
      walletAddress,
      amount: challengeData.tokenReward,
      xpAmount: challengeData.xpReward,
      reason: `Daily Challenge Reward: ${challengeData.title}`,
      type: 'challenge_reward',
      challengeId,
      suiTxDigest: paymentResult.success ? paymentResult.txDigest : null,
      timestamp: serverTimestamp()
    });
    
    return {
      success: true,
      reward: challengeData.tokenReward,
      xpReward: challengeData.xpReward
    };
  } catch (error) {
    
    throw error;
  }
};

// Get user's daily challenges for today
export const getUserDailyChallenges = async (walletAddress: string): Promise<DailyChallenge[]> => {
  try {
    // First ensure the user has challenges for today
    await ensureDailyChallengesExist(walletAddress);
    
    // Get today's date range
    const today = getTodayAtMidnightUTC();
    const tomorrow = getTomorrowAtMidnightUTC();
    
    // Query user challenges for today
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
        // Use the original challenge ID from the data if it exists, otherwise use doc.id
        const challenge = {
          id: data.id || doc.id, // Prefer the original ID if it exists
          ...data
        } as DailyChallenge;
        
        // Only include challenge types that we know how to display
        if (isValidChallengeType(challenge.type)) {
          challenges.push(challenge);
        } else {
          // For invalid types, replace with a valid one instead of skipping
          const replacementType = getReplacementChallengeType(challenge.type);
          const difficulty = challenge.difficulty || 'medium';
          
          challenges.push({
            ...challenge,
            type: replacementType,
            title: getChallengeTitle(replacementType, difficulty),
            description: getChallengeDescription(replacementType, difficulty),
            content: getMultipleFallbackContent(replacementType, difficulty)
          });
        }
      } catch (error) {
        console.error("Error processing challenge document:", error);
      }
    });
    
    // Ensure we have exactly 3 challenges
    if (challenges.length > 3) {
      return challenges.slice(0, 3); 
    } else if (challenges.length < 3) {
      // If we have fewer than 3, add fallback challenges
      const fallbackChallenges = getFallbackChallenges().slice(0, 3 - challenges.length);
      return [...challenges, ...fallbackChallenges];
    }
    
    return challenges;
  } catch (error) {
    console.error("Error getting user daily challenges:", error);
    return getFallbackChallenges().slice(0, 3); // Return exactly 3 fallback challenges
  }
}; 