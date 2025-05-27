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
  getDocs
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
    console.error('Error getting user learning progress:', error);
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
    console.error('Error updating current module:', error);
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
    console.error('Error ensuring learning progress is initialized:', error);
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
    console.error('Error completing lesson:', error);
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
    console.error('Error completing quiz:', error);
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
    console.error('Error completing alien challenge:', error);
    throw error;
  }
};

/**
 * Fix missing completedModules array in user progress document
 */
export const repairCompletedModules = async (walletAddress: string): Promise<boolean> => {
  try {
    console.log(`Attempting to repair completedModules for user ${walletAddress}`);
    
    // Get main progress document
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const progressDoc = await getDoc(userProgressRef);
    
    if (!progressDoc.exists()) {
      console.log(`No learning progress found for user ${walletAddress}`);
      return false;
    }
    
    const userData = progressDoc.data();
    
    // If completedModules is undefined, fix it
    if (!userData.completedModules) {
      console.log(`Repairing missing completedModules array for user ${walletAddress}`);
      
      // Get all module progress subcollection documents
      const moduleProgressCollection = collection(userProgressRef, 'moduleProgress');
      const moduleProgressDocs = await getDocs(moduleProgressCollection);
      
      // Find completed modules
      const completedModules: string[] = [];
      moduleProgressDocs.forEach(doc => {
        const moduleData = doc.data();
        if (moduleData.completed) {
          completedModules.push(doc.id);
          console.log(`Found completed module: ${doc.id}`);
        }
      });
      
      // Update main document with fixed completedModules array
      await updateDoc(userProgressRef, {
        completedModules: completedModules
      });
      
      console.log(`Repair successful. Added ${completedModules.length} modules to completedModules array`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error repairing completedModules:`, error);
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
    console.log(`Starting module completion process for user ${walletAddress}, module ${moduleId}, next module ${nextModuleId}`);
    
    // First ensure the learning progress documents are initialized
    await ensureLearningProgressInitialized(walletAddress, moduleId);
    // Also ensure the next module is initialized for a smooth transition
    await ensureLearningProgressInitialized(walletAddress, nextModuleId);
    
    // Fix potential issues with completedModules array
    await repairCompletedModules(walletAddress);
    
    // Access learningProgress document directly with wallet address
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const moduleProgressRef = doc(collection(userProgressRef, 'moduleProgress'), moduleId);
    
    // Get the module progress to calculate total XP
    const moduleProgressDoc = await getDoc(moduleProgressRef);
    const moduleProgressData = moduleProgressDoc.exists() ? moduleProgressDoc.data() : { completedLessons: [] };
    
    // Check if module is already completed
    if (moduleProgressData.completed) {
      console.log(`Module ${moduleId} already completed for user ${walletAddress}, skipping rewards`);
      return {
        xpEarned: 0,
        suiEarned: 0,
        mysteryBoxAwarded: false,
        leveledUp: false
      };
    }
    
    // Calculate XP from flashcards
    const flashcardsXp = (moduleProgressData.completedLessons?.length || 0) * XP_REWARDS.COMPLETE_FLASHCARD;
    
    // Calculate XP from quiz (if taken)
    const quizXp = moduleProgressData.quizScore !== undefined ? 
      (XP_REWARDS.COMPLETE_QUIZ + (moduleProgressData.quizScore / 100 * 5 * XP_REWARDS.CORRECT_QUIZ_ANSWER)) : 0;
    
    // Calculate XP from alien challenges
    const alienXp = (moduleProgressData.alienChallengesCompleted?.length || 0) * XP_REWARDS.DEFEAT_ALIEN;
    
    // Add module completion bonus
    const moduleCompletionXp = XP_REWARDS.COMPLETE_MODULE;
    
    // Calculate total XP earned in this module
    const totalModuleXp = Math.floor(flashcardsXp + quizXp + alienXp + moduleCompletionXp);
    
    console.log(`Calculated XP: flashcards=${flashcardsXp}, quiz=${quizXp}, alien=${alienXp}, completion=${moduleCompletionXp}, total=${totalModuleXp}`);
    
    // Mark module as completed in the moduleProgress subcollection
    try {
      await updateDoc(moduleProgressRef, {
        completed: true,
        completedAt: serverTimestamp()
      });
      console.log(`Marked module ${moduleId} as completed in moduleProgress subcollection`);
    } catch (updateError) {
      console.error(`Error marking module ${moduleId} as completed:`, updateError);
      // Try to recover by setting the document if update failed
      try {
        await setDoc(moduleProgressRef, {
          ...moduleProgressData,
          completed: true,
          completedAt: serverTimestamp()
        });
        console.log(`Recovered by setting module ${moduleId} as completed`);
      } catch (setError) {
        console.error(`Recovery failed for module ${moduleId}:`, setError);
        throw new Error(`Failed to mark module as completed: ${setError}`);
      }
    }
    
    // Get user's current XP and level
    const userDoc = await getDoc(userProgressRef);
    const userData = userDoc.data() || {};
    const currentXp = userData.totalXpEarned || 0;
    const currentLevel = userData.level || 1;
    
    // Calculate new level based on XP
    const newTotalXp = currentXp + totalModuleXp;
    const newLevel = calculateLevel(newTotalXp);
    const leveledUp = newLevel > currentLevel;
    console.log(`Current XP=${currentXp}, new total=${newTotalXp}, level change: ${currentLevel} -> ${newLevel}`);
    
    // Calculate how many levels were gained (for multi-level jumps)
    const levelsGained = newLevel - currentLevel;
    
    // Update module position in galaxy
    let updatedRocketPosition = userData.rocketPosition || { x: 300, y: 150 };
    
    // Update position based on module ID (simplified for now)
    // In a real implementation, this would be more sophisticated
    let moduleIdNum = 1;
    if (moduleId === 'intro-to-sui') {
      moduleIdNum = 1;
    } else {
      try {
        const match = moduleId.match(/(\d+)$/);
        if (match) {
          moduleIdNum = parseInt(match[1], 10);
        }
      } catch (e) {
        console.error(`Error parsing moduleId: ${moduleId}`, e);
      }
    }
    
    // Calculate new rocket position
    updatedRocketPosition = {
      x: 300 + (moduleIdNum * 30),
      y: 150 + (moduleIdNum * 15)
    };
    
    console.log(`Updating rocket position to:`, updatedRocketPosition);
    
    // Check if completedModules exists, if not create it
    const currentCompletedModules = userData.completedModules || [];
    
    // Make sure it's an array
    const validCompletedModules = Array.isArray(currentCompletedModules) ? 
      currentCompletedModules : [];
    
    // Add moduleId if not already in the array
    if (!validCompletedModules.includes(moduleId)) {
      validCompletedModules.push(moduleId);
    }
    
    // First, ensure the next module ID is valid
    if (!nextModuleId) {
      console.warn("Next module ID is empty, using default");
      // Set a default next module based on the current module
      if (moduleId === 'intro-to-sui') {
        nextModuleId = 'module-2';
      } else {
        try {
          const match = moduleId.match(/(\d+)$/);
          if (match) {
            const currentNum = parseInt(match[1], 10);
            nextModuleId = `module-${currentNum + 1}`;
          } else {
            nextModuleId = 'intro-to-sui'; // Fallback
          }
        } catch (e) {
          console.error(`Error parsing moduleId for next module: ${moduleId}`, e);
          nextModuleId = 'intro-to-sui'; // Fallback
        }
      }
      console.log(`Set default next module ID to ${nextModuleId}`);
    }
    
    // Update main progress document - first try with arrayUnion
    // This is important because arrayUnion will work even if the array doesn't exist yet
    try {
      const updateData = {
        completedModules: arrayUnion(moduleId),
        currentModuleId: nextModuleId,
        totalXpEarned: increment(totalModuleXp),
        xp: increment(totalModuleXp), // Also update the xp field
        level: newLevel,
        rocketPosition: updatedRocketPosition,
        lastUpdated: serverTimestamp()
      };
      
      await updateDoc(userProgressRef, updateData);
      console.log(`Updated main progress document with arrayUnion: XP=${newTotalXp}, level=${newLevel}, currentModule=${nextModuleId}`);
    } catch (updateError) {
      console.error(`Error updating main progress with arrayUnion:`, updateError);
      
      // Try again with direct set of completedModules
      try {
        const updateData = {
          completedModules: validCompletedModules,
          currentModuleId: nextModuleId,
          totalXpEarned: newTotalXp,
          xp: (userData.xp || 0) + totalModuleXp, // Calculate directly
          level: newLevel,
          rocketPosition: updatedRocketPosition,
          lastUpdated: serverTimestamp()
        };
        
        await updateDoc(userProgressRef, updateData);
        console.log(`Updated main progress document with direct set: XP=${newTotalXp}, level=${newLevel}, currentModule=${nextModuleId}`);
      } catch (directUpdateError) {
        console.error(`Error with direct update of main progress:`, directUpdateError);
        
        // Critical error, try one more time with a delay and setDoc instead of updateDoc
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          // Get the current document again to make sure we have the latest
          const latestUserDoc = await getDoc(userProgressRef);
          const latestData = latestUserDoc.exists() ? latestUserDoc.data() : {};
          
          await setDoc(userProgressRef, {
            ...latestData,
            completedModules: validCompletedModules,
            currentModuleId: nextModuleId,
            totalXpEarned: newTotalXp,
            xp: (latestData.xp || 0) + totalModuleXp,
            level: newLevel,
            rocketPosition: updatedRocketPosition,
            lastUpdated: serverTimestamp()
          });
          console.log(`Final recovery successful using setDoc`);
        } catch (retryError) {
          console.error(`All attempts failed for updating main progress:`, retryError);
          // Continue with the function but log the error
        }
      }
    }
    
    // Award random SUI tokens
    const minSui = SUI_REWARDS.COMPLETE_MODULE[0];
    const maxSui = SUI_REWARDS.COMPLETE_MODULE[2];
    const suiEarned = parseFloat((Math.random() * (maxSui - minSui) + minSui).toFixed(2));
    
    // Add SUI tokens to user wallet
    try {
      await updateDoc(userProgressRef, {
        suiTokens: increment(suiEarned)
      });
      console.log(`Added ${suiEarned} SUI tokens to user wallet`);
    } catch (suiUpdateError) {
      console.error(`Error updating SUI tokens:`, suiUpdateError);
    }
    
    // Small chance (10%) to earn a mystery box
    const mysteryBoxAwarded = Math.random() < 0.1;
    if (mysteryBoxAwarded) {
      try {
        await awardMysteryBox(walletAddress, 'common', 'module_completion');
        console.log(`Awarded mystery box to user`);
      } catch (mysteryBoxError) {
        console.error(`Error awarding mystery box:`, mysteryBoxError);
      }
    }
    
    // Record activity with total XP earned
    try {
      await addLearningActivity(walletAddress, {
        type: 'module_completed',
        title: `Module Completed`,
        description: `You completed the module ${moduleId} and earned ${totalModuleXp} XP`,
        moduleId,
        xpEarned: totalModuleXp,
        timestamp: serverTimestamp()
      });
      console.log(`Added module completion activity to activity log`);
    } catch (activityError) {
      console.error(`Error recording activity:`, activityError);
    }
    
    // If leveled up, record that achievement
    if (leveledUp) {
      // If multiple level-ups occurred, add an activity for each level
      for (let i = 0; i < levelsGained; i++) {
        const achievedLevel = currentLevel + i + 1;
        try {
          await addLearningActivity(walletAddress, {
            type: 'level_up',
            title: `Level Up!`,
            description: `You reached level ${achievedLevel}!`,
            timestamp: serverTimestamp()
          });
          console.log(`Added level up activity for level ${achievedLevel}`);
        } catch (levelUpError) {
          console.error(`Error recording level up activity:`, levelUpError);
        }
      }
    }
    
    // Get the numeric module ID from the module string ID
    let numericModuleId = 1;
    try {
      // Extract the module number from the ID (e.g., "intro-to-sui" => 1, "module-5" => 5)
      const moduleMatch = moduleId.match(/(\d+)$/);
      if (moduleMatch) {
        numericModuleId = parseInt(moduleMatch[1], 10);
      } else if (moduleId === "intro-to-sui") {
        numericModuleId = 1;
      }
    } catch (error) {
      console.error("Error parsing module ID:", error);
    }
    
    // Get the module name
    const moduleName = getModuleName(moduleId);
    
    // Show the module completion popup with NFT option
    // @ts-ignore - This is defined globally in App.tsx
    if (window.showModuleCompletionPopup) {
      console.log(`Showing module completion popup for module ${moduleId} (numeric ID: ${numericModuleId})`);
      try {
        window.showModuleCompletionPopup({
          moduleId: numericModuleId,
          moduleName,
          walletAddress,
          xpEarned: totalModuleXp,
          suiEarned
        });
        console.log(`Module completion popup function called successfully`);
      } catch (popupError) {
        console.error(`Error calling showModuleCompletionPopup:`, popupError);
        
        // Try alternative method to call the function
        console.log(`Attempting alternative popup method...`);
        try {
          const win = window as any;
          if (typeof win.showModuleCompletionPopup === 'function') {
            win.showModuleCompletionPopup({
              moduleId: numericModuleId,
              moduleName,
              walletAddress,
              xpEarned: totalModuleXp,
              suiEarned
            });
            console.log(`Alternative popup method succeeded`);
          } else {
            console.error('showModuleCompletionPopup is not a function on the "any" window object');
            
            // Last resort: try to directly create a custom event to trigger the popup
            const moduleCompletionEvent = new CustomEvent('moduleCompleted', {
              detail: {
                moduleId: numericModuleId,
                moduleName,
                walletAddress,
                xpEarned: totalModuleXp,
                suiEarned
              }
            });
            document.dispatchEvent(moduleCompletionEvent);
            console.log(`Dispatched moduleCompleted custom event as last resort`);
          }
        } catch (altError) {
          console.error(`Alternative popup method also failed:`, altError);
        }
      }
    } else {
      console.error('showModuleCompletionPopup function not found on window object');
      console.log('window object keys:', Object.keys(window));
      
      // Try on "any" typed window as a fallback
      const win = window as any;
      if (typeof win.showModuleCompletionPopup === 'function') {
        console.log(`Found function on "any" window, attempting to call...`);
        win.showModuleCompletionPopup({
          moduleId: numericModuleId,
          moduleName,
          walletAddress,
          xpEarned: totalModuleXp,
          suiEarned
        });
      } else {
        console.error('Function not found on "any" window either');
        
        // Dispatch a custom event as a fallback
        const moduleCompletionEvent = new CustomEvent('moduleCompleted', {
          detail: {
            moduleId: numericModuleId,
            moduleName,
            walletAddress,
            xpEarned: totalModuleXp,
            suiEarned
          }
        });
        document.dispatchEvent(moduleCompletionEvent);
        console.log(`Dispatched moduleCompleted custom event as fallback`);
      }
    }
    
    // Also try the direct method as a last resort
    try {
      const win = window as any;
      if (typeof win.showDirectModuleCompletionPopup === 'function') {
        console.log(`Found direct popup function, calling it...`);
        win.showDirectModuleCompletionPopup({
          moduleId: numericModuleId,
          moduleName,
          walletAddress,
          xpEarned: totalModuleXp,
          suiEarned
        });
      }
    } catch (directError) {
      console.error(`Direct popup method failed:`, directError);
    }
    
    console.log(`Module completion process finished successfully`);
    return {
      xpEarned: totalModuleXp,
      suiEarned,
      mysteryBoxAwarded,
      leveledUp,
      newLevel: leveledUp ? newLevel : undefined
    };
  } catch (error) {
    console.error('Critical error completing module:', error);
    // Try to push a minimal update to at least mark the module as completed
    try {
      const userProgressRef = doc(db, 'learningProgress', walletAddress);
      const moduleProgressRef = doc(collection(userProgressRef, 'moduleProgress'), moduleId);
      
      await updateDoc(moduleProgressRef, {
        completed: true,
        completedAt: serverTimestamp()
      });
      
      await updateDoc(userProgressRef, {
        completedModules: arrayUnion(moduleId),
        currentModuleId: nextModuleId
      });
      
      console.log(`Minimal recovery successful: Module marked as completed`);
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError);
    }
    
    throw error;
  }
};

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
    console.warn("Called getModuleXpPotential with empty moduleId");
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
    console.error("Error parsing module number from ID:", moduleId);
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
    console.error('Error completing galaxy:', error);
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
    console.error('Error adding learning activity:', error);
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
    console.error('Error unlocking achievement:', error);
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
      console.warn('No wallet address provided, using mock data');
      return getMockGalaxiesWithModules();
    }
    
    // Ensure learning progress is initialized
    await ensureLearningProgressInitialized(walletAddress, 'intro-to-sui');
    
    // Get user progress data directly
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const progressDoc = await getDoc(userProgressRef);
    
    if (!progressDoc.exists()) {
      console.warn('User progress not found, using mock data');
      return getMockGalaxiesWithModules();
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
    
    // Get galaxies with their modules from mock data (replace with real data later)
    const mockGalaxies = getMockGalaxiesWithModules();
    
    // Update mock data with real progress information
    const galaxiesWithProgress = mockGalaxies.map((galaxy, galaxyIndex) => {
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
    console.error('Error getting galaxies with modules:', error);
    return getMockGalaxiesWithModules();
  }
};

// Function to provide mock galaxy data when Firebase is not available
function getMockGalaxiesWithModules() {
  // Define all mock galaxies with complete module data
  const mockGalaxies = [
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
          description: 'Getting started with the Move programming language',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: -75, y: -60 },
          type: 'planet',
          color: 'green'
        },
        {
          id: 'objects-ownership',
          title: 'Objects & Ownership',
          description: 'Learn about object ownership in Sui',
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
          color: 'orange'
        }
      ],
      unlocked: false,
      completed: false,
      current: false,
      position: { x: 500, y: 250 }
    },
    {
      id: 3,
      name: 'Nebula Galaxy',
      modules: [
        {
          id: 'advanced-concepts',
          title: 'Advanced Concepts',
          description: 'Explore advanced Sui concepts',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: -75, y: -60 },
          type: 'planet',
          color: 'red'
        },
        {
          id: 'nft-marketplace',
          title: 'NFT Marketplace',
          description: 'Building an NFT marketplace on Sui',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: 75, y: 60 },
          type: 'asteroid',
          color: 'blue'
        }
      ],
      unlocked: false,
      completed: false,
      current: false,
      position: { x: 700, y: 350 }
    },
    {
      id: 4,
      name: 'Cosmic Galaxy',
      modules: [
        {
          id: 'defi-protocols',
          title: 'DeFi Protocols',
          description: 'Building DeFi protocols on Sui',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: -75, y: -60 },
          type: 'planet',
          color: 'purple'
        },
        {
          id: 'blockchain-security',
          title: 'Blockchain Security',
          description: 'Security best practices for Sui development',
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
          color: 'green'
        }
      ],
      unlocked: false,
      completed: false,
      current: false,
      position: { x: 900, y: 400 }
    },
    {
      id: 5,
      name: 'Nova Galaxy',
      modules: [
        {
          id: 'tokenomics',
          title: 'Tokenomics',
          description: 'Learn about token economics on Sui',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: -75, y: -60 },
          type: 'planet',
          color: 'orange'
        },
        {
          id: 'cross-chain-apps',
          title: 'Cross-Chain Apps',
          description: 'Building cross-chain applications with Sui',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: 75, y: 60 },
          type: 'asteroid',
          color: 'red'
        }
      ],
      unlocked: false,
      completed: false,
      current: false,
      position: { x: 1100, y: 450 }
    },
    {
      id: 6,
      name: 'Stellar Galaxy',
      modules: [
        {
          id: 'sui-governance',
          title: 'Sui Governance',
          description: 'Governance mechanisms on the Sui network',
          locked: true,
          completed: false,
          current: false,
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
          id: 'zk-applications',
          title: 'ZK Applications',
          description: 'Zero-knowledge applications on Sui',
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
      unlocked: false,
      completed: false,
      current: false,
      position: { x: 1300, y: 500 }
    },
    {
      id: 7,
      name: 'Quantum Galaxy',
      modules: [
        {
          id: 'gaming-on-blockchain',
          title: 'Gaming on Blockchain',
          description: 'Blockchain gaming with Sui',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: -75, y: -60 },
          type: 'planet',
          color: 'green'
        },
        {
          id: 'social-networks',
          title: 'Social Networks',
          description: 'Building social networks on Sui',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: 75, y: 60 },
          type: 'asteroid',
          color: 'orange'
        }
      ],
      unlocked: false,
      completed: false,
      current: false,
      position: { x: 1500, y: 550 }
    },
    {
      id: 8,
      name: 'Aurora Galaxy',
      modules: [
        {
          id: 'identity-solutions',
          title: 'Identity Solutions',
          description: 'Digital identity solutions using Sui',
          locked: true,
          completed: false,
          current: false,
          progress: {
            completed: false,
            completedLessons: [],
            lastAccessed: new Date()
          },
          position: { x: -75, y: -60 },
          type: 'planet',
          color: 'red'
        },
        {
          id: 'real-world-assets',
          title: 'Real-World Assets',
          description: 'Tokenizing real-world assets on Sui',
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
          color: 'blue'
        }
      ],
      unlocked: false,
      completed: false,
      current: false,
      position: { x: 1700, y: 600 }
    },
    {
      id: 9,
      name: 'Home Planet',
      modules: [
        {
          id: 'graduation-galaxy',
          title: 'Return to Earth',
          description: 'Final challenge to prove your Sui mastery and return home',
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
      position: { x: 1900, y: 650 }
    }
  ];
  
  return mockGalaxies;
}

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
    console.error('Error awarding SUI tokens:', error);
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
    console.error('Error awarding mystery box:', error);
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
    
    console.log('Last login timestamp:', lastLogin);
    
    // Get the date part only (strip time) for day comparison
    const lastLoginDate = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate()).getTime();
    
    // Also calculate hours since last login for the 24hr check
    const hoursSinceLastLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);
    console.log('Hours since last login:', hoursSinceLastLogin);
    
    // Check if it's a new day AND more than 24 hours have passed since last login
    // Either different calendar day OR more than 24 hours
    const isDifferentDay = lastLoginDate < today;
    const isMoreThan24Hours = hoursSinceLastLogin >= 24;
    
    // Determine if we should count this as a new streak day
    const isStreakDay = isDifferentDay || isMoreThan24Hours;
    
    if (isStreakDay) {
      console.log('New streak day detected - different day:', isDifferentDay, 'more than 24h:', isMoreThan24Hours);
      
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
        console.log('Continuing streak to day:', newStreak);
        
        // Bonus for every 7 days
        if (newStreak % 7 === 0) {
          xpAwarded += XP_REWARDS.STREAK_MILESTONE;
          isMilestone = true;
          console.log('Milestone reached!', newStreak, 'days');
          
          // Also award a mystery box every 7 days
          await awardMysteryBox(walletAddress, 'rare', 'streak-milestone');
        }
      } else {
        // Streak broken - reset to 1 for today
        console.log('Streak broken - last login too old. Resetting to 1.');
        newStreak = 1;
        xpAwarded = XP_REWARDS.DAILY_STREAK; // Still award XP for the new day
      }
      
      // Get current user level before updating
      const currentLevel = userData.level || 1;
      const currentXp = userData.totalXpEarned || 0;
      const newTotalXp = currentXp + xpAwarded;
      const newLevel = calculateLevel(newTotalXp);
      const leveledUp = newLevel > currentLevel;
      
      console.log('Updating user data with new streak:', newStreak);
      
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
    
    console.log('Not a new streak day - updating login time only');
    
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
    console.error('Error checking daily streak:', error);
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
    console.error('Error restoring streak:', error);
    return false;
  }
};

/**
 * Check if a specific module is marked as completed for a user
 */
export const isModuleCompleted = async (walletAddress: string, moduleId: string): Promise<boolean> => {
  try {
    console.log(`Checking if module ${moduleId} is completed for user ${walletAddress}`);
    
    // Get main progress document
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const progressDoc = await getDoc(userProgressRef);
    
    if (!progressDoc.exists()) {
      console.log(`No learning progress found for user ${walletAddress}`);
      return false;
    }
    
    const userData = progressDoc.data() as LearningProgress;
    
    // Check if module is in the completedModules array
    const isInCompletedArray = userData.completedModules && 
      userData.completedModules.includes(moduleId);
    
    // Also check module progress subcollection
    const moduleProgressRef = doc(collection(userProgressRef, 'moduleProgress'), moduleId);
    const moduleProgressDoc = await getDoc(moduleProgressRef);
    
    // Module can be marked completed in the subcollection
    const isMarkedCompleted = moduleProgressDoc.exists() && 
      moduleProgressDoc.data().completed === true;
    
    const result = isInCompletedArray || isMarkedCompleted;
    console.log(`Module ${moduleId} completion status: ${result ? 'COMPLETED' : 'NOT COMPLETED'}`);
    console.log(`- In completedModules array: ${isInCompletedArray}`);
    console.log(`- Marked completed in subcollection: ${isMarkedCompleted}`);
    
    return result;
  } catch (error) {
    console.error(`Error checking module completion:`, error);
    return false;
  }
};

// Update model to gemini-2.0-flash
// This is just a stub since we don't have the full file, but would contain code to change the AI model 
// This is just a stub since we don't have the full file, but would contain code to change the AI model 