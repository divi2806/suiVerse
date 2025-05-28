import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  arrayUnion, 
  increment, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase-config';
import { WalletUserData } from '@/contexts/AuthContext';

// User Services
export const getUserData = async (userId: string): Promise<WalletUserData | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'learningProgress', userId));
    if (userDoc.exists()) {
      return userDoc.data() as WalletUserData;
    }
    return null;
  } catch (error) {
    
    throw error;
  }
};

export const updateUserXp = async (userId: string, xpToAdd: number): Promise<void> => {
  try {
    const userRef = doc(db, 'learningProgress', userId);
    
    // First, get the current XP and level
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data() as WalletUserData;
    const currentXp = userData.totalXpEarned || userData.xp || 0;
    const currentLevel = userData.level || 1;
    
    // Calculate new XP
    const newXp = currentXp + xpToAdd;
    
    // Calculate new level (simple calculation - you can customize this based on your game mechanics)
    // For example: Level up every 1000 XP
    const xpPerLevel = 1000;
    const newLevel = Math.floor(newXp / xpPerLevel) + 1;
    
    // Update user document
    await updateDoc(userRef, {
      xp: newXp,
      totalXpEarned: newXp, // Always update both fields for consistency
      level: newLevel,
      lastUpdated: serverTimestamp()
    });
    
    // If user leveled up, record the achievement
    if (newLevel > currentLevel) {
      await setDoc(doc(db, 'achievements', `${userId}-level-${newLevel}`), {
        userId,
        type: 'level_up',
        level: newLevel,
        timestamp: serverTimestamp()
      });
    }
  } catch (error) {
    
    throw error;
  }
};

export const updateUserStreak = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, 'learningProgress', userId);
    
    // Get user data
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data() as WalletUserData;
    const lastLogin = userData.lastLogin;
    const currentStreak = userData.streak || 0;
    
    // Check if lastLogin was yesterday
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastLoginDate = lastLogin instanceof Timestamp 
      ? lastLogin.toDate() 
      : new Date(lastLogin);
    
    const isConsecutiveDay = lastLoginDate.getDate() === yesterday.getDate() &&
      lastLoginDate.getMonth() === yesterday.getMonth() &&
      lastLoginDate.getFullYear() === yesterday.getFullYear();
    
    // Update streak count
    const newStreak = isConsecutiveDay ? currentStreak + 1 : 1;
    
    await updateDoc(userRef, {
      streak: newStreak,
      lastLogin: serverTimestamp()
    });
    
    // If streak is a milestone (e.g., 7, 30, 365 days), record achievement
    const milestones = [7, 30, 90, 180, 365];
    if (milestones.includes(newStreak)) {
      await setDoc(doc(db, 'achievements', `${userId}-streak-${newStreak}`), {
        userId,
        type: 'streak',
        days: newStreak,
        timestamp: serverTimestamp()
      });
    }
  } catch (error) {
    
    throw error;
  }
};

// Leaderboard Services
export const getLeaderboard = async (limitCount = 10): Promise<Array<WalletUserData & { rank: number }>> => {
  try {
    const q = query(collection(db, 'learningProgress'), orderBy('totalXpEarned', 'desc'), firestoreLimit(limitCount));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map((doc, index) => ({
      ...(doc.data() as WalletUserData),
      rank: index + 1
    }));
  } catch (error) {
    
    throw error;
  }
};

// Progress Tracking Services
export const saveUserProgress = async (
  userId: string, 
  moduleId: string, 
  lessonId: string, 
  completed: boolean,
  score?: number
): Promise<void> => {
  try {
    const progressRef = doc(db, 'userProgress', `${userId}-${moduleId}-${lessonId}`);
    
    await setDoc(progressRef, {
      userId,
      moduleId,
      lessonId,
      completed,
      score,
      timestamp: serverTimestamp()
    }, { merge: true });
    
    // If lesson was completed, update user's completed lessons
    if (completed) {
      const userRef = doc(db, 'learningProgress', userId);
      await updateDoc(userRef, {
        completedLessons: arrayUnion(`${moduleId}-${lessonId}`),
        lastActivity: serverTimestamp()
      });
    }
  } catch (error) {
    
    throw error;
  }
};

export const getUserProgress = async (
  userId: string,
  moduleId?: string
): Promise<Array<DocumentData>> => {
  try {
    let progressQuery;
    if (moduleId) {
      progressQuery = query(
        collection(db, 'userProgress'),
        where('userId', '==', userId),
        where('moduleId', '==', moduleId)
      );
    } else {
      progressQuery = query(
        collection(db, 'userProgress'),
        where('userId', '==', userId)
      );
    }
    
    const snapshot = await getDocs(progressQuery);
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    
    throw error;
  }
};

// Wallet Integration Services
export const getUserByWalletAddress = async (
  walletAddress: string
): Promise<WalletUserData | null> => {
  try {
    const walletDoc = await getDoc(doc(db, 'wallets', walletAddress));
    
    if (!walletDoc.exists()) {
      return null;
    }
    
    const { userId } = walletDoc.data();
    const userData = await getUserData(userId);
    
    return userData ? { walletAddress, ...userData } : null;
  } catch (error) {
    
    throw error;
  }
};

// Utility function to upload and get image URL
export const uploadImage = async (
  file: File,
  path: string
): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (error) {
    
    throw error;
  }
}; 