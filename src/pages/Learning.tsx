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
  const [loading, setLoading] = useState(false);
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
  const [mapPosition, setMapPosition] = useState({ x: -200, y: -100 });
  const [rocketPosition, setRocketPosition] = useState({ x: 300, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [startDragPosition, setStartDragPosition] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
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
            
            // Ensure modules have the correct type
            const typedModules = galaxy.modules.map(module => ({
              ...module,
            type: module.type as 'planet' | 'moon' | 'asteroid' | 'station' | 'earth',
            }));
            
            return {
              ...galaxy,
            position: { x: baseX, y: baseY },
              modules: typedModules
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
  
  // Calculate module progress percentage based on the user's actual progress
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
    setMapPosition({ x: -200, y: -100 });
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
    try {
      setLoading(true);
      toast({
        title: "Refreshing Progress",
        description: "Loading latest data...",
        duration: 2000,
      });
      
      if (walletAddress) {
        // Get user progress directly to ensure we have the latest data
        const userProgress = await getUserLearningProgress(walletAddress);
        if (userProgress) {
          // Update rocket position directly from user progress
          if (userProgress.rocketPosition) {
            
            setRocketPosition(userProgress.rocketPosition);
          }
          
          // Update current module
          if (userProgress.currentModuleId) {
            setCurrentModuleId(userProgress.currentModuleId);
          }
          
          // Re-fetch galaxies with modules to update the display
          const galaxiesData = await getGalaxiesWithModules(walletAddress);
          
          // Format and update the galaxies data
          const formattedGalaxies = galaxiesData.map((galaxy, index) => {
            const baseX = 600 + index * 500;
            const baseY = 500 + (index % 2) * 100;
            
            const typedModules = galaxy.modules.map(module => ({
              ...module,
              type: module.type as 'planet' | 'moon' | 'asteroid' | 'station' | 'earth',
            }));
            
            return {
              ...galaxy,
              position: { x: baseX, y: baseY },
              modules: typedModules
            } as GalaxyType;
          });
          
          setGalaxies(formattedGalaxies);
          
          // Update completed modules from user progress
          if (userProgress.completedModules) {
            setCompletedModules(userProgress.completedModules);
          }
          
          // Calculate overall progress statistics
          const totalModules = formattedGalaxies.reduce((total, galaxy) => total + galaxy.modules.length, 0);
          const completedModulesCount = formattedGalaxies.reduce((total, galaxy) => 
            total + galaxy.modules.filter((m: ModuleType) => m.completed).length, 0);
          const overallPercentage = Math.floor((completedModulesCount / totalModules) * 100);
          
          setUserProgress({
            overallProgress: overallPercentage,
            totalModulesCompleted: completedModulesCount,
            totalModules
          });
          
          toast({
            title: "Progress Refreshed",
            description: "Your learning progress has been updated",
            duration: 2000,
          });
        }
      }
    } catch (error) {
      
      toast({
        title: "Error",
        description: "Failed to refresh progress data",
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
            // Connected state with user progress
            <>
          <motion.div 
            className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="galaxy-card px-5 py-3 flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-xs text-foreground/60">Overall Progress</p>
                <p className="font-semibold">{userProgress.overallProgress}%</p>
              </div>
            </div>
            
            <div className="galaxy-card px-5 py-3 flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                <Circle className="h-5 w-5 text-secondary" />
              </div>
              <div className="text-left">
                <p className="text-xs text-foreground/60">Current Galaxy</p>
                <p className="font-semibold">{currentGalaxyData?.name || 'Genesis Galaxy'}</p>
              </div>
            </div>
            
            <div className="galaxy-card px-5 py-3 flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-accent" />
              </div>
              <div className="text-left">
                <p className="text-xs text-foreground/60">Modules Completed</p>
                <p className="font-semibold">{userProgress.totalModulesCompleted}/{userProgress.totalModules}</p>
              </div>
            </div>
          </motion.div>
              
              <div className="grid lg:grid-cols-7 gap-6 mt-10">
                <div className="lg:col-span-5">
                  <section className="galaxy-card p-1 relative mb-6">
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
                      className="overflow-hidden rounded-lg h-[500px] relative"
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      ref={mapContainerRef}
                    >
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
        </section>
        
              <motion.div 
                    className="galaxy-card overflow-hidden"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                  >
                    <div className="p-6">
                      <h2 className="text-xl font-heading font-semibold mb-4 flex items-center">
                        <Rocket className="mr-2 h-5 w-5 text-primary" />
                        Current Module
                      </h2>
                      
                      {currentModuleData && !loading ? (
                        <div className="flex flex-col md:flex-row justify-between gap-6">
                          <div className="space-y-4">
                      <div>
                              <h3 className="text-lg font-semibold">{currentModuleData.title}</h3>
                              <p className="text-sm text-foreground/70 mt-1">{currentModuleData.description}</p>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <p className="text-sm text-foreground/60 mb-1">Module Progress</p>
                            <div className="progress-bar">
                              <div 
                                className="progress-bar-fill" 
                                    style={{ width: `${currentModuleData.completed ? 100 : calculateModuleProgress(currentModuleData)}%` }} 
                              />
                            </div>
                          </div>
                          
                          <div className="flex gap-4 my-4">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-accent" />
                                  <span className="text-sm">
                                    {(() => {
                                      try {
                                        // Get XP with error handling
                                        const xp = currentModuleId ? getModuleXpPotential(currentModuleId) : 0;
                                        // Make sure we have a valid number
                                        return `${!isNaN(xp) ? xp : 0} XP potential`;
                                      } catch (error) {
                                        
                                        return "0 XP potential";
                                      }
                                    })()}
                                  </span>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="text-sm">{currentModuleData.completed ? 'Completed' : 'In Progress'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <Button 
                          className="neon-button" 
                          onClick={() => handleStartModule(currentModuleId)}
                          disabled={currentModuleData.locked}
                        >
                          {currentModuleData.completed ? 'Review Module' : currentModuleData.locked ? 'Locked' : 'Continue Learning'}
                        </Button>
                      </div>
                    </div>
                      ) :
                    <div className="flex items-center justify-center py-8">
                      <div className="loading-spinner"></div>
                      <span className="ml-3">Loading module data...</span>
                    </div>
                      }
                </div>
              </motion.div>
          </div>
          
                <div className="lg:col-span-2">
            <motion.div
              className="galaxy-card p-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <div className="flex items-center mb-4">
                <Calendar className="mr-2 h-5 w-5 text-primary" />
                <h2 className="text-xl font-heading font-semibold">Daily Tasks</h2>
              </div>
              
                    {loadingChallenges ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="loading-spinner"></div>
                        <span className="ml-3">Loading challenges...</span>
                      </div>
                    ) : (
              <DailyChallenges 
                        challenges={dailyChallenges}
                onStartChallenge={handleStartChallenge}
                onClaimReward={handleClaimReward}
                        walletAddress={walletAddress}
              />
                    )}
            </motion.div>
          </div>
        </div>
            </>
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
                  
                  const isCompleted = await isModuleCompleted(walletAddress, moduleId);
                  
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
