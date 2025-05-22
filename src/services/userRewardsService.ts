import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  where, 
  addDoc,
  serverTimestamp,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { sendSuiReward } from './suiPaymentService';

// Types for reward tracking
export interface UserReward {
  id: string;
  amount: number;
  reason: string;
  txDigest?: string;
  timestamp: Timestamp;
  source: 'game' | 'challenge' | 'mystery_box' | 'achievement' | 'learning' | 'other';
}

export interface RewardSummary {
  totalEarned: number;
  gameRewards: number;
  challengeRewards: number;
  mysteryBoxRewards: number;
  achievementRewards: number;
  otherRewards: number;
  lastReward?: Timestamp;
}

/**
 * Record a SUI token reward for a user and send the tokens
 */
export const rewardUser = async (
  recipientAddress: string,
  amount: number,
  reason: string,
  source: 'game' | 'challenge' | 'mystery_box' | 'achievement' | 'learning' | 'other' = 'other'
): Promise<{ success: boolean; txDigest?: string; message?: string }> => {
  try {
    // Send the SUI tokens
    const result = await sendSuiReward(recipientAddress, amount, reason);
    
    if (result.success) {
      // Record the reward in user_rewards collection
      await addDoc(collection(db, 'user_rewards'), {
        userId: recipientAddress,
        amount: amount,
        reason: reason,
        source: source,
        txDigest: result.txDigest,
        timestamp: serverTimestamp()
      });
      
      return result;
    }
    
    return result;
  } catch (error) {
    console.error('Error rewarding user:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error rewarding user' 
    };
  }
};

/**
 * Get all rewards for a user
 */
export const getUserRewards = async (walletAddress: string): Promise<UserReward[]> => {
  try {
    const rewardsQuery = query(
      collection(db, 'user_rewards'),
      where('userId', '==', walletAddress),
      orderBy('timestamp', 'desc')
    );
    
    const rewardsSnapshot = await getDocs(rewardsQuery);
    
    return rewardsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as UserReward));
  } catch (error) {
    console.error('Error getting user rewards:', error);
    return [];
  }
};

/**
 * Get rewards summary for a user
 */
export const getUserRewardsSummary = async (walletAddress: string): Promise<RewardSummary> => {
  try {
    // First check if we have the data in the user profile
    const userProfileRef = doc(db, 'learningProgress', walletAddress);
    const userDoc = await getDoc(userProfileRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // If we already have reward tracking data, use it
      if (userData.totalSuiEarned) {
        return {
          totalEarned: userData.totalSuiEarned || 0,
          gameRewards: userData.gameSuiEarned || 0,
          challengeRewards: userData.challengeSuiEarned || 0,
          mysteryBoxRewards: userData.mysteryBoxSuiEarned || 0,
          achievementRewards: userData.achievementSuiEarned || 0,
          otherRewards: userData.otherSuiEarned || 0,
          lastReward: userData.lastReward
        };
      }
    }
    
    // Otherwise calculate from transactions
    const rewards = await getUserRewards(walletAddress);
    
    const summary: RewardSummary = {
      totalEarned: 0,
      gameRewards: 0,
      challengeRewards: 0,
      mysteryBoxRewards: 0,
      achievementRewards: 0,
      otherRewards: 0,
    };
    
    let lastRewardTime: Timestamp | undefined;
    
    for (const reward of rewards) {
      summary.totalEarned += reward.amount;
      
      switch (reward.source) {
        case 'game':
          summary.gameRewards += reward.amount;
          break;
        case 'challenge':
          summary.challengeRewards += reward.amount;
          break;
        case 'mystery_box':
          summary.mysteryBoxRewards += reward.amount;
          break;
        case 'achievement':
          summary.achievementRewards += reward.amount;
          break;
        default:
          summary.otherRewards += reward.amount;
      }
      
      // Track the most recent reward
      if (!lastRewardTime || (reward.timestamp && reward.timestamp.toMillis() > lastRewardTime.toMillis())) {
        lastRewardTime = reward.timestamp;
      }
    }
    
    if (lastRewardTime) {
      summary.lastReward = lastRewardTime;
    }
    
    return summary;
  } catch (error) {
    console.error('Error getting user rewards summary:', error);
    return {
      totalEarned: 0,
      gameRewards: 0,
      challengeRewards: 0,
      mysteryBoxRewards: 0,
      achievementRewards: 0,
      otherRewards: 0
    };
  }
};

/**
 * Get recent reward transactions for display in the UI
 */
export const getRecentRewards = async (walletAddress: string, limitCount: number = 5): Promise<UserReward[]> => {
  try {
    const rewardsQuery = query(
      collection(db, 'user_rewards'),
      where('userId', '==', walletAddress),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    const rewardsSnapshot = await getDocs(rewardsQuery);
    
    return rewardsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as UserReward));
  } catch (error) {
    console.error('Error getting recent rewards:', error);
    return [];
  }
};

/**
 * Check if a transaction has already been recorded to avoid duplicates
 */
export const isTransactionRecorded = async (txDigest: string): Promise<boolean> => {
  try {
    const txQuery = query(
      collection(db, 'transactions'),
      where('txDigest', '==', txDigest),
      limit(1)
    );
    
    const txSnapshot = await getDocs(txQuery);
    
    return !txSnapshot.empty;
  } catch (error) {
    console.error('Error checking if transaction is recorded:', error);
    return false;
  }
};

export default {
  rewardUser,
  getUserRewards,
  getUserRewardsSummary,
  getRecentRewards,
  isTransactionRecorded
}; 