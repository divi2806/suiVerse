import React, { useState, useEffect } from 'react';
import NavBar from '@/components/NavBar';
import StarField from '@/components/StarField';
import MysteryBox from '@/components/MysteryBox';
import EnhancedMysteryBox from '@/components/EnhancedMysteryBox';
import MysteryBoxStore from '@/components/MysteryBoxStore';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { 
  Trophy, 
  Star, 
  CircleCheck, 
  Rocket, 
  Circle,
  Coins
} from 'lucide-react';
import AchievementNotification from '@/components/AchievementNotification';
import { Achievement, getUserAchievements, checkAchievements } from '@/services/achievementsService';
import { doc, setDoc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import confetti from 'canvas-confetti';

interface Reward {
  id: string;
  name: string;
  description: string;
  type: 'badge' | 'booster' | 'avatar' | 'theme';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  image?: string;
  acquired: boolean;
  unlockRequirement?: string;
}

// Interface for streak rewards
interface StreakReward {
  day: number;
  reward: string;
  claimed: boolean;
}

const Rewards = () => {
  const { userData, walletAddress, refreshUserData } = useAuth();
  const currentAccount = useCurrentAccount();
  const [connected, setConnected] = useState(false);
  const [unlockedAchievement, setUnlockedAchievement] = useState<Achievement | null>(null);
  const [activeTab, setActiveTab] = useState("boxes");
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [claimingRewardDay, setClaimingRewardDay] = useState<number | null>(null);
  const [claimedRewards, setClaimedRewards] = useState<Record<number, boolean>>({});

  // Update connection status when wallet changes
  useEffect(() => {
    setConnected(!!currentAccount);
  }, [currentAccount]);

  // Load claimed rewards from Firestore
  useEffect(() => {
    const loadClaimedRewards = async () => {
      if (!walletAddress) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'learningProgress', walletAddress));
        if (userDoc.exists()) {
          const data = userDoc.data();
          
          // Get claimed streak rewards if they exist
          if (data.claimedStreakRewards) {
            setClaimedRewards(data.claimedStreakRewards);
          }
        }
      } catch (error) {
        console.error('Error loading claimed rewards:', error);
      }
    };
    
    loadClaimedRewards();
  }, [walletAddress]);

  // Check for achievements when page loads
  useEffect(() => {
    if (walletAddress) {
      checkAchievements(walletAddress).then(newAchievements => {
        if (newAchievements.length > 0) {
          // Show the most recent achievement if multiple were unlocked
          setUnlockedAchievement(newAchievements[0]);
        }
      });
    }
  }, [walletAddress]);

  const handleConnect = (address: string) => {
    setConnected(true);
  };

  const handleDisconnect = () => {
    setConnected(false);
  };

  // User stats with fallback values if not connected
  const userStats = {
    xp: userData?.xp || 0,
    streak: userData?.streak || 0,
    level: userData?.level || 1,
    username: userData?.displayName || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Explorer'),
    avatarSrc: userData?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=cosmic',
    suiTokens: userData?.suiTokens || 0
  };

  const { toast } = useToast();

  // Mystery box reward reveal
  const handleBoxOpen = (rewards: any) => {
    toast({
      title: "Mystery Box Opened!",
      description: (
        <div className="space-y-2">
          {rewards.suiTokens > 0 && <p>+ {rewards.suiTokens} SUI</p>}
          {rewards.xp > 0 && <p>+ {rewards.xp} XP</p>}
          {rewards.specialItem && <p>+ {rewards.specialItem}</p>}
        </div>
      ),
      duration: 5000,
    });
  };

  // List of earned rewards
  const [rewards] = useState<Reward[]>([
    {
      id: '1',
      name: 'Early Explorer',
      description: 'Awarded for joining during the platform launch',
      type: 'badge',
      rarity: 'rare',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=explorer',
      acquired: true,
    },
    {
      id: '2',
      name: 'Code Racer Champion',
      description: 'Achieved top score in the Code Racer game',
      type: 'badge',
      rarity: 'epic',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=racer',
      acquired: true,
    },
    {
      id: '3',
      name: 'Sui Master',
      description: 'Completed all Sui Network learning modules',
      type: 'badge',
      rarity: 'legendary',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=master',
      acquired: false,
      unlockRequirement: 'Complete all learning modules',
    },
    {
      id: '4',
      name: 'Week Streak: Bronze',
      description: 'Maintained a daily learning streak for 7 days',
      type: 'badge',
      rarity: 'common',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=streak',
      acquired: true,
    },
    {
      id: '5',
      name: 'Space Explorer Avatar',
      description: 'Special avatar for active learners',
      type: 'avatar',
      rarity: 'rare',
      image: 'https://api.dicebear.com/7.x/bottts/svg?seed=special',
      acquired: true,
    },
    {
      id: '6',
      name: 'Nebula Theme',
      description: 'Special UI theme unlock',
      type: 'theme',
      rarity: 'epic',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=nebula',
      acquired: false,
      unlockRequirement: 'Reach level 10',
    },
  ]);

  // Generate streak rewards based on actual user data
  const getStreakRewards = () => {
    const currentStreak = userStats.streak || 0;
    const maxReward = 28;
    
    // Define streak milestone rewards
    const rewards = [
      { day: 1, reward: '50 XP', claimed: claimedRewards[1] || false },
      { day: 3, reward: '100 XP', claimed: claimedRewards[3] || false },
      { day: 7, reward: 'Common Box', claimed: claimedRewards[7] || false },
      { day: 14, reward: 'Rare Box', claimed: claimedRewards[14] || false },
      { day: 21, reward: '500 XP', claimed: claimedRewards[21] || false },
      { day: 28, reward: 'Epic Box', claimed: claimedRewards[28] || false }
    ];
    
    // Check if we need to update the claimed status based on the user data
    // This ensures the UI is in sync with the backend data
    const updatedRewards = rewards.map(reward => ({
      ...reward,
      claimed: claimedRewards[reward.day] || false,
      // Add a flag to indicate if the reward is available to claim
      available: currentStreak >= reward.day && !claimedRewards[reward.day]
    }));
    
    return {
      current: currentStreak,
      maxReward,
      rewards: updatedRewards,
      // Add a convenience method to check if any rewards are available to claim
      hasAvailableRewards: updatedRewards.some(r => r.available)
    };
  };
  
  // Function to handle streak reward claim
  const handleClaimStreakReward = async (reward: StreakReward) => {
    if (!walletAddress || !userData || isClaimingReward) return;
    
    setIsClaimingReward(true);
    setClaimingRewardDay(reward.day);
    
    try {
      // Parse the reward to determine what to award
      let xpToAward = 0;
      let boxType: string | null = null;
      
      if (reward.reward.includes('XP')) {
        // Extract XP amount
        xpToAward = parseInt(reward.reward.split(' ')[0]);
      } else if (reward.reward.includes('Box')) {
        // Set box type based on reward text
        if (reward.reward.includes('Common')) {
          boxType = 'common';
        } else if (reward.reward.includes('Rare')) {
          boxType = 'rare';
        } else if (reward.reward.includes('Epic')) {
          boxType = 'epic';
        } else if (reward.reward.includes('Legendary')) {
          boxType = 'legendary';
        }
      }
      
      // Update user data in Firestore
      const userRef = doc(db, 'learningProgress', walletAddress);
      
      // Update claimed rewards
      const updatedClaimedRewards = {
        ...claimedRewards,
        [reward.day]: true
      };
      
      // Start with base update data
      const updateData: Record<string, any> = {
        claimedStreakRewards: updatedClaimedRewards,
        updatedAt: serverTimestamp()
      };
      
      // Award XP if needed
      if (xpToAward > 0) {
        // Calculate new XP total
        const currentXp = userData.xp || 0;
        const newXpTotal = currentXp + xpToAward;
        
        updateData.xp = newXpTotal;
        updateData.totalXpEarned = newXpTotal;
      }
      
      // Update Firestore with XP and claimed rewards
      await setDoc(userRef, updateData, { merge: true });
      
      // If box rewarded, add to user's inventory
      if (boxType) {
        try {
          // Add mystery box to inventory
          const inventoryRef = doc(db, 'user_inventory', walletAddress);
          const inventoryDoc = await getDoc(inventoryRef);
          
          if (inventoryDoc.exists()) {
            // Update existing inventory
            const currentBoxes = inventoryDoc.data().mysteryBoxes || {};
            const boxCount = currentBoxes[boxType] || 0;
            
            await updateDoc(inventoryRef, {
              mysteryBoxes: {
                ...currentBoxes,
                [boxType]: boxCount + 1
              },
              updatedAt: serverTimestamp()
            });
          } else {
            // Create new inventory
            await setDoc(inventoryRef, {
              mysteryBoxes: {
                [boxType]: 1
              },
              userId: walletAddress,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          
          console.log(`Added ${boxType} mystery box to inventory`);
        } catch (error) {
          console.error('Error updating inventory:', error);
          // Continue execution even if inventory update fails
        }
      }
      
      // Update local state
      setClaimedRewards(updatedClaimedRewards);
      
      // Refresh user data to update UI
      await refreshUserData();
      
      // Show success toast and confetti
      toast({
        title: "Reward Claimed!",
        description: (
          <div className="space-y-2">
            {xpToAward > 0 && <p>+ {xpToAward} XP</p>}
            {boxType && <p>+ 1 {boxType.charAt(0).toUpperCase() + boxType.slice(1)} Mystery Box</p>}
          </div>
        ),
        duration: 5000,
      });
      
      // Show confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.5, y: 0.3 },
        colors: ['#10b981', '#3b82f6', '#f59e0b']
      });
      
    } catch (error) {
      console.error('Error claiming reward:', error);
      toast({
        title: "Error",
        description: "Failed to claim streak reward. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsClaimingReward(false);
      setClaimingRewardDay(null);
    }
  };
  
  // Get live streak data
  const dailyStreak = getStreakRewards();

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
        avatarSrc={userStats.avatarSrc}
      />
      
      <main className="container mx-auto pt-24 px-4 pb-20">
        <section className="text-center mb-12">
          <motion.h1 
            className="text-3xl md:text-4xl font-heading font-bold mb-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-gradient">Space Treasury</span>
          </motion.h1>
          
          <motion.p
            className="text-lg text-foreground/80 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            Collect rewards, mystery boxes, and achievements as you
            explore the Sui Network galaxy.
          </motion.p>
        </section>
        
        {/* User stats overview */}
        <motion.section 
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="galaxy-card p-4 flex items-center space-x-4">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-foreground/60">Rewards Earned</p>
                <p className="text-2xl font-bold">{rewards.filter(r => r.acquired).length}</p>
              </div>
            </div>
            
            <div className="galaxy-card p-4 flex items-center space-x-4">
              <div className="h-12 w-12 rounded-full bg-secondary/20 flex items-center justify-center">
                <Star className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-foreground/60">Total XP</p>
                <p className="text-2xl font-bold">{userStats.xp}</p>
              </div>
            </div>
            
            <div className="galaxy-card p-4 flex items-center space-x-4">
              <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Coins className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-foreground/60">SUI</p>
                <p className="text-2xl font-bold">{userStats.suiTokens}</p>
              </div>
            </div>
            
            <div className="galaxy-card p-4 flex items-center space-x-4">
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <CircleCheck className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-foreground/60">Daily Streak</p>
                <p className="text-2xl font-bold">{userStats.streak} days</p>
              </div>
            </div>
          </div>
        </motion.section>
        
        {/* Main content tabs */}
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-8 mx-auto">
            <TabsTrigger value="boxes">Mystery Boxes</TabsTrigger>
            <TabsTrigger value="store">Box Store</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
            <TabsTrigger value="streak">Daily Streak</TabsTrigger>
          </TabsList>
          
          {/* Mystery Boxes Tab */}
          <TabsContent value="boxes" className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Your Mystery Boxes</h2>
              <p className="text-foreground/70">Open your mystery boxes to reveal rewards</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
              <EnhancedMysteryBox boxType="common" onOpen={handleBoxOpen} animated={true} />
              <EnhancedMysteryBox boxType="rare" onOpen={handleBoxOpen} animated={true} />
              <EnhancedMysteryBox boxType="epic" onOpen={handleBoxOpen} animated={true} />
              <EnhancedMysteryBox boxType="legendary" onOpen={handleBoxOpen} animated={true} />
            </div>
            
            <div className="text-center mt-8">
              <p className="text-foreground/70 mb-4">Complete missions and achievements to earn more mystery boxes</p>
              <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/20">
                View Missions
              </Button>
            </div>
          </TabsContent>
          
          {/* Store Tab */}
          <TabsContent value="store">
            {walletAddress ? (
              <MysteryBoxStore walletAddress={walletAddress} />
            ) : (
              <div className="text-center py-12">
                <p className="text-foreground/70 mb-4">Connect your wallet to purchase mystery boxes</p>
                <Button className="neon-button">Connect Wallet</Button>
              </div>
            )}
          </TabsContent>
          
          {/* Rest of the tabs remain unchanged */}
          <TabsContent value="rewards" className="space-y-8">
            <h2 className="text-2xl font-heading font-bold mb-6">
              <span className="text-gradient">Your Collection</span>
            </h2>
            
            <div className="galaxy-card overflow-hidden">
              <Tabs defaultValue="acquired">
                <TabsList className="w-full bg-muted/20 rounded-none">
                  <TabsTrigger value="acquired" className="flex-1">Acquired ({rewards.filter(r => r.acquired).length})</TabsTrigger>
                  <TabsTrigger value="locked" className="flex-1">Locked ({rewards.filter(r => !r.acquired).length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="acquired" className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {rewards
                      .filter(reward => reward.acquired)
                      .map(reward => (
                        <div 
                          key={reward.id} 
                          className="bg-card/60 border border-primary/20 rounded-lg p-4 text-center"
                        >
                          <div className="mb-3">
                            <div 
                              className={`w-16 h-16 mx-auto rounded-lg overflow-hidden
                                ${reward.rarity === 'legendary' ? 'border-2 border-purple-500' :
                                  reward.rarity === 'epic' ? 'border-2 border-pink-500' :
                                  reward.rarity === 'rare' ? 'border-2 border-blue-500' :
                                  'border-2 border-green-500'}`}
                            >
                              <img 
                                src={reward.image} 
                                alt={reward.name} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                          
                          <h3 className="font-medium text-sm mb-1">{reward.name}</h3>
                          
                          <div 
                            className={`text-xs px-2 py-0.5 rounded-full inline-block mb-2
                              ${reward.rarity === 'legendary' ? 'bg-purple-500/20 text-purple-400' :
                                reward.rarity === 'epic' ? 'bg-pink-500/20 text-pink-400' :
                                reward.rarity === 'rare' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-green-500/20 text-green-400'}`}
                          >
                            {reward.rarity}
                          </div>
                          
                          <p className="text-xs text-foreground/60 line-clamp-2">{reward.description}</p>
                        </div>
                      ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="locked" className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {rewards
                      .filter(reward => !reward.acquired)
                      .map(reward => (
                        <div 
                          key={reward.id} 
                          className="bg-card/60 border border-muted rounded-lg p-4 text-center"
                        >
                          <div className="mb-3 relative">
                            <div className="w-16 h-16 mx-auto rounded-lg overflow-hidden border-2 border-muted grayscale">
                              <img 
                                src={reward.image} 
                                alt={reward.name} 
                                className="w-full h-full object-cover opacity-50"
                              />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Rocket className="h-6 w-6 text-foreground/50" />
                            </div>
                          </div>
                          
                          <h3 className="font-medium text-sm mb-1">{reward.name}</h3>
                          
                          <div 
                            className={`text-xs px-2 py-0.5 rounded-full inline-block mb-2
                              bg-muted text-muted-foreground`}
                          >
                            {reward.rarity}
                          </div>
                          
                          <p className="text-xs text-foreground/50 mb-2 line-clamp-2">{reward.description}</p>
                          
                          <div className="text-xs bg-muted/30 rounded p-1">
                            <strong>Unlock:</strong> {reward.unlockRequirement}
                          </div>
                        </div>
                      ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>
          
          <TabsContent value="streak" className="space-y-8">
            <h2 className="text-2xl font-heading font-bold mb-6">
              <span className="text-gradient">Daily Streak Rewards</span>
            </h2>
            
            <div className="galaxy-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-lg font-medium">Current Streak: <span className="text-primary">{dailyStreak.current} days</span></p>
                  <p className="text-sm text-foreground/60">Keep logging in daily to earn rewards!</p>
                </div>
                <div className="bg-primary/20 px-3 py-1 rounded-lg">
                  <p className="text-sm">
                    {dailyStreak.hasAvailableRewards ? (
                      <span className="text-yellow-400 font-semibold animate-pulse">Rewards Available!</span>
                    ) : (
                      <>Next reward: <strong>Day {
                        dailyStreak.rewards.find(r => r.day > dailyStreak.current)?.day || dailyStreak.maxReward
                      }</strong></>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="relative">
                {/* Progress bar */}
                <div className="progress-bar mb-2">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${Math.min((dailyStreak.current / dailyStreak.maxReward) * 100, 100)}%` }} 
                  />
                </div>
                
                {/* Day markers with rewards */}
                <div className="flex justify-between">
                  {dailyStreak.rewards.map((reward) => (
                    <div key={reward.day} className="flex flex-col items-center">
                      <div 
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mb-1 
                          ${dailyStreak.current >= reward.day 
                            ? reward.claimed 
                              ? 'bg-secondary text-secondary-foreground' 
                              : 'bg-primary text-primary-foreground animate-pulse' 
                            : 'bg-muted text-muted-foreground'}`}
                      >
                        {dailyStreak.current >= reward.day && reward.claimed 
                          ? <CircleCheck className="h-3 w-3" /> 
                          : reward.day}
                      </div>
                      <div className={`text-xs font-medium ${reward.available ? 'text-primary' : ''}`}>
                        {reward.reward}
                      </div>
                      {reward.available && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs h-6 mt-1 neon-button animate-pulse" 
                          onClick={() => handleClaimStreakReward(reward as StreakReward)}
                          disabled={isClaimingReward}
                        >
                          {isClaimingReward && claimingRewardDay === reward.day ? 'Claiming...' : 'Claim'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Add explanation text */}
                <div className="mt-6 text-sm text-foreground/70 bg-muted/20 p-3 rounded-md">
                  <p className="mb-1"><strong>How it works:</strong></p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Log in daily to increase your streak counter</li>
                    <li>Claim special rewards when you reach streak milestones</li>
                    <li>Missing a day will reset your streak to 1</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Achievement notification */}
      {unlockedAchievement && (
        <AchievementNotification 
          achievement={unlockedAchievement} 
          onClose={() => setUnlockedAchievement(null)} 
        />
      )}
    </div>
  );
};

export default Rewards;
