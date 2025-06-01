import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';

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
    
    // Create a clearer, more structured prompt that encourages proper JSON formatting
    const prompt = `Create an engaging learning module about "${topic}" for a space-themed educational platform about the Sui blockchain.

This is Module ${moduleNumber} in the ${galaxy} Galaxy. ${moduleNumber === 2 ? "This module should build upon knowledge from the first module in this galaxy." : "This is the entry module for this galaxy."}

Return your response as a valid JSON object with these fields:
{
  "title": "Module Title",
  "description": "Brief 2-3 sentence description of this module",
  "flashcards": [
    {
      "question": "What is [Concept]?",
      "answer": "Detailed explanation with proper formatting. Include code examples using markdown code blocks where relevant:
\`\`\`move
module example::module_name {
    // Code example here
    // Use proper Move syntax
}
\`\`\`
Include bullet points and structured content."
    }
    // Include exactly 15 flashcards that progressively build knowledge and cover all important aspects of the topic
    // Make sure flashcards are comprehensive and informative, covering all key Sui concepts related to the topic
  ],
  "quiz": [
    {
      "question": "Clear, concise question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0, // Index (0-3) of the correct answer
      "explanation": "Why this answer is correct and what makes the others wrong"
    }
    // Include 10 quiz questions that test understanding of the concepts
  ],
  "codingChallenges": [
    {
      "scenario": "Brief scenario description that's engaging and relates to the module content",
      "task": "Specific instructions on what the user needs to implement",
      "codeSnippet": "// Starting code template with TODO comments indicating where to add code\nmodule example::challenge {\n    use sui::transfer;\n    use sui::object::{Self, UID};\n    // TODO: Add implementation\n}",
      "solution": "// Complete solution code\nmodule example::challenge {\n    use sui::transfer;\n    use sui::object::{Self, UID};\n    // Full implementation here\n}",
      "hints": ["Specific hint 1", "More detailed hint 2"]
    }
    // Include 3 coding challenges of increasing difficulty
  ],
  "summary": "Summary paragraph of key learnings that reinforces main concepts"
}

Make sure the content:
1. Is accurate and educational
2. Follows a logical progression of complexity
3. Includes properly formatted Move code examples
4. Has practical examples relevant to real-world Sui development
5. Builds upon previous knowledge appropriately for Module ${moduleNumber}
6. Provides comprehensive coverage of the topic with 15 detailed flashcards
7. Includes 10 diverse quiz questions that test different aspects of the topic`;

    
    
    try {
      const model = getModel(SMART_CONTRACT_MODEL);
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
        alienChallenges: (parsedContent.codingChallenges || []).map((challenge: any, index: number) => ({
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
      
      
      // Return a fallback module with some content
      const fallbackModule = createFallbackModule(moduleId);
      return fallbackModule;
    }
  } catch (error) {
    
    // Return a complete fallback module
    return createFallbackModule(moduleId);
  }
};

/**
 * Creates a fallback module if Gemini API fails
 */
export function createFallbackModule(moduleId: string): ModuleContent {
  console.warn(`[GeminiService] Creating fallback module content for: ${moduleId}`);
  
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
  console.log(`[GeminiService] Created ${flashcards.length} flashcards for module ${moduleId}`);
  if (flashcards.length !== FLASHCARD_COUNT) {
    console.warn(`[GeminiService] Flashcard count mismatch: ${flashcards.length}/${FLASHCARD_COUNT}`);
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
  console.log(`[GeminiService] Created ${quizQuestions.length} quiz questions for module ${moduleId}`);
  if (quizQuestions.length !== QUIZ_QUESTION_COUNT) {
    console.warn(`[GeminiService] Quiz question count mismatch: ${quizQuestions.length}/${QUIZ_QUESTION_COUNT}`);
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
  
  console.log(`[GeminiService] Created ${challenges.length} alien challenges for module ${moduleId}`);
  
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
    console.log(`[Module] Using cached module for ${moduleId}`);
    return moduleCache[moduleId];
  }
  
  try {
    // Check if module exists in Firebase
    const moduleRef = doc(db, 'generatedModules', moduleId);
    const moduleDoc = await getDoc(moduleRef);
    
    if (moduleDoc.exists()) {
      console.log(`[Module] Found module in Firebase for ${moduleId}`);
      const moduleData = moduleDoc.data() as ModuleContent;
      
      // Check if the module has the correct number of flashcards and quiz questions
      let needsUpdate = false;
      
      // Ensure we have exactly 15 flashcards
      if (!moduleData.flashcards || moduleData.flashcards.length !== 15) {
        console.log(`[Module] Module has ${moduleData.flashcards?.length || 0} flashcards, updating to 15`);
        needsUpdate = true;
      }
      
      // Ensure we have exactly 10 quiz questions
      if (!moduleData.quiz || moduleData.quiz.length !== 10) {
        console.log(`[Module] Module has ${moduleData.quiz?.length || 0} quiz questions, updating to 10`);
        needsUpdate = true;
      }
      
      // Ensure we have at least one alien challenge
      if (!moduleData.alienChallenges || moduleData.alienChallenges.length === 0) {
        console.log(`[Module] Module has no alien challenges, adding them`);
        needsUpdate = true;
      }
      
      // If the module needs updating, generate a new one
      if (needsUpdate) {
        console.log(`[Module] Regenerating module for ${moduleId} to meet new requirements`);
        return await regenerateModule(moduleId);
      }
      
      // Store in local cache
      moduleCache[moduleId] = moduleData;
      
      return moduleData;
    }
    
    console.log(`[Module] Generating new module for ${moduleId}`);
    
    // Generate new module content
    const moduleContent = await generateLearningModule(moduleId);
    
    // Verify the module has all required content
    let isValid = true;
    
    // Check flashcards
    if (!moduleContent.flashcards || moduleContent.flashcards.length !== 15) {
      console.log(`[Module] Generated module has ${moduleContent.flashcards?.length || 0} flashcards, fixing...`);
      moduleContent.flashcards = createFallbackFlashcards(moduleId, 15);
      isValid = false;
    }
    
    // Check quiz questions
    if (!moduleContent.quiz || moduleContent.quiz.length !== 10) {
      console.log(`[Module] Generated module has ${moduleContent.quiz?.length || 0} quiz questions, fixing...`);
      moduleContent.quiz = createFallbackQuestions(moduleId, 10);
      isValid = false;
    }
    
    // Check alien challenges
    if (!moduleContent.alienChallenges || moduleContent.alienChallenges.length === 0) {
      console.log(`[Module] Generated module has no alien challenges, adding them...`);
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
      console.log(`[Module] Stored module in Firebase for ${moduleId}`);
    } catch (dbError) {
      console.error(`[Module] Failed to store in Firebase: ${dbError}`);
    }
    
    // Store in local cache
    moduleCache[moduleId] = moduleContent;
    
    return moduleContent;
  } catch (error) {
    console.error(`[Module] Error getting module: ${error}`);
    
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
      console.error(`[Module] Failed to store fallback in Firebase: ${dbError}`);
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
      console.log(`[Module] Updated module in Firebase for ${moduleId}`);
    } catch (dbError) {
      console.error(`[Module] Failed to update in Firebase: ${dbError}`);
    }
    
    // Store in local cache
    moduleCache[moduleId] = moduleContent;
    
    return moduleContent;
  } catch (error) {
    console.error(`[Module] Error regenerating module: ${error}`);
    
    // Get topic for fallback content
    const topic = MODULE_TOPICS[moduleId as keyof typeof MODULE_TOPICS] || moduleId;
    
    // Create fallback content with correct counts
    const fallbackContent = createFallbackModule(moduleId);
    
    return fallbackContent;
  }
};

/**
 * Generate content using Gemini API
 */
export const generateContent = async (prompt: string, modelName = DEFAULT_MODEL): Promise<string> => {
  try {
    const model = getModel(modelName);
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    
    return 'I encountered an error generating a response. Please try again later.';
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
    
    const prompt = `Generate ${count} multiple-choice quiz questions about ${topic}. 
The questions should be at ${difficulty} difficulty level.

IMPORTANT: Your response must be valid JSON array of question objects.

Each question must follow this exact JSON format:
{
  "question": "The question text here",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": 0, // Index of the correct answer (0-3)
  "explanation": "Explanation why this answer is correct"
}

Ensure that:
1. Each question has exactly 4 options
2. The correct answer index is between 0-3
3. Each question includes a clear explanation
4. Questions are factually accurate
5. For ${difficulty} difficulty, the questions should be ${
      difficulty === 'easy' 
        ? 'basic and straightforward, suitable for beginners' 
        : difficulty === 'medium' 
        ? 'moderately challenging with some nuanced concepts' 
        : 'advanced and detailed, requiring deep knowledge'
    }

Return ONLY a valid JSON array of question objects without any text before or after.`;

    
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
  
  console.log(`[GeminiService] Created ${flashcards.length} fallback flashcards for: ${moduleId}`);
  
  return flashcards;
} 