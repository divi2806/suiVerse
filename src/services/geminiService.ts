import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// Function to select the best available API key
const selectApiKey = (): string => {
  // First try env variable for Vite 
  if (import.meta.env.VITE_GEMINI_API_KEY) {
    console.log("[Gemini] Using API key from VITE_GEMINI_API_KEY");
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  
  // Try alternative env variables (for different build systems)
  if (import.meta.env.REACT_APP_GEMINI_API_KEY) {
    console.log("[Gemini] Using API key from REACT_APP_GEMINI_API_KEY");
    return import.meta.env.REACT_APP_GEMINI_API_KEY;
  }
  
  // Fallback to backup API keys
  const backupKeys = [
    'AIzaSyC9YKF89cnfSAAzM6TilPY29Ea9LeiIf8s',  // Primary backup
    'AIzaSyC9YKF89cnfSAAzM6TilPY29Ea9LeiIf8s',  // Secondary backup
  ];
  
  // Try each backup key in order
  for (const key of backupKeys) {
    console.log("[Gemini] Trying backup API key");
    return key;
  }
  
  // Last resort fallback
  console.warn("[Gemini] No valid API key found, using default fallback key");
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

// Initialize the Gemini API with error handling
let genAI;
try {
  genAI = new GoogleGenerativeAI(API_KEY);
  console.log("[Gemini] API initialized successfully");
} catch (error) {
  console.error("[Gemini] Failed to initialize API:", error);
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
      console.log(`[Gemini] Created model instance for: ${modelName}`);
    }
    return modelInstances[modelName];
  } catch (error) {
    console.error(`[Gemini] Error creating model instance for ${modelName}:`, error);
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
  title: string;
  description: string;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  alienChallenges?: CodingChallenge[];
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

const MODULE_TOPICS = {
  // Genesis Galaxy
  'intro-to-sui': 'Introduction to the Sui blockchain platform',
  'smart-contracts-101': 'Fundamentals of smart contracts on Sui',
  
  // Explorer Galaxy
  'move-language': 'Move programming language basics for Sui',
  'objects-ownership': 'Sui objects and ownership models',
  
  // Nebula Galaxy
  'advanced-concepts': 'Advanced Sui development concepts',
  'nft-marketplace': 'Building NFT marketplaces on Sui',
  
  // Cosmic Galaxy
  'defi-protocols': 'Decentralized finance protocols on Sui',
  'blockchain-security': 'Security best practices for Sui development',
  
  // Nova Galaxy
  'tokenomics': 'Token economics and design on Sui',
  'cross-chain-apps': 'Building cross-chain applications with Sui',
  
  // Stellar Galaxy
  'sui-governance': 'Governance mechanisms on the Sui network',
  'zk-applications': 'Zero-knowledge applications on Sui',
  
  // Quantum Galaxy
  'gaming-on-blockchain': 'Blockchain gaming with Sui',
  'social-networks': 'Building social networks on Sui',
  
  // Aurora Galaxy
  'identity-solutions': 'Digital identity solutions using Sui',
  'real-world-assets': 'Tokenizing real-world assets on Sui',
  
  // Home Planet
  'graduation-galaxy': 'Final comprehensive challenge to return to Earth',
};

/**
 * Generates a complete learning module with flashcards, quizzes, and coding challenges
 */
export const generateLearningModule = async (moduleId: string): Promise<ModuleContent> => {
  try {
    const topic = MODULE_TOPICS[moduleId as keyof typeof MODULE_TOPICS] || moduleId;
    console.log(`[generateLearningModule] Generating content for topic: ${topic}`);
    
    // Create a clearer, more structured prompt that encourages proper JSON formatting
    const prompt = `Create an engaging learning module about "${topic}" for a space-themed educational platform about the Sui blockchain.

Return your response as a valid JSON object with these fields:
{
  "title": "Module Title",
  "description": "Brief 2-3 sentence description",
  "flashcards": [
    {"question": "Question text", "answer": "Detailed answer text"}
    // Include 8 flashcards total
  ],
  "quiz": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0, // Index (0-3) of the correct answer
      "explanation": "Why this answer is correct"
    }
    // Include 5 quiz questions total
  ],
  "codingChallenges": [
    {
      "scenario": "Brief scenario description",
      "task": "What the user needs to do",
      "codeSnippet": "Starting code template...",
      "solution": "Complete solution code...",
      "hints": ["Hint 1", "Hint 2"]
    }
    // Include 3 coding challenges total
  ],
  "summary": "Summary paragraph of key learnings"
}

Make sure the content is accurate, educational, and follows a logical progression of complexity.`;

    console.log(`[generateLearningModule] Sending prompt to Gemini API for ${moduleId}...`);
    
    try {
      const model = getModel(SMART_CONTRACT_MODEL);
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      console.log(`[generateLearningModule] Received response from Gemini, length: ${text.length} characters`);
      
      // Try multiple approaches to extract valid JSON
      let parsedContent = null;
      let extractionMethods = [
        // Method 1: Look for JSON block between markdown code fences
        () => {
          const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            const cleanedJson = jsonMatch[1].trim();
            console.log(`[generateLearningModule] Extracted JSON from code block: ${cleanedJson.substring(0, 100)}...`);
            return JSON.parse(cleanedJson);
          }
          throw new Error("No JSON found in code block");
        },
        
        // Method 2: Look for content that starts with { and ends with }
        () => {
          const jsonMatch = text.match(/{[\s\S]*}/);
          if (jsonMatch) {
            const cleanedJson = jsonMatch[0].trim();
            console.log(`[generateLearningModule] Extracted JSON using brace matching: ${cleanedJson.substring(0, 100)}...`);
            return JSON.parse(cleanedJson);
          }
          throw new Error("No JSON found using brace matching");
        },
        
        // Method 3: Try to parse the entire text as JSON
        () => {
          console.log(`[generateLearningModule] Attempting to parse entire response as JSON`);
          return JSON.parse(text);
        }
      ];
      
      // Try each method until one works
      for (const method of extractionMethods) {
        try {
          parsedContent = method();
          if (parsedContent) break;
        } catch (error) {
          console.warn(`[generateLearningModule] JSON extraction method failed:`, error);
          // Continue to next method
        }
      }
      
      // If no method worked, try a different approach - generate just quiz questions
      if (!parsedContent) {
        console.warn(`[generateLearningModule] Could not parse JSON response, will generate quiz questions separately`);
        
        // Create a basic module structure
        const basicModule = createFallbackModule(moduleId, topic);
        
        // Try to generate just the quiz questions
        try {
          console.log(`[generateLearningModule] Generating quiz questions separately for ${moduleId}...`);
          const quizQuestions = await generateQuizQuestions(topic, 5, 'medium');
          
          if (quizQuestions && quizQuestions.length > 0) {
            console.log(`[generateLearningModule] Successfully generated ${quizQuestions.length} quiz questions separately`);
            basicModule.quiz = quizQuestions;
          }
        } catch (quizError) {
          console.error(`[generateLearningModule] Failed to generate separate quiz questions:`, quizError);
        }
        
        return basicModule;
      }
      
      // Successfully parsed JSON response
      console.log(`[generateLearningModule] Successfully parsed JSON for ${moduleId}`);
      
      // Check if quiz questions exist and have the correct format
      let quizQuestions = [];
      if (parsedContent.quiz && Array.isArray(parsedContent.quiz)) {
        console.log(`[generateLearningModule] ${parsedContent.quiz.length} quiz questions found in response`);
        
        // Validate quiz questions format
        quizQuestions = parsedContent.quiz.map((q: any, index: number) => {
          const correctAnswer = typeof q.correctAnswerIndex !== 'undefined' ? 
            q.correctAnswerIndex : 
            (typeof q.correctAnswer !== 'undefined' ? q.correctAnswer : 0);
            
          return {
            id: `${moduleId}-quiz-${index}`,
            question: q.question || `Question about ${topic} #${index + 1}`,
            options: Array.isArray(q.options) && q.options.length >= 4 ? 
              q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: correctAnswer,
            explanation: q.explanation || 'This is the correct answer based on the module content.'
          };
        });
      } else {
        console.warn(`[generateLearningModule] No quiz array found in API response or invalid format`);
        // Generate quiz questions separately
        try {
          quizQuestions = await generateQuizQuestions(topic, 5, 'medium');
          console.log(`[generateLearningModule] Generated ${quizQuestions.length} quiz questions separately`);
        } catch (quizError) {
          console.error(`[generateLearningModule] Failed to generate separate quiz questions:`, quizError);
          quizQuestions = createFallbackQuestions(topic, 5, 'medium');
        }
      }
      
      // Transform the data into our expected format
      return {
        title: parsedContent.title || `Learn about ${topic}`,
        description: parsedContent.description || `A comprehensive module about ${topic}`,
        flashcards: (parsedContent.flashcards || []).map((card: any, index: number) => ({
          id: `${moduleId}-card-${index}`,
          question: card.question || `Question about ${topic} #${index + 1}`,
          answer: card.answer || `This is information about ${topic}.`,
          imagePrompt: card.imagePrompt || `${topic} ${card.question?.split(' ').slice(0, 3).join(' ') || ''}`
        })),
        quiz: quizQuestions,
        alienChallenges: (parsedContent.codingChallenges || []).map((challenge: any, index: number) => ({
          id: `${moduleId}-challenge-${index}`,
          scenario: challenge.scenario || `Scenario about ${topic}`,
          task: challenge.task || `Complete this task related to ${topic}`,
          codeSnippet: challenge.codeSnippet || '// Add your code here',
          solution: challenge.solution || '// Solution code',
          hints: Array.isArray(challenge.hints) ? challenge.hints : ['Think about the concepts', 'Check your syntax']
        })),
        summary: parsedContent.summary || `You've completed the ${topic} module. Great job!`
      };
    } catch (apiError) {
      console.error(`[generateLearningModule] API error for ${moduleId}:`, apiError);
      
      // Use dedicated quiz generation as a backup
      const fallbackModule = createFallbackModule(moduleId, topic);
      
      try {
        // Still try to get quiz questions at least
        const quizQuestions = await generateQuizQuestions(topic, 5, 'medium');
        if (quizQuestions && quizQuestions.length > 0) {
          fallbackModule.quiz = quizQuestions;
        }
      } catch (quizError) {
        console.error(`[generateLearningModule] Failed to generate backup quiz questions:`, quizError);
      }
      
      return fallbackModule;
    }
  } catch (error) {
    console.error(`[generateLearningModule] Fatal error for ${moduleId}:`, error);
    return createFallbackModule(moduleId, moduleId);
  }
};

/**
 * Creates a fallback module if Gemini API fails
 */
const createFallbackModule = (moduleId: string, topic: string): ModuleContent => {
  return {
    title: `Learn about ${topic}`,
    description: `This module teaches you the fundamentals of ${topic} in the Sui blockchain ecosystem.`,
    flashcards: Array(5).fill(0).map((_, index) => ({
      id: `${moduleId}-card-${index}`,
      question: `What is an important concept in ${topic}?`,
      answer: `This is a placeholder for ${topic} content that would normally be generated by AI.`
    })),
    quiz: Array(3).fill(0).map((_, index) => ({
      id: `${moduleId}-quiz-${index}`,
      question: `Question about ${topic}?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 0,
      explanation: 'This is a placeholder explanation.'
    })),
    alienChallenges: Array(2).fill(0).map((_, index) => ({
      id: `${moduleId}-challenge-${index}`,
      scenario: `You encounter an alien that knows about ${topic}!`,
      task: `Complete the code to defeat the alien using ${topic} knowledge.`,
      codeSnippet: '// Complete the code\nmodule example::module {\n    // Add your code here\n}',
      solution: 'module example::module {\n    // Solution code\n}',
      hints: ['Think about the core concepts', 'Check your syntax']
    })),
    summary: `Congratulations! You've mastered the basics of ${topic}.`
  };
};

/**
 * Cache for storing generated modules to avoid unnecessary API calls
 */
const moduleCache: Record<string, ModuleContent> = {};

/**
 * Get a module, either from cache or by generating a new one
 */
export const getModule = async (moduleId: string): Promise<ModuleContent> => {
  if (moduleCache[moduleId]) {
    console.log(`[getModule] Using cached module data for ${moduleId}`);
    return moduleCache[moduleId];
  }
  
  try {
    console.log(`[getModule] Generating learning module for ${moduleId}...`);
    const module = await generateLearningModule(moduleId);
    
    // Verify that quiz questions are valid
    if (!module.quiz || module.quiz.length === 0) {
      console.warn(`[getModule] No quiz questions generated for module ${moduleId}, using fallbacks`);
      // If quiz questions are missing, add fallback questions
      const topic = MODULE_KNOWLEDGE[moduleId as keyof typeof MODULE_KNOWLEDGE] || 'Sui blockchain';
      module.quiz = createFallbackQuestions(topic, 5, 'medium');
      console.log(`[getModule] Added ${module.quiz.length} fallback questions`);
    } else {
      console.log(`[getModule] Successfully generated ${module.quiz.length} quiz questions from API`);
      
      // Log one example question to verify format
      if (module.quiz.length > 0) {
        console.log(`[getModule] Example question: ${JSON.stringify(module.quiz[0])}`);
      }
      
      // Verify each question has all required properties
      let fixedQuestions = 0;
      module.quiz = module.quiz.map((question, index) => {
        // Ensure question has all required fields
        if (!question.question || !question.options || !question.explanation || question.correctAnswer === undefined) {
          console.warn(`[getModule] Invalid quiz question at index ${index}, using fallback`);
          fixedQuestions++;
          return {
            id: `${moduleId}-q${index + 1}`,
            question: `What is an important feature of the Sui blockchain? (Question ${index + 1})`,
            options: [
              "Horizontal scaling with object-centric architecture",
              "Proof of Authority consensus",
              "Smart contracts written in Python",
              "Limited to 1000 transactions per second"
            ],
            correctAnswer: 0,
            explanation: "Sui uses an object-centric architecture that enables horizontal scaling, which is one of its key features for handling high transaction throughput."
          };
        }
        return question;
      });
      
      if (fixedQuestions > 0) {
        console.log(`[getModule] Fixed ${fixedQuestions} invalid questions with fallbacks`);
      }
    }
    
    moduleCache[moduleId] = module;
    console.log(`[getModule] Module ${moduleId} cached and ready to use`);
    return module;
  } catch (error) {
    console.error(`[getModule] Error generating module ${moduleId}:`, error);
    // Return a complete fallback module with guaranteed content
    const fallbackModule = createFallbackModule(moduleId, 
      MODULE_KNOWLEDGE[moduleId as keyof typeof MODULE_KNOWLEDGE] || 'Sui blockchain');
    console.log(`[getModule] Using complete fallback module for ${moduleId} due to error`);
    moduleCache[moduleId] = fallbackModule;
    return fallbackModule;
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
    console.error('Error generating content with Gemini:', error);
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
    console.error('Error generating smart contract with Gemini:', error);
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
  count: number = 5,
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

    console.log(`[generateQuizQuestions] Sending prompt for ${topic} questions...`);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log(`[generateQuizQuestions] Received response of length: ${responseText.length}`);
    
    // Try multiple JSON extraction methods
    let parsedQuestions;
    const extractionMethods = [
      // Method 1: Extract JSON array using regex
      () => {
        const jsonRegex = /\[\s*\{[\s\S]*\}\s*\]/;
        const jsonMatch = responseText.match(jsonRegex);
        if (jsonMatch) {
          console.log(`[generateQuizQuestions] Extracted JSON using array regex matcher`);
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
          console.log(`[generateQuizQuestions] Extracted JSON from code block`);
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
          console.log(`[generateQuizQuestions] Extracted JSON using bracket positions`);
          return JSON.parse(jsonText);
        }
        throw new Error("No valid JSON brackets found");
      },
      
      // Method 4: As a last resort, try to parse the entire text as JSON
      () => {
        console.log(`[generateQuizQuestions] Attempting to parse entire response as JSON`);
        return JSON.parse(responseText);
      }
    ];
    
    // Try each extraction method until one works
    for (const method of extractionMethods) {
      try {
        parsedQuestions = method();
        if (parsedQuestions && Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
          console.log(`[generateQuizQuestions] Successfully extracted ${parsedQuestions.length} questions`);
          break;
        }
      } catch (error) {
        console.warn(`[generateQuizQuestions] Extraction method failed:`, error);
        // Continue to next method
      }
    }
    
    // If no extraction method worked, fall back to default questions
    if (!parsedQuestions || !Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      console.warn(`[generateQuizQuestions] All JSON extraction methods failed, using fallback questions`);
      return createFallbackQuestions(topic, count, difficulty);
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
    
    console.log(`[generateQuizQuestions] Generated ${validatedQuestions.length} validated questions`);
    return validatedQuestions;
  } catch (error) {
    console.error('[generateQuizQuestions] Error generating questions with Gemini:', error);
    return createFallbackQuestions(topic, count, difficulty);
  }
};

/**
 * Create fallback questions if the API fails
 */
const createFallbackQuestions = (
  topic: string,
  count: number,
  difficulty: 'easy' | 'medium' | 'hard'
): QuizQuestion[] => {
  const questions: QuizQuestion[] = [];
  
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
      question: "What is the native token of the Sui network?",
      options: [
        "SUI",
        "MOVE",
        "MYSTIC",
        "DIEM"
      ],
      correctAnswer: 0,
      explanation: "SUI is the native token of the Sui network, used for gas fees, staking, and governance."
    }
  ];
  
  // Return a subset of the fallback questions
  for (let i = 0; i < Math.min(count, fallbackQuestions.length); i++) {
    questions.push({
      id: `${topic.replace(/\s+/g, '-')}-fallback-${i + 1}`,
      ...fallbackQuestions[i]
    });
  }
  
  return questions;
}; 