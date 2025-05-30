import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { serverTimestamp } from 'firebase/firestore';
import { ensureLearningProgressInitialized } from '@/services/learningService';
import { checkDailyStreak, calculateLevel } from '@/services/learningService';
import { showLevelUpCelebration, LevelUpDetails } from '@/components/LevelUpCelebration';

export interface WalletUserData {
  walletAddress: string;
  xp: number;
  totalXpEarned?: number;
  level?: number;
  streak?: number;
  displayName?: string;
  photoURL?: string;
  lastLogin?: Date;
  createdAt?: Date;
  suiTokens?: number;
  hasSeenOnboarding?: boolean;
}

interface WalletContextType {
  walletAddress: string | null;
  userData: WalletUserData | null;
  loading: boolean;
  error: string | null;
  updateUserData: (newData: WalletUserData) => Promise<void>;
  refreshUserData: () => Promise<void>;
  updateAvatar: (avatarUrl: string) => Promise<void>;
  checkUserStreak: () => Promise<void>;
  synchronizeUserLevel: () => Promise<boolean>;
}

// We'll use this to globally track if we've already shown the streak popup
let hasShownStreakPopup = false;
const STREAK_POPUP_KEY = 'last_streak_popup_day';
const STREAK_POPUP_SESSION_KEY = 'streak_popup_session';
// Add specific keys for exact timestamps for even better tracking
const STREAK_POPUP_TIMESTAMP_KEY = 'streak_popup_last_timestamp';

// Define user level tiers
const levelTiers = [
  { name: "Explorer", range: [1, 5], color: "text-green-400" },
  { name: "Pathfinder", range: [6, 10], color: "text-blue-400" },
  { name: "Voyager", range: [11, 25], color: "text-purple-400" },
  { name: "Commander", range: [26, 35], color: "text-pink-400" },
  { name: "Stellar Admiral", range: [36, Infinity], color: "text-amber-400" }
];

// Get the user's current tier based on level
const getUserTier = (level: number) => {
  const tier = levelTiers.find(tier => level >= tier.range[0] && level <= tier.range[1]);
  return tier || levelTiers[0]; // Default to Explorer if no tier found
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const currentAccount = useCurrentAccount();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userData, setUserData] = useState<WalletUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevWalletRef = useRef<string | null>(null);
  const previousLevelRef = useRef<number | null>(null);

  // Function to update streak in localStorage to prevent multiple popups in same day
  const updateStreakPopupDay = () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(STREAK_POPUP_KEY, today);
      // Also set a session storage flag to prevent multiple popups in the same session
      sessionStorage.setItem(STREAK_POPUP_SESSION_KEY, 'true');
      // Save exact timestamp for more precise checking
      localStorage.setItem(STREAK_POPUP_TIMESTAMP_KEY, Date.now().toString());
      hasShownStreakPopup = true;
      
    } catch (e) {
      
    }
  };

  // Function to check if we've shown the streak popup today
  const hasShownStreakPopupToday = () => {
    try {
      // We need to be more selective about when to show the streak popup
      // Reset tracking if more than 24 hours have passed since last popup
      
      // Check when the last popup was shown (timestamp)
      const lastTimestampStr = localStorage.getItem(STREAK_POPUP_TIMESTAMP_KEY);
      if (lastTimestampStr) {
        const lastTimestamp = parseInt(lastTimestampStr, 10);
        const hoursSinceLastPopup = (Date.now() - lastTimestamp) / (1000 * 60 * 60);
        
        // If it's been over 24 hours since last popup, clear all flags to allow a new popup
        if (hoursSinceLastPopup >= 24) {
          
          hasShownStreakPopup = false;
          sessionStorage.removeItem(STREAK_POPUP_SESSION_KEY);
          localStorage.removeItem(STREAK_POPUP_KEY);
          return false;
        }
      }
      
      // Otherwise, check all possible sources to ensure we don't show the popup multiple times
      
      // 1. Check memory variable first (most immediate)
      if (hasShownStreakPopup) {
        
        return true;
      }
      
      // 2. Check session storage (survives page refreshes but not browser restart)
      const shownThisSession = sessionStorage.getItem(STREAK_POPUP_SESSION_KEY) === 'true';
      if (shownThisSession) {
        
        hasShownStreakPopup = true; // Update memory flag
        return true;
      }
      
      // 3. Check timestamp-based threshold (if shown in last 6 hours, don't show again)
      if (lastTimestampStr) {
        const lastTimestamp = parseInt(lastTimestampStr, 10);
        const sixHoursMs = 6 * 60 * 60 * 1000;
        if (Date.now() - lastTimestamp < sixHoursMs) {
          
          hasShownStreakPopup = true; // Update memory flag
          sessionStorage.setItem(STREAK_POPUP_SESSION_KEY, 'true'); // Update session flag
          return true;
        }
      }
      
      // 4. Check calendar day (if already shown today, don't show again)
      const today = new Date().toISOString().split('T')[0];
      const lastDay = localStorage.getItem(STREAK_POPUP_KEY);
      if (lastDay === today) {
        
        hasShownStreakPopup = true; // Update memory flag
        sessionStorage.setItem(STREAK_POPUP_SESSION_KEY, 'true'); // Update session flag
        return true;
      }
      
      // Not shown yet, can show the popup
      
      return false;
    } catch (e) {
      
      return hasShownStreakPopup; // Use memory flag as fallback
    }
  };
  
  // Check for tier changes when user data is updated
  useEffect(() => {
    // Skip if no user data or no previous level reference
    if (!userData || userData.level === undefined || previousLevelRef.current === null) {
      if (userData?.level !== undefined) {
        previousLevelRef.current = userData.level;
      }
      return;
    }
    
    const currentLevel = userData.level;
    const previousLevel = previousLevelRef.current;
    
    // Check if level has increased
    if (currentLevel > previousLevel) {
      const currentTier = getUserTier(currentLevel);
      const previousTier = getUserTier(previousLevel);
      
      // Check if user crossed a tier threshold
      if (currentTier.name !== previousTier.name) {
        // User has reached a new tier - show celebration
        const levelUpDetails: LevelUpDetails = {
          oldLevel: previousLevel,
          newLevel: currentLevel,
          oldTier: previousTier.name,
          newTier: currentTier.name,
          xpAwarded: 500, // Bonus XP for reaching a new tier
          suiAwarded: 5,  // Bonus SUI tokens
          cosmetics: [
            {
              name: `${currentTier.name} Badge`,
              type: 'badge'
            },
            {
              name: `${currentTier.name} Avatar Frame`,
              type: 'frame'
            }
          ]
        };
        
        // Show level up celebration
        showLevelUpCelebration(levelUpDetails);
        
        // Award the bonus XP and SUI for reaching a new tier
        if (walletAddress) {
          setDoc(doc(db, 'learningProgress', walletAddress), {
            xp: userData.xp + 500,
            totalXpEarned: (userData.xp + 500),
            suiTokens: (userData.suiTokens || 0) + 5,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      } else if (currentLevel > previousLevel) {
        // Regular level up, not a tier change
        const levelUpDetails: LevelUpDetails = {
          oldLevel: previousLevel,
          newLevel: currentLevel,
          xpAwarded: 100 // Smaller bonus for regular level up
        };
        
        // Show level up celebration
        showLevelUpCelebration(levelUpDetails);
      }
      
      // Update the previous level reference
      previousLevelRef.current = currentLevel;
    }
  }, [userData, walletAddress]);
  
  // Fetch the latest user data from Firestore
  const refreshUserData = async () => {
    if (!walletAddress) return;
    
    try {
      setLoading(true);
      
      
      const userDoc = await getDoc(doc(db, 'learningProgress', walletAddress));
      
      if (userDoc.exists()) {
        const dbData = userDoc.data();
        
        
        // Get the XP value from totalXpEarned
        let xpValue = 0;
        if (dbData.totalXpEarned !== undefined) {
          // Convert to number regardless of storage type
          xpValue = Number(dbData.totalXpEarned) || 0;
        }
        
        const updatedUserData: WalletUserData = {
          walletAddress,
          xp: xpValue,
          level: dbData.level || 1,
          streak: dbData.streak || 0,
          displayName: dbData.displayName || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
          photoURL: dbData.photoURL,
          lastLogin: dbData.lastLogin?.toDate?.() || new Date(),
          createdAt: dbData.createdAt?.toDate?.() || new Date(),
          suiTokens: dbData.suiTokens || 0,
          hasSeenOnboarding: dbData.hasSeenOnboarding || false
        };
        
        
        setUserData(updatedUserData);
      } else {
        
      }
    } catch (err) {
      
    } finally {
      setLoading(false);
    }
  };

  // Function to check user streak. This will be called on app load and navigation
  const checkUserStreak = async () => {
    if (!walletAddress) return;
    
    try {
      // For login/reconnection, we want to check if we need to force showing the popup
      const isLoginEvent = sessionStorage.getItem('just_connected_wallet') === 'true';
      
      // Check when the last popup was shown (timestamp)
      const lastTimestampStr = localStorage.getItem(STREAK_POPUP_TIMESTAMP_KEY);
      let forceCheck = false;
      
      // If user just logged in, force streak check
      if (isLoginEvent) {
        
        forceCheck = true;
        // Clear the login flag
        sessionStorage.removeItem('just_connected_wallet');
      } else if (lastTimestampStr) {
        const lastTimestamp = parseInt(lastTimestampStr, 10);
        const hoursSinceLastPopup = (Date.now() - lastTimestamp) / (1000 * 60 * 60);
        
        // If it's been over 24 hours since last popup, force a check
        if (hoursSinceLastPopup >= 24) {
          
          forceCheck = true;
        }
      } else {
        // No record of ever showing popup, force check
        forceCheck = true;
      }
      
      // If not forcing check, see if we've already shown today
      if (!forceCheck && hasShownStreakPopupToday()) {
        
        return;
      }
      
      
      const streakResult = await checkDailyStreak(walletAddress);
      
      // Make sure we have the latest user data after streak check
      await refreshUserData();
      
      // Show popup if it's a new day or if we're forcing a check after 24+ hours or on login
      if (streakResult.isNewDay || forceCheck) {
        // Set flag to prevent showing streak popup again in this session
        updateStreakPopupDay();
        
        // Reset hasShownStreakPopup to ensure it will be shown on this login
        if (isLoginEvent) {
          hasShownStreakPopup = false;
          sessionStorage.removeItem(STREAK_POPUP_SESSION_KEY);
        }
        
        // Emit a custom event that other components can listen for
        const streakEvent = new CustomEvent('dailyStreakChecked', { 
          detail: {
            isNewDay: true, // Force to true if we're doing a 24+ hour check or login check
            currentStreak: streakResult.currentStreak,
            xpAwarded: streakResult.xpAwarded,
            isMilestone: streakResult.isMilestone,
            leveledUp: streakResult.leveledUp,
            newLevel: streakResult.newLevel
          }
        });
        document.dispatchEvent(streakEvent);
        
        
      } else {
        
      }
    } catch (err) {
      
    }
  };

  // Function to update user data
  const updateUserData = async (newData: WalletUserData) => {
    if (!walletAddress) {
      throw new Error('Cannot update user data without a wallet address');
    }
    
    try {
      // Create a clean version of the data for Firebase
      const cleanData = {};
      
      // Only include defined properties 
      Object.entries(newData).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanData[key] = value;
        }
      });
      
      await setDoc(doc(db, 'learningProgress', walletAddress), {
        ...cleanData,
        totalXpEarned: newData.xp, // Make sure to store the xp value in totalXpEarned
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setUserData(newData);
    } catch (err) {
      
      throw err;
    }
  };

  // Dedicated function to update avatar
  const updateAvatar = async (avatarUrl: string) => {
    if (!walletAddress || !userData) {
      throw new Error('Cannot update avatar without a wallet address or user data');
    }

    try {
      
      
      // Update in Firestore
      await setDoc(doc(db, 'learningProgress', walletAddress), {
        photoURL: avatarUrl,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Update in local state
      setUserData({
        ...userData,
        photoURL: avatarUrl
      });
      
      
      
      // Force a refresh to ensure all components get the updated avatar
      setTimeout(() => {
        refreshUserData();
      }, 500);
      
      return;
    } catch (err) {
      
      throw err;
    }
  };

  // Check user streak when wallet is first connected or refreshed
  useEffect(() => {
    if (walletAddress && !loading) {
      checkUserStreak();
    }
  }, [walletAddress, loading]);

  useEffect(() => {
    const fetchWalletData = async () => {
      if (currentAccount) {
        if (currentAccount.address === prevWalletRef.current) {
          return;
        }
        
        try {
          // Set a flag to indicate user just connected wallet
          sessionStorage.setItem('just_connected_wallet', 'true');
          
          setLoading(true);
          setWalletAddress(currentAccount.address);
          prevWalletRef.current = currentAccount.address;
          
          // Try to get existing user data directly from learningProgress collection
          const userDoc = await getDoc(doc(db, 'learningProgress', currentAccount.address));
          
          if (userDoc.exists()) {
            // User exists, get their data
            const dbData = userDoc.data();
            
            
            // Get the XP value from totalXpEarned
            let xpValue = 0;
            if (dbData.totalXpEarned !== undefined) {
              // Convert to number regardless of storage type
              xpValue = Number(dbData.totalXpEarned) || 0;
            }
            
            
            const userData: WalletUserData = {
              walletAddress: currentAccount.address,
              xp: xpValue,
              level: dbData.level || 1,
              streak: dbData.streak || 0,
              displayName: dbData.displayName || `${currentAccount.address.slice(0, 6)}...${currentAccount.address.slice(-4)}`,
              photoURL: dbData.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=fixed',
              lastLogin: dbData.lastLogin?.toDate?.() || new Date(),
              createdAt: dbData.createdAt?.toDate?.() || new Date(),
              suiTokens: dbData.suiTokens || 0,
              hasSeenOnboarding: dbData.hasSeenOnboarding || false
            };
            
            
            setUserData(userData);
            
            // Update last login time
            await setDoc(doc(db, 'learningProgress', currentAccount.address), {
              lastLogin: serverTimestamp()
            }, { merge: true });
          } else {
            // New wallet with no user data yet - create user entry
            // Generate a random avatar using DiceBear API - use fixed seed for consistency
            const avatarUrl = 'https://api.dicebear.com/7.x/bottts/svg?seed=fixed';
            
            const newUserData: WalletUserData = {
              walletAddress: currentAccount.address,
              xp: 0,
              level: 1,
              streak: 0,
              suiTokens: 0,
              displayName: `${currentAccount.address.slice(0, 6)}...${currentAccount.address.slice(-4)}`,
              photoURL: avatarUrl,
              createdAt: new Date(),
              lastLogin: new Date(),
              hasSeenOnboarding: false
            };
            
            // Create user document directly in learningProgress collection
            await setDoc(doc(db, 'learningProgress', currentAccount.address), {
              ...newUserData,
              totalXpEarned: 0, // Store xp as totalXpEarned for consistency
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
              photoURL: avatarUrl, // Save the generated avatar URL
              hasSeenOnboarding: false // Explicitly set this for new users
            });
            
            // Ensure default module progress is initialized
            await ensureLearningProgressInitialized(currentAccount.address, 'intro-to-sui');
            
            setUserData(newUserData);
            
          }
        } catch (err) {
          
          setError("Failed to load wallet data");
        } finally {
          setLoading(false);
        }
      } else {
        if (walletAddress !== null) {
          setWalletAddress(null);
          setUserData(null);
          prevWalletRef.current = null;
        }
        setLoading(false);
      }
    };

    fetchWalletData();
  }, [currentAccount]);

  /**
   * Synchronize user level with XP
   * Ensures that the level stored in Firestore matches what it should be based on their XP
   */
  const synchronizeUserLevel = async () => {
    if (!walletAddress) return false;
    
    try {
      // Get the user's document from Firestore
      const userProgressRef = doc(db, 'learningProgress', walletAddress);
      const userDoc = await getDoc(userProgressRef);
      
      if (!userDoc.exists()) return false;
      
      const userData = userDoc.data();
      const currentXp = userData.totalXpEarned || 0;
      const storedLevel = userData.level || 1;
      
      // Calculate what the level should be based on XP
      const calculatedLevel = calculateLevel(currentXp);
      
      // If there's a mismatch, update the level in Firestore
      if (calculatedLevel !== storedLevel) {
        
        
        await updateDoc(userProgressRef, {
          level: calculatedLevel
        });
        
        // Refresh user data
        await refreshUserData();
        
        return true;
      }
      
      return false;
    } catch (error) {
      
      return false;
    }
  };

  // Run level synchronization when user data is loaded
  useEffect(() => {
    if (userData && !loading) {
      synchronizeUserLevel();
    }
  }, [userData, loading]);

  return (
    <WalletContext.Provider 
      value={{
        walletAddress,
        userData,
        loading,
        error,
        updateUserData,
        refreshUserData,
        updateAvatar,
        checkUserStreak,
        synchronizeUserLevel
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export default WalletProvider; 