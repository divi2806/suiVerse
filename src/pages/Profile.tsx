import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import NavBar from '@/components/NavBar';
import StarField from '@/components/StarField';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentAccount, useSuiClientQuery, useDisconnectWallet } from '@mysten/dapp-kit';
import { handleWalletConnect, handleWalletDisconnect } from '@/utils/walletHelpers';
import { 
  Trophy, 
  Star, 
  CircleCheck, 
  Rocket, 
  Calendar, 
  User, 
  BadgeCheck,
  Award,
  Heart,
  Wallet,
  Edit,
  Loader2,
  Badge as BadgeIcon,
  Lock,
  EyeOff
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/use-toast';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { Achievement as AchievementType, getUserAchievements } from '@/services/achievementsService';
import { calculateLevel } from '@/services/learningService';

// Achievement interface for typing
interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  date: string;
  progress: number;
  locked?: boolean;
}

// Activity interface for typing
interface Activity {
  id: string;
  type: 'module_completed' | 'quiz_completed' | 'achievement_earned' | 'streak_milestone' | 'flashcards_completed';
  title: string;
  description: string;
  timestamp: Date;
  moduleId?: string;
  score?: number;
  achievementId?: string;
}

// Learning stats interface
interface LearningStats {
  modulesCompleted: number;
  totalModules: number;
  quizzesCompleted: number;
  averageScore: number;
  flashcardsReviewed: number;
  alienChallengesCompleted: number;
  timeSpentLearning: string;
  pointsEarned: number;
}

// Module completion interface
interface ModuleCompletion {
  id: string;
  title: string;
  completedDate: Date;
}

// User badge interface
interface UserBadge {
  id: string;
  name: string;
  description: string;
  image: string;
  rarity: string;
  acquiredDate: Date;
}

const Profile = () => {
  const [connected, setConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const currentAccount = useCurrentAccount();
  const { userData, refreshUserData, updateAvatar, synchronizeUserLevel } = useAuth();
  const disconnectMutation = useDisconnectWallet();
  
  // State for edit profile dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  
  // State for real-time data
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [activitiesHistory, setActivitiesHistory] = useState<Activity[]>([]);
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [moduleCompletions, setModuleCompletions] = useState<ModuleCompletion[]>([]);
  const [loading, setLoading] = useState({
    achievements: true,
    activities: true,
    stats: true
  });
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(true);

  // Check for wallet connection on component mount - only once
  useEffect(() => {
    if (currentAccount) {
      setConnected(true);
      setWalletAddress(currentAccount.address);
      // Only refresh user data on initial mount or when account changes
      refreshUserData();
    } else {
      setConnected(false);
      setWalletAddress(null);
    }
  }, [currentAccount, refreshUserData]);

  // Handle wallet connection - use useCallback to prevent unnecessary re-renders
  const handleConnect = useCallback((address: string) => {
    handleWalletConnect(address, (addr) => {
      setConnected(true);
      setWalletAddress(addr);
    });
  }, []);

  // Handle wallet disconnection - use useCallback to prevent unnecessary re-renders
  const disconnect = useCallback(() => {
    setConnected(false);
    setWalletAddress(null);
  }, []);

  const handleDisconnect = useCallback(() => 
    handleWalletDisconnect(disconnectMutation, disconnect)(),
  [disconnectMutation, disconnect]);

  // If wallet is connected, fetch some basic Sui data
  const { data: suiBalance } = useSuiClientQuery(
    'getBalance',
    {
      owner: walletAddress || '',
    },
    {
      enabled: !!walletAddress,
    }
  );

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

  // Calculate progress to next tier
  const getNextLevelProgress = (level: number) => {
    const currentTier = getUserTier(level);
    // If at max tier, calculate progress within the tier
    if (currentTier.name === "Stellar Admiral") {
      // For the highest tier, show progress based on levels above the min tier level
      const levelsIntoTier = level - currentTier.range[0];
      // Arbitrarily assume 10 levels per progress bar in the highest tier
      return Math.min(levelsIntoTier * 10, 100);
    }
    
    // For other tiers, calculate progress towards the next tier
    const tierMax = currentTier.range[1];
    const tierMin = currentTier.range[0];
    const tierRange = tierMax - tierMin + 1;
    const progress = ((level - tierMin + 1) / tierRange) * 100;
    return progress;
  };

  // Get next tier
  const getNextTier = (level: number) => {
    const currentTierIndex = levelTiers.findIndex(tier => 
      level >= tier.range[0] && level <= tier.range[1]
    );
    
    // If at the highest tier, return the current tier
    if (currentTierIndex === levelTiers.length - 1 || currentTierIndex === -1) {
      return levelTiers[levelTiers.length - 1];
    }
    
    // Otherwise, return the next tier
    return levelTiers[currentTierIndex + 1];
  };

  // Calculate XP needed for next level
  const getXpForNextLevel = (level: number) => {
    // Simple progression: each level needs level * 100 XP
    return level * 1000;
  };

  // Fetch user achievements from Firestore
  useEffect(() => {
    const fetchAchievements = async () => {
      if (!walletAddress) return;
      
      try {
        setLoading(prev => ({ ...prev, achievements: true }));
        
        // Use the getUserAchievements function from achievementsService
        const { unlocked, locked } = await getUserAchievements(walletAddress);
        
        // Format unlocked achievements
        const unlockedAchievements = unlocked.map(achievement => {
          let icon;
          
          // Map achievement categories to icons
          switch (achievement.category) {
            case 'module_completion':
              icon = <Rocket className={`h-5 w-5 ${achievement.iconColor}`} />;
              break;
            case 'galaxy_completion':
              icon = <Star className={`h-5 w-5 ${achievement.iconColor}`} />;
              break;
            case 'streak':
              icon = <Calendar className={`h-5 w-5 ${achievement.iconColor}`} />;
              break;
            case 'mystery_box':
              icon = <BadgeIcon className={`h-5 w-5 ${achievement.iconColor}`} />;
              break;
            case 'mastery':
              icon = <Trophy className={`h-5 w-5 ${achievement.iconColor}`} />;
              break;
            case 'learning':
              icon = <BadgeCheck className={`h-5 w-5 ${achievement.iconColor}`} />;
              break;
            case 'social':
              icon = <User className={`h-5 w-5 ${achievement.iconColor}`} />;
              break;
            default:
              icon = <Award className={`h-5 w-5 ${achievement.iconColor}`} />;
          }
          
          // Format date
          const date = achievement.unlockedAt ? 
            achievement.unlockedAt.toLocaleDateString() : 
            'Recently';
          
          return {
            id: achievement.id,
            title: achievement.title,
            description: achievement.description,
            icon,
            date,
            progress: 100,
            locked: false
          };
        });
        
        // Format locked achievements
        const lockedAchievements = locked.map(achievement => {
          let icon;
          
          // Map achievement categories to icons
          switch (achievement.category) {
            case 'module_completion':
              icon = <Rocket className={`h-5 w-5 text-gray-400`} />;
              break;
            case 'galaxy_completion':
              icon = <Star className={`h-5 w-5 text-gray-400`} />;
              break;
            case 'streak':
              icon = <Calendar className={`h-5 w-5 text-gray-400`} />;
              break;
            case 'mystery_box':
              icon = <BadgeIcon className={`h-5 w-5 text-gray-400`} />;
              break;
            case 'mastery':
              icon = <Trophy className={`h-5 w-5 text-gray-400`} />;
              break;
            case 'learning':
              icon = <BadgeCheck className={`h-5 w-5 text-gray-400`} />;
              break;
            case 'social':
              icon = <User className={`h-5 w-5 text-gray-400`} />;
              break;
            default:
              icon = <Award className={`h-5 w-5 text-gray-400`} />;
          }
          
          return {
            id: achievement.id,
            title: achievement.title,
            description: achievement.description,
            icon,
            date: 'Locked',
            progress: 0,
            locked: true
          };
        });
        
        // Combine unlocked and locked achievements
        setAchievements([...unlockedAchievements, ...lockedAchievements]);
        setLoading(prev => ({ ...prev, achievements: false }));
      } catch (error) {
        console.error('Error fetching achievements:', error);
        setLoading(prev => ({ ...prev, achievements: false }));
      }
    };
    
    fetchAchievements();
  }, [walletAddress]);

  // Fetch user activity history from Firestore
  useEffect(() => {
    const fetchActivityHistory = async () => {
      if (!walletAddress) return;
      
      try {
        setLoading(prev => ({ ...prev, activities: true }));
        
        // Query for recent activities
        const activitiesQuery = query(
          collection(db, 'learning_activities'),
          where('walletAddress', '==', walletAddress),
          orderBy('timestamp', 'desc'),
          limit(10)
        );
        
        const activitiesSnapshot = await getDocs(activitiesQuery);
        const activitiesData: Activity[] = [];
        
        activitiesSnapshot.forEach(doc => {
          const data = doc.data();
          activitiesData.push({
            id: doc.id,
            type: data.type,
            title: data.title,
            description: data.description,
            timestamp: data.timestamp.toDate(),
            moduleId: data.moduleId,
            score: data.score,
            achievementId: data.achievementId
          });
        });
        
        setActivitiesHistory(activitiesData);
        setLoading(prev => ({ ...prev, activities: false }));
      } catch (error) {
        console.error('Error fetching activity history:', error);
        setLoading(prev => ({ ...prev, activities: false }));
      }
    };
    
    fetchActivityHistory();
  }, [walletAddress]);

  // Fetch learning stats from Firestore
  useEffect(() => {
    const fetchLearningStats = async () => {
      if (!walletAddress) return;
      
      try {
        setLoading(prev => ({ ...prev, stats: true }));
        
        // Get user learning progress document
        const learningProgressRef = doc(db, 'learningProgress', walletAddress);
        const progressDoc = await getDoc(learningProgressRef);
        
        if (!progressDoc.exists()) {
          // If no progress document exists yet, create default stats
          setLearningStats({
            modulesCompleted: 0,
            totalModules: 17, // Updated to match new module structure (16 modules + 1 Home Planet)
            quizzesCompleted: 0,
            averageScore: 0,
            flashcardsReviewed: 0,
            alienChallengesCompleted: 0,
            timeSpentLearning: '0 hours 0 minutes',
            pointsEarned: 0
          });
        } else {
          const data = progressDoc.data();
          console.log('Raw progress data from Firestore:', data);
          
          // Get completed modules count
          const completedModules = data.completedModules ? Object.keys(data.completedModules).length : 0;
          
          // Extract totalXpEarned and ensure it's a number
          let totalXpEarned = 0;
          if (data.totalXpEarned !== undefined) {
            if (typeof data.totalXpEarned === 'number') {
              totalXpEarned = data.totalXpEarned;
            } else {
              // Try parsing as a number
              totalXpEarned = Number(data.totalXpEarned) || 0;
            }
          }
          console.log('Parsed totalXpEarned:', totalXpEarned);
          
          // Format time spent learning
          const timeSpentMinutes = totalXpEarned ? Math.floor(totalXpEarned / 10) : 0; // Estimate time based on XP
          const hours = Math.floor(timeSpentMinutes / 60);
          const minutes = timeSpentMinutes % 60;
          const timeSpentFormatted = `${hours} hours ${minutes} minutes`;
          
          setLearningStats({
            modulesCompleted: completedModules,
            totalModules: 17, // Updated to match new module structure (16 modules + 1 Home Planet)
            quizzesCompleted: data.quizzesCompleted || 0,
            averageScore: data.averageScore || 0,
            flashcardsReviewed: data.flashcardsReviewed || 0,
            alienChallengesCompleted: data.alienChallengesCompleted || 0,
            timeSpentLearning: timeSpentFormatted,
            pointsEarned: totalXpEarned
          });
        }
        
        // Get recent module completions
        const moduleProgressCollection = await getDocs(
          collection(db, 'learningProgress', walletAddress, 'moduleProgress')
        );
        
        const completionsData: ModuleCompletion[] = [];
        
        moduleProgressCollection.forEach(doc => {
          const data = doc.data();
          if (data.lastAccessed) {
            completionsData.push({
              id: doc.id,
              title: data.moduleName || doc.id.replace(/-/g, ' '),
              completedDate: data.lastAccessed.toDate()
            });
          }
        });
        
        // Sort by most recent
        completionsData.sort((a, b) => b.completedDate.getTime() - a.completedDate.getTime());
        
        // Limit to 5 most recent
        setModuleCompletions(completionsData.slice(0, 5));
        setLoading(prev => ({ ...prev, stats: false }));
      } catch (error) {
        console.error('Error fetching learning stats:', error);
        setLoading(prev => ({ ...prev, stats: false }));
      }
    };
    
    fetchLearningStats();
  }, [walletAddress]);

  // Fetch user badges from Firestore
  useEffect(() => {
    const fetchUserBadges = async () => {
      if (!walletAddress) return;
      
      try {
        setLoadingBadges(true);
        
        const badgesQuery = query(
          collection(db, 'user_nfts'),
          where('userId', '==', walletAddress),
          where('type', '==', 'badge'),
          where('unlocked', '==', true)
        );
        
        const badgesSnapshot = await getDocs(badgesQuery);
        const badgesData: UserBadge[] = [];
        
        badgesSnapshot.forEach(doc => {
          const data = doc.data();
          badgesData.push({
            id: doc.id,
            name: data.name,
            description: data.description,
            image: data.imageUrl,
            rarity: data.rarity,
            acquiredDate: data.acquiredAt?.toDate() || new Date()
          });
        });
        
        setUserBadges(badgesData);
        setLoadingBadges(false);
      } catch (error) {
        console.error('Error fetching user badges:', error);
        setLoadingBadges(false);
      }
    };
    
    fetchUserBadges();
  }, [walletAddress]);

  // User stats with real data or fallback values if not available
  const userStats = useMemo(() => {
    // Get XP from userData or use 0 as fallback
    const userXp = userData?.xp || 0;
    
    // Calculate level based on XP using our level calculation logic
    const calculatedLevel = calculateLevel(userXp);
    
    return {
      xp: userXp,
      streak: userData?.streak || 0,
      // Use calculated level instead of the one stored in Firebase
      level: calculatedLevel,
      username: userData?.displayName || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Explorer'),
      avatarSrc: userData?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=fixed',
      suiTokens: userData?.suiTokens || 0,
      createdAt: userData?.createdAt instanceof Date ? userData.createdAt : new Date(),
      lastLogin: userData?.lastLogin instanceof Date ? userData.lastLogin : new Date(),
      rank: calculateRank(userXp) // Calculate rank based on XP
    };
  }, [userData, walletAddress]);
  
  // Log avatar info for debugging
  useEffect(() => {
    console.log('Profile component - userData?.photoURL:', userData?.photoURL);
    console.log('Profile component - userStats.avatarSrc:', userStats.avatarSrc);
  }, [userData?.photoURL, userStats.avatarSrc]);

  // Refresh user data when profile mounts to ensure we have the latest data
  useEffect(() => {
    if (refreshUserData && walletAddress) {
      console.log('Profile page: Refreshing user data');
      refreshUserData();
    }
  }, [refreshUserData, walletAddress]);

  // Function to update user's profile avatar
  const handleSetAvatar = async (avatarUrl: string) => {
    if (!walletAddress || !userData) return;
    
    try {
      setIsUpdatingAvatar(true);
      
      // Use the dedicated updateAvatar function from AuthContext
      await updateAvatar(avatarUrl);
      
      // Show success toast
      toast({
        title: "Avatar Updated",
        description: "Your profile avatar has been updated successfully.",
      });
      
    } catch (error) {
      console.error('Error updating avatar:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update your profile avatar. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  // Generate a new random avatar
  const generateRandomAvatar = async () => {
    const randomSeed = Math.random().toString(36).substring(2, 10);
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${randomSeed}`;
    await handleSetAvatar(avatarUrl);
  };

  // Calculate global rank based on XP
  function calculateRank(xp: number): number {
    if (xp >= 10000) return 1;  // Top rank
    if (xp >= 8000) return 2;
    if (xp >= 6000) return 3;
    if (xp >= 4000) return 4;
    if (xp >= 2000) return 5;
    if (xp >= 1000) return 10;
    if (xp >= 500) return 20;
    if (xp >= 100) return 50;
    
    return 100; // Beginner rank
  }

  // Function to get badge color based on rarity
  const getBadgeColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'border-green-400 text-green-400';
      case 'rare':
        return 'border-blue-400 text-blue-400';
      case 'epic':
        return 'border-purple-400 text-purple-400';
      case 'legendary':
        return 'border-amber-400 text-amber-400';
      default:
        return 'border-slate-400 text-slate-400';
    }
  };

  // Function to group achievements by category
  const groupAchievementsByCategory = (achievements: Achievement[]) => {
    const groupedAchievements: { [key: string]: Achievement[] } = {};
    
    achievements.forEach(achievement => {
      // Extract category from achievement ID
      let category = 'Other';
      
      if (achievement.id.includes('module')) {
        category = 'Module Completion';
      } else if (achievement.id.includes('galaxy')) {
        category = 'Galaxy Exploration';
      } else if (achievement.id.includes('streak')) {
        category = 'Learning Streaks';
      } else if (achievement.id.includes('mystery_box') || achievement.id.includes('lucky')) {
        category = 'Mystery Boxes';
      } else if (achievement.id.includes('perfect') || achievement.id.includes('master') || achievement.id.includes('conqueror')) {
        category = 'Mastery';
      } else if (achievement.id.includes('night_owl')) {
        category = 'Special';
      }
      
      if (!groupedAchievements[category]) {
        groupedAchievements[category] = [];
      }
      
      groupedAchievements[category].push(achievement);
    });
    
    return Object.keys(groupedAchievements).map(category => ({
      category,
      achievements: groupedAchievements[category]
    }));
  };

  return (
    <div className="relative min-h-screen">
      <StarField />
      
      <NavBar 
        connected={connected}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        userXp={userStats.xp}
        userStreak={userStats.streak}
        userLevel={userStats.level}
        username={userStats.username}
        avatarSrc={userData?.photoURL || userStats.avatarSrc}
      />
      
      <main className="container mx-auto pt-24 px-4 pb-20">
        <section className="mb-8">
          <motion.h1 
            className="text-3xl md:text-4xl font-heading font-bold mb-6 text-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-gradient">Your Explorer Profile</span>
          </motion.h1>
        </section>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <motion.div
            className="md:col-span-1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <Card className="galaxy-card overflow-hidden">
              <div className="h-32 bg-gradient-to-br from-primary/20 to-secondary/20"></div>
              <div className="relative px-6 pb-6">
                <div className="flex justify-between">
                  <Avatar className="h-24 w-24 border-4 border-background mt-[-3rem] bg-background">
                    <AvatarImage src={userData?.photoURL || userStats.avatarSrc} />
                    <AvatarFallback>{userStats.username.charAt(0)}</AvatarFallback>
                  </Avatar>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 h-8"
                    onClick={generateRandomAvatar}
                    disabled={isUpdatingAvatar}
                  >
                    {isUpdatingAvatar ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Edit className="h-4 w-4 mr-2" />
                    )}
                    Change Avatar
                  </Button>
                </div>
                
                <div className="mt-3">
                  <h2 className="text-2xl font-bold">{userStats.username}</h2>
                  <p className="text-muted-foreground text-sm">
                    Explorer since {userStats.createdAt.toLocaleDateString()}
                  </p>
                </div>
                
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Level {userStats.level}</span>
                      <span>{userStats.xp} XP</span>
                    </div>
                    <Progress 
                      value={((userStats.xp % 1000) / 1000) * 100} 
                      className="h-2" 
                    />
                  </div>
                  
                  {/* Tier progression */}
                  <div className="bg-card/50 p-3 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <span className="text-sm font-medium">Rank: </span>
                        <span className={`text-sm font-bold ${getUserTier(userStats.level).color}`}>
                          {getUserTier(userStats.level).name}
                        </span>
                      </div>
                      {getUserTier(userStats.level).name !== "Stellar Admiral" && (
                        <div className="text-xs text-muted-foreground">
                          Next: {getNextTier(userStats.level).name}
                        </div>
                      )}
                    </div>
                    
                    <div className="relative">
                      <Progress 
                        value={getNextLevelProgress(userStats.level)} 
                        className="h-2" 
                      />
                      <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-xs text-muted-foreground">
                        <span>{getUserTier(userStats.level).range[0]}</span>
                        {getUserTier(userStats.level).name !== "Stellar Admiral" && (
                          <span>{getUserTier(userStats.level).range[1]}</span>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground text-center mt-6">
                      {getUserTier(userStats.level).name === "Stellar Admiral" 
                        ? "You've reached the highest rank!" 
                        : `${getNextTier(userStats.level).range[0] - userStats.level} more levels to reach ${getNextTier(userStats.level).name}`}
                    </p>
                    
                    {/* Add sync button */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-4"
                      onClick={async () => {
                        const updated = await refreshUserData();
                        // Try to synchronize the level
                        const synced = await synchronizeUserLevel();
                        if (synced) {
                          toast({
                            title: "Level Synchronized",
                            description: "Your level has been updated to match your XP.",
                            duration: 3000,
                          });
                        } else {
                          toast({
                            title: "Already Synchronized",
                            description: "Your level is already correctly set for your XP.",
                            duration: 3000,
                          });
                        }
                      }}
                    >
                      <CircleCheck className="h-4 w-4 mr-2" />
                      Sync Level
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-card/50 p-3 rounded-lg flex flex-col items-center">
                      <CircleCheck className="w-12 h-12 p-1 text-accent" />
                      <span className="text-2xl font-bold">{userStats.streak}</span>
                      <span className="text-xs text-muted-foreground">Day Streak</span>
                    </div>
                    
                    <div className="bg-card/50 p-3 rounded-lg flex flex-col items-center">
                      <Trophy className="w-12 h-12 p-1 text-primary" />
                      <span className="text-2xl font-bold">
                        {userStats.rank > 0 ? `#${userStats.rank}` : 'N/A'}
                      </span>
                      <span className="text-xs text-muted-foreground">Global Rank</span>
                    </div>
                  </div>
                  
                  <div className="bg-card/50 p-3 rounded-lg flex justify-between items-center">
                    <div className="flex items-center">
                      <Wallet className="w-5 h-5 mr-2 text-yellow-500" />
                      <div>
                        <div className="text-sm font-medium">SUI Balance</div>
                        <div className="text-xs text-muted-foreground">
                          {connected ? 
                            (suiBalance ? 
                              `${parseInt(suiBalance.totalBalance) / 1000000000} SUI` : 
                              "Loading...") : 
                            "Not connected"}
                        </div>
                      </div>
                    </div>
                    <div className="text-xl font-bold">{userStats.suiTokens}</div>
                  </div>
                  
                  {walletAddress && (
                    <div className="text-xs text-muted-foreground break-all">
                      <span className="font-medium">Wallet:</span> {walletAddress}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
          
          {/* Badges Section */}
          <motion.div
            className="md:col-span-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <Card className="galaxy-card h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-xl flex items-center">
                    <Award className="w-5 h-5 mr-2 text-primary" />
                    Badges & Achievements
                  </CardTitle>
                  <CardDescription>
                    Special items and achievements you've earned
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {loadingBadges ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : userBadges.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {userBadges.map(badge => (
                      <div 
                        key={badge.id}
                        className={`relative rounded-lg p-3 border ${getBadgeColor(badge.rarity)} flex flex-col items-center text-center hover:bg-accent/5 transition-colors`}
                      >
                        <div className="w-16 h-16 rounded-full overflow-hidden mb-2">
                          <img src={badge.image} alt={badge.name} className="w-full h-full object-cover" />
                        </div>
                        <h4 className="text-sm font-medium">{badge.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BadgeIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-30" />
                    <h3 className="text-lg font-medium">No Badges Yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Purchase badges from the Cosmetics Store or earn them through achievements.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="mt-8">
            <Tabs defaultValue="achievements" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="achievements" className="flex items-center">
                <Trophy className="h-4 w-4 mr-2" />
                Achievements
              </TabsTrigger>
              <TabsTrigger value="activities" className="flex items-center">
                <Star className="h-4 w-4 mr-2" />
                Activities
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex items-center">
                <CircleCheck className="h-4 w-4 mr-2" />
                Learning Stats
              </TabsTrigger>
              </TabsList>
              
              {/* Achievements Tab */}
              <TabsContent value="achievements" className="space-y-6">
                <Card className="galaxy-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Award className="h-5 w-5 mr-2 text-primary" />
                      Achievements
                    </CardTitle>
                    <CardDescription>Track your learning milestones and accomplishments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading.achievements ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : achievements.length > 0 ? (
                      <div className="space-y-8">
                        {groupAchievementsByCategory(achievements).map(group => (
                          <div key={group.category} className="space-y-4">
                            <h3 className="text-lg font-semibold">{group.category}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {group.achievements.map(achievement => (
                                <div
                                  key={achievement.id}
                                  className={`p-4 rounded-lg border ${achievement.locked ? 'border-gray-700 bg-gray-800/50' : 'border-primary/30 bg-primary/5'} relative overflow-hidden`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-1">
                                      {achievement.locked ? (
                                        <div className="relative">
                                          {achievement.icon}
                                          <Lock className="h-3 w-3 absolute -bottom-1 -right-1 text-gray-400" />
                                        </div>
                                      ) : (
                                        achievement.icon
                                      )}
                                    </div>
                                    
                                    <div className="flex-grow">
                                      <div className="flex justify-between items-start">
                                        <h4 className={`font-medium ${achievement.locked ? 'text-gray-400' : 'text-foreground'}`}>
                                          {achievement.title}
                                        </h4>
                                        <span className="text-xs text-muted-foreground">
                                          {achievement.date}
                                        </span>
                                      </div>
                                      
                                      <p className={`text-sm ${achievement.locked ? 'text-gray-500' : 'text-foreground/70'} mt-1`}>
                                        {achievement.description}
                                      </p>
                                      
                                      <div className="mt-2">
                                        <Progress value={achievement.progress} className="h-1.5" />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-30" />
                        <h3 className="text-lg font-medium">No Achievements Yet</h3>
                        <p className="text-sm text-muted-foreground">
                          Complete learning modules and challenges to earn achievements.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
            {/* Other tabs content */}
            </Tabs>
        </div>
      </main>
    </div>
  );
};

// Utility function to format relative time (e.g., "2 days ago")
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) {
    return 'Today';
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  } else {
    return date.toLocaleDateString();
  }
};

// Utility function to format time (e.g., "2 hours ago")
const formatTime = (date: Date): string => {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  
  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffInMinutes < 24 * 60) {
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else {
    return formatTimeAgo(date);
  }
};

// Utility function to group activities by date
const groupActivitiesByDate = (activities: Activity[]): { date: string; activities: Activity[] }[] => {
  const groupedActivities: { [key: string]: Activity[] } = {};
  
  activities.forEach(activity => {
    const date = new Date(activity.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let dateString: string;
    
    if (date.toDateString() === today.toDateString()) {
      dateString = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateString = 'Yesterday';
    } else if (today.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
      dateString = 'This Week';
    } else {
      dateString = 'Earlier';
    }
    
    if (!groupedActivities[dateString]) {
      groupedActivities[dateString] = [];
    }
    
    groupedActivities[dateString].push(activity);
  });
  
  return Object.keys(groupedActivities).map(date => ({
    date,
    activities: groupedActivities[date]
  }));
};

// Utility function to get color based on activity type
const getActivityColor = (type: Activity['type']): string => {
  switch (type) {
    case 'module_completed':
      return '#10b981'; // green
    case 'quiz_completed':
      return '#3b82f6'; // blue
    case 'achievement_earned':
      return '#f59e0b'; // yellow
    case 'streak_milestone':
      return '#ef4444'; // red
    case 'flashcards_completed':
      return '#8b5cf6'; // purple
    default:
      return '#6b7280'; // gray
  }
};

export default Profile; 