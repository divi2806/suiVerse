import { 
  GoogleGenerativeAI, 
  GenerativeModel,
  GenerateContentResult,
  HarmCategory,
  HarmBlockThreshold
} from '@google/generative-ai';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
// Import the logger
import logger from '@/utils/logger';

// Function to select the best available API key
const selectApiKey = (): string => {
  // First try env variable for Vite 
  if (import.meta.env.VITE_GEMINI_API_KEY) {
    
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  
  // Try alternative env variables (for different build systems)
  if (import.meta.env.REACT_APP_GEMINI_API_KEY) {
    
    return import.meta.env.REACT_APP_GEMINI_API_KEY;
  }
  
  // Fallback to backup API keys
  const backupKeys = [
    'AIzaSyC9YKF89cnfSAAzM6TilPY29Ea9LeiIf8s',  // Primary backup
    'AIzaSyC9YKF89cnfSAAzM6TilPY29Ea9LeiIf8s',  // Secondary backup
  ];
  
  // Try each backup key in order
  for (const key of backupKeys) {
    
    return key;
  }
  
  // Last resort fallback
  
  return 'AIzaSyC9YKF89cnfSAAzM6TilPY29Ea9LeiIf8s';
};

// Update the API key using our new selector
const API_KEY = selectApiKey();

// Update model names to use currently available models (as of 2024)
const DEFAULT_MODEL = 'gemini-2.0-flash';
const SMART_CONTRACT_MODEL = 'gemini-2.0-flash';

// Constants for smart contract prompt engineering
const CODE_GENERATION_PROMPT_PREFIX = 
`You are Blazo, a helpful AI assistant specialized in creating Sui Move smart contracts.
Follow these guidelines:
1. Create clean, well-structured, and secure Move code
2. Add clear comments explaining the main components
3. Format your response as follows:
   - First provide the complete code block with syntax highlighting
   - Then explain how the contract works in simple terms
4. Include best practices for Sui Move development
5. Be friendly and encouraging in your explanation
6. Keep explanations clear and beginner-friendly

Now, please create a smart contract that:`;

// For module-specific knowledge - expand as needed
const MODULE_KNOWLEDGE = {
  'intro-to-sui': 'Basic Sui Move concepts and syntax',
  'sui-objects': 'Working with Sui objects and ownership',
  'coin-token': 'Creating fungible tokens and coins on Sui',
  'nft-marketplace': 'Building NFT marketplaces on Sui',
  'defi-applications': 'Decentralized finance applications on Sui',
  'cross-chain': 'Cross-chain interactions with Sui',
};

// Define the topics for each module with progressive learning paths
const MODULE_TOPICS = {
  // Genesis Galaxy (Introduction)
  'intro-to-sui': 'Fundamentals of the Sui blockchain platform and Move language',
  'smart-contracts-101': 'Creating your first Sui Move smart contract',
  
  // Explorer Galaxy (Core concepts)
  'move-language': 'Move language syntax, types, and basic structures',
  'objects-ownership': 'Understanding Sui objects, ownership models, and transfers',
  
  // Nebula Galaxy (Building blocks)
  'advanced-concepts': 'Advanced data structures and object capabilities in Sui Move',
  'nft-marketplace': 'Building a composable NFT marketplace on Sui',
  
  // Cosmic Galaxy (DeFi)
  'defi-protocols': 'Implementing liquidity pools and token swaps on Sui',
  'blockchain-security': 'Security best practices and audit techniques for Sui smart contracts',
  
  // Nova Galaxy (Tokenomics)
  'tokenomics': 'Creating token economics and incentive mechanisms with Sui',
  'cross-chain-apps': 'Building cross-chain applications using Sui interoperability features',
  
  // Stellar Galaxy (Advanced)
  'sui-governance': 'Implementing on-chain governance systems with Sui Move',
  'zk-applications': 'Zero-knowledge proofs and privacy-preserving applications on Sui',
  
  // Quantum Galaxy (Gaming & Social)
  'gaming-on-blockchain': 'Building interactive blockchain games with Sui',
  'social-networks': 'Implementing decentralized social networks on Sui',
  
  // Aurora Galaxy (Real-world assets)
  'identity-solutions': 'Creating verifiable digital identity systems on Sui',
  'real-world-assets': 'Tokenizing and managing real-world assets on the Sui blockchain',
  
  // Home Planet
  'graduation-galaxy': 'Final comprehensive challenge to return to Earth',
};

// Map galaxy names to their modules for better organization
const GALAXY_MODULES = {
  'genesis': ['intro-to-sui', 'smart-contracts-101'],
  'explorer': ['move-language', 'objects-ownership'],
  'nebula': ['advanced-concepts', 'nft-marketplace'],
  'cosmic': ['defi-protocols', 'blockchain-security'],
  'nova': ['tokenomics', 'cross-chain-apps'],
  'stellar': ['sui-governance', 'zk-applications'],
  'quantum': ['gaming-on-blockchain', 'social-networks'],
  'aurora': ['identity-solutions', 'real-world-assets'],
  'home': ['graduation-galaxy']
};

// Initialize the Gemini API with error handling
let genAI;
try {
  genAI = new GoogleGenerativeAI(API_KEY);
  
} catch (error) {
  
  // Create a fallback implementation if initialization fails
  genAI = {
    getGenerativeModel: () => ({
      generateContent: async () => {
        throw new Error("Gemini API initialization failed");
      }
    })
  };
}

// Cache for model instances
let modelInstances: Record<string, GenerativeModel> = {};

// Get or create a model instance with better error handling
function getModel(modelName: string): GenerativeModel {
  try {
    if (!modelInstances[modelName]) {
      modelInstances[modelName] = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      });
      
    }
    return modelInstances[modelName];
  } catch (error) {
    
    // Return a dummy model that always throws
    return {
      generateContent: async () => {
        throw new Error(`Model instance creation failed for ${modelName}`);
      }
    } as unknown as GenerativeModel;
  }
}

// Data types for learning content
export interface ModuleContent {
  id?: string;
  title: string;
  description: string;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  alienChallenges: CodingChallenge[];
  summary: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  imagePrompt?: string; // Prompt to generate an image for this card
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface CodingChallenge {
  id: string;
  scenario: string;
  task: string;
  codeSnippet: string;
  solution: string;
  hints: string[];
}

// Constants for retry mechanism
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 8000; // 8 seconds
const MAX_RETRY_DELAY = 16000; // 16 seconds
const BACKOFF_FACTOR = 2;

/**
 * Make a model request with retry logic and exponential backoff
 * @param model The generative model to use
 * @param prompt The prompt to send to the model
 * @param retryCount Current retry count (internal use)
 * @param delay Current delay in ms (internal use)
 * @returns The model response
 */
async function makeModelRequestWithRetry(
  model: GenerativeModel,
  prompt: string,
  retryCount = 0,
  delay = INITIAL_RETRY_DELAY
): Promise<GenerateContentResult> {
  try {
    logger.log(`[GeminiService] Making model request (attempt ${retryCount + 1})`);
    
    // Enhanced prompt with stronger instructions for JSON responses
    let enhancedPrompt = prompt;
    const isJsonPrompt = prompt.includes('JSON') || prompt.includes('json');
    
    if (isJsonPrompt) {
      // Add additional instructions to ensure valid JSON
      enhancedPrompt = `${prompt}\n\nCRITICAL INSTRUCTIONS FOR JSON RESPONSE:\n` +
        `1. Your response MUST be valid JSON that can be parsed directly with JSON.parse().\n` +
        `2. DO NOT include markdown code blocks, backticks, or any other formatting.\n` +
        `3. Return ONLY the raw JSON data, properly formatted and escaped.\n` +
        `4. Ensure all strings are properly terminated with double quotes.\n` +
        `5. Verify that all objects and arrays have matching closing brackets.\n` +
        `6. DO NOT include any text outside the JSON structure.\n` +
        `7. If you need to include a quote inside a string, escape it with a backslash (\\").`;
      
      logger.log('[GeminiService] Enhanced prompt with JSON-specific instructions');
    }
    
    // Make the request with a timeout
    const result = await Promise.race([
      model.generateContent(enhancedPrompt),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 60000) // 60 second timeout
      )
    ]) as GenerateContentResult;
    
    // Get the response text
    const responseText = result.response.text();
    
    // For JSON responses, validate that we can parse them
    if (isJsonPrompt) {
      try {
        // Try to validate/extract JSON from the response
        const jsonContent = extractJsonFromText(responseText);
        
        // If we got this far, JSON was successfully parsed
        logger.log('[GeminiService] Successfully parsed JSON from response');
        
        // If there are specific format requirements (array or object), check them
        if (prompt.includes('array') && !Array.isArray(jsonContent)) {
          logger.warn('[GeminiService] Expected JSON array but got different format, retrying');
          console.warn('[GeminiService] Expected JSON array but got different format, retrying');
          throw new Error('Invalid JSON format: expected array');
        }
        
        // Check minimum array length if this is likely a questions/flashcards response
        if (Array.isArray(jsonContent) && 
            (prompt.includes('questions') || prompt.includes('flashcards')) && 
            jsonContent.length < 3) {
          console.warn(`[GeminiService] JSON array too short (${jsonContent.length} items), retrying`);
          throw new Error('Invalid JSON format: array too short');
        }
      } catch (jsonError) {
        if (retryCount < MAX_RETRIES) {
          console.warn(`[GeminiService] JSON validation failed: ${jsonError.message}, retrying...`);
          
          // Calculate the next delay with exponential backoff
          const nextDelay = retryCount === 0 
            ? INITIAL_RETRY_DELAY  // First retry uses 8 seconds
            : MAX_RETRY_DELAY;     // All subsequent retries use 16 seconds
          
          // Wait for the delay
          await new Promise(resolve => setTimeout(resolve, nextDelay));
          
          // Retry the request with incremented retry count and updated delay
          return makeModelRequestWithRetry(model, prompt, retryCount + 1, nextDelay);
        } else {
          console.error(`[GeminiService] Maximum retry count (${MAX_RETRIES}) reached. Using fallback content.`);
          // Let the error bubble up - fallback mechanisms will handle it at a higher level
          throw jsonError;
        }
      }
    }
    
    return result;
  } catch (error: any) {
    // Check if we've reached the maximum retry count
    if (retryCount >= MAX_RETRIES) {
      console.error(`[GeminiService] Maximum retry count (${MAX_RETRIES}) reached. Giving up.`);
      throw error;
    }
    
    // Calculate the next delay with exponential backoff
    const nextDelay = retryCount === 0 
      ? INITIAL_RETRY_DELAY  // First retry uses 8 seconds
      : MAX_RETRY_DELAY;     // All subsequent retries use 16 seconds
    
    // Log the error and retry information
    console.warn(`[GeminiService] Error: ${error.message}. Retrying in ${nextDelay / 1000} seconds...`);
    
    // Wait for the delay
    await new Promise(resolve => setTimeout(resolve, nextDelay));
    
    // Retry the request with incremented retry count and updated delay
    return makeModelRequestWithRetry(model, prompt, retryCount + 1, nextDelay);
  }
}

/**
 * Helper function to extract JSON from a string that might contain markdown code blocks
 * @param text The text that might contain JSON in markdown code blocks
 * @returns Parsed JSON object
 */
function extractJsonFromText(text: string): any {
  logger.log('[GeminiService] Attempting to extract JSON from response');
  
  try {
    // First try direct JSON parsing
    return JSON.parse(text);
  } catch (e) {
    logger.log('[GeminiService] Direct JSON parsing failed, trying alternative methods');
    
    // Try multiple extraction and repair methods
    const extractionMethods = [
      // Method 1: Extract JSON from markdown code blocks
      () => {
        const jsonRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
        const match = text.match(jsonRegex);
        
        if (match && match[1]) {
          const extractedJson = match[1].trim();
          logger.log('[GeminiService] Extracted JSON from markdown code block');
          return JSON.parse(extractedJson);
        }
        throw new Error('No JSON found in code block');
      },
      
      // Method 2: Find array/object directly
      () => {
        const possibleJson = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (possibleJson && possibleJson[1]) {
          const extractedJson = possibleJson[1].trim();
          logger.log('[GeminiService] Extracted JSON from text');
          return JSON.parse(extractedJson);
        }
        throw new Error('No JSON object/array found in text');
      },
      
      // Method 3: Clean markdown formatting and try to parse
      () => {
        let cleanedText = text
          .replace(/```[a-z]*\n?/g, '')  // Remove code block markers
          .replace(/\n?```/g, '')        // Remove closing code block markers
          .replace(/^\s*\n/gm, '')       // Remove empty lines
          .trim();
        
        // Check if it's an array or object
        if ((cleanedText.startsWith('[') && cleanedText.endsWith(']')) || 
            (cleanedText.startsWith('{') && cleanedText.endsWith('}'))) {
          logger.log('[GeminiService] Parsed cleaned JSON');
          return JSON.parse(cleanedText);
        }
        throw new Error('Cleaned text is not valid JSON');
      },
      
      // Method 4: Attempt to repair common JSON issues - unterminated strings, missing quotes, etc.
      () => {
        logger.log('[GeminiService] Attempting to repair malformed JSON');
        const repaired = repairMalformedJson(text);
        return JSON.parse(repaired);
      },
      
      // Method 5: Last resort - create synthetic JSON from text patterns
      () => {
        logger.log('[GeminiService] Creating synthetic JSON from text patterns');
        return createSyntheticJsonFromText(text);
      }
    ];
    
    // Try each method in sequence
    for (const method of extractionMethods) {
      try {
        return method();
      } catch (methodError) {
        // Continue to next method
        logger.log(`[GeminiService] Extraction method failed: ${methodError.message}`);
      }
    }
    
    // If all methods fail, throw a clear error
    throw new Error('Failed to extract valid JSON using all available methods');
  }
}

/**
 * Attempts to repair common issues in malformed JSON
 * @param text The potentially malformed JSON text
 * @returns Repaired JSON string
 */
function repairMalformedJson(text: string): string {
  // Start with the most likely JSON content
  let jsonText = text;
  
  // Extract what looks most like JSON (between [ ] or { })
  const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  const objectMatch = text.match(/\{[\s\S]*\}/);
  
  if (arrayMatch) {
    jsonText = arrayMatch[0];
  } else if (objectMatch) {
    jsonText = objectMatch[0];
  }
  
  // Fix unterminated strings (common issue)
  // Look for quotes without matching end quotes
  let fixedJson = '';
  let inString = false;
  let escapeNext = false;
  let lastQuotePos = -1;
  
  for (let i = 0; i < jsonText.length; i++) {
    const char = jsonText[i];
    
    // Handle string boundaries
    if (char === '"' && !escapeNext) {
      if (inString) {
        inString = false;
      } else {
        inString = true;
        lastQuotePos = i;
      }
    }
    
    // Handle escape sequences
    if (char === '\\' && !escapeNext) {
      escapeNext = true;
    } else {
      escapeNext = false;
    }
    
    fixedJson += char;
    
    // Check for unterminated string at end of line
    if (inString && (char === '\n' || i === jsonText.length - 1)) {
      fixedJson += '"'; // Close the string
      inString = false;
    }
  }
  
  // Ensure proper array/object termination
  if (fixedJson.trim().startsWith('[') && !fixedJson.trim().endsWith(']')) {
    fixedJson = fixedJson.trim() + ']';
  } else if (fixedJson.trim().startsWith('{') && !fixedJson.trim().endsWith('}')) {
    fixedJson = fixedJson.trim() + '}';
  }
  
  return fixedJson;
}

/**
 * Create synthetic JSON when all parsing attempts fail
 * @param text The text to extract patterns from
 * @returns A JSON object with best-effort extraction
 */
function createSyntheticJsonFromText(text: string): any {
  logger.log('[GeminiService] Creating fallback synthetic JSON');
  
  // For arrays of objects (like quiz questions or flashcards)
  if (text.includes('"question"') || text.includes('"answer"') || 
      text.includes('"options"') || text.includes('"correctAnswer"')) {
    
    // Try to extract quiz questions
    const questions = [];
    const questionBlocks = text.split(/(?=\s*"question":|(?:\d+\s*\.\s*)"question":)/g);
    
    for (let i = 0; i < questionBlocks.length; i++) {
      const block = questionBlocks[i];
      if (!block.includes('question')) continue;
      
      try {
        // Extract question
        const questionMatch = block.match(/"question"\s*:\s*"([^"]+)"/);
        const question = questionMatch ? questionMatch[1] : `Question ${i+1}`;
        
        // Extract options
        const options = [];
        const optionsMatches = block.match(/"options"\s*:\s*\[([\s\S]*?)\]/);
        if (optionsMatches) {
          const optionsText = optionsMatches[1];
          const optionMatches = optionsText.match(/"([^"]+)"/g);
          if (optionMatches) {
            optionMatches.forEach(opt => {
              options.push(opt.replace(/"/g, ''));
            });
          }
        }
        
        // Ensure we have 4 options
        while (options.length < 4) {
          options.push(`Option ${options.length + 1}`);
        }
        
        // Extract correctAnswer
        let correctAnswer = 0;
        const correctAnswerMatch = block.match(/"correctAnswer"\s*:\s*(\d+)/);
        if (correctAnswerMatch) {
          correctAnswer = parseInt(correctAnswerMatch[1], 10);
          if (isNaN(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
            correctAnswer = 0;
          }
        }
        
        // Extract explanation
        const explanationMatch = block.match(/"explanation"\s*:\s*"([^"]+)"/);
        const explanation = explanationMatch ? explanationMatch[1] : `Explanation for question ${i+1}`;
        
        questions.push({
          id: `synthetic-question-${i+1}`,
          question,
          options,
          correctAnswer,
          explanation
        });
      } catch (e) {
        // Skip this block if there's an error
        logger.log(`[GeminiService] Error extracting question from block ${i+1}`);
      }
    }
    
    // If we found any questions, return them
    if (questions.length > 0) {
      logger.log(`[GeminiService] Created synthetic array with ${questions.length} items`);
      return questions;
    }
  }
  
  // Fallback to a basic object
  return [{ 
    id: "synthetic-fallback-1",
    content: "Synthetic content created due to JSON parsing failure",
    note: "The original content couldn't be parsed correctly"
  }];
}

/**
 * Generates a complete learning module with flashcards, quizzes, and coding challenges
 */
export const generateLearningModule = async (moduleId: string): Promise<ModuleContent> => {
  try {
    const topic = MODULE_TOPICS[moduleId as keyof typeof MODULE_TOPICS] || moduleId;
    
    // Find which galaxy this module belongs to for context
    let galaxy = "";
    for (const [galaxyName, modules] of Object.entries(GALAXY_MODULES)) {
      if (modules.includes(moduleId)) {
        galaxy = galaxyName;
        break;
      }
    }
    
    // Get the module number within the galaxy (1 or 2)
    const moduleNumber = GALAXY_MODULES[galaxy as keyof typeof GALAXY_MODULES]?.indexOf(moduleId) + 1 || 1;
    
    // Special enhanced prompt for the Move Language module
    let prompt = '';
    
    if (moduleId === 'move-language') {
      prompt = `Create comprehensive learning content about the Move programming language for Sui blockchain.

This should be a detailed, in-depth module with 15 flashcards that progressively build knowledge:

1. Start with 7-8 flashcards covering theoretical foundations:
   - What Move is and its relationship to Sui
   - Core concepts and design principles
   - Key features that differentiate it from other languages
   - Object model and ownership
   - Resource types and linear logic

2. Then include 7-8 flashcards with practical coding examples:
   - Basic syntax and structure with code samples
   - Creating and using resources
   - Defining structs and implementing functions
   - Working with objects and ownership transfers
   - Common patterns and best practices
   - Error handling and security considerations
   - Step-by-step examples of simple smart contracts

Each coding example should be properly formatted and explained line by line.

Format the response as a valid JSON object with this structure:
{
  "title": "Move Programming Language",
  "description": "A comprehensive introduction to Move programming on Sui",
  "flashcards": [
    {
      "question": "What is Move?",
      "answer": "Detailed answer with key points..."
    },
    // More flashcards following the same format
  ],
  "summary": "A concise summary of the key points covered in this module"
}

Make sure the content is accurate, educational, and follows a logical progression from basic concepts to more advanced topics.`;
    } else {
      // Enhanced prompt for all other modules to match move-language quality
      prompt = `Create comprehensive learning content about "${topic}" for the Sui blockchain platform.

This should be a detailed, in-depth module with 15 flashcards that progressively build knowledge like a professional educational course:

1. Start with 7-8 flashcards covering theoretical foundations:
   - What ${topic} is and its significance in Sui blockchain development
   - Core concepts and design principles specific to ${topic}
   - Key features and characteristics that make ${topic} important
   - Relationship to other Sui/Move concepts
   - Fundamental theory and mechanisms behind ${topic}
   - Real-world use cases and applications

2. Then include 7-8 flashcards with practical coding examples:
   - Basic syntax and structure with detailed code samples
   - Step-by-step implementation examples
   - Creating and using relevant resources/objects
   - Common patterns and best practices for ${topic}
   - Error handling and security considerations
   - Performance optimization techniques
   - Advanced implementation strategies

Each coding example should be properly formatted and explained line by line with comments. Include specific Sui Move code examples that demonstrate the concepts.

Format the response as a valid JSON object with this structure:
{
  "title": "A clear, concise title about ${topic}",
  "description": "A comprehensive introduction to ${topic} in Sui blockchain development",
  "flashcards": [
    {
      "question": "What is ${topic}?",
      "answer": "Detailed answer with key points, examples, and when relevant, code samples that demonstrate the concept..."
    },
    // More flashcards following progressive learning structure
  ],
  "summary": "A detailed summary of the key points covered in this module that reinforces the learning path"
}

Make sure the content is accurate, educational, highly detailed, and follows a logical progression from basic concepts to more advanced topics. The content should match the depth and quality of university-level course materials.`;
    }

    // Use gemini-2.0-flash model for fast responses
    const model = getModel(DEFAULT_MODEL);
    
    // Generate content
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // Try multiple approaches to extract valid JSON
      let parsedContent = null;
      let extractionMethods = [
        // Method 1: Look for JSON block between markdown code fences
        () => {
          const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            const cleanedJson = jsonMatch[1].trim();
            
            return JSON.parse(cleanedJson);
          }
          throw new Error("No JSON found in code block");
        },
        
        // Method 2: Look for content that starts with { and ends with }
        () => {
          const jsonMatch = text.match(/{[\s\S]*}/);
          if (jsonMatch) {
            const cleanedJson = jsonMatch[0].trim();
            
            return JSON.parse(cleanedJson);
          }
          throw new Error("No JSON found using brace matching");
        },
        
        // Method 3: Try to parse the entire text as JSON
        () => {
          
          return JSON.parse(text);
        }
      ];
      
      // Try each method until one works
      for (const method of extractionMethods) {
        try {
          parsedContent = method();
          if (parsedContent) break;
        } catch (error) {
          
          // Continue to next method
        }
      }
      
      // If no method worked, try a different approach - generate just quiz questions
      if (!parsedContent) {
        
        
        // Create a basic module structure
      const basicModule = createFallbackModule(moduleId);
        
        // Try to generate just the quiz questions
        try {
          
        const quizQuestions = await generateQuizQuestions(topic, 10);
          
          if (quizQuestions && quizQuestions.length > 0) {
            
            basicModule.quiz = quizQuestions;
          }
        } catch (quizError) {
          
        }
        
        return basicModule;
      }
      
    // Process the content - ensure all required fields are present
    const processedContent: ModuleContent = {
      title: parsedContent.title || `Learn about ${topic}`,
      description: parsedContent.description || `This module teaches you about ${topic}.`,
      flashcards: (parsedContent.flashcards || []).map((card: any, index: number) => ({
        id: `${moduleId}-card-${index}`,
        question: card.question || `What is an important concept in ${topic}?`,
        answer: card.answer || `This concept is fundamental to understanding ${topic}.`
      })),
      quiz: (parsedContent.quiz || []).map((question: any, index: number) => {
        // Convert correctAnswerIndex to correctAnswer (if needed)
        let correctAnswer = question.correctAnswer;
        if (correctAnswer === undefined && question.correctAnswerIndex !== undefined) {
          correctAnswer = question.correctAnswerIndex;
        }
        
        return {
          id: `${moduleId}-quiz-${index}`,
          question: question.question || `Question about ${topic}?`,
          options: question.options || ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: correctAnswer || 0,
          explanation: question.explanation || 'This is the correct answer based on the module content.'
        };
      }),
      alienChallenges: (parsedContent.alienChallenges || []).map((challenge: any, index: number) => ({
        id: `${moduleId}-challenge-${index}`,
        scenario: challenge.scenario || `Scenario about ${topic}`,
        task: challenge.task || `Complete this task related to ${topic}`,
        codeSnippet: challenge.codeSnippet || `// Complete the code\nmodule example::module {\n    // Add your implementation here\n}`,
        solution: challenge.solution || `// Solution\nmodule example::module {\n    // Solution code here\n}`,
        hints: challenge.hints || ['Think about the core concepts', 'Check your syntax']
      })),
      summary: parsedContent.summary || `This module covered important aspects of ${topic}.`
    };
    
    // Ensure we have exactly 15 flashcards
    if (processedContent.flashcards.length < 15) {
      // Add more flashcards if needed
      const additionalCount = 15 - processedContent.flashcards.length;
      for (let i = 0; i < additionalCount; i++) {
        const existingLength = processedContent.flashcards.length;
        processedContent.flashcards.push({
          id: `${moduleId}-card-${existingLength + i}`,
          question: `What is another important aspect of ${topic}?`,
          answer: `This is another critical concept related to ${topic} that builds on previous knowledge.`
        });
      }
    } else if (processedContent.flashcards.length > 15) {
      // Limit to 15 flashcards
      processedContent.flashcards = processedContent.flashcards.slice(0, 15);
    }
    
    // Ensure we have 10 quiz questions
    if (processedContent.quiz.length < 10) {
      const additionalQuizzes = await generateQuizQuestions(topic, 10 - processedContent.quiz.length);
      processedContent.quiz = [...processedContent.quiz, ...additionalQuizzes];
    } else if (processedContent.quiz.length > 10) {
      processedContent.quiz = processedContent.quiz.slice(0, 10);
    }
    
    return processedContent;
  } catch (error) {
    
    // Return a complete fallback module
    return createFallbackModule(moduleId);
  }
};

/**
 * Creates a fallback module if Gemini API fails
 */
export function createFallbackModule(moduleId: string): ModuleContent {
  logger.warn(`[GeminiService] Creating fallback module content for: ${moduleId}`);
  
  // Define the number of cards and questions - always use these exact numbers
  const FLASHCARD_COUNT = 15;
  const QUIZ_QUESTION_COUNT = 10;
  
  // Title and description based on module ID
  let title = 'Learning Module';
  let description = 'Learn the fundamentals of Sui blockchain development.';
  
  // Special module titles and descriptions
  if (moduleId === 'intro-to-sui') {
    title = 'Introduction to Sui';
    description = 'Learn about the core concepts of Sui blockchain and its unique features.';
  } else if (moduleId === 'smart-contracts-101') {
    title = 'Smart Contracts 101';
    description = 'Understand the basics of smart contract development on the Sui blockchain.';
  } else if (moduleId === 'move-language') {
    title = 'Move Programming Language';
    description = 'Master the fundamentals of the Move programming language used in Sui.';
  } else if (moduleId.includes('objects')) {
    title = 'Objects & Ownership';
    description = 'Learn about Sui\'s unique object model and ownership types.';
  }
  
  // Create exactly 15 flashcards based on module ID
  const flashcards = createFallbackFlashcards(moduleId, FLASHCARD_COUNT);
  
  // Verify we have exactly 15 flashcards
  logger.log(`[GeminiService] Created ${flashcards.length} flashcards for module ${moduleId}`);
  if (flashcards.length !== FLASHCARD_COUNT) {
    logger.warn(`[GeminiService] Flashcard count mismatch: ${flashcards.length}/${FLASHCARD_COUNT}`);
    // Ensure we have exactly 15 flashcards by adding or removing
    while (flashcards.length < FLASHCARD_COUNT) {
      const cardNumber = flashcards.length + 1;
      flashcards.push({
        id: `${moduleId}-card-${cardNumber}`,
        question: `Concept ${cardNumber}: Key Learning Point`,
        answer: `This is an important concept related to ${moduleId.replace(/-/g, ' ')}. Understanding this will help you build applications on the Sui blockchain.`,
      });
    }
    // If we have too many, trim the excess
    if (flashcards.length > FLASHCARD_COUNT) {
      flashcards.splice(FLASHCARD_COUNT);
    }
  }
  
  // Create exactly 10 quiz questions based on module ID
  const quizQuestions = createFallbackQuestions(moduleId, QUIZ_QUESTION_COUNT);
  
  // Verify we have exactly 10 quiz questions
  logger.log(`[GeminiService] Created ${quizQuestions.length} quiz questions for module ${moduleId}`);
  if (quizQuestions.length !== QUIZ_QUESTION_COUNT) {
    logger.warn(`[GeminiService] Quiz question count mismatch: ${quizQuestions.length}/${QUIZ_QUESTION_COUNT}`);
    // Ensure we have exactly 10 quiz questions by adding or removing
    while (quizQuestions.length < QUIZ_QUESTION_COUNT) {
      const questionNumber = quizQuestions.length + 1;
      quizQuestions.push({
        id: `${moduleId}-quiz-${questionNumber}`,
        question: `Question ${questionNumber} about ${moduleId.replace(/-/g, ' ')}?`,
        options: [
          `Answer option A for ${moduleId}`,
          `Answer option B for ${moduleId}`,
          `Answer option C for ${moduleId}`,
          `Answer option D for ${moduleId}`
        ],
        correctAnswer: 0,
        explanation: `This is the explanation for question ${questionNumber} about ${moduleId}.`
      });
    }
    // If we have too many, trim the excess
    if (quizQuestions.length > QUIZ_QUESTION_COUNT) {
      quizQuestions.splice(QUIZ_QUESTION_COUNT);
    }
  }
  
  // Create alien challenges based on module ID
  const alienChallenges = createFallbackAlienChallenges(moduleId);
  
      return {
    id: moduleId,
    title,
    description,
    flashcards,
        quiz: quizQuestions,
    alienChallenges,
    summary: `This module covered the key concepts of ${title}. You learned about fundamental principles and practical applications.`
  };
}

// Create a fallback alien challenges for a module
function createFallbackAlienChallenges(moduleId: string): CodingChallenge[] {
  const challenges: CodingChallenge[] = [];
  
  // Create a unique alien challenge based on module ID
  switch(moduleId) {
    case 'intro-to-sui':
      challenges.push({
        id: `${moduleId}-challenge-1`,
        scenario: "An alien from the Planet Move challenges you to create your first Sui object!",
        task: "Create a simple 'HelloWorld' object with a 'message' field and transfer it to the sender.",
        codeSnippet: `module example::hello_world {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  use std::string::{Self, String};
  
  // TODO: Define your HelloWorld struct
  
  // TODO: Create a mint function
}`,
        solution: `module example::hello_world {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  use std::string::{Self, String};
  
  struct HelloWorld has key, store {
      id: UID,
      message: String
  }
  
  entry fun mint(ctx: &mut TxContext) {
      let hello = HelloWorld {
          id: object::new(ctx),
          message: string::utf8(b"Hello, Sui Universe!")
      };
      
      transfer::transfer(hello, tx_context::sender(ctx));
  }
}`,
        hints: [
          "Objects need the 'key' ability and an 'id: UID' field",
          "Use object::new(ctx) to create a new ID",
          "Transfer the object to the sender with transfer::transfer"
        ]
      });
      break;
      
    case 'smart-contracts-101':
      challenges.push({
        id: `${moduleId}-challenge-1`,
        scenario: "An alien merchant wants to implement a simple counter contract.",
        task: "Create a counter module with functions to create and increment counters.",
        codeSnippet: `module example::counter {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  
  struct Counter has key, store {
      id: UID,
      value: u64
  }
  
  // TODO: Implement create function
  
  // TODO: Implement increment function
}`,
        solution: `module example::counter {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  
  struct Counter has key, store {
      id: UID,
      value: u64
  }
  
  entry fun create(ctx: &mut TxContext) {
      let counter = Counter {
          id: object::new(ctx),
          value: 0
      };
      
      transfer::transfer(counter, tx_context::sender(ctx));
  }
  
  entry fun increment(counter: &mut Counter) {
      counter.value = counter.value + 1;
  }
}`,
        hints: [
          "Initialize Counter with value 0",
          "The increment function takes a mutable reference",
          "Use counter.value = counter.value + 1 to increment"
        ]
      });
      break;
      
    case 'move-language':
      challenges.push({
        id: `${moduleId}-challenge-1`,
        scenario: "An alien linguist wants you to demonstrate your Move language skills.",
        task: "Create a module with a custom type and a function that operates on it.",
        codeSnippet: `module example::custom_types {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  
  // TODO: Define a Book struct with title and author fields
  
  // TODO: Create a function to create and transfer a new Book
}`,
        solution: `module example::custom_types {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  use std::string::{Self, String};
  
  struct Book has key, store {
      id: UID,
      title: String,
      author: String
  }
  
  entry fun create_book(title: vector<u8>, author: vector<u8>, ctx: &mut TxContext) {
      let book = Book {
          id: object::new(ctx),
          title: string::utf8(title),
          author: string::utf8(author)
      };
      
      transfer::transfer(book, tx_context::sender(ctx));
  }
}`,
        hints: [
          "Use String type for text fields in your struct",
          "Convert byte vectors to strings with string::utf8()",
          "Remember to add the 'key' and 'store' abilities to your struct"
        ]
      });
      break;
      
    case 'objects-ownership':
      challenges.push({
        id: `${moduleId}-challenge-1`,
        scenario: "An alien collector wants you to demonstrate object ownership concepts.",
        task: "Implement a collectible item with transfer and share functions.",
        codeSnippet: `module example::collectible {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  use sui::dynamic_field as df;
  
  struct Collectible has key, store {
      id: UID,
      rarity: u8
  }
  
  // TODO: Implement mint function that creates a collectible
  
  // TODO: Implement share function that makes a collectible shared
}`,
        solution: `module example::collectible {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  use sui::dynamic_field as df;
  
  struct Collectible has key, store {
      id: UID,
      rarity: u8
  }
  
  entry fun mint(rarity: u8, ctx: &mut TxContext) {
      let collectible = Collectible {
          id: object::new(ctx),
          rarity
      };
      
      transfer::transfer(collectible, tx_context::sender(ctx));
  }
  
  entry fun share(collectible: Collectible) {
      transfer::share_object(collectible);
  }
}`,
        hints: [
          "Use transfer::transfer for owned objects",
          "Use transfer::share_object for shared objects",
          "The rarity parameter determines how rare the collectible is"
        ]
      });
      break;
      
    case 'advanced-concepts':
      challenges.push({
        id: `${moduleId}-challenge-1`,
        scenario: "An alien engineer wants you to demonstrate advanced Sui Move concepts.",
        task: "Implement a module with dynamic fields to store extensible data.",
        codeSnippet: `module example::dynamic_storage {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  use sui::dynamic_field as df;
  
  struct Storage has key {
      id: UID
  }
  
  // TODO: Implement create_storage function
  
  // TODO: Implement add_field function to add a u64 value with a string key
  
  // TODO: Implement get_field function to retrieve a value by key
}`,
        solution: `module example::dynamic_storage {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  use sui::dynamic_field as df;
  use std::string::{Self, String};
  
  struct Storage has key {
      id: UID
  }
  
  entry fun create_storage(ctx: &mut TxContext) {
      let storage = Storage {
          id: object::new(ctx)
      };
      
      transfer::share_object(storage);
  }
  
  entry fun add_field(storage: &mut Storage, key: vector<u8>, value: u64) {
      let key_string = string::utf8(key);
      df::add(&mut storage.id, key_string, value);
  }
  
  public fun get_field(storage: &Storage, key: vector<u8>): u64 {
      let key_string = string::utf8(key);
      df::borrow<String, u64>(&storage.id, key_string)
  }
}`,
        hints: [
          "Use dynamic_field module to add extensible storage to objects",
          "Keys can be any type that has store, copy and drop abilities",
          "Values can be any type with the store ability"
        ]
      });
      break;
      
    case 'nft-marketplace':
      challenges.push({
        id: `${moduleId}-challenge-1`,
        scenario: "An alien art collector wants you to create a simple NFT with metadata.",
        task: "Implement a digital artwork NFT with title, description and URL fields.",
        codeSnippet: `module example::digital_art {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  use std::string::{Self, String};
  
  // TODO: Define a DigitalArt struct with appropriate fields
  
  // TODO: Implement mint function
}`,
        solution: `module example::digital_art {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  use std::string::{Self, String};
  
  struct DigitalArt has key, store {
      id: UID,
      title: String,
      description: String,
      url: String,
      creator: address
  }
  
  entry fun mint(
      title: vector<u8>,
      description: vector<u8>,
      url: vector<u8>,
      ctx: &mut TxContext
  ) {
      let artwork = DigitalArt {
          id: object::new(ctx),
          title: string::utf8(title),
          description: string::utf8(description),
          url: string::utf8(url),
          creator: tx_context::sender(ctx)
      };
      
      transfer::transfer(artwork, tx_context::sender(ctx));
  }
}`,
        hints: [
          "NFTs should have the 'key' and 'store' abilities",
          "Store the creator's address to track the artist",
          "String values in Move are created from byte vectors"
        ]
      });
      break;
      
    case 'defi-protocols':
      challenges.push({
        id: `${moduleId}-challenge-1`,
        scenario: "An alien financier wants you to implement a simple coin swap mechanism.",
        task: "Create a module that lets users deposit two types of coins into a pool.",
        codeSnippet: `module example::coin_pool {
  use sui::object::{Self, UID};
  use sui::balance::{Self, Balance};
  use sui::coin::{Self, Coin};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  
  struct Pool<phantom X, phantom Y> has key {
      id: UID,
      coin_x: Balance<X>,
      coin_y: Balance<Y>
  }
  
  // TODO: Implement create_pool function
  
  // TODO: Implement add_liquidity function
}`,
        solution: `module example::coin_pool {
  use sui::object::{Self, UID};
  use sui::balance::{Self, Balance};
  use sui::coin::{Self, Coin};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  
  struct Pool<phantom X, phantom Y> has key {
      id: UID,
      coin_x: Balance<X>,
      coin_y: Balance<Y>
  }
  
  entry fun create_pool<X, Y>(ctx: &mut TxContext) {
      let pool = Pool<X, Y> {
          id: object::new(ctx),
          coin_x: balance::zero<X>(),
          coin_y: balance::zero<Y>()
      };
      
      transfer::share_object(pool);
  }
  
  entry fun add_liquidity<X, Y>(
      pool: &mut Pool<X, Y>,
      coin_x: Coin<X>,
      coin_y: Coin<Y>
  ) {
      let balance_x = coin::into_balance(coin_x);
      let balance_y = coin::into_balance(coin_y);
      
      balance::join(&mut pool.coin_x, balance_x);
      balance::join(&mut pool.coin_y, balance_y);
  }
}`,
        hints: [
          "Use phantom type parameters for coin types",
          "Initialize empty balances with balance::zero()",
          "Convert coins to balances with coin::into_balance()"
        ]
      });
      break;
  }
  
  // If no specific challenge was added based on moduleId, add a generic one
  if (challenges.length === 0) {
    challenges.push({
      id: `${moduleId}-challenge-generic`,
      scenario: "An alien programmer challenges you to implement a basic Sui module.",
      task: "Complete the implementation of this module based on the template.",
      codeSnippet: `module example::my_module {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  
  // TODO: Define a custom struct with appropriate abilities
  
  // TODO: Implement a function to create and transfer the object
}`,
      solution: `module example::my_module {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  
  struct MyObject has key, store {
      id: UID,
      data: u64
  }
  
  entry fun create(data: u64, ctx: &mut TxContext) {
      let obj = MyObject {
          id: object::new(ctx),
          data
      };
      transfer::transfer(obj, tx_context::sender(ctx));
  }
}`,
      hints: [
        "Define a struct with the key ability",
        "Create a function to mint your object",
        "Transfer the object to the sender"
      ]
    });
  }
  
  logger.log(`[GeminiService] Created ${challenges.length} alien challenges for module ${moduleId}`);
  
  // Ensure we always return at least one challenge
  return challenges;
}

/**
 * Cache for storing generated modules to avoid unnecessary API calls
 */
const moduleCache: Record<string, ModuleContent> = {};

/**
 * Get a module, either from Firebase, local cache, or by generating a new one
 */
export const getModule = async (moduleId: string): Promise<ModuleContent> => {
  // First check local memory cache
  if (moduleCache[moduleId]) {
    logger.log(`[Module] Using cached module for ${moduleId}`);
    return moduleCache[moduleId];
  }
  
  try {
    // Check if module exists in Firebase
    const moduleRef = doc(db, 'generatedModules', moduleId);
    const moduleDoc = await getDoc(moduleRef);
    
    if (moduleDoc.exists()) {
      logger.log(`[Module] Found module in Firebase for ${moduleId}`);
      const moduleData = moduleDoc.data() as ModuleContent;
      
      // Check if the module has the correct number of flashcards and quiz questions
      let needsUpdate = false;
      
      // Ensure we have exactly 15 flashcards
      if (!moduleData.flashcards || moduleData.flashcards.length !== 15) {
        logger.log(`[Module] Module has ${moduleData.flashcards?.length || 0} flashcards, updating to 15`);
        needsUpdate = true;
      }
      
      // Ensure we have exactly 10 quiz questions
      if (!moduleData.quiz || moduleData.quiz.length !== 10) {
        logger.log(`[Module] Module has ${moduleData.quiz?.length || 0} quiz questions, updating to 10`);
        needsUpdate = true;
      }
      
      // Ensure we have at least one alien challenge
      if (!moduleData.alienChallenges || moduleData.alienChallenges.length === 0) {
        logger.log(`[Module] Module has no alien challenges, adding them`);
        needsUpdate = true;
      }
      
      // If the module needs updating, generate a new one
      if (needsUpdate) {
        logger.log(`[Module] Regenerating module for ${moduleId} to meet new requirements`);
        return await regenerateModule(moduleId);
      }
      
      // Store in local cache
      moduleCache[moduleId] = moduleData;
      
      return moduleData;
    }
    
    logger.log(`[Module] Generating new module for ${moduleId}`);
    
    // Generate new module content
    const moduleContent = await generateLearningModule(moduleId);
    
    // Verify the module has all required content
    let isValid = true;
    
    // Check flashcards
    if (!moduleContent.flashcards || moduleContent.flashcards.length !== 15) {
      logger.log(`[Module] Generated module has ${moduleContent.flashcards?.length || 0} flashcards, fixing...`);
      moduleContent.flashcards = createFallbackFlashcards(moduleId, 15);
      isValid = false;
    }
    
    // Check quiz questions
    if (!moduleContent.quiz || moduleContent.quiz.length !== 10) {
      logger.log(`[Module] Generated module has ${moduleContent.quiz?.length || 0} quiz questions, fixing...`);
      moduleContent.quiz = createFallbackQuestions(moduleId, 10);
      isValid = false;
    }
    
    // Check alien challenges
    if (!moduleContent.alienChallenges || moduleContent.alienChallenges.length === 0) {
      logger.log(`[Module] Generated module has no alien challenges, adding them...`);
      moduleContent.alienChallenges = createFallbackAlienChallenges(moduleId);
      isValid = false;
    }
    
    // Store in Firebase for future use
    try {
      await setDoc(moduleRef, {
        ...moduleContent,
        createdAt: serverTimestamp(),
        moduleId: moduleId,
        wasRepaired: !isValid
      });
      logger.log(`[Module] Stored module in Firebase for ${moduleId}`);
    } catch (dbError) {
      logger.error(`[Module] Failed to store in Firebase: ${dbError}`);
    }
    
    // Store in local cache
    moduleCache[moduleId] = moduleContent;
    
    return moduleContent;
  } catch (error) {
    logger.error(`[Module] Error getting module: ${error}`);
    
    // Get topic for fallback content
    const topic = MODULE_TOPICS[moduleId as keyof typeof MODULE_TOPICS] || moduleId;
    
    // Create fallback content
    const fallbackContent = createFallbackModule(moduleId);
    
    // Store fallback in cache
    moduleCache[moduleId] = fallbackContent;
    
    // Try to store in Firebase for future use
    try {
      const moduleRef = doc(db, 'generatedModules', moduleId);
      await setDoc(moduleRef, {
        ...fallbackContent,
        createdAt: serverTimestamp(),
        moduleId: moduleId,
        isFailover: true
      });
    } catch (dbError) {
      logger.error(`[Module] Failed to store fallback in Firebase: ${dbError}`);
    }
    
    return fallbackContent;
  }
};

/**
 * Regenerate a module to ensure it has 15 flashcards and 10 quiz questions
 */
const regenerateModule = async (moduleId: string): Promise<ModuleContent> => {
  try {
    // Generate new module content
    const moduleContent = await generateLearningModule(moduleId);
    
    // Store in Firebase
    try {
      const moduleRef = doc(db, 'generatedModules', moduleId);
      await setDoc(moduleRef, {
        ...moduleContent,
        createdAt: serverTimestamp(),
        moduleId: moduleId,
        updatedAt: serverTimestamp(),
        wasRegenerated: true
      });
      logger.log(`[Module] Updated module in Firebase for ${moduleId}`);
    } catch (dbError) {
      logger.error(`[Module] Failed to update in Firebase: ${dbError}`);
    }
    
    // Store in local cache
    moduleCache[moduleId] = moduleContent;
    
    return moduleContent;
  } catch (error) {
    logger.error(`[Module] Error regenerating module: ${error}`);
    
    // Get topic for fallback content
    const topic = MODULE_TOPICS[moduleId as keyof typeof MODULE_TOPICS] || moduleId;
    
    // Create fallback content with correct counts
    const fallbackContent = createFallbackModule(moduleId);
    
    return fallbackContent;
  }
};

/**
 * Generate content with the specified model
 */
export const generateContent = async (prompt: string, modelName = DEFAULT_MODEL): Promise<string> => {
  try {
    const model = getModel(modelName);
    // Use the retry mechanism instead of direct call
    const result = await makeModelRequestWithRetry(model, prompt);
    return result.response.text();
  } catch (error) {
    logger.error(`[GeminiService] Error generating content:`, error);
    return "I'm sorry, I couldn't generate a response at the moment. Please try again later.";
  }
};

/**
 * Generate a smart contract using the Gemini model optimized for code generation
 */
export const generateSmartContract = async (prompt: string): Promise<{code: string, explanation: string}> => {
  try {
    // Enhanced prompt for better smart contract generation
    const enhancedPrompt = `${CODE_GENERATION_PROMPT_PREFIX} ${prompt}

Please format your response with:
1. The complete Move smart contract code block
2. A clear explanation of how it works
3. Important security considerations`;

    const model = getModel(SMART_CONTRACT_MODEL);
    const result = await model.generateContent(enhancedPrompt);
    const fullResponse = result.response.text();
    
    // Extract code and explanation from the response
    let code = '', explanation = '';
    
    // Check if the response contains a code block
    if (fullResponse.includes('```move') || fullResponse.includes('```sui')) {
      const codeRegex = /```(?:move|sui)([\s\S]*?)```/;
      const match = fullResponse.match(codeRegex);
      
      if (match && match[1]) {
        code = match[1].trim();
        
        // Extract explanation (everything after the last code block)
        const lastCodeBlockEnd = fullResponse.lastIndexOf('```') + 3;
        explanation = fullResponse.substring(lastCodeBlockEnd).trim();
        
        // If explanation is empty, use everything before the first code block
        if (!explanation) {
          const firstCodeBlockStart = fullResponse.indexOf('```');
          if (firstCodeBlockStart > 0) {
            explanation = fullResponse.substring(0, firstCodeBlockStart).trim();
          }
        }
      }
    }
    
    // If regex didn't work, use the full response
    if (!code) {
      code = fullResponse;
      explanation = "I've created this smart contract for you. Let me know if you need any clarification!";
    }
    
    return { code, explanation };
  } catch (error) {
    
    return { 
      code: '// An error occurred while generating the smart contract', 
      explanation: 'I encountered an error generating the smart contract. Please try again later or refine your request.'
    };
  }
};

/**
 * Get interactive learning assistance for a specific module
 */
export const getModuleAssistance = async (moduleId: string, question: string): Promise<string> => {
  const moduleContext = MODULE_KNOWLEDGE[moduleId as keyof typeof MODULE_KNOWLEDGE] || 'Sui Move development concepts';
  
  const modulePrompt = `As a Sui blockchain instructor, help a student with this question about ${moduleContext}:
  
  "${question}"
  
  Provide a clear, concise explanation focused on Sui Move development. Include small code examples where appropriate.`;
  
  return generateContent(modulePrompt);
};

/**
 * Check if a provided Move code has any errors or security issues
 */
export const analyzeSmartContract = async (code: string): Promise<string> => {
  const analysisPrompt = `Analyze this Sui Move smart contract for errors, security issues, and best practices:
  
  \`\`\`move
  ${code}
  \`\`\`
  
  Provide constructive feedback focused on:
  1. Syntax errors
  2. Security vulnerabilities
  3. Gas optimization
  4. Best practices
  5. Potential improvements`;
  
  return generateContent(analysisPrompt);
};

/**
 * Generate quiz questions using Gemini API
 * @param topic The topic to generate questions about
 * @param count Number of questions to generate
 * @param difficulty Difficulty level of questions
 * @returns An array of quiz questions
 */
export const generateQuizQuestions = async (
  topic: string,
  count: number = 10,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): Promise<QuizQuestion[]> => {
  try {
    const model = getModel(DEFAULT_MODEL);
    
    const prompt = `Create a set of 10 detailed, in-depth quiz questions about ${topic} for the Sui blockchain platform.

These should be high-quality multiple-choice questions that thoroughly test the user's understanding of ${topic} at different cognitive levels (knowledge, comprehension, application, analysis).

Each question should include:
1. A clear, specific question about ${topic} that tests deep understanding
2. Four well-crafted possible answers (labeled 1-4)
3. The index of the correct answer (1-4)
4. A comprehensive explanation of why the answer is correct and why the other options are incorrect

Question distribution:
- 3-4 questions on theoretical concepts and principles of ${topic}
- 3-4 questions on practical application and implementation details
- 2-3 questions that involve analyzing code snippets or debugging scenarios
- At least 1 question on security considerations or best practices

For code-related questions, include properly formatted Move code examples in both the questions and answers. Make sure code examples are accurate, idiomatic Sui Move code.

IMPORTANT: Return your response as raw JSON without markdown formatting or code blocks. The response must be a valid JSON array that can be parsed directly.

Use this exact format:
[
  {
    "question": "Detailed question text about ${topic}?",
    "options": [
      "Option 1 with specific, meaningful content",
      "Option 2 with specific, meaningful content",
      "Option 3 with specific, meaningful content",
      "Option 4 with specific, meaningful content"
    ],
    "correctAnswer": 1,
    "explanation": "Thorough explanation of why Option 1 is correct, including technical details and references to Sui/Move concepts. Also explain why the other options are incorrect."
  },
  ...
]

The questions should progressively build in difficulty, starting with fundamental concepts and advancing to more complex applications. Make sure questions are challenging but fair, and cover important aspects of ${topic} thoroughly and accurately.`;

    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    
    // Try multiple JSON extraction methods
    let parsedQuestions;
    const extractionMethods = [
      // Method 1: Extract JSON array using regex
      () => {
        const jsonRegex = /\[\s*\{[\s\S]*\}\s*\]/;
        const jsonMatch = responseText.match(jsonRegex);
        if (jsonMatch) {
          
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error("No JSON array found in response");
      },
      
      // Method 2: Look for JSON block between markdown code fences
      () => {
        const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
        const match = responseText.match(codeBlockRegex);
        if (match && match[1]) {
          const cleanedJson = match[1].trim();
          
          return JSON.parse(cleanedJson);
        }
        throw new Error("No JSON found in code block");
      },
      
      // Method 3: Remove all text before first [ and after last ]
      () => {
        const firstBracket = responseText.indexOf('[');
        const lastBracket = responseText.lastIndexOf(']') + 1;
        if (firstBracket !== -1 && lastBracket > firstBracket) {
          const jsonText = responseText.substring(firstBracket, lastBracket);
          
          return JSON.parse(jsonText);
        }
        throw new Error("No valid JSON brackets found");
      },
      
      // Method 4: As a last resort, try to parse the entire text as JSON
      () => {
        
        return JSON.parse(responseText);
      }
    ];
    
    // Try each extraction method until one works
    for (const method of extractionMethods) {
      try {
        parsedQuestions = method();
        if (parsedQuestions && Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
          
          break;
        }
      } catch (error) {
        
        // Continue to next method
      }
    }
    
    // If no extraction method worked, fall back to default questions
    if (!parsedQuestions || !Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      
      return createFallbackQuestions(topic, count);
    }
    
    // Validate and fix questions
    const validatedQuestions = parsedQuestions.map((q: any, index: number) => {
      // Ensure all required fields exist
      const validQuestion: QuizQuestion = {
        id: `${topic.replace(/\s+/g, '-')}-q${index + 1}`,
        question: q.question || `Question ${index + 1} about ${topic}`,
        options: Array.isArray(q.options) && q.options.length >= 4 
          ? q.options.slice(0, 4) 
          : ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: (typeof q.correctAnswer === 'number' && q.correctAnswer >= 0 && q.correctAnswer <= 3) 
          ? q.correctAnswer 
          : 0,
        explanation: q.explanation || `This is the correct answer to the question about ${topic}.`
      };
      
      return validQuestion;
    });
    
    
    return validatedQuestions;
  } catch (error) {
    
    return createFallbackQuestions(topic, count);
  }
};

/**
 * Create fallback questions if the API fails
 */
export function createFallbackQuestions(moduleId: string, count: number = 10): QuizQuestion[] {
  // Basic Sui blockchain questions as fallback
  const fallbackQuestions = [
    {
      question: "What is Sui?",
      options: [
        "A layer 1 blockchain designed for scalable apps",
        "A layer 2 solution for Ethereum",
        "A cryptocurrency exchange",
        "A blockchain gaming platform"
      ],
      correctAnswer: 0,
      explanation: "Sui is a layer 1 blockchain that's designed to be scalable and optimized for high-throughput applications."
    },
    {
      question: "What programming language is used for Sui smart contracts?",
      options: [
        "Solidity",
        "Rust",
        "Move",
        "JavaScript"
      ],
      correctAnswer: 2,
      explanation: "Move is the programming language used for developing smart contracts on Sui."
    },
    {
      question: "What is one of Sui's key innovations for scalability?",
      options: [
        "Sharding",
        "Parallel transaction execution",
        "Zero-knowledge proofs",
        "Rollups"
      ],
      correctAnswer: 1,
      explanation: "Sui achieves scalability through parallel transaction execution, allowing independent transactions to be processed simultaneously."
    },
    {
      question: "What is an object in Sui?",
      options: [
        "A governance token",
        "A data structure created and managed by Move modules",
        "A unique NFT format",
        "A validator node"
      ],
      correctAnswer: 1,
      explanation: "In Sui, objects are data structures created and managed by Move modules. They are the primary unit of storage."
    },
    {
      question: "What company created Sui?",
      options: [
        "Consensys",
        "Avalabs",
        "Mysten Labs",
        "Solana Labs"
      ],
      correctAnswer: 2,
      explanation: "Sui was created by Mysten Labs, a company founded by former senior engineers from Meta's Diem blockchain project."
    },
    {
      question: "Which of these is a unique feature of Move compared to other smart contract languages?",
      options: [
        "It's written in JavaScript",
        "Resources are first-class citizens and can't be copied or implicitly discarded",
        "It doesn't require compilation",
        "It allows unlimited recursion"
      ],
      correctAnswer: 1,
      explanation: "In Move, resources are first-class citizens and come with safety guarantees - they can't be copied or implicitly discarded, which prevents many common smart contract vulnerabilities."
    },
    {
      question: "What is a Package in Sui?",
      options: [
        "A collection of NFTs",
        "A published collection of Move modules",
        "A wallet integration",
        "A validator reward"
      ],
      correctAnswer: 1,
      explanation: "In Sui, a Package is a published collection of related Move modules that can be executed on the blockchain."
    },
    {
      question: "What is the Sui consensus mechanism?",
      options: [
        "Proof of Work",
        "Proof of History",
        "Delegated Proof of Stake",
        "Byzantine Fault Tolerant consensus"
      ],
      correctAnswer: 3,
      explanation: "Sui uses a Byzantine Fault Tolerant (BFT) consensus mechanism called Narwhal and Bullshark for ordering and efficiently processing transactions."
    },
    {
      question: "What are dynamic fields in Sui?",
      options: [
        "Fields that can change their data type at runtime",
        "Fields that automatically update with market prices",
        "A way to add and remove fields from objects after creation",
        "Animated UI elements in the Sui wallet"
      ],
      correctAnswer: 2,
      explanation: "Dynamic fields in Sui allow developers to add and remove fields from objects after they've been created, enabling more flexible data structures."
    },
    {
      question: "What is the purpose of the One-Time Witness pattern in Sui?",
      options: [
        "To verify a user's identity",
        "To ensure a module can only be initialized once",
        "To validate transaction signatures",
        "To create unique NFTs"
      ],
      correctAnswer: 1,
      explanation: "The One-Time Witness pattern in Sui is used to ensure that a module can only be initialized once, providing a guarantee that certain operations can only happen during module publication."
    }
  ];
  
  // Create an array of questions with the desired count
  const questions: QuizQuestion[] = [];
  
  // Always ensure we have exactly 10 questions
  const targetCount = 10;
  
  // If we have enough fallback questions, use them
  if (fallbackQuestions.length >= targetCount) {
    // Take the first 'targetCount' questions
    for (let i = 0; i < targetCount; i++) {
    questions.push({
        id: `${moduleId.replace(/\s+/g, '-')}-q${i + 1}`,
        ...fallbackQuestions[i]
      });
    }
  } else {
    // Use all available fallback questions
    for (let i = 0; i < fallbackQuestions.length; i++) {
      questions.push({
        id: `${moduleId.replace(/\s+/g, '-')}-q${i + 1}`,
      ...fallbackQuestions[i]
    });
    }
    
    // Fill the rest with generic questions
    for (let i = fallbackQuestions.length; i < targetCount; i++) {
      questions.push({
        id: `${moduleId.replace(/\s+/g, '-')}-q${i + 1}`,
        question: `Question about ${moduleId} (${i + 1})`,
        options: [
          `Answer option A for ${moduleId}`,
          `Answer option B for ${moduleId}`,
          `Answer option C for ${moduleId}`,
          `Answer option D for ${moduleId}`
        ],
        correctAnswer: 0,
        explanation: `This is the explanation for question ${i + 1} about ${moduleId}.`
      });
    }
  }
  
  return questions;
}

// Create a fallback module with basic content
export function createFallbackFlashcards(moduleId: string, count: number = 15): Flashcard[] {
  // Ensure we always have the exact number of flashcards requested
  const flashcards: Flashcard[] = [];
  
  // Special module content
  if (moduleId === 'intro-to-sui') {
    flashcards.push(
      {
        id: `${moduleId}-card-1`,
        question: 'What is Sui?',
        answer: 'Sui is a layer-1 blockchain designed for high throughput and low latency. It features a unique object-centric data model and uses the Move programming language for smart contracts.',
      },
      {
        id: `${moduleId}-card-2`,
        question: 'What is the Move programming language?',
        answer: 'Move is a safe and expressive programming language designed for writing secure smart contracts. It was initially developed for the Diem blockchain and has been adopted by Sui.',
      }
    );
  } else if (moduleId === 'smart-contracts-101') {
    flashcards.push(
      {
        id: `${moduleId}-card-1`,
        question: 'What is a smart contract?',
        answer: 'A smart contract is a self-executing program that runs on a blockchain. In Sui, smart contracts are written in the Move language and operate on objects.',
      },
      {
        id: `${moduleId}-card-2`,
        question: 'How do you define a module in Move?',
        answer: 'A module in Move is defined using the `module` keyword followed by the address and module name: `module address::module_name { ... }`',
      }
    );
  }
  
  // Fill remaining cards with generic content to reach exactly the required count
  const existingCount = flashcards.length;
  const remainingCount = count - existingCount;
  
  for (let i = 0; i < remainingCount; i++) {
    const cardNumber = existingCount + i + 1;
    flashcards.push({
      id: `${moduleId}-card-${cardNumber}`,
      question: `Concept ${cardNumber}: Key Learning Point`,
      answer: `This is an important concept related to ${moduleId.replace(/-/g, ' ')}. Understanding this will help you build applications on the Sui blockchain.`,
    });
  }
  
  logger.log(`[GeminiService] Created ${flashcards.length} fallback flashcards for: ${moduleId}`);
  
  return flashcards;
}

/**
 * Force complete regeneration of a module with enhanced content
 */
export const regenerateEnhancedModule = async (moduleId: string): Promise<boolean> => {
  try {
    logger.log(`[GeminiService] Regenerating enhanced module ${moduleId}`);
    
    // Generate new module content
    const moduleContent = await generateLearningModule(moduleId);
    
    // Verify the module has all required content
    let isValid = true;
    
    // Check flashcards
    if (!moduleContent.flashcards || moduleContent.flashcards.length !== 15) {
      logger.log(`[GeminiService] Generated module has ${moduleContent.flashcards?.length || 0} flashcards, fixing...`);
      moduleContent.flashcards = createFallbackFlashcards(moduleId, 15);
      isValid = false;
    }
    
    // Save the module content to Firestore
    const moduleRef = doc(db, 'generatedModules', moduleId);
    
    await setDoc(moduleRef, {
      ...moduleContent,
      moduleId,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });
    
    logger.log(`[GeminiService] Module content saved to Firestore`);
    
    // Now regenerate the quiz questions separately to ensure they're unique
    logger.log(`[GeminiService] Regenerating quiz questions for ${moduleId}`);
    const quizSuccess = await regenerateModuleQuiz(moduleId);
    
    if (!quizSuccess) {
      logger.error(`[GeminiService] Failed to regenerate quiz questions`);
      isValid = false;
    }
    
    // Also regenerate alien challenges
    logger.log(`[GeminiService] Regenerating alien challenges for ${moduleId}`);
    const alienChallenges = await generateAlienChallenges(moduleId, 1);
    
    if (alienChallenges.length === 0) {
      logger.error(`[GeminiService] Failed to regenerate alien challenges`);
      isValid = false;
    } else {
      // Update the module with new alien challenges
      await updateDoc(moduleRef, {
        alienChallenges,
        updatedAt: serverTimestamp(),
        alienChallengesLastUpdated: serverTimestamp()
      });
      
      logger.log(`[GeminiService] Alien challenges updated in Firestore`);
    }
    
    return isValid;
  } catch (error) {
    logger.error(`[GeminiService] Error regenerating enhanced module:`, error);
    return false;
  }
};

/**
 * Force regeneration of quiz questions for a specific module
 * This ensures we have unique questions tailored to each module
 */
export const regenerateModuleQuiz = async (moduleId: string): Promise<boolean> => {
  try {
    logger.log(`[GeminiService] Regenerating quiz for module ${moduleId}`);
    
    // Get the module topic for context
    const topic = MODULE_TOPICS[moduleId as keyof typeof MODULE_TOPICS] || moduleId;
    
    // Find which galaxy this module belongs to for context
    let galaxy = "";
    for (const [galaxyName, modules] of Object.entries(GALAXY_MODULES)) {
      if (modules.includes(moduleId)) {
        galaxy = galaxyName;
        break;
      }
    }
    
    // Create a focused prompt for quiz generation
    const prompt = `Create a set of 10 detailed, in-depth quiz questions about ${topic} for the Sui blockchain platform.

These should be high-quality multiple-choice questions that thoroughly test the user's understanding of ${topic} at different cognitive levels (knowledge, comprehension, application, analysis).

Each question should include:
1. A clear, specific question about ${topic} that tests deep understanding
2. Four well-crafted possible answers (labeled 1-4)
3. The index of the correct answer (1-4)
4. A comprehensive explanation of why the answer is correct and why the other options are incorrect

Question distribution:
- 3-4 questions on theoretical concepts and principles of ${topic}
- 3-4 questions on practical application and implementation details
- 2-3 questions that involve analyzing code snippets or debugging scenarios
- At least 1 question on security considerations or best practices

For code-related questions, include properly formatted Move code examples in both the questions and answers. Make sure code examples are accurate, idiomatic Sui Move code.

IMPORTANT: Return your response as raw JSON without markdown formatting or code blocks. The response must be a valid JSON array that can be parsed directly.

Use this exact format:
[
  {
    "question": "Detailed question text about ${topic}?",
    "options": [
      "Option 1 with specific, meaningful content",
      "Option 2 with specific, meaningful content",
      "Option 3 with specific, meaningful content",
      "Option 4 with specific, meaningful content"
    ],
    "correctAnswer": 1,
    "explanation": "Thorough explanation of why Option 1 is correct, including technical details and references to Sui/Move concepts. Also explain why the other options are incorrect."
  },
  ...
]

The questions should progressively build in difficulty, starting with fundamental concepts and advancing to more complex applications. Make sure questions are challenging but fair, and cover important aspects of ${topic} thoroughly and accurately.`;
    
    // Get module content from Firestore first to avoid overwriting other content
    const moduleRef = doc(db, 'generatedModules', moduleId);
    const moduleDoc = await getDoc(moduleRef);
    
    if (!moduleDoc.exists()) {
      logger.log(`[GeminiService] Module ${moduleId} doesn't exist in Firestore yet, creating it first`);
      await generateLearningModule(moduleId);
      return false;
    }
    
    // Generate quiz questions with Gemini
    logger.log(`[GeminiService] Generating quiz questions for ${moduleId}`);
    const model = getModel(DEFAULT_MODEL);
    
    // Use the retry mechanism instead of direct call
    const result = await makeModelRequestWithRetry(model, prompt);
    const response = result.response.text();
    
    if (!response) {
      logger.error(`[GeminiService] Failed to generate quiz for ${moduleId}`);
      return false;
    }
    
    // Process the response
    let processedQuestions;
    try {
      // Parse the JSON response, handling markdown code blocks
      processedQuestions = extractJsonFromText(response);
      
      // Validate the structure
      if (!Array.isArray(processedQuestions) || processedQuestions.length === 0) {
        throw new Error('Invalid quiz questions format');
      }
      
      // Add IDs to questions
      processedQuestions = processedQuestions.map((q, index) => ({
        ...q,
        id: `${moduleId}-q${index + 1}`
      }));
      
      logger.log(`[GeminiService] Generated ${processedQuestions.length} quiz questions`);
    } catch (error) {
      logger.error(`[GeminiService] Error processing quiz questions:`, error);
      return false;
    }
    
    // Update the module with new quiz questions
    const moduleData = moduleDoc.data();
    
    await updateDoc(moduleRef, {
      quiz: processedQuestions,
      updatedAt: serverTimestamp(),
      quizLastUpdated: serverTimestamp()
    });
    
    logger.log(`[GeminiService] Successfully updated quiz for module ${moduleId}`);
    return true;
    
  } catch (error) {
    logger.error(`[GeminiService] Error regenerating quiz:`, error);
    return false;
  }
};

/**
 * Generate alien challenges (coding exercises) for a module
 * @param moduleId The ID of the module
 * @param count Number of challenges to generate
 * @returns Array of alien challenges
 */
export const generateAlienChallenges = async (moduleId: string, count: number = 1): Promise<any[]> => {
  try {
    console.log(`[GeminiService] Generating ${count} alien challenges for module ${moduleId}`);
    
    // Get the module topic for context
    const topic = MODULE_TOPICS[moduleId as keyof typeof MODULE_TOPICS] || moduleId;
    
    // Find which galaxy this module belongs to for context
    let galaxy = "";
    for (const [galaxyName, modules] of Object.entries(GALAXY_MODULES)) {
      if (modules.includes(moduleId)) {
        galaxy = galaxyName;
        break;
      }
    }
    
    // Create a focused prompt for alien challenge generation
    const prompt = `Create ${count} detailed coding challenge${count > 1 ? 's' : ''} about ${topic} for the Sui blockchain platform.

These should be professional-quality, practical exercises that thoroughly test the user's understanding of ${topic} through hands-on Sui Move programming.

Each challenge should include:
1. An engaging scenario that contextualizes the problem within a real-world Sui blockchain use case
2. A specific, clearly defined task with measurable success criteria
3. A realistic code snippet that needs to be completed or fixed, with clear TODOs and comments
4. The complete solution code that is production-ready, well-documented, and follows best practices
5. 3-4 helpful hints that guide the user progressively from high-level concepts to specific implementation details without giving away the answer

Challenge requirements:
- Code must be valid, compilable Sui Move that follows current best practices
- Solutions should demonstrate proper error handling and security considerations
- Include comments explaining key parts of the solution and implementation decisions
- The challenges should be appropriately difficult for the module topic and target intermediate to advanced developers
- Each challenge should focus on a different aspect of ${topic} to cover the subject comprehensively

IMPORTANT: Return your response as raw JSON without markdown formatting or code blocks. The response must be a valid JSON array that can be parsed directly.

Use this exact format:
[
  {
    "id": "${moduleId}-challenge1",
    "scenario": "Detailed scenario description that sets up a realistic problem",
    "task": "Precise description of what the user needs to implement",
    "codeSnippet": "// Incomplete but valid Sui Move code with clear TODOs\nmodule example::module_name {\n    use sui::object::{Self, UID};\n    use sui::transfer;\n    use sui::tx_context::{Self, TxContext};\n    \n    // Struct definitions and code skeleton\n    // ...\n    \n    // TODO: Implement specific function or logic\n}",
    "solution": "// Complete, working Sui Move code\nmodule example::module_name {\n    use sui::object::{Self, UID};\n    use sui::transfer;\n    use sui::tx_context::{Self, TxContext};\n    \n    // Full implementation with comments explaining key parts\n    // ...\n}",
    "hints": [
      "Strategic hint about the approach without giving away code details",
      "More specific hint about a particular concept or pattern to use",
      "Technical hint about implementation details or syntax",
      "Final hint that guides toward the specific solution"
    ]
  }
]`;

    // Generate challenges with Gemini
    const model = getModel(DEFAULT_MODEL);
    
    // Use the retry mechanism instead of direct call
    const result = await makeModelRequestWithRetry(model, prompt);
    const response = result.response.text();
    
    if (!response) {
      console.error(`[GeminiService] Failed to generate alien challenges for ${moduleId}`);
      return [];
    }
    
    // Process the response
    try {
      // Parse the JSON response, handling markdown code blocks
      const challenges = extractJsonFromText(response);
      
      // Validate the structure
      if (!Array.isArray(challenges) || challenges.length === 0) {
        throw new Error('Invalid alien challenges format');
      }
      
      console.log(`[GeminiService] Generated ${challenges.length} alien challenges`);
      return challenges;
    } catch (error) {
      console.error(`[GeminiService] Error processing alien challenges:`, error);
      return [];
    }
    
  } catch (error) {
    console.error(`[GeminiService] Error generating alien challenges:`, error);
    return [];
  }
};

/**
 * Regenerate all modules in a specific galaxy
 * @param galaxyName The name of the galaxy (e.g., 'genesis', 'explorer')
 * @returns Object with success status and count of successfully regenerated modules
 */
export const regenerateGalaxyModules = async (galaxyName: string): Promise<{success: boolean, count: number}> => {
  try {
    console.log(`[GeminiService] Regenerating all modules in ${galaxyName} galaxy`);
    
    // Get the modules for this galaxy
    const modules = GALAXY_MODULES[galaxyName as keyof typeof GALAXY_MODULES];
    
    if (!modules || modules.length === 0) {
      console.error(`[GeminiService] No modules found for galaxy ${galaxyName}`);
      return { success: false, count: 0 };
    }
    
    console.log(`[GeminiService] Found ${modules.length} modules to regenerate in ${galaxyName} galaxy`);
    
    // Track successful regenerations and failures
    let successCount = 0;
    const failedModules: string[] = [];
    
    // Regenerate each module with increasing delays to avoid overloading the API
    for (let i = 0; i < modules.length; i++) {
      const moduleId = modules[i];
      console.log(`[GeminiService] Regenerating module ${moduleId} (${i + 1}/${modules.length})`);
      
      try {
        const success = await regenerateEnhancedModule(moduleId);
        
        if (success) {
          console.log(`[GeminiService] Successfully regenerated module ${moduleId}`);
          successCount++;
        } else {
          console.error(`[GeminiService] Failed to regenerate module ${moduleId}`);
          failedModules.push(moduleId);
        }
      } catch (error) {
        console.error(`[GeminiService] Error regenerating module ${moduleId}:`, error);
        failedModules.push(moduleId);
      }
      
      // Add an increasing delay between regenerations to avoid rate limiting
      // The delay increases for each module to give the API more time to recover
      const baseDelay = 20000; // 20 seconds
      const delayMultiplier = 1 + (i * 0.5); // Increase delay by 50% for each module
      const delay = Math.min(baseDelay * delayMultiplier, 60000); // Cap at 60 seconds
      
      if (i < modules.length - 1) {
        console.log(`[GeminiService] Waiting ${Math.round(delay / 1000)} seconds before next module...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Log the final results
    console.log(`[GeminiService] Regeneration complete for ${galaxyName} galaxy`);
    console.log(`[GeminiService] Successfully regenerated ${successCount}/${modules.length} modules`);
    
    if (failedModules.length > 0) {
      console.log(`[GeminiService] Failed modules: ${failedModules.join(', ')}`);
    }
    
    return { 
      success: successCount > 0, 
      count: successCount 
    };
  } catch (error) {
    console.error(`[GeminiService] Error regenerating galaxy modules:`, error);
    return { success: false, count: 0 };
  }
}; 

/**
 * Force regenerate a specific module with high-quality content
 * This function bypasses caches and ensures detailed content is generated
 * @param moduleId The module ID to regenerate
 * @returns True if successful, false otherwise
 */
export const forceRegenerateModule = async (moduleId: string): Promise<boolean> => {
  try {
    console.log(`[GeminiService] Force regenerating module ${moduleId} with high-quality content`);
    
    // Find which galaxy this module belongs to for context
    let galaxy = "";
    for (const [galaxyName, modules] of Object.entries(GALAXY_MODULES)) {
      if (modules.includes(moduleId)) {
        galaxy = galaxyName;
        break;
      }
    }
    
    // Get the module topic for context
    const topic = MODULE_TOPICS[moduleId as keyof typeof MODULE_TOPICS] || moduleId;
    console.log(`[GeminiService] Generating content for topic: ${topic} in galaxy: ${galaxy}`);
    
    // Create a detailed prompt for high-quality content generation with progressive learning
    const prompt = `Create comprehensive, detailed learning content about "${topic}" for the Sui blockchain platform.

This MUST be a professional-quality, in-depth module with exactly 15 flashcards that progressively build knowledge in a structured way:

1. First 7-8 flashcards covering theoretical foundations (REQUIRED):
   - What ${topic} is and its significance in Sui blockchain development
   - Core concepts and design principles specific to ${topic}
   - Key features and characteristics that make ${topic} important
   - Relationship to other Sui/Move concepts
   - Fundamental theory and mechanisms behind ${topic}
   - Real-world use cases and applications
   - Advanced theoretical considerations

2. Then 7-8 flashcards with practical coding examples (REQUIRED):
   - Basic syntax and structure with detailed code samples
   - Step-by-step implementation examples
   - Creating and using relevant resources/objects
   - Common patterns and best practices for ${topic}
   - Error handling and security considerations
   - Performance optimization techniques
   - Advanced implementation strategies
   - Concrete code examples that demonstrate these concepts

Each coding example MUST be properly formatted Sui Move code explained line by line with comments. Include specific Sui Move code examples that demonstrate the concepts.

Format the response as a valid JSON object with this EXACT structure:
{
  "title": "A clear, concise title about ${topic}",
  "description": "A comprehensive introduction to ${topic} in Sui blockchain development",
  "flashcards": [
    {
      "question": "What is ${topic}?",
      "answer": "Detailed answer with key points, examples, and when relevant, code samples that demonstrate the concept..."
    },
    // EXACTLY 15 total flashcards are required - 7-8 theory and 7-8 coding
  ],
  "summary": "A detailed summary of the key points covered in this module that reinforces the learning path"
}

CRITICAL REQUIREMENTS:
1. EXACTLY 15 total flashcards are required
2. MUST include 7-8 theoretical flashcards
3. MUST include 7-8 practical coding flashcards with actual code examples
4. Content MUST be specifically about ${topic} in the context of Sui blockchain
5. Each flashcard MUST have substantial, detailed content
6. DO NOT use generic placeholders or filler content
7. The response MUST be valid JSON that can be parsed directly

Make sure the content is accurate, educational, highly detailed, and follows a logical progression from basic concepts to more advanced topics.`;

    // Generate module content with enhanced prompt and validation
    const model = getModel(DEFAULT_MODEL);
    const result = await makeModelRequestWithRetry(model, prompt);
    const responseText = result.response.text();
    
    // Process the content with our robust JSON extraction
    let parsedContent;
    try {
      parsedContent = extractJsonFromText(responseText);
      console.log(`[GeminiService] Successfully extracted JSON module content`);
    } catch (error) {
      console.error(`[GeminiService] Error extracting module content JSON:`, error);
      return false;
    }
    
    // Validate the content structure
    if (!parsedContent || !parsedContent.flashcards || !Array.isArray(parsedContent.flashcards)) {
      console.error(`[GeminiService] Invalid module content structure`);
      return false;
    }
    
    // Ensure we have exactly 15 flashcards
    if (parsedContent.flashcards.length !== 15) {
      console.warn(`[GeminiService] Expected 15 flashcards but got ${parsedContent.flashcards.length}, fixing...`);
      
      // If we have more than 15, trim the excess
      if (parsedContent.flashcards.length > 15) {
        parsedContent.flashcards = parsedContent.flashcards.slice(0, 15);
      }
      
      // If we have less than 15, add placeholders
      while (parsedContent.flashcards.length < 15) {
        const isTheory = parsedContent.flashcards.length < 8;
        const index = parsedContent.flashcards.length + 1;
        
        parsedContent.flashcards.push({
          question: isTheory 
            ? `${index}. What is an important theoretical concept of ${topic}?`
            : `${index}. How do you implement ${topic} in Sui Move?`,
          answer: isTheory
            ? `This is an important theoretical concept in ${topic}. It relates to how Sui blockchain handles advanced data structures and object capabilities.`
            : `Here's a code example for implementing ${topic} in Sui Move:\n\n\`\`\`move\nmodule examples::${moduleId.replace(/-/g, '_')} {\n    use sui::object::{Self, UID};\n    use sui::transfer;\n    use sui::tx_context::{Self, TxContext};\n    \n    // Implementation code would go here\n    // ...\n}\n\`\`\``
        });
      }
    }
    
    // Add IDs to the flashcards
    parsedContent.flashcards = parsedContent.flashcards.map((card: any, index: number) => ({
      ...card,
      id: `${moduleId}-card-${index + 1}`
    }));
    
    // Validate content quality (basic check)
    let hasDetailedContent = true;
    let hasCodeExamples = false;
    
    for (const card of parsedContent.flashcards) {
      // Check if answers are detailed enough
      if (!card.answer || card.answer.length < 50) {
        hasDetailedContent = false;
        console.warn(`[GeminiService] Flashcard has short answer: ${card.answer}`);
      }
      
      // Check if we have code examples
      if (card.answer && (card.answer.includes('```move') || card.answer.includes('```sui') || card.answer.includes('module '))) {
        hasCodeExamples = true;
      }
    }
    
    if (!hasDetailedContent) {
      console.warn(`[GeminiService] Generated content lacks detail`);
    }
    
    if (!hasCodeExamples) {
      console.warn(`[GeminiService] Generated content lacks code examples`);
    }
    
    // Store processed content
    const moduleContent = {
      id: moduleId,
      title: parsedContent.title || `Advanced ${topic} Concepts`,
      description: parsedContent.description || `Learn about advanced concepts in ${topic} for Sui blockchain development.`,
      flashcards: parsedContent.flashcards,
      quiz: [], // Will be generated separately
      alienChallenges: [], // Will be generated separately
      summary: parsedContent.summary || `This module covered important aspects of ${topic}.`
    };
    
    // Save to Firestore
    try {
      const moduleRef = doc(db, 'generatedModules', moduleId);
      await setDoc(moduleRef, {
        ...moduleContent,
        moduleId,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        wasForceRegenerated: true
      });
      
      console.log(`[GeminiService] Saved high-quality module content to Firestore`);
      
      // Clear local cache
      if (moduleCache[moduleId]) {
        delete moduleCache[moduleId];
      }
      
      // Now regenerate quiz questions with detailed content
      console.log(`[GeminiService] Regenerating quiz questions for ${moduleId}`);
      const quizSuccess = await regenerateHighQualityQuiz(moduleId);
      
      if (!quizSuccess) {
        console.error(`[GeminiService] Failed to regenerate quiz questions`);
      }
      
      // Generate alien challenges that match the content
      console.log(`[GeminiService] Generating aligned alien challenges for ${moduleId}`);
      const challengeSuccess = await regenerateAlignedChallenges(moduleId);
      
      if (!challengeSuccess) {
        console.error(`[GeminiService] Failed to generate alien challenges`);
      }
      
      return true;
    } catch (error) {
      console.error(`[GeminiService] Error saving module content to Firestore:`, error);
      return false;
    }
  } catch (error) {
    console.error(`[GeminiService] Error force regenerating module:`, error);
    return false;
  }
};

/**
 * Generate high-quality quiz questions aligned with module content
 * @param moduleId The module ID
 * @returns True if successful, false otherwise
 */
export const regenerateHighQualityQuiz = async (moduleId: string): Promise<boolean> => {
  try {
    // Get the module topic for context
    const topic = MODULE_TOPICS[moduleId as keyof typeof MODULE_TOPICS] || moduleId;
    
    // Create an enhanced prompt for quiz generation with theory/code balance
    const prompt = `Create a set of EXACTLY 10 detailed, in-depth quiz questions about ${topic} for the Sui blockchain platform.

These must be high-quality multiple-choice questions that thoroughly test the user's understanding of ${topic} at different cognitive levels.

REQUIRED Question Distribution:
- 6-7 questions on theoretical concepts and principles of ${topic}
- 3-4 questions on practical coding implementation and application

Each question MUST include:
1. A clear, specific question about ${topic} that tests deep understanding
2. Four well-crafted possible answers (labeled 1-4)
3. The index of the correct answer (1-4)
4. A comprehensive explanation of why the answer is correct and why the other options are incorrect

For code-related questions, include properly formatted Move code examples in both the questions and answers. Make sure code examples are accurate, idiomatic Sui Move code.

IMPORTANT: Return your response as raw JSON without markdown formatting or code blocks. The response must be a valid JSON array that can be parsed directly.

Use this exact format:
[
  {
    "question": "Detailed question text about ${topic}?",
    "options": [
      "Option 1 with specific, meaningful content",
      "Option 2 with specific, meaningful content",
      "Option 3 with specific, meaningful content",
      "Option 4 with specific, meaningful content"
    ],
    "correctAnswer": 1,
    "explanation": "Thorough explanation of why Option 1 is correct, including technical details and references to Sui/Move concepts. Also explain why the other options are incorrect."
  },
  // EXACTLY 10 questions are required
]

CRITICAL REQUIREMENTS:
1. EXACTLY 10 questions are required
2. MUST include 6-7 theoretical questions
3. MUST include 3-4 coding implementation questions
4. Each question MUST be specifically about ${topic}
5. DO NOT use generic placeholders or filler content
6. Questions should progressively build in difficulty

The questions should cover important aspects of ${topic} thoroughly and accurately.`;

    // Generate quiz questions
    const model = getModel(DEFAULT_MODEL);
    const result = await makeModelRequestWithRetry(model, prompt);
    const responseText = result.response.text();
    
    // Process the content with our robust JSON extraction
    let quizQuestions;
    try {
      quizQuestions = extractJsonFromText(responseText);
      console.log(`[GeminiService] Successfully extracted quiz questions JSON`);
    } catch (error) {
      console.error(`[GeminiService] Error extracting quiz questions JSON:`, error);
      return false;
    }
    
    // Validate the questions
    if (!Array.isArray(quizQuestions) || quizQuestions.length === 0) {
      console.error(`[GeminiService] Invalid quiz questions format`);
      return false;
    }
    
    // Ensure we have exactly 10 questions
    if (quizQuestions.length !== 10) {
      console.warn(`[GeminiService] Expected 10 questions but got ${quizQuestions.length}, fixing...`);
      
      // If we have more than 10, trim the excess
      if (quizQuestions.length > 10) {
        quizQuestions = quizQuestions.slice(0, 10);
      }
      
      // If we have less than 10, add placeholders
      while (quizQuestions.length < 10) {
        const isCoding = quizQuestions.length > 6;
        const index = quizQuestions.length + 1;
        
        quizQuestions.push({
          question: isCoding 
            ? `What is the correct way to implement ${topic} in Sui Move?`
            : `What is an important concept in ${topic}?`,
          options: isCoding
            ? [
                `Use the ${moduleId.replace(/-/g, '_')}::create function`,
                `Initialize with object::new(ctx)`,
                `Call transfer::transfer to the sender`,
                `All of the above`
              ]
            : [
                `It's a core feature of Sui blockchain`,
                `It's related to object capabilities`,
                `It's a fundamental concept in Move programming`,
                `All of the above`
              ],
          correctAnswer: 3,
          explanation: isCoding
            ? `The correct implementation requires creating the object, initializing it, and transferring it to the sender.`
            : `All of the options are correct aspects of ${topic} in Sui blockchain development.`
        });
      }
    }
    
    // Add IDs to the questions
    quizQuestions = quizQuestions.map((question: any, index: number) => ({
      ...question,
      id: `${moduleId}-quiz-${index + 1}`
    }));
    
    // Save to Firestore
    try {
      const moduleRef = doc(db, 'generatedModules', moduleId);
      await updateDoc(moduleRef, {
        quiz: quizQuestions,
        updatedAt: serverTimestamp(),
        quizLastUpdated: serverTimestamp()
      });
      
      console.log(`[GeminiService] Saved high-quality quiz questions to Firestore`);
      return true;
    } catch (error) {
      console.error(`[GeminiService] Error saving quiz questions to Firestore:`, error);
      return false;
    }
  } catch (error) {
    console.error(`[GeminiService] Error generating high-quality quiz:`, error);
    return false;
  }
};

/**
 * Generate alien challenges aligned with module content
 * @param moduleId The module ID
 * @returns True if successful, false otherwise
 */
export const regenerateAlignedChallenges = async (moduleId: string): Promise<boolean> => {
  try {
    // Get the module topic for context
    const topic = MODULE_TOPICS[moduleId as keyof typeof MODULE_TOPICS] || moduleId;
    
    // Create a detailed prompt for aligned alien challenges
    const prompt = `Create 2 detailed coding challenges about ${topic} for the Sui blockchain platform.

These must be high-quality, practical exercises that thoroughly test the user's understanding of ${topic} through hands-on Sui Move programming.

Each challenge MUST include:
1. An engaging scenario that contextualizes the problem within a real-world Sui blockchain use case
2. A specific, clearly defined task with measurable success criteria
3. A realistic code snippet that needs to be completed or fixed, with clear TODOs and comments
4. The complete solution code that is production-ready, well-documented, and follows best practices
5. 3-4 helpful hints that guide the user progressively without giving away the answer

Challenge requirements:
- Code must be valid, compilable Sui Move that follows current best practices
- Solutions should demonstrate proper error handling and security considerations
- Include comments explaining key parts of the solution
- The challenges should focus on different aspects of ${topic}
- Challenges should directly relate to the concepts taught in the module

IMPORTANT: Return your response as raw JSON without markdown formatting or code blocks. The response must be a valid JSON array that can be parsed directly.

Use this exact format:
[
  {
    "id": "${moduleId}-challenge1",
    "scenario": "Detailed scenario description that sets up a realistic problem",
    "task": "Precise description of what the user needs to implement",
    "codeSnippet": "// Incomplete but valid Sui Move code with clear TODOs\\nmodule example::module_name {\\n    use sui::object::{Self, UID};\\n    use sui::transfer;\\n    use sui::tx_context::{Self, TxContext};\\n    \\n    // Struct definitions and code skeleton\\n    // ...\\n    \\n    // TODO: Implement specific function or logic\\n}",
    "solution": "// Complete, working Sui Move code\\nmodule example::module_name {\\n    use sui::object::{Self, UID};\\n    use sui::transfer;\\n    use sui::tx_context::{Self, TxContext};\\n    \\n    // Full implementation with comments explaining key parts\\n    // ...\\n}",
    "hints": [
      "Strategic hint about the approach without giving away code details",
      "More specific hint about a particular concept or pattern to use",
      "Technical hint about implementation details or syntax",
      "Final hint that guides toward the specific solution"
    ]
  },
  {
    "id": "${moduleId}-challenge2",
    "scenario": "Different scenario focusing on another aspect of ${topic}",
    "task": "Another implementation task related to ${topic}",
    "codeSnippet": "// Different code skeleton for the second challenge\\nmodule example::another_module {\\n    // ...\\n}",
    "solution": "// Complete solution for the second challenge\\nmodule example::another_module {\\n    // ...\\n}",
    "hints": [
      "First hint for second challenge",
      "Second hint for second challenge",
      "Third hint for second challenge",
      "Fourth hint for second challenge"
    ]
  }
]`;

    // Generate alien challenges
    const model = getModel(DEFAULT_MODEL);
    const result = await makeModelRequestWithRetry(model, prompt);
    const responseText = result.response.text();
    
    // Process the content with our robust JSON extraction
    let challenges;
    try {
      challenges = extractJsonFromText(responseText);
      console.log(`[GeminiService] Successfully extracted alien challenges JSON`);
    } catch (error) {
      console.error(`[GeminiService] Error extracting alien challenges JSON:`, error);
      return false;
    }
    
    // Validate the challenges
    if (!Array.isArray(challenges) || challenges.length === 0) {
      console.error(`[GeminiService] Invalid alien challenges format`);
      return false;
    }
    
    // Ensure we have exactly 2 challenges
    if (challenges.length !== 2) {
      console.warn(`[GeminiService] Expected 2 challenges but got ${challenges.length}, fixing...`);
      
      // If we have more than 2, trim the excess
      if (challenges.length > 2) {
        challenges = challenges.slice(0, 2);
      }
      
      // If we have less than 2, add placeholders
      while (challenges.length < 2) {
        const index = challenges.length + 1;
        
        challenges.push({
          id: `${moduleId}-challenge${index}`,
          scenario: `Implement a feature related to ${topic} in Sui Move`,
          task: `Create a module that demonstrates ${topic} functionality`,
          codeSnippet: `module example::${moduleId.replace(/-/g, '_')}_challenge${index} {\n    use sui::object::{Self, UID};\n    use sui::transfer;\n    use sui::tx_context::{Self, TxContext};\n    \n    struct ExampleObject has key, store {\n        id: UID,\n        // Add appropriate fields here\n    }\n    \n    // TODO: Implement required functions\n}`,
          solution: `module example::${moduleId.replace(/-/g, '_')}_challenge${index} {\n    use sui::object::{Self, UID};\n    use sui::transfer;\n    use sui::tx_context::{Self, TxContext};\n    \n    struct ExampleObject has key, store {\n        id: UID,\n        value: u64\n    }\n    \n    // Create a new example object\n    public fun create(value: u64, ctx: &mut TxContext): ExampleObject {\n        ExampleObject {\n            id: object::new(ctx),\n            value\n        }\n    }\n    \n    // Transfer example object to recipient\n    public entry fun transfer_object(object: ExampleObject, recipient: address) {\n        transfer::transfer(object, recipient);\n    }\n}`,
          hints: [
            `Think about what data structures would best represent ${topic}`,
            `Consider how to initialize the object properly`,
            `Remember to implement proper transfer mechanics`,
            `Make sure to handle edge cases and errors`
          ]
        });
      }
    }
    
    // Save to Firestore
    try {
      const moduleRef = doc(db, 'generatedModules', moduleId);
      await updateDoc(moduleRef, {
        alienChallenges: challenges,
        updatedAt: serverTimestamp(),
        alienChallengesLastUpdated: serverTimestamp()
      });
      
      console.log(`[GeminiService] Saved aligned alien challenges to Firestore`);
      return true;
    } catch (error) {
      console.error(`[GeminiService] Error saving alien challenges to Firestore:`, error);
      return false;
    }
  } catch (error) {
    console.error(`[GeminiService] Error generating aligned challenges:`, error);
    return false;
  }
};

/**
 * Force regenerate all modules in a galaxy with high-quality content
 * @param galaxyName The name of the galaxy (e.g., 'genesis', 'explorer')
 * @returns Object with success status and count of successfully regenerated modules
 */
export const forceRegenerateGalaxyModules = async (galaxyName: string): Promise<{success: boolean, count: number}> => {
  try {
    console.log(`[GeminiService] Force regenerating all modules in ${galaxyName} galaxy with high-quality content`);
    
    // Get the modules for this galaxy
    const modules = GALAXY_MODULES[galaxyName as keyof typeof GALAXY_MODULES];
    
    if (!modules || modules.length === 0) {
      console.error(`[GeminiService] No modules found for galaxy ${galaxyName}`);
      return { success: false, count: 0 };
    }
    
    console.log(`[GeminiService] Found ${modules.length} modules to regenerate in ${galaxyName} galaxy`);
    
    // Track successful regenerations and failures
    let successCount = 0;
    const failedModules: string[] = [];
    
    // Regenerate each module with increasing delays to avoid overloading the API
    for (let i = 0; i < modules.length; i++) {
      const moduleId = modules[i];
      console.log(`[GeminiService] Force regenerating module ${moduleId} (${i + 1}/${modules.length})`);
      
      try {
        // Use the force regenerate function for high-quality content
        const success = await forceRegenerateModule(moduleId);
        
        if (success) {
          console.log(`[GeminiService] Successfully regenerated module ${moduleId} with high-quality content`);
          successCount++;
        } else {
          console.error(`[GeminiService] Failed to regenerate module ${moduleId}`);
          failedModules.push(moduleId);
        }
      } catch (error) {
        console.error(`[GeminiService] Error regenerating module ${moduleId}:`, error);
        failedModules.push(moduleId);
      }
      
      // Add an increasing delay between regenerations to avoid rate limiting
      // The delay increases for each module to give the API more time to recover
      const baseDelay = 20000; // 20 seconds
      const delayMultiplier = 1 + (i * 0.5); // Increase delay by 50% for each module
      const delay = Math.min(baseDelay * delayMultiplier, 60000); // Cap at 60 seconds
      
      if (i < modules.length - 1) {
        console.log(`[GeminiService] Waiting ${Math.round(delay / 1000)} seconds before next module...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Log the final results
    console.log(`[GeminiService] High-quality regeneration complete for ${galaxyName} galaxy`);
    console.log(`[GeminiService] Successfully regenerated ${successCount}/${modules.length} modules`);
    
    if (failedModules.length > 0) {
      console.log(`[GeminiService] Failed modules: ${failedModules.join(', ')}`);
    }
    
    return { 
      success: successCount > 0, 
      count: successCount 
    };
  } catch (error) {
    console.error(`[GeminiService] Error force regenerating galaxy modules:`, error);
    return { success: false, count: 0 };
  }
}; 