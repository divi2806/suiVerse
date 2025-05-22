import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  increment, 
  collection,
  query,
  where,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { addLearningActivity } from './learningService';
import { toast } from '@/components/ui/use-toast';

// Achievement types
export type AchievementCategory = 
  | 'learning' 
  | 'module_completion'
  | 'galaxy_completion'
  | 'mystery_box'
  | 'streak'
  | 'mastery'
  | 'social';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  icon: string; // Icon name from Lucide
  iconColor: string; // Tailwind color class
  xpReward: number;
  suiReward: number;
  requirementType: 'count' | 'specific' | 'streak';
  requirement: number; // Count required or specific ID
  secret?: boolean; // Hidden until unlocked
}

// List of all possible achievements
export const ACHIEVEMENTS: Achievement[] = [
  // Learning achievements
  {
    id: 'first_module',
    title: 'First Steps',
    description: 'Complete your first learning module',
    category: 'module_completion',
    icon: 'Rocket',
    iconColor: 'text-purple-500',
    xpReward: 100,
    suiReward: 0.01,
    requirementType: 'count',
    requirement: 1
  },
  {
    id: 'five_modules',
    title: 'Knowledge Seeker',
    description: 'Complete 5 learning modules',
    category: 'module_completion',
    icon: 'Lightbulb',
    iconColor: 'text-yellow-500',
    xpReward: 250,
    suiReward: 0.03,
    requirementType: 'count',
    requirement: 5
  },
  {
    id: 'all_modules',
    title: 'Master of Sui',
    description: 'Complete all learning modules and return to Earth',
    category: 'module_completion',
    icon: 'Award',
    iconColor: 'text-amber-500',
    xpReward: 1000,
    suiReward: 0.5,
    requirementType: 'count',
    requirement: 17
  },
  
  // Galaxy achievements
  {
    id: 'galaxy_1',
    title: 'Genesis Explorer',
    description: 'Complete the Genesis Galaxy',
    category: 'galaxy_completion',
    icon: 'Star',
    iconColor: 'text-blue-500',
    xpReward: 200,
    suiReward: 0.05,
    requirementType: 'specific',
    requirement: 1
  },
  {
    id: 'galaxy_5',
    title: 'Cosmic Voyager',
    description: 'Reach and complete the Nova Galaxy',
    category: 'galaxy_completion',
    icon: 'Orbit',
    iconColor: 'text-purple-600',
    xpReward: 500,
    suiReward: 0.1,
    requirementType: 'specific',
    requirement: 5
  },
  {
    id: 'all_galaxies',
    title: 'Interstellar Pioneer',
    description: 'Complete all galaxies in the Sui universe',
    category: 'galaxy_completion',
    icon: 'Globe',
    iconColor: 'text-emerald-500',
    xpReward: 1000,
    suiReward: 0.2,
    requirementType: 'count',
    requirement: 8
  },
  
  // Mystery box achievements
  {
    id: 'first_mystery_box',
    title: 'Curious Explorer',
    description: 'Open your first mystery box',
    category: 'mystery_box',
    icon: 'Package',
    iconColor: 'text-amber-400',
    xpReward: 50,
    suiReward: 0,
    requirementType: 'count',
    requirement: 1
  },
  {
    id: 'purchase_common_box',
    title: 'Treasure Hunter',
    description: 'Purchase your first Common mystery box',
    category: 'mystery_box',
    icon: 'ShoppingBag',
    iconColor: 'text-green-400',
    xpReward: 75,
    suiReward: 0,
    requirementType: 'specific',
    requirement: 1 // 1 = common box
  },
  {
    id: 'purchase_rare_box',
    title: 'Rare Collector',
    description: 'Purchase your first Rare mystery box',
    category: 'mystery_box',
    icon: 'GemIcon',
    iconColor: 'text-blue-500',
    xpReward: 150,
    suiReward: 0,
    requirementType: 'specific',
    requirement: 2 // 2 = rare box
  },
  {
    id: 'purchase_legendary_box',
    title: 'Legend of the Stars',
    description: 'Purchase your first Legendary mystery box',
    category: 'mystery_box',
    icon: 'Crown',
    iconColor: 'text-purple-600',
    xpReward: 300,
    suiReward: 0,
    requirementType: 'specific',
    requirement: 3 // 3 = legendary box
  },
  {
    id: 'box_collector',
    title: 'Box Collector',
    description: 'Open 10 mystery boxes of any rarity',
    category: 'mystery_box',
    icon: 'Package',
    iconColor: 'text-orange-500',
    xpReward: 200,
    suiReward: 0.05,
    requirementType: 'count',
    requirement: 10
  },
  
  // Streak achievements
  {
    id: 'streak_3',
    title: 'Consistent Explorer',
    description: 'Maintain a 3-day learning streak',
    category: 'streak',
    icon: 'Flame',
    iconColor: 'text-orange-500',
    xpReward: 100,
    suiReward: 0.02,
    requirementType: 'streak',
    requirement: 3
  },
  {
    id: 'streak_7',
    title: 'Weekly Voyager',
    description: 'Maintain a 7-day learning streak',
    category: 'streak',
    icon: 'CalendarCheck',
    iconColor: 'text-orange-600',
    xpReward: 250,
    suiReward: 0.05,
    requirementType: 'streak',
    requirement: 7
  },
  {
    id: 'streak_30',
    title: 'Stellar Dedication',
    description: 'Maintain a 30-day learning streak',
    category: 'streak',
    icon: 'Calendar',
    iconColor: 'text-red-500',
    xpReward: 1000,
    suiReward: 0.2,
    requirementType: 'streak',
    requirement: 30
  },
  
  // Mastery achievements
  {
    id: 'perfect_quiz',
    title: 'Perfect Score',
    description: 'Earn a perfect 100% score on any quiz',
    category: 'mastery',
    icon: 'CheckCircle',
    iconColor: 'text-green-500',
    xpReward: 150,
    suiReward: 0.02,
    requirementType: 'count',
    requirement: 1
  },
  {
    id: 'flash_master',
    title: 'Flashcard Master',
    description: 'Master all flashcards in a module',
    category: 'mastery',
    icon: 'Brain',
    iconColor: 'text-indigo-500',
    xpReward: 200,
    suiReward: 0.03,
    requirementType: 'count',
    requirement: 1
  },
  {
    id: 'alien_conqueror',
    title: 'Alien Conqueror',
    description: 'Complete 10 alien coding challenges',
    category: 'mastery',
    icon: 'Alien',
    iconColor: 'text-green-500',
    xpReward: 300,
    suiReward: 0.05,
    requirementType: 'count',
    requirement: 10
  },
  
  // Secret achievements
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Study between midnight and 5 AM',
    category: 'learning',
    icon: 'Moon',
    iconColor: 'text-indigo-400',
    xpReward: 100,
    suiReward: 0.01,
    requirementType: 'specific',
    requirement: 1,
    secret: true
  },
  {
    id: 'lucky_drop',
    title: 'Lucky Explorer',
    description: 'Get the rarest reward from a mystery box',
    category: 'mystery_box',
    icon: 'Sparkles',
    iconColor: 'text-amber-500',
    xpReward: 250,
    suiReward: 0,
    requirementType: 'specific',
    requirement: 1,
    secret: true
  }
];

/**
 * Get all achievements for a user
 */
export const getUserAchievements = async (walletAddress: string) => {
  try {
    // Check if user exists
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const userDoc = await getDoc(userProgressRef);
    
    if (!userDoc.exists()) {
      return {
        unlocked: [],
        locked: ACHIEVEMENTS.filter(a => !a.secret)
      };
    }
    
    // Get all achievements the user has unlocked
    const achievementsCollection = collection(userProgressRef, 'achievements');
    const achievementsSnapshot = await getDocs(achievementsCollection);
    
    // Map of unlocked achievement IDs
    const unlockedAchievementIds = new Set<string>();
    const unlockedAchievements: (Achievement & { unlockedAt: Date })[] = [];
    
    achievementsSnapshot.forEach(doc => {
      const data = doc.data();
      const achievementId = data.achievementId;
      unlockedAchievementIds.add(achievementId);
      
      // Find the achievement details
      const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
      if (achievement) {
        unlockedAchievements.push({
          ...achievement,
          unlockedAt: data.unlockedAt?.toDate() || new Date()
        });
      }
    });
    
    // Get locked achievements (except secret ones)
    const lockedAchievements = ACHIEVEMENTS.filter(a => 
      !unlockedAchievementIds.has(a.id) && !a.secret
    );
    
    return {
      unlocked: unlockedAchievements,
      locked: lockedAchievements
    };
  } catch (error) {
    console.error('Error getting user achievements:', error);
    throw error;
  }
};

/**
 * Check if user has a specific achievement
 */
export const hasAchievement = async (walletAddress: string, achievementId: string): Promise<boolean> => {
  try {
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const achievementRef = doc(collection(userProgressRef, 'achievements'), achievementId);
    const achievementDoc = await getDoc(achievementRef);
    
    return achievementDoc.exists();
  } catch (error) {
    console.error('Error checking achievement:', error);
    return false;
  }
};

/**
 * Unlock an achievement and reward the user
 */
export const unlockAchievement = async (
  walletAddress: string, 
  achievementId: string
): Promise<{
  success: boolean;
  achievement?: Achievement;
  alreadyUnlocked?: boolean;
}> => {
  try {
    // Check if achievement exists
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) {
      return { success: false };
    }
    
    // Check if user already has this achievement
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const achievementRef = doc(collection(userProgressRef, 'achievements'), achievementId);
    const achievementDoc = await getDoc(achievementRef);
    
    if (achievementDoc.exists()) {
      return { 
        success: true, 
        achievement,
        alreadyUnlocked: true
      };
    }
    
    // Add the achievement
    await setDoc(achievementRef, {
      achievementId,
      unlockedAt: serverTimestamp(),
      category: achievement.category,
      xpAwarded: achievement.xpReward,
      suiAwarded: achievement.suiReward
    });
    
    // Add XP and SUI rewards
    await updateDoc(userProgressRef, {
      totalXpEarned: increment(achievement.xpReward),
      suiTokens: increment(achievement.suiReward)
    });
    
    // Record activity
    await addLearningActivity(walletAddress, {
      type: 'achievement_earned',
      title: `Achievement Unlocked: ${achievement.title}`,
      description: achievement.description,
      timestamp: serverTimestamp(),
      achievementId,
      xpEarned: achievement.xpReward,
      suiEarned: achievement.suiReward
    });
    
    // Return success with achievement details
    return {
      success: true,
      achievement
    };
  } catch (error) {
    console.error('Error unlocking achievement:', error);
    return { success: false };
  }
};

/**
 * Check various achievement conditions and unlock if met
 */
export const checkAchievements = async (walletAddress: string): Promise<Achievement[]> => {
  try {
    const userProgressRef = doc(db, 'learningProgress', walletAddress);
    const userDoc = await getDoc(userProgressRef);
    
    if (!userDoc.exists()) {
      return [];
    }
    
    const userData = userDoc.data();
    const unlockedAchievements: Achievement[] = [];
    
    // Check module completion achievements
    const completedModules = userData.completedModules?.length || 0;
    
    if (completedModules >= 1) {
      const result = await unlockAchievement(walletAddress, 'first_module');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        unlockedAchievements.push(result.achievement);
      }
    }
    
    if (completedModules >= 5) {
      const result = await unlockAchievement(walletAddress, 'five_modules');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        unlockedAchievements.push(result.achievement);
      }
    }
    
    if (completedModules >= 17) {
      const result = await unlockAchievement(walletAddress, 'all_modules');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        unlockedAchievements.push(result.achievement);
      }
    }
    
    // Check galaxy completion achievements
    const currentGalaxy = userData.currentGalaxy || 1;
    
    if (currentGalaxy > 1) {
      const result = await unlockAchievement(walletAddress, 'galaxy_1');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        unlockedAchievements.push(result.achievement);
      }
    }
    
    if (currentGalaxy > 5) {
      const result = await unlockAchievement(walletAddress, 'galaxy_5');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        unlockedAchievements.push(result.achievement);
      }
    }
    
    if (currentGalaxy > 8) {
      const result = await unlockAchievement(walletAddress, 'all_galaxies');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        unlockedAchievements.push(result.achievement);
      }
    }
    
    // Check streak achievements
    const streak = userData.streak || 0;
    
    if (streak >= 3) {
      const result = await unlockAchievement(walletAddress, 'streak_3');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        unlockedAchievements.push(result.achievement);
      }
    }
    
    if (streak >= 7) {
      const result = await unlockAchievement(walletAddress, 'streak_7');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        unlockedAchievements.push(result.achievement);
      }
    }
    
    if (streak >= 30) {
      const result = await unlockAchievement(walletAddress, 'streak_30');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        unlockedAchievements.push(result.achievement);
      }
    }
    
    // Check mystery box achievements
    const mysteryBoxesOpened = userData.totalMysteryBoxes || 0;
    
    if (mysteryBoxesOpened >= 1) {
      const result = await unlockAchievement(walletAddress, 'first_mystery_box');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        unlockedAchievements.push(result.achievement);
      }
    }
    
    if (mysteryBoxesOpened >= 10) {
      const result = await unlockAchievement(walletAddress, 'box_collector');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        unlockedAchievements.push(result.achievement);
      }
    }
    
    // Check night owl achievement (if using the app between midnight and 5 AM)
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 0 && hour < 5) {
      const result = await unlockAchievement(walletAddress, 'night_owl');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        unlockedAchievements.push(result.achievement);
      }
    }
    
    return unlockedAchievements;
  } catch (error) {
    console.error('Error checking achievements:', error);
    return [];
  }
};

/**
 * Specifically check for mystery box purchase achievements
 */
export const checkMysteryBoxPurchaseAchievement = async (
  walletAddress: string, 
  boxType: 'common' | 'rare' | 'epic' | 'legendary'
): Promise<Achievement | null> => {
  try {
    let achievementId = '';
    
    switch(boxType) {
      case 'common':
        achievementId = 'purchase_common_box';
        break;
      case 'rare':
        achievementId = 'purchase_rare_box';
        break;
      case 'epic':
        achievementId = 'purchase_epic_box';
        break;
      case 'legendary':
        achievementId = 'purchase_legendary_box';
        break;
    }
    
    const result = await unlockAchievement(walletAddress, achievementId);
    if (result.success && !result.alreadyUnlocked && result.achievement) {
      return result.achievement;
    }
    
    return null;
  } catch (error) {
    console.error('Error checking mystery box purchase achievement:', error);
    return null;
  }
};

/**
 * Check for Perfect Quiz achievement
 */
export const checkPerfectQuizAchievement = async (walletAddress: string, score: number): Promise<Achievement | null> => {
  try {
    if (score === 100) {
      const result = await unlockAchievement(walletAddress, 'perfect_quiz');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        return result.achievement;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error checking perfect quiz achievement:', error);
    return null;
  }
};

/**
 * Check for Flashcard Master achievement
 */
export const checkFlashcardMasterAchievement = async (
  walletAddress: string,
  moduleId: string,
  masteredCardCount: number,
  totalCardCount: number
): Promise<Achievement | null> => {
  try {
    if (masteredCardCount === totalCardCount) {
      const result = await unlockAchievement(walletAddress, 'flash_master');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        return result.achievement;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error checking flashcard master achievement:', error);
    return null;
  }
};

/**
 * Check for Alien Conqueror achievement
 */
export const checkAlienConquerorAchievement = async (
  walletAddress: string,
  completedChallenges: number
): Promise<Achievement | null> => {
  try {
    if (completedChallenges >= 10) {
      const result = await unlockAchievement(walletAddress, 'alien_conqueror');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        return result.achievement;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error checking alien conqueror achievement:', error);
    return null;
  }
};

/**
 * Check for Lucky Drop achievement
 */
export const checkLuckyDropAchievement = async (
  walletAddress: string,
  boxType: 'common' | 'rare' | 'epic' | 'legendary',
  rewardAmount: number
): Promise<Achievement | null> => {
  try {
    // Calculate threshold for "lucky" drops - depends on box rarity
    let thresholdValue = 0;
    switch(boxType) {
      case 'common':
        thresholdValue = 0.2; // High value for common box
        break;
      case 'rare':
        thresholdValue = 0.5; // High value for rare box
        break;
      case 'epic':
        thresholdValue = 0.8; // High value for epic box
        break;
      case 'legendary':
        thresholdValue = 1.0; // High value for legendary box
        break;
    }
    
    if (rewardAmount >= thresholdValue) {
      const result = await unlockAchievement(walletAddress, 'lucky_drop');
      if (result.success && !result.alreadyUnlocked && result.achievement) {
        return result.achievement;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error checking lucky drop achievement:', error);
    return null;
  }
}; 