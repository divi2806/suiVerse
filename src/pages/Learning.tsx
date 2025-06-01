import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import NavBar from '@/components/NavBar';
import LearningPathMap from '@/components/LearningPathMap';
import StarField from '@/components/StarField';
import DailyChallenges from '@/components/DailyChallenges';
import { Star, Circle, Rocket, Calendar, CheckCircle, Trophy, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import { 
  getGalaxiesWithModules, 
  getModuleXpPotential, 
  getUserLearningProgress, 
  repairCompletedModules, 
  isModuleCompleted,
  completeModule
} from '@/services/learningService';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc, 
  updateDoc, 
  Timestamp, 
  setDoc, 
  increment, 
  serverTimestamp, 
  addDoc, 
  arrayUnion, 
  getFirestore 
} from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { sendSuiReward } from '@/services/suiPaymentService';
import { rewardUser } from '@/services/userRewardsService';
import './learning.css';
import { Progress } from "@/components/ui/progress";

// Define interfaces that match the ones in LearningPathMap
interface Module {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  locked: boolean;
  position: { x: number; y: number };
  type: 'planet' | 'moon' | 'asteroid' | 'station';
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

// For internal use with API data
interface ModuleProgress {
  score?: number;
  completedAt?: string;
  attempts?: number;
  completed?: boolean;
  completedLessons?: string[];
  lastAccessed?: Date;
  quizScore?: number;
  alienChallengesCompleted?: string[];
}

interface ModuleType {
  id: string;
  title: string;
  description: string;
  locked: boolean;
  completed: boolean;
  current: boolean;
  progress: ModuleProgress;
  position: { x: number; y: number };
  type: 'planet' | 'moon' | 'asteroid' | 'station' | 'earth';
  color: string;
  xpReward: number;
  tokenReward?: number;
}

// For internal use with API data
interface GalaxyType {
  id: number;
  name: string;
  modules: ModuleType[];
  unlocked: boolean;
  completed: boolean;
  current: boolean;
  position: { x: number; y: number };
}

const Learning = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { walletAddress, userData, refreshUserData } = useAuth();
  const currentAccount = useCurrentAccount();
  const [connected, setConnected] = useState(false);
  
  const [galaxies, setGalaxies] = useState<GalaxyType[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentGalaxy, setCurrentGalaxy] = useState(1);
  const [currentModuleId, setCurrentModuleId] = useState('intro-to-sui');
  const [userProgress, setUserProgress] = useState({
    overallProgress: 0,
    totalModulesCompleted: 0,
    totalModules: 0
  });
  const [dailyChallenges, setDailyChallenges] = useState<any[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [completingModule, setCompletingModule] = useState<string | null>(null);
  const [completedModules, setCompletedModules] = useState<string[]>([]);
  const [unlockedAchievement, setUnlockedAchievement] = useState<any | null>(null);
  // Start with a zoomed out view to see more galaxies
  const [mapPosition, setMapPosition] = useState({ x: 0, y: 0 });
  const [rocketPosition, setRocketPosition] = useState({ x: 300, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [startDragPosition, setStartDragPosition] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // User level and XP tracking
  const [userLevel, setUserLevel] = useState(1);
  const [levelProgress, setLevelProgress] = useState(0);
  const [nextLevelXp, setNextLevelXp] = useState(100);
  
  // Map interaction state
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Update connection status when wallet changes
  useEffect(() => {
    setConnected(!!currentAccount);
  }, [currentAccount]);

  const handleConnect = useCallback((address: string) => {
    setConnected(true);
  }, []);

  const handleDisconnect = useCallback(() => {
    setConnected(false);
  }, []);
  
  // Fetch modules and user progress
  useEffect(() => {
    const fetchUserProgress = async () => {
        try {
          setLoading(true);
        
        // Get modules and progress (empty wallet address will return mock data structure but we'll handle display differently)
        
        const galaxiesData = await getGalaxiesWithModules(walletAddress || '');
          
          // Format the galaxies data for the map
          const formattedGalaxies = galaxiesData.map((galaxy, index) => {
          // Position galaxies in a more horizontal line with slight vertical offset
          // This makes them easier to see on standard screens
          const baseX = 600 + index * 500; // More horizontal spacing
          const baseY = 500 + (index % 2) * 100; // Slight vertical zigzag for visibility
            
            // Process modules to ensure correct locked/unlocked status
            const processedModules = galaxy.modules.map((module, moduleIndex) => {
              let isModuleLocked = module.locked;
              let isModuleCurrent = module.current;
              
              // First module in first galaxy is always unlocked
              if (index === 0 && moduleIndex === 0) {
                isModuleLocked = false;
              } 
              // For other galaxies, first module is unlocked if previous galaxy is completed
              else if (moduleIndex === 0 && index > 0) {
                const previousGalaxy = galaxiesData[index - 1];
                const isPreviousGalaxyCompleted = previousGalaxy.completed;
                isModuleLocked = !isPreviousGalaxyCompleted && !galaxy.unlocked;
              } 
              // For subsequent modules in a galaxy, they're unlocked if previous module is completed
              else if (moduleIndex > 0) {
                const previousModule = galaxy.modules[moduleIndex - 1];
                isModuleLocked = !previousModule.completed && module.locked;
              }
              
              return {
                ...module,
                type: module.type as 'planet' | 'moon' | 'asteroid' | 'station' | 'earth',
                locked: isModuleLocked,
                current: isModuleCurrent
              };
            });
            
            return {
              ...galaxy,
              position: { x: baseX, y: baseY },
              modules: processedModules
            } as GalaxyType;
          });
          
          // Set the galaxies data
          setGalaxies(formattedGalaxies);
          
        // Only process progress data if wallet is connected
        if (walletAddress) {
          
          
          // Get user progress to get the correct rocket position
          const userProgress = await getUserLearningProgress(walletAddress);
          
          // Find the current galaxy
          const current = formattedGalaxies.find(g => g.current);
          if (current) {
            setCurrentGalaxy(current.id);
            
            // Find the current module
            const currentModule = current.modules.find((m: ModuleType) => m.current);
            if (currentModule) {
              
              setCurrentModuleId(currentModule.id);
              
              // Set rocket position - prioritize the one from userProgress if available
              if (userProgress && userProgress.rocketPosition) {
                
                setRocketPosition(userProgress.rocketPosition);
              } else {
                const rocketX = current.position.x + (currentModule.position?.x || 0);
                const rocketY = current.position.y + (currentModule.position?.y || 0);
                setRocketPosition({ x: rocketX, y: rocketY });
              }
            }
          }
          
          // Set completed modules from user progress
          if (userProgress && userProgress.completedModules) {
            setCompletedModules(userProgress.completedModules || []);
          }
          
          // Calculate overall progress statistics
          const totalModules = formattedGalaxies.reduce((total, galaxy) => total + galaxy.modules.length, 0);
          const completedModules = formattedGalaxies.reduce((total, galaxy) => 
            total + galaxy.modules.filter((m: ModuleType) => m.completed).length, 0);
          const overallPercentage = Math.floor((completedModules / totalModules) * 100);
          
          setUserProgress({
            overallProgress: overallPercentage,
            totalModulesCompleted: completedModules,
            totalModules
          });
        } else {
          // Set default values for unconnected state
          setUserProgress({
            overallProgress: 0,
            totalModulesCompleted: 0,
            totalModules: formattedGalaxies.reduce((total, galaxy) => total + galaxy.modules.length, 0)
          });
          
          // Set default galaxy and module
          setCurrentGalaxy(1); // First galaxy
          setCurrentModuleId('intro-to-sui'); // First module
          setRocketPosition({ x: 300, y: 150 }); // Default position
        }
        } catch (error) {
        
        toast({
          title: "Error",
          description: "Failed to load learning progress",
          variant: "destructive",
        });
        } finally {
          setLoading(false);
        }
    };
    
    fetchUserProgress();
  }, [walletAddress, toast]);
  
  // Fetch daily challenges for the user
  useEffect(() => {
    const fetchDailyChallenges = async () => {
      try {
        setLoadingChallenges(true);
        
        if (!walletAddress) {
          // For non-connected users, don't show any challenges
          setDailyChallenges([]);
          return;
        }
        
        // Get challenges from our service
        const challenges = await import('@/services/dailyChallengesService')
          .then(module => module.getUserDailyChallenges(walletAddress));
        
        setDailyChallenges(challenges);
      } catch (error) {
        
        // Leave challenges empty for error cases
        setDailyChallenges([]);
      } finally {
        setLoadingChallenges(false);
      }
    };
    
    fetchDailyChallenges();
    
    // Set up a timer to check for expired challenges
    const checkExpiredInterval = setInterval(() => {
      const now = new Date();
      // If any challenge is expired, refresh the challenges
      if (dailyChallenges.some(challenge => challenge.expiresAt && 
          (challenge.expiresAt instanceof Date ? challenge.expiresAt < now : 
           challenge.expiresAt.toDate() < now))) {
        fetchDailyChallenges();
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(checkExpiredInterval);
  }, [walletAddress]);
  
  // Center the map on the current galaxy
  useEffect(() => {
    const currentGalaxyData = galaxies.find(galaxy => galaxy.id === currentGalaxy);
    if (currentGalaxyData && mapContainerRef.current) {
      const containerWidth = mapContainerRef.current.clientWidth;
      const containerHeight = mapContainerRef.current.clientHeight;
      
      // Calculate a position that centers the current galaxy but also tries to show more of the upcoming galaxies
      // For early galaxies, show more to the right. For later galaxies, center more evenly
      const xOffset = currentGalaxy <= 4 ? 200 : 0; // Show more right side for early galaxies
      
      setMapPosition({
        x: (containerWidth / 2) - currentGalaxyData.position.x + xOffset,
        y: (containerHeight / 2) - currentGalaxyData.position.y
      });
    }
  }, [currentGalaxy, galaxies]);
  
  // Handle map dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartDragPosition({ x: e.clientX - mapPosition.x, y: e.clientY - mapPosition.y });
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setMapPosition({
      x: e.clientX - startDragPosition.x,
      y: e.clientY - startDragPosition.y
    });
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Start a module
  const handleStartModule = (moduleId: string) => {
    if (!connected) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to track progress",
        variant: "default",
      });
      return;
    }
    
    // Update current module ID locally before navigating
    setCurrentModuleId(moduleId);
    
    // Find the galaxy this module belongs to
    for (const galaxy of galaxies) {
      const moduleInGalaxy = galaxy.modules.find(m => m.id === moduleId);
      if (moduleInGalaxy) {
        // Set this galaxy as current if it's not already
        if (galaxy.id !== currentGalaxy) {
          setCurrentGalaxy(galaxy.id);
        }
        
        // Update galaxies to reflect current module
        setGalaxies(prevGalaxies => 
          prevGalaxies.map(g => ({
            ...g,
            current: g.id === galaxy.id,
            modules: g.modules.map(m => ({
              ...m,
              current: m.id === moduleId
            }))
          }))
        );
        
        // If the module is not locked, update user progress in Firestore
        if (!moduleInGalaxy.locked && walletAddress) {
          try {
            const userProgressRef = doc(db, 'learningProgress', walletAddress);
            updateDoc(userProgressRef, {
              currentModuleId: moduleId,
              lastActivityTimestamp: serverTimestamp()
            }).catch(err => console.error('[Learning] Error updating current module:', err));
          } catch (error) {
            console.error('[Learning] Error updating current module:', error);
          }
        }
        
        break;
      }
    }
    
    // Navigate to the module page
    navigate(`/learning/${moduleId}`);
  };
  
  // Handlers for challenges
  const handleStartChallenge = async (challengeId: string) => {
    // This function is now handled by DailyChallenges component directly
    // It's only needed for backwards compatibility
    
  };
  
  const handleClaimReward = async (challengeId: string) => {
    if (!walletAddress) return;
    
    try {
      const result = await import('@/services/dailyChallengesService')
        .then(module => module.completeChallengeAndClaimRewards(challengeId, walletAddress));
      
      if (result.success) {
        toast({
          title: "Rewards Claimed!",
          description: `${result.reward} SUI has been added to your wallet.`,
          duration: 3000,
        });
        
        // Refresh user data to show updated balances
        refreshUserData();
        
        // Refresh challenges list
        const challenges = await import('@/services/dailyChallengesService')
          .then(module => module.getUserDailyChallenges(walletAddress));
        setDailyChallenges(challenges);
      } else {
        throw new Error("Failed to claim reward");
      }
    } catch (error) {
      
      toast({
        title: "Error",
        description: "Failed to claim rewards. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };
  
  // Find the current galaxy and module
  const currentGalaxyData = galaxies.find(galaxy => galaxy.id === currentGalaxy);
  const currentModuleData = currentGalaxyData?.modules.find((m: ModuleType) => m.id === currentModuleId);
  
  // User stats
  const userStats = {
    xp: userData?.xp || 0,
    streak: userData?.streak || 0,
    level: userData?.level || 1,
    username: userData?.displayName || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Explorer'),
    avatarSrc: userData?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=cosmic'
  };
  
  // Check if a module has been completed
  const isModuleCompleted = (moduleId: string): boolean => {
    // First check local state
    if (completedModules.includes(moduleId)) {
      return true;
    }
    
    // Then check in galaxies data
    for (const galaxy of galaxies) {
      const module = galaxy.modules.find(m => m.id === moduleId);
      if (module && module.completed) {
        return true;
      }
    }
    
    return false;
  };
  
  // Calculate module progress percentage
  const calculateModuleProgress = (module: ModuleType): number => {
    if (module.completed) return 100;
    if (module.locked) return 0;
    
    // Check if the module has progress data
    if (!module.progress) return 5; // Just started
    
    const { completedLessons = [], quizScore } = module.progress;
    
    // First, estimate total content in the module (can be adjusted based on real data)
    const estimatedFlashcards = 10;
    const hasQuiz = true; // Most modules have quizzes
    const challengeCount = Math.min(2, Math.ceil(parseInt(module.id.split('-').pop() || '0', 10) / 3));
    
    // Calculate completion percentage
    let completedItems = completedLessons.length;
    let totalItems = estimatedFlashcards + (hasQuiz ? 1 : 0) + challengeCount;
    
    // If quiz is taken, count it as completed
    if (quizScore !== undefined) {
      completedItems += 1;
    }
    
    // Calculate percentage, with minimum 5% if module is started
    const percentage = Math.max(5, Math.floor((completedItems / totalItems) * 100));
    
    return Math.min(99, percentage); // Cap at 99% until fully completed
  };
  
  // Function to zoom in/out
  const handleZoom = (direction: 'in' | 'out') => {
    if (direction === 'in' && zoomLevel < 1.5) {
      setZoomLevel(prev => prev + 0.1);
    } else if (direction === 'out' && zoomLevel > 0.5) {
      setZoomLevel(prev => prev - 0.1);
    }
  };
  
  // Function to reset view
  const resetView = () => {
    setZoomLevel(1);
    setMapPosition({ x: 0, y: 0 });
  };

  const completeModule = async (moduleId: string) => {
    if (!walletAddress) return;
    
    try {
      setCompletingModule(moduleId);
      
      // Get module info
      const module = galaxies.find(g => g.id === currentGalaxy)?.modules.find(m => m.id === moduleId);
      if (!module) {
        
        return;
      }
      
      // Get user progress document
      const userRef = doc(db, 'learningProgress', walletAddress);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        
        return;
      }
      
      // Update user progress
      await updateDoc(userRef, {
        completedModules: arrayUnion(moduleId),
        xp: increment(module.xpReward),
        totalXpEarned: increment(module.xpReward),
        lastActivityTimestamp: serverTimestamp()
      });
      
      // Award SUI tokens if the module includes a token reward
      if (module.tokenReward && module.tokenReward > 0) {
        // Use the new rewardUser function with the proper source
        const tokenResult = await rewardUser(
          walletAddress,
          module.tokenReward,
          `Module Completion: ${module.title}`,
          'learning'
        );
        
        if (tokenResult.success) {
          
        } else {
          
        }
      }
      
      // Add to activity log
      await addDoc(collection(db, 'learning_activity'), {
        userId: walletAddress,
        type: 'module_completion',
        moduleId: moduleId,
        moduleName: module.title,
        xpEarned: module.xpReward,
        suiEarned: module.tokenReward || 0,
        timestamp: serverTimestamp()
      });
      
      // Update completed modules list locally
      setCompletedModules(prev => [...prev, moduleId]);
      
      // Show success toast
      toast({
        title: "Module Completed!",
        description: (
          <div className="space-y-1">
            <p>You've earned:</p>
            <p>✓ {module.xpReward} XP</p>
            {module.tokenReward > 0 && <p>✓ {module.tokenReward} SUI</p>}
            <p className="text-green-500 font-medium">Keep going! You're making great progress.</p>
          </div>
        ),
        duration: 5000,
      });
      
      // Check for achievements
      await checkAchievements(walletAddress).then(newAchievements => {
        if (newAchievements.length > 0) {
          setUnlockedAchievement(newAchievements[0]);
        }
      });
      
    } catch (error) {
      
      toast({
        title: "Error",
        description: "There was a problem completing the module. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setCompletingModule(null);
    }
  };

  const checkAchievements = async (userAddress: string): Promise<any[]> => {
    try {
      // Check if user document exists
      const userDoc = await getDoc(doc(db, 'learningProgress', userAddress));
      
      if (!userDoc.exists()) {
        return [];
      }
      
      const userData = userDoc.data();
      const completedModulesCount = userData.completedModules?.length || 0;
      const newAchievements = [];
      
      // Check for module completion achievements
      if (completedModulesCount >= 5 && !userData.achievements?.includes('complete_5_modules')) {
        // Award 5 modules completion achievement
        const achievementData = {
          id: 'complete_5_modules',
          name: 'Stellar Student',
          description: 'Completed 5 learning modules',
          awardedAt: serverTimestamp(),
          xpReward: 100
        };
        
        // Add to user's achievements
        await updateDoc(doc(db, 'learningProgress', userAddress), {
          achievements: arrayUnion('complete_5_modules'),
          xp: increment(100),
          totalXpEarned: increment(100)
        });
        
        // Record the achievement
        await addDoc(collection(db, 'user_achievements'), {
          userId: userAddress,
          ...achievementData
        });
        
        newAchievements.push(achievementData);
      }
      
      // Can add more achievement checks here
      
      return newAchievements;
    } catch (error) {
      
      return [];
    }
  };

  // Manual refresh function for progress data
  const refreshProgressData = async () => {
    if (!walletAddress) return;
    
    try {
      setLoading(true);
      
      // Get user progress data
      const userProgressRef = doc(db, 'learningProgress', walletAddress);
      const userDoc = await getDoc(userProgressRef);
      
      if (!userDoc.exists()) {
        setLoading(false);
        return;
      }
      
      const userData = userDoc.data();
      
      // Get user's completed modules
      const completedModulesList = userData.completedModules || [];
      setCompletedModules(completedModulesList);
      
      // Get current module ID
      const currentModuleId = userData.currentModuleId || 'intro-to-sui';
      setCurrentModuleId(currentModuleId);
      
      // Get rocket position (if available)
      if (userData.rocketPosition) {
        setRocketPosition(userData.rocketPosition);
      }
      
      // Get all galaxies with modules
      const galaxiesData = await getGalaxiesWithModules(walletAddress);
      
      // Process galaxy data to determine current galaxy and module
      let currentGalaxyId = 1;
      let foundCurrentModule = false;
      
      for (const galaxy of galaxiesData) {
        // Check if any module in this galaxy is current
        for (const module of galaxy.modules) {
          if (module.id === currentModuleId) {
            currentGalaxyId = galaxy.id;
            foundCurrentModule = true;
            break;
          }
        }
        if (foundCurrentModule) break;
      }
      
      // Update current galaxy
      setCurrentGalaxy(currentGalaxyId);
      
      // Process galaxies to update their completion and unlocked status
      const processedGalaxies = galaxiesData.map((galaxy, galaxyIndex) => {
        // A galaxy is completed if all its modules are completed
        const isCompleted = galaxy.modules.every(module => 
          completedModulesList.includes(module.id)
        );
        
        // A galaxy is current if it contains the current module
        const isCurrent = galaxy.id === currentGalaxyId;
        
        // A galaxy is unlocked if it's the first one, or if the previous galaxy is completed
        let isUnlocked = galaxy.unlocked;
        if (galaxyIndex === 0) {
          isUnlocked = true; // First galaxy is always unlocked
        } else if (galaxyIndex > 0) {
          const previousGalaxy = galaxiesData[galaxyIndex - 1];
          const isPreviousGalaxyCompleted = previousGalaxy.modules.every(module => 
            completedModulesList.includes(module.id)
          );
          isUnlocked = isPreviousGalaxyCompleted || galaxy.unlocked;
          
          // Check if previous galaxy is completed but this one isn't unlocked yet
          if (isPreviousGalaxyCompleted && !galaxy.unlocked) {
            console.log(`[Learning] Galaxy ${previousGalaxy.id} completed, unlocking Galaxy ${galaxy.id}`);
            isUnlocked = true;
            
            // Update in Firebase to ensure persistence
            try {
              updateDoc(userProgressRef, {
                unlockedGalaxies: arrayUnion(galaxy.id),
                lastActivityTimestamp: serverTimestamp()
              }).catch(err => console.error(`[Learning] Error updating unlocked galaxy ${galaxy.id}:`, err));
            } catch (error) {
              console.error(`[Learning] Error updating unlocked galaxy ${galaxy.id}:`, error);
            }
            
            // Show notification toast
            toast({
              title: "New Galaxy Unlocked!",
              description: `You've unlocked the ${galaxy.name}!`,
              duration: 4000,
              className: "galaxy-unlocked-toast"
            });
          }
        }
        
        // Process modules to update their locked/current/completed status
        const processedModules = galaxy.modules.map((module, moduleIndex) => {
          // A module is completed if it's in the completedModules list
          const isModuleCompleted = completedModulesList.includes(module.id);
          
          // A module is current if its ID matches the currentModuleId
          const isModuleCurrent = module.id === currentModuleId;
          
          // Determine if module should be locked
          let isModuleLocked = module.locked;
          
          // First module in an unlocked galaxy is never locked
          if (moduleIndex === 0 && isUnlocked) {
            isModuleLocked = false;
          } 
          // For subsequent modules, they're unlocked if the previous module is completed
          else if (moduleIndex > 0) {
            const previousModule = galaxy.modules[moduleIndex - 1];
            const isPreviousModuleCompleted = completedModulesList.includes(previousModule.id);
            isModuleLocked = !isPreviousModuleCompleted && !isModuleCompleted;
          }
          
          return {
            ...module,
            completed: isModuleCompleted,
            current: isModuleCurrent,
            locked: isModuleLocked
          };
        });
        
        return {
          ...galaxy,
          completed: isCompleted,
          current: isCurrent,
          unlocked: isUnlocked,
          modules: processedModules
        };
      });
      
      // Update galaxies state
      setGalaxies(processedGalaxies);
      
      // Calculate and update user level based on XP
      const userXp = userData.xp || 0;
      const userLevel = calculateLevel(userXp);
      setUserLevel(userLevel);
      
      // Calculate next level XP requirement
      const nextLevelXp = calculateXpForNextLevel(userLevel);
      setNextLevelXp(nextLevelXp);
      
      // Calculate XP progress percentage
      const currentLevelXp = calculateXpForLevel(userLevel);
      const xpProgress = ((userXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
      setLevelProgress(Math.min(100, Math.max(0, xpProgress)));
      
      // Calculate overall progress statistics
      const totalModules = processedGalaxies.reduce((total, galaxy) => total + galaxy.modules.length, 0);
      const completedModulesCount = completedModulesList.length;
      const overallPercentage = Math.floor((completedModulesCount / totalModules) * 100);
      
      setUserProgress({
        overallProgress: overallPercentage,
        totalModulesCompleted: completedModulesCount,
        totalModules
      });
      
      // Check if the current galaxy is actually completed and should be updated
      const currentGalaxyData = processedGalaxies.find(g => g.id === currentGalaxyId);
      if (currentGalaxyData && currentGalaxyData.completed) {
        // Find the next galaxy
        const nextGalaxyIndex = processedGalaxies.findIndex(g => g.id === currentGalaxyId) + 1;
        if (nextGalaxyIndex < processedGalaxies.length) {
          const nextGalaxy = processedGalaxies[nextGalaxyIndex];
          if (nextGalaxy.unlocked) {
            console.log(`[Learning] Current galaxy ${currentGalaxyId} is completed, updating current galaxy to ${nextGalaxy.id}`);
            
            // Find first module in next galaxy
            const firstModule = nextGalaxy.modules.length > 0 ? nextGalaxy.modules[0] : null;
            if (firstModule) {
              // Set next galaxy as current
              setCurrentGalaxy(nextGalaxy.id);
              
              // Set first module as current
              setCurrentModuleId(firstModule.id);
              
              // Update rocket position
              const newRocketPosition = {
                x: nextGalaxy.position.x + firstModule.position.x,
                y: nextGalaxy.position.y + firstModule.position.y
              };
              setRocketPosition(newRocketPosition);
              
              // Update in Firebase
              try {
                const userProgressRef = doc(db, 'learningProgress', walletAddress);
                updateDoc(userProgressRef, {
                  currentGalaxyId: nextGalaxy.id,
                  currentModuleId: firstModule.id,
                  rocketPosition: newRocketPosition,
                  lastActivityTimestamp: serverTimestamp()
                }).catch(err => console.error('[Learning] Error updating current galaxy and rocket position:', err));
              } catch (error) {
                console.error('[Learning] Error updating current galaxy and rocket position:', error);
              }
              
              // Update processed galaxies
              const updatedProcessedGalaxies = processedGalaxies.map(g => ({
                ...g,
                current: g.id === nextGalaxy.id,
                modules: g.modules.map(m => ({
                  ...m,
                  current: g.id === nextGalaxy.id && m.id === firstModule.id
                }))
              }));
              
              // Update galaxies state with corrected current flags
              setGalaxies(updatedProcessedGalaxies);
            }
          }
        }
      }
      
      // Log the updated state for debugging
      console.log('[Learning] Refreshed progress data:', {
        completedModules: completedModulesList.length,
        currentModule: currentModuleId,
        currentGalaxy: currentGalaxyId,
        galaxies: processedGalaxies.length,
        rocketPosition: userData.rocketPosition
      });
      
      // Dispatch a custom event to notify other components that progress data has been refreshed
      document.dispatchEvent(new CustomEvent('progressDataRefreshed', {
        detail: {
          walletAddress,
          completedModules: completedModulesList,
          currentModule: currentModuleId,
          currentGalaxy: currentGalaxyId
        }
      }));
      
    } catch (error) {
      console.error('[Learning] Error refreshing progress data:', error);
      toast({
        title: "Error",
        description: "Failed to refresh your progress data",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to force complete a module (for debugging)
  const forceCompleteModule = async (currentMod: string, nextMod: string): Promise<void> => {
    try {
      // Get the db directly
      const db = getFirestore();
      
      toast({
        title: "Testing Module Completion",
        description: `Attempting to mark ${currentMod} as completed`,
        duration: 2000,
      });
      
      if (!walletAddress) {
        toast({
          title: "Error",
          description: "Wallet address is required",
          variant: "destructive",
          duration: 2000,
        });
        return;
      }
      
      // Access user progress documents
      const userProgressRef = doc(db, 'learningProgress', walletAddress);
      const moduleProgressRef = doc(collection(userProgressRef, 'moduleProgress'), currentMod);
      
      // Mark module as completed
      await updateDoc(moduleProgressRef, {
        completed: true,
        completedAt: serverTimestamp()
      });
      
      // Add to completed modules array and update current module
      await updateDoc(userProgressRef, {
        completedModules: arrayUnion(currentMod),
        currentModuleId: nextMod,
        totalXpEarned: increment(200), // Add some XP
        xp: increment(200),
        lastUpdated: serverTimestamp()
      });
      
      // Award some SUI tokens
      const suiAmount = 0.5;
      await updateDoc(userProgressRef, {
        suiTokens: increment(suiAmount)
      });
      
      // Update rocket position
      let moduleIdNum = 1;
      if (currentMod === 'intro-to-sui') {
        moduleIdNum = 1;
      } else {
        const match = currentMod.match(/(\d+)$/);
        if (match) {
          moduleIdNum = parseInt(match[1], 10);
        }
      }
      
      const updatedRocketPosition = {
        x: 300 + (moduleIdNum * 30),
        y: 150 + (moduleIdNum * 15)
      };
      
      await updateDoc(userProgressRef, {
        rocketPosition: updatedRocketPosition
      });
      
      toast({
        title: "Module Completed",
        description: `XP: 200, SUI: ${suiAmount}, Rocket position updated`,
        duration: 3000,
      });
      
      // Try to show completion popup
      const win = window as any;
      if (win.testModulePopup) {
        win.testModulePopup();
      }
      
      // Refresh to see changes
      setTimeout(() => {
        refreshProgressData();
      }, 2000);
    } catch (err) {
      
      toast({
        title: "Error",
        description: "Failed to complete module",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  // Listen for module completion events from other components
  useEffect(() => {
    const handleModuleCompletion = (event: CustomEvent) => {
      if (!event.detail) return;
      
      const { moduleId, nextModuleId, walletAddress: eventWalletAddress, xpEarned } = event.detail;
      
      if (eventWalletAddress !== walletAddress) return;
      
      console.log('[Learning] Module completion event received:', event.detail);
      
      toast({
        title: "Module Completed!",
        description: `You've earned ${xpEarned} XP and advanced to the next module.`,
        duration: 3000,
      });
      
      // Update current module ID locally
      if (nextModuleId) {
        setCurrentModuleId(nextModuleId);
      }
      
      // Add completed module to local state
      if (moduleId && !completedModules.includes(moduleId)) {
        setCompletedModules(prev => [...prev, moduleId]);
      }
      
      // Update galaxies with new completion status
      setGalaxies(prevGalaxies => {
        // Create a new array to avoid mutating the previous state
        const updatedGalaxies = [...prevGalaxies];
        
        // Find which galaxy this module belongs to
        let moduleGalaxy = null;
        let moduleIndex = -1;
        
        for (const galaxy of updatedGalaxies) {
          const foundModuleIndex = galaxy.modules.findIndex(m => m.id === moduleId);
          if (foundModuleIndex !== -1) {
            moduleGalaxy = galaxy;
            moduleIndex = foundModuleIndex;
            break;
          }
        }
        
        if (!moduleGalaxy) {
          console.warn('[Learning] Could not find galaxy for module:', moduleId);
          return prevGalaxies;
        }
        
        // Update the module to completed
        moduleGalaxy.modules[moduleIndex] = {
          ...moduleGalaxy.modules[moduleIndex],
          completed: true,
          locked: false
        };
        
        // Find and unlock the next module in the sequence
        if (nextModuleId) {
          for (const galaxy of updatedGalaxies) {
            const nextModuleIndex = galaxy.modules.findIndex(m => m.id === nextModuleId);
            
            if (nextModuleIndex !== -1) {
              // Mark this module as current and unlocked
              galaxy.modules[nextModuleIndex] = {
                ...galaxy.modules[nextModuleIndex],
                locked: false,
                current: true
              };
              
              // Also mark other modules as not current
              galaxy.modules = galaxy.modules.map((m, idx) => {
                if (idx !== nextModuleIndex) {
                  return { ...m, current: false };
                }
                return m;
              });
              
              // If this module is in a different galaxy, update galaxy current status
              if (galaxy.id !== moduleGalaxy.id) {
                // Set this galaxy as current
                galaxy.current = true;
                
                // Set the previous galaxy as not current
                moduleGalaxy.current = false;
              }
              
              break;
            }
          }
        }
        
        // Check if all modules in this galaxy are now completed
        const allModulesCompleted = moduleGalaxy.modules.every(m => m.completed);
        
        if (allModulesCompleted) {
          console.log('[Learning] All modules completed in galaxy:', moduleGalaxy.id);
          
          // Mark the galaxy as completed
          moduleGalaxy.completed = true;
          
          // Find the next galaxy and unlock it if it exists
          const galaxyIndex = updatedGalaxies.findIndex(g => g.id === moduleGalaxy.id);
          if (galaxyIndex !== -1 && galaxyIndex < updatedGalaxies.length - 1) {
            const nextGalaxy = updatedGalaxies[galaxyIndex + 1];
            
            // Unlock the next galaxy
            nextGalaxy.unlocked = true;
            
            // Unlock the first module in the next galaxy
            if (nextGalaxy.modules.length > 0) {
              nextGalaxy.modules[0].locked = false;
              
              // Dispatch a galaxy unlocked event
              setTimeout(() => {
                const galaxyUnlockedEvent = new CustomEvent('galaxyUnlocked', {
                  detail: { 
                    galaxyId: moduleGalaxy.id,
                    nextGalaxyId: nextGalaxy.id
                  }
                });
                document.dispatchEvent(galaxyUnlockedEvent);
                
                toast({
                  title: "New Galaxy Unlocked!",
                  description: `You've unlocked the ${nextGalaxy.name}!`,
                  duration: 4000,
                  className: "galaxy-unlocked-toast"
                });
              }, 1000);
            }
          }
        }
        
        return updatedGalaxies;
      });
      
      // Refresh data to show updated progress
      refreshProgressData();
    };

    // Listen for galaxy unlock events
    const handleGalaxyUnlock = (event: CustomEvent) => {
      if (!event.detail) return;
      
      const { galaxyId, nextGalaxyId, firstModuleId, rocketPosition: eventRocketPosition } = event.detail;
      
      console.log('[Learning] Galaxy unlock event received:', galaxyId, nextGalaxyId);
      
      // Update galaxies to unlock the next one
      setGalaxies(prevGalaxies => {
        // Create a copy of the galaxies array
        const updatedGalaxies = [...prevGalaxies];
        
        // Find the completed galaxy
        const completedGalaxyIndex = updatedGalaxies.findIndex(g => g.id === galaxyId);
        
        if (completedGalaxyIndex === -1) {
          console.warn(`[Learning] Galaxy with ID ${galaxyId} not found`);
          return prevGalaxies;
        }
        
        // Mark the current galaxy as completed
        updatedGalaxies[completedGalaxyIndex] = {
          ...updatedGalaxies[completedGalaxyIndex],
          completed: true,
          current: false
        };
        
        // Find the next galaxy index
        const nextGalaxyIndex = completedGalaxyIndex + 1;
        
        // Make sure the next galaxy exists
        if (nextGalaxyIndex >= updatedGalaxies.length) {
          console.log(`[Learning] No more galaxies after galaxy ${galaxyId}`);
          return updatedGalaxies;
        }
        
        // Get the next galaxy
        const nextGalaxy = updatedGalaxies[nextGalaxyIndex];
        
        // Find the first module in the next galaxy
        const firstModule = nextGalaxy.modules.length > 0 ? nextGalaxy.modules[0] : null;
        
        if (!firstModule) {
          console.warn(`[Learning] No modules found in galaxy ${nextGalaxy.id}`);
          return updatedGalaxies;
        }
        
        // Use the provided firstModuleId from the event if available
        const targetModuleId = firstModuleId || firstModule.id;
        
        // Unlock and set the next galaxy as current
        updatedGalaxies[nextGalaxyIndex] = {
          ...nextGalaxy,
          unlocked: true,
          current: true,
          // Update modules in the next galaxy
          modules: nextGalaxy.modules.map((m, idx) => {
            if (m.id === targetModuleId) {
              // Unlock and set the first module as current
              return { 
                ...m, 
                locked: false, 
                current: true 
              };
            } else if (idx === 1) {
              // Make sure the second module is properly locked/unlocked based on first module's status
              return { 
                ...m, 
                locked: !nextGalaxy.modules[0].completed 
              };
            }
            return { ...m, current: false };
          })
        };
        
        // Update the current galaxy state
        setCurrentGalaxy(nextGalaxy.id);
        
        // Update the current module to the first module in the next galaxy
        setCurrentModuleId(targetModuleId);
        
        // Update rocket position to the first module of the new galaxy
        if (eventRocketPosition) {
          setRocketPosition(eventRocketPosition);
        } else {
          const newRocketPosition = {
            x: nextGalaxy.position.x + firstModule.position.x,
            y: nextGalaxy.position.y + firstModule.position.y
          };
          
          setRocketPosition(newRocketPosition);
        }
        
        // Also update in Firebase if user is logged in
        if (walletAddress) {
          try {
            const userProgressRef = doc(db, 'learningProgress', walletAddress);
            updateDoc(userProgressRef, {
              currentModuleId: targetModuleId,
              currentGalaxyId: nextGalaxy.id,
              unlockedGalaxies: arrayUnion(nextGalaxy.id),
              rocketPosition: eventRocketPosition || {
                x: nextGalaxy.position.x + firstModule.position.x,
                y: nextGalaxy.position.y + firstModule.position.y
              },
              lastActivityTimestamp: serverTimestamp()
            }).catch(err => console.error('[Learning] Error updating galaxy unlock data:', err));
          } catch (error) {
            console.error('[Learning] Error updating galaxy unlock data:', error);
          }
        }
        
        return updatedGalaxies;
      });
      
      // Show a success notification
      toast({
        title: "New Galaxy Unlocked!",
        description: "You've unlocked a new galaxy to explore!",
        duration: 4000,
        className: "galaxy-unlocked-toast"
      });
      
      // Refresh data to ensure everything is up to date
      refreshProgressData();
    };
    
    // Add event listeners for module completion and galaxy unlock
    document.addEventListener('moduleCompleted', handleModuleCompletion as EventListener);
    document.addEventListener('galaxyUnlocked', handleGalaxyUnlock as EventListener);
    
    // Clean up event listeners
    return () => {
      document.removeEventListener('moduleCompleted', handleModuleCompletion as EventListener);
      document.removeEventListener('galaxyUnlocked', handleGalaxyUnlock as EventListener);
    };
  }, [walletAddress, completedModules, refreshProgressData, toast]);

  // Helper functions for XP and level calculations
  const calculateLevel = (xp: number): number => {
    // Simple level calculation: Each level requires 20% more XP than the previous
    // Level 1: 0-100 XP
    // Level 2: 101-220 XP
    // Level 3: 221-364 XP, etc.
    
    if (xp < 100) return 1;
    
    let level = 1;
    let xpThreshold = 100;
    
    while (xp >= xpThreshold) {
      level++;
      xpThreshold += Math.floor(100 * Math.pow(1.2, level - 1));
    }
    
    return level;
  };
  
  const calculateXpForLevel = (level: number): number => {
    if (level <= 1) return 0;
    
    let totalXp = 100; // XP needed for level 2
    
    for (let i = 2; i < level; i++) {
      totalXp += Math.floor(100 * Math.pow(1.2, i - 1));
    }
    
    return totalXp;
  };
  
  const calculateXpForNextLevel = (currentLevel: number): number => {
    return calculateXpForLevel(currentLevel + 1);
  };

  // Update rocket position when current module changes
  useEffect(() => {
    if (!currentModuleId) return;

    // Find the current module and its galaxy
    let currentGalaxyFound = null;
    let currentModuleFound = null;
    
    for (const galaxy of galaxies) {
      const module = galaxy.modules.find(m => m.id === currentModuleId);
      if (module) {
        currentGalaxyFound = galaxy;
        currentModuleFound = module;
        
        // Calculate new rocket position based on galaxy and module positions
        const newRocketPosition = {
          x: galaxy.position.x + module.position.x,
          y: galaxy.position.y + module.position.y
        };
        
        // Update rocket position with animation
        setRocketPosition(newRocketPosition);
        
        // Update current galaxy if it's not already set
        if (galaxy.id !== currentGalaxy) {
          console.log(`[Learning] Updating current galaxy from ${currentGalaxy} to ${galaxy.id} based on current module`);
          setCurrentGalaxy(galaxy.id);
        }
        
        // Also update in Firebase if user is logged in
        if (walletAddress) {
          try {
            const userProgressRef = doc(db, 'learningProgress', walletAddress);
            updateDoc(userProgressRef, {
              rocketPosition: newRocketPosition,
              currentGalaxyId: galaxy.id,
              currentModuleId: currentModuleId,
              lastActivityTimestamp: serverTimestamp()
            }).catch(err => console.error('[Learning] Error updating rocket position:', err));
          } catch (error) {
            console.error('[Learning] Error updating rocket position:', error);
          }
        }
        
        break;
      }
    }

    // If we found a module but the galaxy states need updating, update them
    if (currentGalaxyFound && currentModuleFound) {
      // Update the galaxies state to reflect current status
      setGalaxies(prevGalaxies => {
        // Only update if needed
        if (prevGalaxies.some(g => 
            (g.id === currentGalaxyFound.id && !g.current) || 
            (g.id !== currentGalaxyFound.id && g.current)
          )) {
          return prevGalaxies.map(galaxy => ({
            ...galaxy,
            current: galaxy.id === currentGalaxyFound.id,
            modules: galaxy.modules.map(module => ({
              ...module,
              current: galaxy.id === currentGalaxyFound.id && module.id === currentModuleId
            }))
          }));
        }
        return prevGalaxies;
      });
    }
  }, [currentModuleId, galaxies, walletAddress]);

  // Force unlock the next galaxy if all modules in the current galaxy are completed
  useEffect(() => {
    // This effect runs on component mount and whenever galaxies or completedModules change
    if (galaxies.length === 0 || !walletAddress) return;

    // Check all galaxies for completion and unlock next ones
    const checkGalaxiesForCompletion = async () => {
      for (let index = 0; index < galaxies.length - 1; index++) {
        const galaxy = galaxies[index];
        const nextGalaxy = galaxies[index + 1];
        
        // Skip if next galaxy is already unlocked
        if (!nextGalaxy || nextGalaxy.unlocked) continue;
        
        // Check if this galaxy is completed
        const isGalaxyCompleted = galaxy.modules.every(m => 
          m.completed || completedModules.includes(m.id)
        );
        
        if (isGalaxyCompleted) {
          console.log(`[Learning] Galaxy ${galaxy.id} completed, forcing unlock of Galaxy ${nextGalaxy.id}`);
          
          // Find the first module in the next galaxy
          const firstModule = nextGalaxy.modules.length > 0 ? nextGalaxy.modules[0] : null;
          
          if (!firstModule) {
            console.warn(`[Learning] No modules found in galaxy ${nextGalaxy.id}`);
            continue;
          }
          
          // Update galaxies to unlock next galaxy
          setGalaxies(prevGalaxies => {
            const updatedGalaxies = [...prevGalaxies];
            const nextGalaxyIndex = updatedGalaxies.findIndex(g => g.id === nextGalaxy.id);
            const currentGalaxyIndex = updatedGalaxies.findIndex(g => g.id === galaxy.id);
            
            if (nextGalaxyIndex !== -1) {
              // Mark the current galaxy as completed and not current
              if (currentGalaxyIndex !== -1) {
                updatedGalaxies[currentGalaxyIndex] = {
                  ...updatedGalaxies[currentGalaxyIndex],
                  completed: true,
                  current: false
                };
              }
              
              // Set the next galaxy as current and unlocked
              updatedGalaxies[nextGalaxyIndex] = {
                ...updatedGalaxies[nextGalaxyIndex],
                unlocked: true,
                current: true,
                modules: updatedGalaxies[nextGalaxyIndex].modules.map((m, idx) => {
                  if (idx === 0) {
                    // Set first module as current and unlocked
                    return { ...m, locked: false, current: true };
                  } else if (idx === 1) {
                    // Make sure second module is properly locked/unlocked
                    return { ...m, locked: !m.completed };
                  }
                  return m;
                })
              };
            }
            
            return updatedGalaxies;
          });
          
          // Update the current galaxy state
          setCurrentGalaxy(nextGalaxy.id);
          
          // Update the current module to the first module in the next galaxy
          const firstModuleId = firstModule.id;
          setCurrentModuleId(firstModuleId);
          
          // Update rocket position to the first module of the new galaxy
          const newRocketPosition = {
            x: nextGalaxy.position.x + firstModule.position.x,
            y: nextGalaxy.position.y + firstModule.position.y
          };
          
          setRocketPosition(newRocketPosition);
          
          // Also update in Firebase
          try {
            const userProgressRef = doc(db, 'learningProgress', walletAddress);
            await updateDoc(userProgressRef, {
              unlockedGalaxies: arrayUnion(nextGalaxy.id),
              currentGalaxyId: nextGalaxy.id,
              currentModuleId: firstModuleId,
              rocketPosition: newRocketPosition,
              lastActivityTimestamp: serverTimestamp()
            });
          } catch (error) {
            console.error(`[Learning] Error updating unlocked galaxy ${nextGalaxy.id}:`, error);
          }
          
          // Show notification toast
          toast({
            title: "New Galaxy Unlocked!",
            description: `You've unlocked the ${nextGalaxy.name}!`,
            duration: 4000,
            className: "galaxy-unlocked-toast"
          });
        }
      }
    };
    
    checkGalaxiesForCompletion();
  }, [galaxies, completedModules, walletAddress, toast]);

  // Check if any galaxy is completed and unlock the next one if needed
  useEffect(() => {
    if (galaxies.length === 0 || !walletAddress) return;
    
    for (let i = 0; i < galaxies.length - 1; i++) {
      const currentGalaxy = galaxies[i];
      const nextGalaxy = galaxies[i + 1];
      
      if (currentGalaxy && nextGalaxy && 
          currentGalaxy.modules.every(m => m.completed) && 
          !nextGalaxy.unlocked) {
        console.log(`[Learning] Galaxy ${currentGalaxy.id} completed, unlocking Galaxy ${nextGalaxy.id}`);
        
        setGalaxies(prevGalaxies => {
          const updatedGalaxies = [...prevGalaxies];
          const nextGalaxyIndex = updatedGalaxies.findIndex(g => g.id === nextGalaxy.id);
          
          if (nextGalaxyIndex !== -1) {
            updatedGalaxies[nextGalaxyIndex] = {
              ...updatedGalaxies[nextGalaxyIndex],
              unlocked: true,
              modules: updatedGalaxies[nextGalaxyIndex].modules.map((m, idx) => 
                idx === 0 ? { ...m, locked: false } : m
              )
            };
          }
          
          return updatedGalaxies;
        });
      }
    }
  }, [galaxies, walletAddress]);

  return (
    <div className="relative min-h-screen">
      <StarField />
      
      <NavBar 
        connected={connected}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        userXp={userData?.xp || 0}
        userStreak={userData?.streak || 0}
        userLevel={userData?.level || 1}
        username={userData?.displayName || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Explorer')}
        avatarSrc={userData?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=cosmic'}
      />
      
      <div className="container mx-auto max-w-7xl px-4 pt-20 pb-10">
        <section className="mb-10 text-center">
          <motion.div
            className="inline-block"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl md:text-4xl font-heading font-bold glow-text">
              Learning Journey
            </h1>
          </motion.div>
          
          {!connected ? (
            // Not connected state
            <motion.div
              className="mt-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <div className="galaxy-card p-10 max-w-lg mx-auto">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-4">
                    <Trophy className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-heading font-bold mb-2">Connect Your Wallet</h2>
                  <p className="text-foreground/70 mb-6">
                    Please connect your Sui wallet to view your personal learning progress, track completed modules, and earn rewards.
                  </p>
                  <Button 
                    className="neon-button mx-auto"
                    onClick={() => {
                      // Trigger wallet connection modal via NavBar
                      document.getElementById('connect-wallet-button')?.click();
                    }}
                  >
                    Connect Wallet
                  </Button>
                </div>
                
                <div className="border-t border-border/30 pt-4 mt-4">
                  <p className="text-sm text-foreground/60 text-center">
                    Connecting your wallet will allow you to:
                  </p>
                  <ul className="mt-4 space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Track your learning progress</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Earn XP and SUI rewards</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Participate in daily challenges</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              {/* Add a preview of the galaxy map for non-connected users */}
              <div className="mt-8">
                <h3 className="text-center text-xl font-heading font-bold mb-4">
                  <span className="text-gradient">Learning Path Preview</span>
                </h3>
                <p className="text-center mb-6 text-foreground/70 max-w-xl mx-auto">
                  Here's a preview of the learning journey. Connect your wallet to track your progress and unlock all features.
                </p>
                
                <div className="galaxy-card p-1 relative">
                  <div 
                    className="overflow-hidden rounded-lg h-[400px] relative"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    ref={mapContainerRef}
                  >
                    <div className="absolute top-4 right-4 z-10 flex space-x-2 bg-card/60 rounded-lg p-1.5 backdrop-blur-sm">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full"
                        onClick={() => handleZoom('in')}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full"
                        onClick={() => handleZoom('out')}
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full"
                        onClick={resetView}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div 
                      className="absolute"
                      style={{
                        transform: `translate(${mapPosition.x}px, ${mapPosition.y}px) scale(${zoomLevel})`,
                        width: '5000px',
                        height: '3000px',
                        transformOrigin: 'center',
                      }}
                    >
                      <LearningPathMap 
                        galaxies={galaxies as Galaxy[]} 
                        currentGalaxy={currentGalaxy}
                        currentModuleId={currentModuleId}
                        rocketPosition={{ x: 0, y: 0 }} // Hide rocket for non-connected users
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            // Connected state - show progress
            <div className="mt-6 mb-10">
              <div className="flex flex-col md:flex-row justify-center items-center gap-8 mb-6">
                <div className="bg-card/40 backdrop-blur-sm rounded-lg p-4 flex items-center gap-4 w-full md:w-auto">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Star className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm text-foreground/70">Overall Progress</h3>
                    <p className="text-2xl font-bold">{userProgress.overallProgress}%</p>
                  </div>
                </div>
                
                <div className="bg-card/40 backdrop-blur-sm rounded-lg p-4 flex items-center gap-4 w-full md:w-auto">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <Circle className="h-6 w-6 text-cyan-500" />
                  </div>
                  <div>
                    <h3 className="text-sm text-foreground/70">Current Galaxy</h3>
                    <p className="text-2xl font-bold">{galaxies.find(g => g.current)?.name || 'Genesis Galaxy'}</p>
                  </div>
                </div>
                
                <div className="bg-card/40 backdrop-blur-sm rounded-lg p-4 flex items-center gap-4 w-full md:w-auto">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Trophy className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-sm text-foreground/70">Modules Completed</h3>
                    <p className="text-2xl font-bold">
                      {userProgress.totalModulesCompleted}/{userProgress.totalModules}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="galaxy-card p-1 relative">
                <div 
                  className="overflow-hidden rounded-lg h-[500px] relative"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  ref={mapContainerRef}
                >
                  <div className="absolute top-4 right-4 z-10 flex space-x-2 bg-card/60 rounded-lg p-1.5 backdrop-blur-sm">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full"
                      onClick={() => handleZoom('in')}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full"
                      onClick={() => handleZoom('out')}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full"
                      onClick={resetView}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div 
                    className="absolute"
                    style={{
                      transform: `translate(${mapPosition.x}px, ${mapPosition.y}px) scale(${zoomLevel})`,
                      width: '5000px',
                      height: '3000px',
                      transformOrigin: 'center',
                    }}
                  >
                    <LearningPathMap 
                      galaxies={galaxies as Galaxy[]} 
                      currentGalaxy={currentGalaxy}
                      currentModuleId={currentModuleId}
                      rocketPosition={rocketPosition}
                    />
                  </div>
                </div>
              </div>
              
              {/* Daily Challenges Section */}
              <div className="mt-10">
                <h2 className="text-2xl font-heading font-bold mb-6 flex items-center">
                  <Calendar className="mr-2 h-5 w-5 text-primary" />
                  Daily Tasks
                </h2>
                
                <DailyChallenges 
                  challenges={dailyChallenges}
                  loading={loadingChallenges}
                  onStartChallenge={handleStartChallenge}
                  onClaimReward={handleClaimReward}
                  walletAddress={walletAddress}
                />
              </div>
              
              {/* Learning Modules List - Showing current galaxy modules */}
              <div className="mt-10">
                <h2 className="text-2xl font-heading font-bold mb-6 flex items-center">
                  <Star className="mr-2 h-5 w-5 text-primary" />
                  Available Learning Modules
                </h2>
                
                
                {/* Module cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {galaxies.find(g => g.current)?.modules.map((module) => (
                    <motion.div
                      key={module.id}
                      className={`galaxy-card border ${module.locked ? 'border-muted/30' : module.completed ? 'border-green-500/20' : 'border-primary/20'} p-4 rounded-lg relative overflow-hidden`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={!module.locked ? { scale: 1.02 } : {}}
                      transition={{ duration: 0.2 }}
                      onClick={() => !module.locked && handleStartModule(module.id)}
                    >
                      {/* Module background effect */}
                      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/10 opacity-50"></div>
                      
                      {/* Lock indicator for locked modules */}
                      {module.locked && (
                        <div className="absolute top-3 right-3 bg-yellow-500/20 text-yellow-500 p-1 rounded">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                          </svg>
                        </div>
                      )}
                      
                      {/* Completion indicator */}
                      {module.completed && (
                        <div className="absolute top-3 right-3 bg-green-500/20 text-green-500 p-1 rounded-full">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      )}
                      
                      {/* Module icon */}
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                        module.locked 
                          ? 'bg-muted/20' 
                          : module.completed
                            ? 'bg-green-500/20'
                            : module.type === 'planet' 
                              ? 'bg-blue-500/20' 
                              : module.type === 'moon' 
                                ? 'bg-purple-500/20' 
                                : module.type === 'asteroid' 
                                  ? 'bg-orange-500/20' 
                                  : module.type === 'station' 
                                    ? 'bg-green-500/20' 
                                    : 'bg-primary/20'
                      }`}>
                        {module.type === 'planet' && <Circle className={`h-6 w-6 ${module.completed ? 'text-green-500' : 'text-blue-500'}`} />}
                        {module.type === 'moon' && <Circle className={`h-6 w-6 ${module.completed ? 'text-green-500' : 'text-purple-500'}`} />}
                        {module.type === 'asteroid' && <Circle className={`h-6 w-6 ${module.completed ? 'text-green-500' : 'text-orange-500'}`} />}
                        {module.type === 'station' && <Circle className={`h-6 w-6 ${module.completed ? 'text-green-500' : 'text-green-500'}`} />}
                        {module.type === 'earth' && <Circle className={`h-6 w-6 ${module.completed ? 'text-green-500' : 'text-cyan-500'}`} />}
                      </div>
                      
                      <div className="relative z-10">
                        <h3 className={`font-bold text-lg mb-1 ${module.locked ? 'text-foreground/50' : ''}`}>
                          {module.title}
                        </h3>
                        
                        <p className={`text-sm mb-4 line-clamp-2 h-10 ${module.locked ? 'text-foreground/40' : 'text-foreground/70'}`}>
                          {module.description}
                        </p>
                        
                        {/* Progress indicator for ongoing modules */}
                        {!module.locked && !module.completed && (
                          <div className="mb-3">
                            <div className="flex justify-between text-xs mb-1">
                              <span>Progress</span>
                              <span>{calculateModuleProgress(module)}%</span>
                            </div>
                            <Progress value={calculateModuleProgress(module)} className="h-1.5" />
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center">
                              <Star className="h-3.5 w-3.5 text-yellow-500 mr-1" />
                              <span className="text-xs">{module.xpReward || 100} XP</span>
                            </div>
                          </div>
                          
                          <Button
                            size="sm"
                            className={`h-8 ${
                              module.locked 
                                ? 'bg-muted/20 text-foreground/40 cursor-not-allowed' 
                                : module.completed 
                                  ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' 
                                  : module.current 
                                    ? 'bg-primary/80 text-white hover:bg-primary/90'
                                    : 'neon-button'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!module.locked) handleStartModule(module.id);
                            }}
                            disabled={module.locked}
                          >
                            {module.locked ? 'Locked' : module.completed ? 'Completed' : module.current ? 'Continue' : 'Start'}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                
                {/* Show all available galaxies */}
                {galaxies.filter(g => !g.current).map((galaxy) => (
                  <div key={`galaxy-${galaxy.id}`} className="mt-8">
                    <div className={`bg-card/40 backdrop-blur-sm rounded-lg p-4 mb-6 ${!galaxy.unlocked ? 'opacity-60' : galaxy.current ? 'border-l-4 border-primary' : ''}`}>
                      <h3 className="text-lg font-bold flex items-center">
                        <Circle className={`h-5 w-5 ${galaxy.current ? 'text-primary' : 'text-cyan-500'} mr-2`} />
                        {galaxy.name} 
                        {!galaxy.unlocked && <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded">Locked</span>}
                        {galaxy.completed && <span className="ml-2 text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">Completed</span>}
                        {galaxy.current && !galaxy.completed && <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Current</span>}
                      </h3>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-sm text-foreground/70">
                          {galaxy.unlocked 
                            ? `Progress through all modules in this galaxy`
                            : `Complete the previous galaxy to unlock this one`}
                        </p>
                        
                        {galaxy.unlocked && (
                          <div className="flex items-center text-sm">
                            <span className="mr-2">Progress:</span>
                            <span className="font-medium">
                              {galaxy.modules.filter(m => m.completed).length}/{galaxy.modules.length} modules
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {galaxy.unlocked && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {galaxy.modules.map((module) => (
                          <motion.div
                            key={module.id}
                            className={`galaxy-card border ${module.locked ? 'border-muted/30' : module.completed ? 'border-green-500/20' : 'border-primary/20'} p-4 rounded-lg relative overflow-hidden`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={!module.locked ? { scale: 1.02 } : {}}
                            transition={{ duration: 0.2 }}
                            onClick={() => !module.locked && handleStartModule(module.id)}
                          >
                            {/* Module background effect */}
                            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/10 opacity-50"></div>
                            
                            {/* Lock indicator for locked modules */}
                            {module.locked && (
                              <div className="absolute top-3 right-3 bg-yellow-500/20 text-yellow-500 p-1 rounded">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                              </div>
                            )}
                            
                            {/* Completion indicator */}
                            {module.completed && (
                              <div className="absolute top-3 right-3 bg-green-500/20 text-green-500 p-1 rounded-full">
                                <CheckCircle className="h-4 w-4" />
                              </div>
                            )}
                            
                            {/* Module icon */}
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                              module.locked 
                                ? 'bg-muted/20' 
                                : module.completed
                                  ? 'bg-green-500/20'
                                  : module.type === 'planet' 
                                    ? 'bg-blue-500/20' 
                                    : module.type === 'moon' 
                                      ? 'bg-purple-500/20' 
                                      : module.type === 'asteroid' 
                                        ? 'bg-orange-500/20' 
                                        : module.type === 'station' 
                                          ? 'bg-green-500/20' 
                                          : 'bg-primary/20'
                            }`}>
                              {module.type === 'planet' && <Circle className={`h-6 w-6 ${module.completed ? 'text-green-500' : 'text-blue-500'}`} />}
                              {module.type === 'moon' && <Circle className={`h-6 w-6 ${module.completed ? 'text-green-500' : 'text-purple-500'}`} />}
                              {module.type === 'asteroid' && <Circle className={`h-6 w-6 ${module.completed ? 'text-green-500' : 'text-orange-500'}`} />}
                              {module.type === 'station' && <Circle className={`h-6 w-6 ${module.completed ? 'text-green-500' : 'text-green-500'}`} />}
                              {module.type === 'earth' && <Circle className={`h-6 w-6 ${module.completed ? 'text-green-500' : 'text-cyan-500'}`} />}
                            </div>
                            
                            <div className="relative z-10">
                              <h3 className={`font-bold text-lg mb-1 ${module.locked ? 'text-foreground/50' : ''}`}>
                                {module.title}
                              </h3>
                              
                              <p className={`text-sm mb-4 line-clamp-2 h-10 ${module.locked ? 'text-foreground/40' : 'text-foreground/70'}`}>
                                {module.description}
                              </p>
                              
                              {/* Progress indicator for ongoing modules */}
                              {!module.locked && !module.completed && (
                                <div className="mb-3">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span>Progress</span>
                                    <span>{calculateModuleProgress(module)}%</span>
                                  </div>
                                  <Progress value={calculateModuleProgress(module)} className="h-1.5" />
                                </div>
                              )}
                              
                              <div className="flex justify-between items-center">
                                <div className="flex items-center space-x-2">
                                  <div className="flex items-center">
                                    <Star className="h-3.5 w-3.5 text-yellow-500 mr-1" />
                                    <span className="text-xs">{module.xpReward || 100} XP</span>
                                  </div>
                                </div>
                                
                                <Button
                                  size="sm"
                                  className={`h-8 ${
                                    module.locked 
                                      ? 'bg-muted/20 text-foreground/40 cursor-not-allowed' 
                                      : module.completed 
                                        ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' 
                                        : module.current 
                                          ? 'bg-primary/80 text-white hover:bg-primary/90'
                                          : 'neon-button'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!module.locked) handleStartModule(module.id);
                                  }}
                                  disabled={module.locked}
                                >
                                  {module.locked ? 'Locked' : module.completed ? 'Completed' : module.current ? 'Continue' : 'Start'}
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Debug panel */}
      {process.env.NODE_ENV !== 'production' && walletAddress && (
        <div className="mt-8 p-4 border border-yellow-500 rounded-md bg-yellow-500/10">
          <h3 className="text-sm font-bold mb-2">Debug Tools</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={refreshProgressData}
            >
              Refresh Progress
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={async () => {
                try {
                  toast({
                    title: "Starting Repair",
                    description: "Attempting to repair completedModules array",
                    duration: 2000,
                  });
                  
                  const repaired = await repairCompletedModules(walletAddress);
                  
                  toast({
                    title: repaired ? "Repair Successful" : "No Repair Needed",
                    description: repaired 
                      ? "CompletedModules array was fixed" 
                      : "No issues found with completedModules array",
                    duration: 3000,
                  });
                  
                  // Refresh to see changes
                  refreshProgressData();
                } catch (err) {
                  
                  toast({
                    title: "Error",
                    description: "Failed to repair completedModules",
                    variant: "destructive",
                    duration: 3000,
                  });
                }
              }}
            >
              Repair CompletedModules
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={async () => {
                try {
                  // Find a module to check - either current one or first one from galaxies
                  let moduleToCheck: any = null;
                  
                  // Try to find current module
                  for (const galaxy of galaxies) {
                    for (const mod of galaxy.modules) {
                      if (mod.current) {
                        moduleToCheck = mod;
                        break;
                      }
                    }
                    if (moduleToCheck) break;
                  }
                  
                  // If no current module, use the first one
                  if (!moduleToCheck && galaxies.length > 0 && galaxies[0].modules.length > 0) {
                    moduleToCheck = galaxies[0].modules[0];
                  }
                  
                  if (!moduleToCheck) {
                    toast({
                      title: "Error",
                      description: "No module found to check",
                      variant: "destructive",
                      duration: 2000,
                    });
                    return;
                  }
                  
                  const moduleId = moduleToCheck.id;
                  
                  toast({
                    title: "Checking Status",
                    description: `Checking completion status for ${moduleId}`,
                    duration: 2000,
                  });
                  
                  const isCompleted = await isModuleCompleted(moduleId);
                  
                  toast({
                    title: `Module Status: ${isCompleted ? 'COMPLETED' : 'NOT COMPLETED'}`,
                    description: `Module ID: ${moduleId}`,
                    duration: 4000,
                  });
                } catch (err) {
                  
                  toast({
                    title: "Error",
                    description: "Failed to check module status",
                    variant: "destructive",
                    duration: 3000,
                  });
                }
              }}
            >
              Check Module Status
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="text-xs bg-red-500/10"
              onClick={async () => {
                try {
                  // Get user progress directly to update the rocket position
                  const userProgress = await getUserLearningProgress(walletAddress);
                  
                  if (!userProgress) {
                    toast({
                      title: "Error",
                      description: "No user progress found",
                      variant: "destructive",
                      duration: 2000,
                    });
                    return;
                  }
                  
                  const moduleId = userProgress.currentModuleId;
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
                      
                    }
                  }
                  
                  // New rocket position
                  const updatedRocketPosition = {
                    x: 300 + (moduleIdNum * 30),
                    y: 150 + (moduleIdNum * 15)
                  };
                  
                  toast({
                    title: "Updating Rocket",
                    description: `Setting position to ${JSON.stringify(updatedRocketPosition)}`,
                    duration: 2000,
                  });
                  
                  // Update user progress document
                  const db = getFirestore();
                  const userProgressRef = doc(db, 'learningProgress', walletAddress);
                  
                  await updateDoc(userProgressRef, {
                    rocketPosition: updatedRocketPosition
                  });
                  
                  toast({
                    title: "Rocket Updated",
                    description: "Rocket position has been updated",
                    duration: 3000,
                  });
                  
                  // Refresh to see changes
                  refreshProgressData();
                } catch (err) {
                  
                  toast({
                    title: "Error",
                    description: "Failed to update rocket position",
                    variant: "destructive",
                    duration: 3000,
                  });
                }
              }}
            >
              Force Update Rocket Position
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="text-xs bg-green-500/10"
              onClick={() => {
                const win = window as any;
                if (win.testModulePopup) {
                  win.testModulePopup();
                  toast({
                    title: "Test Popup Triggered",
                    description: "Check if completion popup appears",
                    duration: 3000,
                  });
                } else {
                  toast({
                    title: "Error",
                    description: "Test function not found",
                    variant: "destructive",
                    duration: 3000,
                  });
                }
              }}
            >
              Test Completion Popup
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="text-xs bg-blue-500/10"
              onClick={async () => {
                try {
                  // Get current module ID
                  const currentMod = currentModuleId;
                  
                  // Determine next module ID
                  let nextModId = '';
                  if (currentMod === 'intro-to-sui') {
                    nextModId = 'module-2';
                  } else {
                    const match = currentMod.match(/(\d+)$/);
                    if (match) {
                      const num = parseInt(match[1], 10);
                      nextModId = `module-${num + 1}`;
                    } else {
                      nextModId = 'module-2';
                    }
                  }
                  
                  // Call our helper function that directly updates the database
                  await forceCompleteModule(currentMod, nextModId);
                } catch (err) {
                  
                  toast({
                    title: "Error",
                    description: "Failed to complete module",
                    variant: "destructive",
                    duration: 3000,
                  });
                }
              }}
            >
              Force Complete Current Module
            </Button>
          </div>
          <p className="text-xs mt-2 text-yellow-500">These tools are for debugging only</p>
        </div>
      )}
    </div>
  );
};

export default Learning;
