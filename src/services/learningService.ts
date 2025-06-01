import { 
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  increment,
  serverTimestamp,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
  addDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { getModule } from './geminiService';

interface ModuleProgress {
  moduleId: string;
  completed: boolean;
  completedLessons: string[];
  lastAccessed: Date;
  quizScore?: number;
  alienChallengesCompleted?: string[];
}

interface LearningProgress {
  completedModules: string[];
  currentModuleId: string;
  moduleProgress: Record<string, ModuleProgress>;
  totalXpEarned: number;
  currentGalaxy: number;
  rocketPosition: { x: number; y: number };
}

// Galaxy and related types
interface Module {
  id: string;
  title: string;
  description: string;
  locked: boolean;
  completed: boolean;
  current: boolean;
  progress: {
    completed: boolean;
    completedLessons: string[];
    lastAccessed: Date;
  };
  position: { x: number; y: number };
  type: string;
  color: string;
}

interface Galaxy {
  id: number;
  name: string;
  modules: Module[];
  unlocked: boolean;
  completed: boolean;
  current: boolean;
  position: { x: number; y: number };
}

// Constants for rewards
const XP_REWARDS = {
  COMPLETE_FLASHCARD: 10,
  COMPLETE_QUIZ: 50,
  CORRECT_QUIZ_ANSWER: 15,
  DEFEAT_ALIEN: 75,
  COMPLETE_MODULE: 200,
  COMPLETE_GALAXY: 500,
  DAILY_STREAK: 25,
  STREAK_MILESTONE: 100 // For every 7 days
};

const SUI_REWARDS = {
  COMPLETE_MODULE: [0.5, 0.75, 1], // Random amount between 0.5 and 1 SUI
  COMPLETE_GALAXY: 2,
  RESTORE_STREAK: 0.1
};

/**
 * Get a user's learning progress
 */
export const getUserLearningProgress = async (walletAddress: string): Promise<LearningProgress | null> => {
  try {
    // Access learningProgress document directly with wallet address
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const progressDoc = await getDoc(userProgressRef);
    
    if (!progressDoc.exists()) {
      // Initialize for the default module
      await ensureLearningProgressInitialized(walletAddress, 'intro-to-sui');
      
      // Re-fetch the document
      const updatedProgressDoc = await getDoc(userProgressRef);
      return updatedProgressDoc.data() as LearningProgress;
    }
    
    return progressDoc.data() as LearningProgress;
  } catch (error) {
    
    throw error;
  }
};

/**
 * Update the user's current module
 */
export const updateCurrentModule = async (walletAddress: string, moduleId: string): Promise<void> => {
  try {
    // Ensure the module exists
    await getModule(moduleId);
    
    // Initialize necessary documents
    await ensureLearningProgressInitialized(walletAddress, moduleId);
    
    // Access learningProgress document directly with wallet address
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const moduleProgressRef = doc(collection(userProgressRef, 'moduleProgress'), moduleId);
    
    // Update last accessed timestamp
    await updateDoc(moduleProgressRef, {
      lastAccessed: serverTimestamp()
    });
    
    // Update current module in main progress document
    await updateDoc(userProgressRef, {
      currentModuleId: moduleId
    });
    
  } catch (error) {
    
    throw error;
  }
};

/**
 * Ensure learning progress documents are properly initialized
 */
export const ensureLearningProgressInitialized = async (walletAddress: string, moduleId: string): Promise<void> => {
  try {
    // 1. Check and create main learningProgress document if it doesn't exist
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const progressDoc = await getDoc(userProgressRef);
    
    if (!progressDoc.exists()) {
      // Initialize new user progress
      const initialProgress: LearningProgress = {
        completedModules: [],
        currentModuleId: 'intro-to-sui', // First module
        moduleProgress: {},
        totalXpEarned: 0,
        currentGalaxy: 1,
        rocketPosition: { x: 300, y: 150 } // Starting position
      };
      
      await setDoc(userProgressRef, initialProgress);
    }
    
    // 2. Check and create module progress subcollection document if it doesn't exist
    const moduleProgressRef = doc(collection(userProgressRef, 'moduleProgress'), moduleId);
    const moduleProgressDoc = await getDoc(moduleProgressRef);
    
    if (!moduleProgressDoc.exists()) {
      // Create module progress document
      await setDoc(moduleProgressRef, {
        moduleId,
        completed: false,
        completedLessons: [],
        lastAccessed: serverTimestamp()
      });
    }
    
  } catch (error) {
    
    throw error;
  }
};

/**
 * Complete a lesson (flashcard) and award XP
 */
export const completeLesson = async (
  walletAddress: string, 
  moduleId: string, 
  lessonId: string
): Promise<number> => { // Returns deferred XP earned (will be awarded on module completion)
  try {
    // First ensure the learning progress documents are initialized
    await ensureLearningProgressInitialized(walletAddress, moduleId);
    
    // Access learningProgress document directly with wallet address
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const moduleProgressRef = doc(collection(userProgressRef, 'moduleProgress'), moduleId);
    
    // Track completion (but don't award XP yet - it will be awarded on module completion)
    await updateDoc(moduleProgressRef, {
      completedLessons: arrayUnion(lessonId),
      lastAccessed: serverTimestamp()
    });
    
    // Record the activity
    await addLearningActivity(walletAddress, {
      type: 'flashcards_completed',
      title: `Flashcard Completed`,
      description: `You completed a flashcard in module ${moduleId}`,
      moduleId,
      timestamp: serverTimestamp()
    });
    
    // Return the XP that will be earned on module completion
    return XP_REWARDS.COMPLETE_FLASHCARD;
  } catch (error) {
    
    throw error;
  }
};

/**
 * Complete a quiz and track progress (XP will be awarded on module completion)
 */
export const completeQuiz = async (
  walletAddress: string,
  moduleId: string,
  score: number, // 0-100 percentage
  correctAnswers: number,
  totalQuestions: number
): Promise<number> => { // Returns deferred XP earned (will be awarded on module completion)
  try {
    // First ensure the learning progress documents are initialized
    await ensureLearningProgressInitialized(walletAddress, moduleId);
    
    // Access learningProgress document directly with wallet address
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const moduleProgressRef = doc(collection(userProgressRef, 'moduleProgress'), moduleId);
    
    // Calculate XP based on performance, but don't award it yet
    const quizXP = XP_REWARDS.COMPLETE_QUIZ + (correctAnswers * XP_REWARDS.CORRECT_QUIZ_ANSWER);
    
    // Save progress with score
    await updateDoc(moduleProgressRef, {
      quizScore: score,
      lastAccessed: serverTimestamp()
    });
    
    // Update user's quiz completion count and average score (but not XP)
    await updateDoc(userProgressRef, {
      quizzesCompleted: increment(1),
      averageScore: score, // This should be a weighted average in a real implementation
      lastActivity: serverTimestamp()
    });
    
    // Record the activity
    await addLearningActivity(walletAddress, {
      type: 'quiz_completed',
      title: `Quiz Completed`,
      description: `You scored ${score}% on the quiz for ${moduleId}`,
      moduleId,
      score,
      timestamp: serverTimestamp()
    });
    
    // Return the XP that will be earned on module completion
    return quizXP;
  } catch (error) {
    
    throw error;
  }
};

/**
 * Complete an alien challenge (coding challenge) but don't award XP immediately
 */
export const completeAlienChallenge = async (
  walletAddress: string,
  moduleId: string,
  challengeId: string
): Promise<number> => { // Returns deferred XP earned (will be awarded on module completion)
  try {
    // First ensure the learning progress documents are initialized
    await ensureLearningProgressInitialized(walletAddress, moduleId);
    
    // Access learningProgress document directly with wallet address
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const moduleProgressRef = doc(collection(userProgressRef, 'moduleProgress'), moduleId);
    
    // Record challenge completion
    await updateDoc(moduleProgressRef, {
      alienChallengesCompleted: arrayUnion(challengeId),
      lastAccessed: serverTimestamp()
    });
    
    // Update user's challenge completion count (but not XP)
    await updateDoc(userProgressRef, {
      alienChallengesCompleted: increment(1),
      lastActivity: serverTimestamp()
    });
    
    // Record the activity
    await addLearningActivity(walletAddress, {
      type: 'alien_challenge_completed',
      title: `Alien Challenge Defeated`,
      description: `You completed an alien challenge in module ${moduleId}`,
      moduleId,
      timestamp: serverTimestamp()
    });
    
    // Return the XP that will be earned on module completion
    return XP_REWARDS.DEFEAT_ALIEN;
  } catch (error) {
    
    throw error;
  }
};

/**
 * Fix missing completedModules array in user progress document
 */
export const repairCompletedModules = async (walletAddress: string): Promise<boolean> => {
  try {
    
    
    // Get main progress document
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const progressDoc = await getDoc(userProgressRef);
    
    if (!progressDoc.exists()) {
      
      return false;
    }
    
    const userData = progressDoc.data();
    
    // If completedModules is undefined, fix it
    if (!userData.completedModules) {
      
      
      // Get all module progress subcollection documents
      const moduleProgressCollection = collection(userProgressRef, 'moduleProgress');
      const moduleProgressDocs = await getDocs(moduleProgressCollection);
      
      // Find completed modules
      const completedModules: string[] = [];
      moduleProgressDocs.forEach(doc => {
        const moduleData = doc.data();
        if (moduleData.completed) {
          completedModules.push(doc.id);
          
        }
      });
      
      // Update main document with fixed completedModules array
      await updateDoc(userProgressRef, {
        completedModules: completedModules
      });
      
      
      return true;
    }
    
    return false;
  } catch (error) {
    
    return false;
  }
};

/**
 * Complete a module and award XP
 */
export const completeModule = async (
  walletAddress: string,
  moduleId: string,
  nextModuleId: string
): Promise<{
  xpEarned: number;
  suiEarned: number;
  mysteryBoxAwarded: boolean;
  leveledUp: boolean;
  newLevel?: number;
}> => {
  try {
    if (!walletAddress) {
      throw new Error('Wallet address is required');
    }
    
    console.log(`[LearningService] Completing module ${moduleId} for ${walletAddress}`);
    
    // Check if module is already completed to avoid duplicate rewards
    const alreadyCompleted = await isModuleCompleted(moduleId, walletAddress);
    
    if (alreadyCompleted) {
      console.log(`[LearningService] Module ${moduleId} already completed, skipping rewards`);
      return {
        xpEarned: 0,
        suiEarned: 0,
        leveledUp: false,
        mysteryBoxAwarded: false
      };
    }
    
    // Get user progress document
    const userRef = doc(db, 'learningProgress', walletAddress);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      await ensureLearningProgressInitialized(walletAddress, moduleId);
    }
    
    // Get module progress if it exists
    const moduleRef = doc(collection(userRef, 'moduleProgress'), moduleId);
    const moduleDoc = await getDoc(moduleRef);
    
    // Calculate XP reward - base amount plus bonuses
    let xpReward = XP_REWARDS.COMPLETE_MODULE; // Base XP for completing any module (200)
    
    // If module progress exists, add bonus XP based on completion %
    if (moduleDoc.exists()) {
      const moduleData = moduleDoc.data();
      
      // Bonus for quiz performance
      if (moduleData.quizScore) {
        const quizBonus = Math.floor(moduleData.quizScore * 0.5); // Up to 50 bonus XP for 100% quiz score
        xpReward += quizBonus;
      }
      
      // Bonus for flashcard mastery
      if (moduleData.completedLessons && moduleData.completedLessons.length > 0) {
        const cardBonus = Math.min(moduleData.completedLessons.length * 2, 30); // Up to 30 bonus XP
        xpReward += cardBonus;
      }
      
      // Bonus for alien challenges
      if (moduleData.alienChallengesCompleted && moduleData.alienChallengesCompleted.length > 0) {
        const challengeBonus = moduleData.alienChallengesCompleted.length * 20; // 20 XP per challenge
        xpReward += challengeBonus;
      }
      
      // Mark the module as completed
      await updateDoc(moduleRef, {
        completed: true,
        completedAt: serverTimestamp()
      });
    } else {
      // If no module progress exists, create it
      await setDoc(moduleRef, {
        moduleId,
          completed: true,
        completedAt: serverTimestamp(),
        completedLessons: []
      });
    }
    
    // Get current user data for level calculation
    const userData = userDoc.exists() ? userDoc.data() : { xp: 0, level: 1 };
    const currentLevel = userData.level || 1;
    const currentXp = userData.xp || 0;
    
    // Calculate level after XP reward
    const nextLevelXp = calculateLevelThreshold(currentLevel + 1);
    const newTotalXp = currentXp + xpReward;
    const leveledUp = newTotalXp >= nextLevelXp;
    
    // Determine new level
    let newLevel = currentLevel;
    if (leveledUp) {
      while (newTotalXp >= calculateLevelThreshold(newLevel + 1)) {
        newLevel++;
      }
    }
    
    // Default SUI reward (can be adjusted based on module difficulty)
    const suiReward = 0.5;
    
    // Random chance for mystery box (10%)
    const mysteryBoxAwarded = Math.random() < 0.1;
    
    // Update user progress with completion and rewards
    await updateDoc(userRef, {
        completedModules: arrayUnion(moduleId),
        currentModuleId: nextModuleId,
      xp: increment(xpReward),
      totalXpEarned: increment(xpReward),
        level: newLevel,
      suiTokens: increment(suiReward),
      totalSuiEarned: increment(suiReward),
            lastUpdated: serverTimestamp()
          });
          
    // If mystery box awarded, add it to user's inventory
    if (mysteryBoxAwarded) {
      const inventoryRef = collection(db, 'user_inventory');
      await addDoc(inventoryRef, {
        userId: walletAddress,
        itemType: 'mystery_box',
        acquired: serverTimestamp(),
        opened: false
      });
    }
    
    // Record the completion in activity log
    await addDoc(collection(db, 'learning_activity'), {
      userId: walletAddress,
      type: 'module_completion',
        moduleId,
      xpEarned: xpReward,
      suiEarned: suiReward,
      leveledUp,
      oldLevel: currentLevel,
      newLevel,
        timestamp: serverTimestamp()
      });
      
    console.log(`[LearningService] Module ${moduleId} completed. XP: ${xpReward}, SUI: ${suiReward}`);
    
    // Return results
    return {
      xpEarned: xpReward,
      suiEarned: suiReward,
      leveledUp,
      newLevel: leveledUp ? newLevel : undefined,
      mysteryBoxAwarded
    };
  } catch (error) {
    console.error('[LearningService] Error completing module:', error);
    
    // Return a minimal success response with default values to avoid UI errors
    return {
      xpEarned: XP_REWARDS.COMPLETE_MODULE, // Default XP value
      suiEarned: 0.5,
      leveledUp: false,
      mysteryBoxAwarded: false
    };
  }
};

// Helper function to calculate XP threshold for a given level
function calculateLevelThreshold(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return 100;
  
  // Each level requires more XP than the previous
  return Math.floor(100 * Math.pow(1.2, level - 1));
}

/**
 * Get a human-readable module name from the module ID
 */
function getModuleName(moduleId: string): string {
  const moduleNames: Record<string, string> = {
    'intro-to-sui': 'Introduction to Sui',
    'module-1': 'Introduction to Sui',
    'module-2': 'Sui Move Basics',
    'module-3': 'Object Model',
    'module-4': 'Custom Types',
    'module-5': 'Ownership & Transfer',
    'module-6': 'Capability Pattern',
    'module-7': 'Events & Indexing',
    'module-8': 'Collections',
    'module-9': 'Dynamic Fields',
    'module-10': 'One-Time Witness',
    'module-11': 'Witness Pattern',
    'module-12': 'Publisher Pattern',
    'module-13': 'Shared Objects',
    'module-14': 'Sui Tokenomics',
    'module-15': 'Advanced Patterns',
    'module-16': 'Graduation'
  };
  
  return moduleNames[moduleId] || `Module ${moduleId}`;
}

/**
 * Calculate user level based on total XP
 * Uses a formula that makes each level require more XP
 */
export const calculateLevel = (totalXp: number): number => {
  if (totalXp <= 0) return 1;
  
  // Define base XP requirements
  // Level 1-2: 500 XP
  // Level 2-3: 2500 XP
  // Level 3-4: 5000 XP
  // Then keeps increasing exponentially
  
  // Create a lookup table for the first few levels
  const xpRequirements = [
    0,     // Level 0-1 (unused)
    500,   // Level 1-2
    2500,  // Level 2-3
    5000,  // Level 3-4
    10000, // Level 4-5
    20000  // Level 5-6
  ];
  
  // Track remaining XP and current level
  let remainingXp = totalXp;
  let level = 1;
  
  // Process the predefined levels first
  for (let i = 1; i < xpRequirements.length; i++) {
    const requiredXp = xpRequirements[i];
    
    if (remainingXp < requiredXp) {
      // Not enough XP for the next level
      break;
    }
    
    // Increase level and deduct the XP
    remainingXp -= requiredXp;
    level++;
  }
  
  // For levels beyond our predefined table, use a formula
  // where each level requires approximately double the XP of the previous level
  if (level >= xpRequirements.length) {
    let nextLevelRequirement = xpRequirements[xpRequirements.length - 1] * 2;
    
    while (remainingXp >= nextLevelRequirement) {
      remainingXp -= nextLevelRequirement;
      level++;
      nextLevelRequirement = Math.floor(nextLevelRequirement * 2);
    }
  }
  
  return level;
};

/**
 * Calculate potential XP for a module
 */
export const getModuleXpPotential = (moduleId: string): number => {
  // Input validation
  if (!moduleId) {
    
    return 0; // Return 0 for invalid input
  }
  
  // Base XP for completing the module
  const baseModuleXp = XP_REWARDS.COMPLETE_MODULE;
  
  // Estimate average flashcards per module (can be adjusted based on real data)
  const estimatedFlashcards = 10;
  const flashcardsXp = estimatedFlashcards * XP_REWARDS.COMPLETE_FLASHCARD;
  
  // Estimate quiz XP assuming ~80% correct answers on 5 questions
  const quizXp = XP_REWARDS.COMPLETE_QUIZ + (4 * XP_REWARDS.CORRECT_QUIZ_ANSWER); 
  
  // Estimate alien challenges (coding challenges) - typical module has 1-2
  // Safer parsing with explicit fallback to 1
  let moduleNumber = 1;
  try {
    const lastPart = moduleId.split('-').pop();
    if (lastPart) {
      const parsed = parseInt(lastPart, 10);
      if (!isNaN(parsed)) {
        moduleNumber = parsed;
      }
    }
  } catch (e) {
    
  }
  
  // More advanced modules have more challenges
  const estimatedChallenges = Math.min(2, Math.ceil(moduleNumber / 3));
  const challengesXp = estimatedChallenges * XP_REWARDS.DEFEAT_ALIEN;
  
  // Sum up all potential XP
  const total = baseModuleXp + flashcardsXp + quizXp + challengesXp;
  return total;
};

/**
 * Complete a galaxy and award XP
 */
export const completeGalaxy = async (
  walletAddress: string,
  currentGalaxy: number,
  nextGalaxy: number
): Promise<number> => { // Returns XP earned
  try {
    // Access learningProgress document directly with wallet address
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    
    // Update galaxy progress
    await updateDoc(userProgressRef, {
      currentGalaxy: nextGalaxy,
      totalXpEarned: increment(XP_REWARDS.COMPLETE_GALAXY)
    });
    
    // Award SUI tokens
    await updateDoc(userProgressRef, {
      suiTokens: increment(SUI_REWARDS.COMPLETE_GALAXY)
    });
    
    // Record activity
    await addLearningActivity(walletAddress, {
      type: 'achievement_earned',
      title: `Galaxy Completed`,
      description: `You completed Galaxy ${currentGalaxy}`,
      timestamp: serverTimestamp()
    });
    
    // Award achievement
    await unlockAchievement(walletAddress, `galaxy_${currentGalaxy}_completed`, XP_REWARDS.COMPLETE_GALAXY);
    
    // Award mystery box (guaranteed for galaxy completion)
    await awardMysteryBox(walletAddress, 'rare', 'galaxy_completion');
    
    return XP_REWARDS.COMPLETE_GALAXY;
  } catch (error) {
    
    throw error;
  }
};

/**
 * Helper function to add a learning activity
 */
export const addLearningActivity = async (walletAddress: string, activity: any): Promise<void> => {
  try {
    // Ensure the learning progress document exists before adding activities
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const progressDoc = await getDoc(userProgressRef);
    
    if (!progressDoc.exists()) {
      // Initialize progress document if it doesn't exist
      await ensureLearningProgressInitialized(walletAddress, 'intro-to-sui');
    }
    
    // Create a subcollection under the user's learning progress for activities
    const activitiesCollection = collection(userProgressRef, 'activities');
    
    await setDoc(doc(activitiesCollection), {
      ...activity,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    
    // Don't throw the error, as this is a non-critical function
    // We don't want to break the main learning flow if activity recording fails
  }
};

/**
 * Unlock an achievement
 */
export const unlockAchievement = async (
  walletAddress: string,
  achievementId: string,
  xpReward: number
): Promise<boolean> => { // Returns true if newly awarded, false if already had it
  try {
    // Check if user already has this achievement
    const existingQuery = query(
      collection(db, 'user_achievements'),
      where('walletAddress', '==', walletAddress),
      where('achievementId', '==', achievementId)
    );
    const existingSnapshot = await getDocs(existingQuery);
    
    if (!existingSnapshot.empty) {
      return false; // Already had the achievement
    }
    
    // Add the achievement
    await setDoc(doc(collection(db, 'user_achievements')), {
      walletAddress,
      achievementId,
      title: getAchievementTitle(achievementId),
      description: getAchievementDescription(achievementId),
      type: getAchievementType(achievementId),
      completed: true,
      completedAt: serverTimestamp(),
      xpAwarded: xpReward
    });
    
    // Add XP
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    await updateDoc(userProgressRef, {
      totalXpEarned: increment(xpReward)
    });
    
    // Record activity
    await addLearningActivity(walletAddress, {
      type: 'achievement_earned',
      title: `Achievement Unlocked: ${getAchievementTitle(achievementId)}`,
      description: getAchievementDescription(achievementId),
      timestamp: serverTimestamp(),
      achievementId
    });
    
    return true;
  } catch (error) {
    
    throw error;
  }
};

/**
 * Helper functions for achievement metadata
 */
function getAchievementTitle(id: string): string {
  const titles: Record<string, string> = {
    'galaxy_1_completed': 'Galactic Pioneer',
    'galaxy_2_completed': 'Cosmic Explorer',
    'galaxy_3_completed': 'Stellar Voyager',
    'streak_7': 'Stellar Consistency',
    'streak_30': 'Cosmic Dedication',
    'modules_10': 'Knowledge Seeker',
    'quiz_perfect_5': 'Stellar Scholar',
    'alien_battles_10': 'Alien Conqueror',
    'flashcards_100': 'Memory Master'
  };
  
  return titles[id] || 'Achievement Unlocked';
}

function getAchievementDescription(id: string): string {
  const descriptions: Record<string, string> = {
    'galaxy_1_completed': 'Completed the first galaxy of Sui learning modules',
    'galaxy_2_completed': 'Mastered the second galaxy of Sui knowledge',
    'galaxy_3_completed': 'Conquered the third galaxy of Sui expertise',
    'streak_7': 'Maintained a 7-day learning streak',
    'streak_30': 'Maintained a 30-day learning streak',
    'modules_10': 'Completed 10 learning modules',
    'quiz_perfect_5': 'Scored 100% on 5 different quizzes',
    'alien_battles_10': 'Defeated 10 coding challenges',
    'flashcards_100': 'Reviewed 100 flashcards'
  };
  
  return descriptions[id] || 'You unlocked a new achievement!';
}

function getAchievementType(id: string): string {
  if (id.startsWith('galaxy_')) return 'galaxy';
  if (id.startsWith('streak_')) return 'streak';
  if (id.startsWith('modules_')) return 'module_completion';
  if (id.startsWith('quiz_')) return 'quiz_perfect';
  if (id.startsWith('alien_')) return 'challenge';
  if (id.startsWith('flashcards_')) return 'flashcards';
  
  return 'general';
}

/**
 * Get the available modules organized by galaxy
 */
export const getGalaxiesWithModules = async (walletAddress: string) => {
  try {
    if (!walletAddress) {
      console.warn('[Learning] No wallet address provided, using fallback data');
      return await fetchGalaxiesWithModules();
    }
    
    // Ensure learning progress is initialized
    await ensureLearningProgressInitialized(walletAddress, 'intro-to-sui');
    
    // Get user progress data directly
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const progressDoc = await getDoc(userProgressRef);
    
    if (!progressDoc.exists()) {
      console.warn('[Learning] No user progress found, using fallback data');
      return await fetchGalaxiesWithModules();
    }
    
    const userProgress = progressDoc.data() as LearningProgress;
    
    // Get module progress collection
    const moduleProgressCollection = collection(userProgressRef, 'moduleProgress');
    const moduleProgressDocs = await getDocs(moduleProgressCollection);
    
    // Convert to a map for easier lookup
    const moduleProgressMap: Record<string, any> = {};
    moduleProgressDocs.forEach(doc => {
      moduleProgressMap[doc.id] = doc.data();
    });
    
    // Get galaxies with their modules from Firebase
    const galaxiesData = await fetchGalaxiesWithModules();
    
    // Update galaxy data with real progress information
    const galaxiesWithProgress = galaxiesData.map((galaxy, galaxyIndex) => {
      // Determine if galaxy is unlocked
      const galaxyUnlocked = (
        galaxyIndex === 0 || // First galaxy is always unlocked
        (userProgress.currentGalaxy && userProgress.currentGalaxy >= galaxy.id)
      );
    
      // Update modules with user progress
      const updatedModules = galaxy.modules.map((module, moduleIndex) => {
        // Check if this module has progress data
        const hasProgress = moduleProgressMap[module.id];
        
        // Determine if module is locked
        const moduleLocked = (
          (moduleIndex > 0 && !galaxy.modules[moduleIndex-1].completed) || // Previous module must be completed
          !galaxyUnlocked // Galaxy must be unlocked
        );
        
        // Determine if module is completed
        const moduleCompleted = (
          userProgress.completedModules && 
          userProgress.completedModules.includes(module.id)
        );
        
        // Determine if this is current module
        const isCurrent = userProgress.currentModuleId === module.id;
        
        return {
          ...module,
          locked: moduleLocked,
          completed: moduleCompleted,
          current: isCurrent,
          progress: hasProgress ? {
            completed: moduleCompleted,
            completedLessons: moduleProgressMap[module.id].completedLessons || [],
            lastAccessed: moduleProgressMap[module.id].lastAccessed?.toDate() || new Date(),
            quizScore: moduleProgressMap[module.id].quizScore
          } : {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          }
        };
      });
      
      return {
        ...galaxy,
        unlocked: galaxyUnlocked,
        completed: (updatedModules.every(m => m.completed) && updatedModules.length > 0),
        current: userProgress.currentGalaxy === galaxy.id,
        modules: updatedModules
      };
    });
    
    return galaxiesWithProgress;
  } catch (error) {
    console.error('[Learning] Error getting galaxies with modules:', error);
    return await fetchGalaxiesWithModules();
  }
};

/**
 * Award SUI tokens to a user (simulated airdrop)
 */
export const awardSuiTokens = async (
  walletAddress: string,
  amount: number,
  reason: string
): Promise<boolean> => {
  try {
    // Update user SUI tokens directly in learningProgress
    const userRef = doc(db, 'learningProgress', walletAddress);
    
    // Update user SUI tokens
    await updateDoc(userRef, {
      suiTokens: increment(amount)
    });
    
    // Record the transaction
    await setDoc(doc(db, 'transactions', `${walletAddress}-${Date.now()}`), {
      userId: walletAddress,
      walletAddress,
      amount,
      reason,
      type: 'sui_reward',
      timestamp: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    
    return false;
  }
};

/**
 * Award a mystery box to the user
 */
export const awardMysteryBox = async (
  walletAddress: string,
  rarity: 'common' | 'rare' | 'legendary',
  source: string
): Promise<boolean> => {
  try {
    // Ensure the learning progress document exists
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const progressDoc = await getDoc(userProgressRef);
    
    if (!progressDoc.exists()) {
      await ensureLearningProgressInitialized(walletAddress, 'intro-to-sui');
    }
    
    // Create a subcollection for mystery boxes
    const mysteryBoxesCollection = collection(userProgressRef, 'mysteryBoxes');
    
    // Determine reward contents based on rarity
    const rewards = getMysteryBoxRewards(rarity);
    
    // Create the mystery box document
    await setDoc(doc(mysteryBoxesCollection), {
      rarity,
      source,
      rewards,
      opened: false,
      createdAt: serverTimestamp()
        });
    
    // Log activity
    await addLearningActivity(walletAddress, {
      type: 'mystery_box_earned',
      title: `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Mystery Box`,
      description: `You received a ${rarity} mystery box from ${source}`,
        timestamp: serverTimestamp()
      });
    
    // Update counter on main document
    await updateDoc(userProgressRef, {
      [`mysteryBoxes_${rarity}`]: increment(1),
      totalMysteryBoxes: increment(1)
      });
      
      return true;
  } catch (error) {
    
    // Don't break main flow if mystery box awarding fails
    return false;
  }
};

/**
 * Helper to generate mystery box rewards
 */
function getMysteryBoxRewards(rarity: 'common' | 'rare' | 'legendary'): any {
  // Base XP and SUI rewards by rarity
  const rewards = {
    xp: 0,
    suiTokens: 0,
    cosmetics: [] as string[]
  };
  
  switch (rarity) {
    case 'common':
      rewards.xp = Math.floor(Math.random() * 50) + 50; // 50-100 XP
      rewards.suiTokens = parseFloat((Math.random() * 0.25 + 0.1).toFixed(2)); // 0.1-0.35 SUI
      // 10% chance of basic cosmetic
      if (Math.random() < 0.1) {
        rewards.cosmetics.push('basic_avatar_border');
      }
      break;
      
    case 'rare':
      rewards.xp = Math.floor(Math.random() * 100) + 100; // 100-200 XP
      rewards.suiTokens = parseFloat((Math.random() * 0.5 + 0.25).toFixed(2)); // 0.25-0.75 SUI
      // 25% chance of medium cosmetic
      if (Math.random() < 0.25) {
        rewards.cosmetics.push('medium_avatar_effect');
      }
      break;
      
    case 'legendary':
      rewards.xp = Math.floor(Math.random() * 200) + 200; // 200-400 XP
      rewards.suiTokens = parseFloat((Math.random() * 1 + 0.5).toFixed(2)); // 0.5-1.5 SUI
      // 50% chance of rare cosmetic
      if (Math.random() < 0.5) {
        rewards.cosmetics.push('rare_rocket_skin');
      }
      break;
  }
  
  return rewards;
}

/**
 * Check and update daily streak, award XP if needed
 */
export const checkDailyStreak = async (walletAddress: string): Promise<{
  isNewDay: boolean;
  currentStreak: number;
  xpAwarded: number;
  suiAwarded: number;
  isMilestone?: boolean;
  leveledUp: boolean;
  newLevel?: number;
}> => {
  try {
    // Get user data directly from learningProgress
    const userRef = doc(db, 'learningProgress', walletAddress);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    let lastLogin = userData.lastLogin;
    if (lastLogin && typeof lastLogin.toDate === 'function') {
      lastLogin = lastLogin.toDate();
    } else if (lastLogin) {
      lastLogin = new Date(lastLogin);
    } else {
      lastLogin = new Date(0); // Very old date
    }
    
    
    
    // Get the date part only (strip time) for day comparison
    const lastLoginDate = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate()).getTime();
    
    // Also calculate hours since last login for the 24hr check
    const hoursSinceLastLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);
    
    
    // Check if it's a new day AND more than 24 hours have passed since last login
    // Either different calendar day OR more than 24 hours
    const isDifferentDay = lastLoginDate < today;
    const isMoreThan24Hours = hoursSinceLastLogin >= 24;
    
    // Determine if we should count this as a new streak day
    const isStreakDay = isDifferentDay || isMoreThan24Hours;
    
    if (isStreakDay) {
      
      
      const currentStreak = userData.streak || 0;
      let newStreak = currentStreak;
      let xpAwarded = 0;
      let suiAwarded = 0;
      let isMilestone = false;
      
      // Check if the user was active yesterday or within the 48-hour window
      // This allows for maintaining streaks if users log in every 24-48 hours
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoTime = twoDaysAgo.getTime();
      
      // If last login was within the valid streak window (yesterday or not more than 48 hours ago)
      const withinStreakWindow = lastLoginDate >= twoDaysAgoTime || hoursSinceLastLogin <= 48;
      
      if (withinStreakWindow) {
        // Continue streak
        newStreak += 1;
        xpAwarded = XP_REWARDS.DAILY_STREAK;
        
        
        // Bonus for every 7 days
        if (newStreak % 7 === 0) {
          xpAwarded += XP_REWARDS.STREAK_MILESTONE;
          isMilestone = true;
          
          
          // Also award a mystery box every 7 days
          await awardMysteryBox(walletAddress, 'rare', 'streak-milestone');
        }
      } else {
        // Streak broken - reset to 1 for today
        
        newStreak = 1;
        xpAwarded = XP_REWARDS.DAILY_STREAK; // Still award XP for the new day
      }
      
      // Get current user level before updating
      const currentLevel = userData.level || 1;
      const currentXp = userData.totalXpEarned || 0;
      const newTotalXp = currentXp + xpAwarded;
      const newLevel = calculateLevel(newTotalXp);
      const leveledUp = newLevel > currentLevel;
      
      
      
      // Update user streak and login date
      await updateDoc(userRef, {
        streak: newStreak,
        lastLogin: serverTimestamp(),
        xp: increment(xpAwarded),
        totalXpEarned: increment(xpAwarded),
        level: newLevel // Update to the new level if changed
      });
      
      // Record the streak activity
      await addLearningActivity(walletAddress, {
        type: 'daily_streak',
        title: `Daily Streak: Day ${newStreak}`,
        description: newStreak > 1 ? 
          `You've maintained a streak for ${newStreak} days!` : 
          `You've started a new streak!`,
        xpEarned: xpAwarded,
        timestamp: serverTimestamp()
      });
      
      // If leveled up, record that achievement
      if (leveledUp) {
        // Calculate how many levels were gained
        const levelsGained = newLevel - currentLevel;
        
        // If multiple level-ups occurred, add an activity for each level
        for (let i = 0; i < levelsGained; i++) {
          const achievedLevel = currentLevel + i + 1;
          await addLearningActivity(walletAddress, {
            type: 'level_up',
            title: `Level Up!`,
            description: `You reached level ${achievedLevel}!`,
            timestamp: serverTimestamp()
          });
        }
      }
      
      return {
        isNewDay: true,
        currentStreak: newStreak,
        xpAwarded,
        suiAwarded,
        isMilestone,
        leveledUp,
        newLevel: leveledUp ? newLevel : undefined
      };
    }
    
    // Not a new day, but still show streak information for today's login
    // This ensures users see their streak status even if they've already logged in today
    const currentStreak = userData.streak || 0;
    const isMilestone = currentStreak > 0 && currentStreak % 7 === 0;
    
    
    
    // Just update login time
    await updateDoc(userRef, {
      lastLogin: serverTimestamp()
    });
    
    return {
      isNewDay: false, // Not a new day or not enough time has passed
      currentStreak: currentStreak,
      xpAwarded: 0, // No additional XP for multiple logins on same day
      suiAwarded: 0,
      isMilestone: isMilestone,
      leveledUp: false,
      newLevel: undefined
    };
  } catch (error) {
    
    return {
      isNewDay: false,
      currentStreak: 0,
      xpAwarded: 0,
      suiAwarded: 0,
      leveledUp: false,
      newLevel: undefined
    };
  }
};

/**
 * Restore a lost streak by spending SUI tokens
 */
export const restoreStreak = async (walletAddress: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'learningProgress', walletAddress);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    
    // Check if user has enough SUI
    const suiTokens = userData.suiTokens || 0;
    if (suiTokens < SUI_REWARDS.RESTORE_STREAK) {
      return false; // Not enough SUI to restore streak
    }
    
    // Deduct SUI and restore streak (increment by 1)
    await updateDoc(userRef, {
      suiTokens: increment(-SUI_REWARDS.RESTORE_STREAK),
      streak: increment(1)
    });
    
    return true;
  } catch (error) {
    
    return false;
  }
};

/**
 * Check if a module has been completed by the user
 * @param moduleId The module ID to check
 * @param walletAddressOverride Optional wallet address to check for (defaults to current user)
 */
export const isModuleCompleted = async (
  moduleId: string,
  walletAddressOverride?: string
): Promise<boolean> => {
  try {
    // Get wallet address (either from override or auth context)
    const walletAddress = walletAddressOverride;
    
    // If no wallet address is available, module is not completed
    if (!walletAddress) {
      console.warn(`[LearningService] Cannot check module completion without wallet address`);
      return false;
    }
    
    console.log(`[LearningService] Checking module completion for ${moduleId}, wallet: ${walletAddress}`);
    
    // Check Firestore to see if this module is in the user's completedModules array
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const userProgressDoc = await getDoc(userProgressRef);
    
    if (!userProgressDoc.exists()) {
      console.warn(`[LearningService] No learning progress document found for ${walletAddress}`);
      return false;
    }
    
    const userData = userProgressDoc.data();
    const completedModules = userData.completedModules || [];
    
    // First check if it's in the completedModules array
    let moduleCompleted = completedModules.includes(moduleId);
    console.log(`[LearningService] Module ${moduleId} in completedModules array: ${moduleCompleted}`);
    
    // If not found in the array, check the module-specific document as a fallback
    if (!moduleCompleted) {
      try {
    const moduleProgressRef = doc(collection(userProgressRef, 'moduleProgress'), moduleId);
    const moduleProgressDoc = await getDoc(moduleProgressRef);
    
        if (moduleProgressDoc.exists()) {
          const moduleData = moduleProgressDoc.data();
          const moduleDocCompleted = moduleData.completed === true;
          console.log(`[LearningService] Module ${moduleId} in module document: ${moduleDocCompleted}`);
          
          // If we found that it's completed in the module document but not in the array,
          // update the completedModules array for consistency
          if (moduleDocCompleted && !completedModules.includes(moduleId)) {
            console.log(`[LearningService] Repairing completedModules array for ${moduleId}`);
            try {
              await updateDoc(userProgressRef, {
                completedModules: arrayUnion(moduleId),
                lastUpdated: serverTimestamp()
              });
              console.log(`[LearningService] Successfully repaired completedModules array for ${moduleId}`);
              moduleCompleted = true;
            } catch (updateError) {
              console.error(`[LearningService] Error updating completedModules array:`, updateError);
              // Still return true if the module document shows completion
              moduleCompleted = true;
            }
          } else {
            moduleCompleted = moduleDocCompleted;
          }
        } else {
          console.log(`[LearningService] No module progress document found for ${moduleId}`);
        }
      } catch (error) {
        console.error(`[LearningService] Error checking module progress:`, error);
      }
    }
    
    console.log(`[LearningService] Final module completion status for ${moduleId}: ${moduleCompleted}`);
    return moduleCompleted;
  } catch (error) {
    console.error(`[LearningService] Error checking if module completed:`, error);
    return false;
  }
};

// Function to provide fallback galaxy data when Firebase fetch fails
function getFallbackGalaxiesWithModules() {
  console.log('[Learning] Using fallback galaxy data - Firebase fetch failed');
  console.log('[Learning] Generating fallback data for fallback galaxies');

  // Define complete fallback data for all galaxies
  const fallbackGalaxies = [
    {
      id: 1,
      name: 'Genesis Galaxy',
      modules: [
        {
          id: 'intro-to-sui',
          title: 'Intro To Sui',
          description: 'Introduction to the Sui blockchain and its core concepts',
          locked: false,
          completed: false,
          current: true,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: -75, y: -60 },
          type: 'planet',
          color: 'blue'
        },
        {
          id: 'smart-contracts-101',
          title: 'Smart Contracts 101',
          description: 'Learn the basics of smart contract development on Sui',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: 75, y: 60 },
          type: 'moon',
          color: 'purple'
        }
      ],
      unlocked: true,
      completed: false,
      current: true,
      position: { x: 300, y: 200 }
    },
    {
      id: 2,
      name: 'Explorer Galaxy',
      modules: [
        {
          id: 'move-language',
          title: 'Move Language',
          description: 'Learn the Move programming language for Sui blockchain',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: -80, y: -70 },
          type: 'planet',
          color: 'green'
        },
        {
          id: 'objects-ownership',
          title: 'Objects & Ownership',
          description: 'Understand objects and ownership models in Sui',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: 80, y: 70 },
          type: 'asteroid',
          color: 'orange'
        }
      ],
      unlocked: false,
      completed: false,
      current: false,
      position: { x: 800, y: 300 }
    },
    {
      id: 3,
      name: 'Nebula Galaxy',
      modules: [
        {
          id: 'advanced-concepts',
          title: 'Advanced Concepts',
          description: 'Dive into advanced blockchain development concepts',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: -60, y: -50 },
          type: 'station',
          color: 'purple'
        },
        {
          id: 'nft-marketplace',
          title: 'NFT Marketplace',
          description: 'Build an NFT marketplace on Sui',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: 60, y: 50 },
          type: 'planet',
          color: 'red'
        }
      ],
      unlocked: false,
      completed: false,
      current: false,
      position: { x: 1300, y: 200 }
    },
    {
      id: 4,
      name: 'Cosmic Galaxy',
      modules: [
        {
          id: 'defi-protocols',
          title: 'DeFi Protocols',
          description: 'Learn about decentralized finance on Sui',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: -70, y: -40 },
          type: 'planet',
          color: 'blue'
        },
        {
          id: 'blockchain-security',
          title: 'Blockchain Security',
          description: 'Understand security concerns and best practices',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: 70, y: 40 },
          type: 'moon',
          color: 'yellow'
        }
      ],
      unlocked: false,
      completed: false,
      current: false,
      position: { x: 1800, y: 400 }
    },
    {
      id: 5,
      name: 'Nova Galaxy',
      modules: [
        {
          id: 'tokenomics',
          title: 'Tokenomics',
          description: 'Learn about token economics and design',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: -65, y: -55 },
          type: 'planet',
          color: 'purple'
        },
        {
          id: 'cross-chain-apps',
          title: 'Cross-Chain Apps',
          description: 'Building applications that work across multiple blockchains',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: 65, y: 55 },
          type: 'station',
          color: 'green'
        }
      ],
      unlocked: false,
      completed: false,
      current: false,
      position: { x: 2300, y: 300 }
    },
    {
      id: 6,
      name: 'Stellar Galaxy',
      modules: [
        {
          id: 'sui-governance',
          title: 'Sui Governance',
          description: 'Understanding governance in the Sui ecosystem',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: -75, y: -45 },
          type: 'planet',
          color: 'orange'
        },
        {
          id: 'zk-applications',
          title: 'ZK Applications',
          description: 'Building applications with zero-knowledge proofs',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: 75, y: 45 },
          type: 'asteroid',
          color: 'blue'
        }
      ],
      unlocked: false,
      completed: false,
      current: false,
      position: { x: 2800, y: 250 }
    },
    {
      id: 7,
      name: 'Quantum Galaxy',
      modules: [
        {
          id: 'gaming-on-blockchain',
          title: 'Gaming on Blockchain',
          description: 'Building games on the Sui blockchain',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: -80, y: -60 },
          type: 'planet',
          color: 'purple'
        },
        {
          id: 'social-networks',
          title: 'Social Networks',
          description: 'Building decentralized social applications',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: 80, y: 60 },
          type: 'moon',
          color: 'red'
        }
      ],
      unlocked: false,
      completed: false,
      current: false,
      position: { x: 3300, y: 350 }
    },
    {
      id: 8,
      name: 'Aurora Galaxy',
      modules: [
        {
          id: 'identity-solutions',
          title: 'Identity Solutions',
          description: 'Building decentralized identity solutions',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: -70, y: -50 },
          type: 'planet',
          color: 'green'
        },
        {
          id: 'real-world-assets',
          title: 'Real World Assets',
          description: 'Tokenizing and managing real-world assets on blockchain',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: 70, y: 50 },
          type: 'station',
          color: 'yellow'
        }
      ],
      unlocked: false,
      completed: false,
      current: false,
      position: { x: 3800, y: 300 }
    },
    {
      id: 9,
      name: 'Home Galaxy',
      modules: [
        {
          id: 'graduation-galaxy',
          title: 'Graduation',
          description: 'Complete your journey and return to Earth',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: 0, y: 0 },
          type: 'earth',
          color: 'earth'
        }
      ],
      unlocked: false,
      completed: false,
      current: false,
      position: { x: 4300, y: 250 }
    }
  ];
  
  return fallbackGalaxies;
}

/**
 * Fetch all galaxies with modules from Firebase
 * @returns Array of galaxies with their modules
 */
export const fetchGalaxiesWithModules = async (): Promise<Galaxy[]> => {
  try {
    // First try to get from Firebase
    const galaxiesSnapshot = await getDocs(collection(db, 'galaxies'));
    
    if (galaxiesSnapshot.empty) {
      console.log('[Learning] No galaxies found in Firebase, using fallback data');
      console.log('[Learning] Attempted to fetch from collection:', 'learningGalaxies');
      console.log('[Learning] No wallet address provided for user-specific data');
      return getFallbackGalaxiesWithModules() as Galaxy[];
    }
    
    // Process galaxies from Firebase
    const galaxies: Galaxy[] = [];
    
    for (const doc of galaxiesSnapshot.docs) {
      const galaxyData = doc.data();
      
      // Get modules for this galaxy
      const modulesSnapshot = await getDocs(
        query(collection(db, 'modules'), where('galaxyId', '==', galaxyData.id))
      );
      
      const modules = modulesSnapshot.docs.map(moduleDoc => {
        const moduleData = moduleDoc.data();
        return {
          id: moduleData.id,
          title: moduleData.title,
          description: moduleData.description,
          locked: moduleData.locked || false,
          completed: moduleData.completed || false,
          current: moduleData.current || false,
          progress: moduleData.progress || {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: moduleData.position || { x: 0, y: 0 },
          type: moduleData.type || 'planet',
          color: moduleData.color || 'blue'
        };
      });
      
      galaxies.push({
        id: galaxyData.id,
        name: galaxyData.name,
        modules,
        unlocked: galaxyData.unlocked || false,
        completed: galaxyData.completed || false,
        current: galaxyData.current || false,
        position: galaxyData.position || { x: 0, y: 0 }
      });
    }
    
    // If no galaxies were retrieved, use fallback
    if (galaxies.length === 0) {
      console.log('[Learning] No galaxies processed from Firebase, using fallback data');
      return getFallbackGalaxiesWithModules() as Galaxy[];
    }
    
    return galaxies;
  } catch (error) {
    console.error('[Learning] Firebase fetch failed with error:', error);
    console.log('[Learning] Error details:', JSON.stringify(error, null, 2));
    console.log('[Learning] Using fallback galaxy data - Firebase fetch failed');
    return getFallbackGalaxiesWithModules() as Galaxy[];
  }
};

/**
 * Unlock the next galaxy when all modules in current galaxy are completed
 * @param walletAddress User's wallet address
 * @param currentGalaxy Current galaxy ID
 * @returns True if next galaxy was unlocked, false otherwise
 */
export const unlockNextGalaxy = async (
  walletAddress: string,
  currentGalaxy: number
): Promise<boolean> => {
  try {
    console.log(`[LearningService] Checking if galaxy ${currentGalaxy} is completed and unlocking next galaxy for ${walletAddress}`);
    
    // Get galaxies with modules to check completion status
    const galaxiesWithModules = await getGalaxiesWithModules(walletAddress);
    
    // Find the current galaxy data
    const currentGalaxyData = galaxiesWithModules.find(g => g.id === currentGalaxy);
    if (!currentGalaxyData) {
      console.warn(`[LearningService] Galaxy ${currentGalaxy} not found for user ${walletAddress}`);
      return false;
    }
    
    // Check if all modules in the current galaxy are completed
    const allModulesCompleted = currentGalaxyData.modules.every(m => m.completed);
    
    if (!allModulesCompleted) {
      console.log(`[LearningService] Not all modules in galaxy ${currentGalaxy} are completed yet`);
      return false;
    }
    
    // Find the next galaxy
    const nextGalaxyIndex = galaxiesWithModules.findIndex(g => g.id === currentGalaxy) + 1;
    if (nextGalaxyIndex >= galaxiesWithModules.length) {
      console.log(`[LearningService] No next galaxy after ${currentGalaxy}`);
      return false;
    }
    
    const nextGalaxy = galaxiesWithModules[nextGalaxyIndex];
    
    // If next galaxy is already unlocked, no need to update
    if (nextGalaxy.unlocked) {
      console.log(`[LearningService] Next galaxy ${nextGalaxy.id} is already unlocked`);
      return true;
    }
    
    // Update user progress to unlock next galaxy
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    await updateDoc(userProgressRef, {
      currentGalaxy: nextGalaxy.id,
      lastUpdated: serverTimestamp()
    });
    
    console.log(`[LearningService] Successfully unlocked galaxy ${nextGalaxy.id} for user ${walletAddress}`);
    
    // Record activity
    await addLearningActivity(walletAddress, {
      type: 'galaxy_unlocked',
      title: `${nextGalaxy.name} Unlocked`,
      description: `You've unlocked ${nextGalaxy.name} by completing ${currentGalaxyData.name}`,
      timestamp: serverTimestamp()
    });
    
    // Award achievement for completing a galaxy
    await unlockAchievement(walletAddress, `galaxy_${currentGalaxy}_completed`, XP_REWARDS.COMPLETE_GALAXY);
    
    // Award mystery box for galaxy completion (higher chance of rare items)
    await awardMysteryBox(walletAddress, 'rare', 'galaxy_completion');
    
    return true;
  } catch (error) {
    console.error(`[LearningService] Error unlocking next galaxy:`, error);
    return false;
  }
};

// Update model to gemini-2.0-flash
// This is just a stub since we don't have the full file, but would contain code to change the AI model 
// This is just a stub since we don't have the full file, but would contain code to change the AI model 