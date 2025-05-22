import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import NavBar from '@/components/NavBar';
import GameCard from '@/components/GameCard';
import StarField from '@/components/StarField';
import MiniGames from '@/components/MiniGames';
import CodeCompletion from '@/components/games/CodeCompletion';
import {useMemo} from 'react';
import BugHunter from '@/components/games/BugHunter';
import SmartContractPuzzle from '@/components/games/SmartContractPuzzle';
import DailyChallenges from '@/components/DailyChallenges';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';
import { Gamepad, Trophy, Star, Calendar, Coins } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentAccount } from '@mysten/dapp-kit';
import RaceYourKnowledge from '@/components/games/RaceYourKnowledge';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  setDoc, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  limit, 
  getFirestore,
  increment
} from 'firebase/firestore';
import { sendSuiReward } from '@/services/suiPaymentService';
import { updateUserXp } from '@/services/firebaseService';
import { rewardUser } from '@/services/userRewardsService'; 

const gamesList = [
  {
    id: 'code-racer',
    title: 'Code Racer',
    description: 'Race against time to complete Sui code snippets. Type faster to earn more points!',
    image: '/CodeRacer.png',
    progress: 0,
    difficulty: 'medium',
    rewards: { xp: 150, coins: 0.05, booster: false },
    completed: false,
    highScore: 0,
    category: 'coding'
  },
  {
    id: 'bug-hunter',
    title: 'Bug Hunter',
    description: 'Find and fix bugs in Move language contracts before time runs out.',
    image: '/BugHunter.png',
    progress: 0,
    difficulty: 'hard',
    rewards: { xp: 250, coins: 0.07, booster: true },
    completed: false,
    highScore: 0,
    category: 'debugging'
  },
  {
    id: 'smart-contract-puzzle',
    title: 'Smart Contract Puzzle',
    description: 'Arrange code blocks to create valid Sui smart contracts.',
    image: '/SmartContractPuzzle.png',
    progress: 0,
    difficulty: 'easy',
    rewards: { xp: 100, coins: 0.05, booster: false },
    completed: false,
    highScore: 0,
    category: 'puzzle'
  },
  {
    id: 'race-your-knowledge',
    title: 'Race Your Knowledge',
    description: 'Test your Sui blockchain knowledge in a fast-paced quiz game!',
    image: '/RaceYourKnowledge.png',
    progress: 0,
    difficulty: 'medium',
    rewards: { xp: 200, coins: 0.07, booster: true },
    completed: false,
    highScore: 0,
    category: 'quiz'
  }
];

const Games = () => {
  const { userData, walletAddress, refreshUserData } = useAuth();
  const currentAccount = useCurrentAccount();
  const [connected, setConnected] = useState(false);
  const [topScore, setTopScore] = useState(0);
  const [totalEarnedSui, setTotalEarnedSui] = useState(0);
  const [completedChallenges, setCompletedChallenges] = useState(0);
  const [userGameStats, setUserGameStats] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Add refs to track data fetch status
  const hasInitiallyFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const prevWalletRef = useRef<string | null>(null);
  
  const db = getFirestore();
  const games = useMemo(() => {
    return gamesList.map(game => {
      const statKey =
        game.id === 'code-racer' ? 'codeRacer' :
        game.id === 'bug-hunter' ? 'bugHunter' :
        game.id === 'smart-contract-puzzle' ? 'smartContractPuzzle' :
        game.id === 'race-your-knowledge' ? 'raceYourKnowledge' :
        '';
  
      const userStats = statKey ? userGameStats?.[statKey] : null;
  
      return {
        ...game,
        progress: userStats?.progress || 0,
        highScore: userStats?.bestScore || 0,
        completed: (userStats?.gamesPlayed || 0) > 0,
        difficulty: game.difficulty as 'easy' | 'medium' | 'hard'
      };
    });
  }, [userGameStats]);

  // Update connection status when wallet changes - optimize to prevent multiple rerenders
  useEffect(() => {
    // Only update connected state if it actually changes
    const isNowConnected = !!currentAccount;
    if (isNowConnected !== connected) {
      setConnected(isNowConnected);
      
      // If we're disconnecting, clear the refs
      if (!isNowConnected) {
        prevWalletRef.current = null;
        hasInitiallyFetchedRef.current = false;
      }
    }
  }, [currentAccount, connected]);

  // Consolidated data fetching effect - only runs when wallet or userData changes
  useEffect(() => {
    // Skip fetch if:
    // 1. No wallet address 
    // 2. Already fetching
    // 3. Same wallet and we've already done initial fetch (unless forced)
    if (!walletAddress || 
        isFetchingRef.current || 
        (walletAddress === prevWalletRef.current && hasInitiallyFetchedRef.current)) {
      return;
    }
    
    const fetchStats = async () => {
      if (isFetchingRef.current) return; // Prevent concurrent fetch operations
      
      try {
        isFetchingRef.current = true;
        setIsLoading(true);
        console.log("Fetching game stats for wallet:", walletAddress);
        
        // Get user's leaderboard stats
        const leaderboardRef = doc(db, 'leaderboard', walletAddress);
        const leaderboardDoc = await getDoc(leaderboardRef);
        
        // Get user's game results to find top score
        const resultsQuery = query(
          collection(db, 'game_results'),
          where('userId', '==', walletAddress),
          orderBy('score', 'desc'),
          limit(1)
        );
        const resultsSnapshot = await getDocs(resultsQuery);
        
        // Get total earned SUI from transactions (all sources)
        const rewardsQuery = query(
          collection(db, 'user_rewards'),
          where('userId', '==', walletAddress)
        );
        const rewardsSnapshot = await getDocs(rewardsQuery);
        
        // Get user's daily challenges
        const challengesQuery = query(
          collection(db, 'daily_challenges'),
          where('userId', '==', walletAddress)
        );
        const challengesSnapshot = await getDocs(challengesQuery);
        
        // Calculate total earned SUI from rewards
        let totalSui = 0;
        rewardsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.amount && typeof data.amount === 'number') {
            totalSui += data.amount;
          }
        });
        
        // Find top score across all games
        let bestScore = 0;
        resultsSnapshot.forEach(doc => {
          const score = doc.data().score || 0;
          if (score > bestScore) bestScore = score;
        });
        
        // Count completed challenges
        let completedCount = 0;
        let challenges: any[] = [];
        challengesSnapshot.forEach(doc => {
          const data = doc.data();
          challenges.push({ ...data, id: doc.id });
          if (data.completed) completedCount++;
        });
        
        // Use default challenges if none found
        if (challenges.length === 0) {
          challenges = [
            {
              id: 'daily-1',
              title: 'Move Language Sprint',
              description: 'Complete 3 Move code exercises in less than 10 minutes',
              xpReward: 100,
              suiReward: 0.05,
              completed: false,
              progress: 0,
              difficulty: 'easy' as const,
            },
            {
              id: 'daily-2',
              title: 'Bug Eliminator',
              description: 'Find at least 5 bugs in the sample Move contracts',
              xpReward: 150,
              suiReward: 0.07,
              completed: false,
              progress: 0,
              difficulty: 'medium' as const,
              timeLeft: '8h 35m'
            },
            {
              id: 'daily-3',
              title: 'Smart Contract Master',
              description: 'Score at least 500 points in the Smart Contract Puzzle game',
              xpReward: 200,
              suiReward: 0.08,
              completed: false,
              progress: 0,
              difficulty: 'hard' as const,
              timeLeft: '8h 35m'
            }
          ];
        }
        
        setDailyChallenges(challenges);
        
        // If we don't have any transaction data but user has SUI tokens in their profile,
        // use that as a fallback
        if (totalSui === 0 && userData?.suiTokens) {
          totalSui = userData.suiTokens;
        }
        
        console.log("Stats loaded:", { bestScore, totalSui, completedCount });
        
        // Update all state at once to minimize renders
        setTopScore(bestScore);
        setTotalEarnedSui(totalSui);
        setCompletedChallenges(completedCount);
        
        // Store all game stats
        if (leaderboardDoc.exists()) {
          setUserGameStats(leaderboardDoc.data());
        }
        
        // Mark that we've completed the fetch
        prevWalletRef.current = walletAddress;
        hasInitiallyFetchedRef.current = true;
        
      } catch (error) {
        console.error('Error fetching user stats:', error);
      } finally {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    };
    
    fetchStats();
  }, [walletAddress, userData?.suiTokens, db]);

  // Make handleConnect and handleDisconnect stable with useCallback
  const handleConnect = useCallback((address: string) => {
    setConnected(true);
    // Force a refresh when connecting
    hasInitiallyFetchedRef.current = false;
  }, []);

  const handleDisconnect = useCallback(() => {
    setConnected(false);
    // Clear cached data on disconnect
    prevWalletRef.current = null;
    hasInitiallyFetchedRef.current = false;
  }, []);

  // Force a refresh function for manual refresh (not automatically called)
  const refreshStats = useCallback(() => {
    if (walletAddress) {
      prevWalletRef.current = null;
      hasInitiallyFetchedRef.current = false;
    }
  }, [walletAddress]);

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

  

  const [dailyChallenges, setDailyChallenges] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState('games');
  const [filteredGames, setFilteredGames] = useState(games);
  const [currentGame, setCurrentGame] = useState<string | null>(null);
  const [gameCategory, setGameCategory] = useState('all');

  useEffect(() => {
    if (gameCategory === 'all') {
      setFilteredGames(games);
    } else {
      setFilteredGames(games.filter(game => game.category === gameCategory));
    }
  }, [gameCategory, games])

  const handleSelectGame = (gameId: string) => {
    setCurrentGame(gameId);
  };

  // Save game results and award SUI tokens
  const handleGameComplete = async (gameId: string, score: number, extraInfo?: any) => {
    if (!walletAddress) {
      toast({
        title: "Game Completed!",
        description: `You scored ${score} points. Connect your wallet to earn rewards!`,
        duration: 5000,
      });
      setCurrentGame(null);
      return;
    }
    
    try {
      // Find the game data
      const gameData = games.find(game => {
        if (gameId === 'code-completion' && game.id === 'code-racer') return true;
        return game.id === gameId;
      });
      
      if (!gameData) {
        console.error('Game data not found:', gameId);
        return;
      }
      
      // Prepare reward data
      const xpToAward = gameData.rewards.xp;
      let suiToAward = gameData.rewards.coins;
      let awardSuiMessage = '';
      
      // Determine if we should award SUI based on game type and score
      let shouldAwardSui = false;
      let performance = 0;
      
      switch (gameId) {
        case 'code-completion':
          // Award SUI if score is above 2000
          shouldAwardSui = score >= 2000;
          performance = score / 3000; // Normalize to 0-1 range
          break;
        case 'bug-hunter':
          // Award SUI if they found at least 7 bugs
          shouldAwardSui = extraInfo?.bugsFound >= 7;
          performance = extraInfo?.bugsFound / 10; // Normalize to 0-1 range
          break;
        case 'smart-contract-puzzle':
          // Award SUI if score is above 300
          shouldAwardSui = score >= 300;
          performance = score / 500; // Normalize to 0-1 range
          break;
        case 'race-your-knowledge':
          // For RaceYourKnowledge, rewards are already handled in the component
          if (extraInfo?.rewardSuccess) {
            // We've already awarded tokens, just record it
            suiToAward = extraInfo.rewardAmount;
            awardSuiMessage = ` and ${suiToAward} SUI tokens`;
            
            // Record the token transaction - but don't trigger a state update yet
            await addDoc(collection(db, 'user_rewards'), {
              userId: walletAddress,
              amount: suiToAward,
              gameId: gameId,
              sourceName: gameData.title,
              score: score,
              txDigest: extraInfo.txDigest,
              timestamp: serverTimestamp(),
              source: 'game',
              details: {
                correctAnswers: extraInfo.correctAnswers,
                rank: extraInfo.rank
              }
            });
            
            // We'll do a single state update at the end
            shouldAwardSui = false;
          } else {
            // If the component didn't award tokens for some reason, we can handle it here
            shouldAwardSui = extraInfo?.correctAnswers >= 8;
            performance = extraInfo?.correctAnswers / 10 || 0; // Normalize to 0-1 range
          }
          break;
      }
      
      // Calculate actual SUI amount based on performance (0.5-1.0 of the max reward)
      let actualSuiReward = 0;
      let txDigest = null;
      
      if (shouldAwardSui && gameId !== 'race-your-knowledge') {
        actualSuiReward = suiToAward * (0.5 + (Math.min(1, performance) * 0.5));
        // Round to 2 decimal places
        actualSuiReward = Math.round(actualSuiReward * 100) / 100;
        
        // Award SUI tokens
        try {
          // Use the improved rewardUser function with proper source tracking
          const result = await rewardUser(
            walletAddress,
            actualSuiReward,
            `Game Reward: ${gameData.title}`,
            'game'
          );
          
          if (result.success) {
            awardSuiMessage = ` and ${actualSuiReward} SUI tokens`;
            txDigest = result.txDigest;
          } else {
            toast({
              title: "Token Award Failed",
              description: `We couldn't send your tokens: ${result.message}`,
              variant: "destructive",
              duration: 5000
            });
          }
        } catch (error) {
          console.error('Error awarding SUI tokens:', error);
        }
      }
      
      // Save game result to Firestore if not already saved by the RaceYourKnowledge component
      if (gameId !== 'race-your-knowledge' || !extraInfo?.rewardSuccess) {
        await addDoc(collection(db, 'game_results'), {
          userId: walletAddress,
          gameId: gameId,
          score: score,
          extraInfo: extraInfo,
          xpAwarded: xpToAward,
          suiAwarded: actualSuiReward,
          timestamp: serverTimestamp()
        });
        
        // If we awarded SUI tokens, record them in user_rewards
        if (actualSuiReward > 0 && txDigest) {
          await addDoc(collection(db, 'user_rewards'), {
            userId: walletAddress,
            amount: actualSuiReward,
            gameId: gameId,
            sourceName: gameData.title,
            score: score,
            txDigest: txDigest,
            timestamp: serverTimestamp(),
            source: 'game'
          });
        }
      }
      
      // Update user's gameStats document
      const normalizedGameId = gameId === 'code-completion' ? 'codeRacer' : 
                               gameId === 'bug-hunter' ? 'bugHunter' :
                               gameId === 'smart-contract-puzzle' ? 'smartContractPuzzle' :
                               'raceYourKnowledge';
      
      // For RaceYourKnowledge, the component handles updating the leaderboard
      if (gameId !== 'race-your-knowledge') {
        const userGameStatsRef = doc(db, 'leaderboard', walletAddress);
        const gameStats = {
          [`${normalizedGameId}.bestScore`]: score > (userGameStats?.[normalizedGameId]?.bestScore || 0) ? 
            score : userGameStats?.[normalizedGameId]?.bestScore || 0,
          [`${normalizedGameId}.gamesPlayed`]: (userGameStats?.[normalizedGameId]?.gamesPlayed || 0) + 1,
          [`${normalizedGameId}.lastPlayed`]: serverTimestamp(),
          [`${normalizedGameId}.progress`]: Math.min(100, ((userGameStats?.[normalizedGameId]?.progress || 0) + 20))
        };
        
        await setDoc(userGameStatsRef, gameStats, { merge: true });
      }
      
      // Update user XP
      if (userData && walletAddress && gameId !== 'race-your-knowledge') {
        // Only update XP if it wasn't already handled by the RaceYourKnowledge component
        await updateUserXp(walletAddress, xpToAward);
      }
      
      // Batch all state updates together
      if (actualSuiReward > 0 || extraInfo?.rewardSuccess) {
        // Update total earned SUI for UI - do this first so the state is ready when refreshed
        setTotalEarnedSui(prev => prev + (actualSuiReward || extraInfo?.rewardAmount || 0));
      }
      
      // Show toast notification
      toast({
        title: "Game Completed!",
        description: `You scored ${score} points and earned ${xpToAward} XP${awardSuiMessage}!`,
        duration: 5000,
      });
      
      // Refresh user data to update UI
      await refreshUserData();
      
      // Force a refresh of game stats - but only once everything else is done
      // Set this with a slight delay to prevent concurrent updates
      setTimeout(() => {
        if (walletAddress === prevWalletRef.current) {
          hasInitiallyFetchedRef.current = false;
          // Don't clear prevWalletRef to avoid duplicate fetches
        }
      }, 500);
      
    } catch (error) {
      console.error('Error saving game results:', error);
      toast({
        title: "Game Completed!",
        description: `You scored ${score} points, but there was an error saving your results.`,
        duration: 5000,
      });
    } finally {
      // Always exit the game
      setCurrentGame(null);
    }
  };

  const handleCancelGame = () => {
    setCurrentGame(null);
  };

  const handleStartChallenge = (challengeId: string) => {
    // Start the challenge based on ID
    toast({
      title: "Challenge Started",
      description: "Good luck on your challenge!",
      duration: 3000,
    });
  };

  const handleClaimReward = async (challengeId: string) => {
    if (!walletAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to claim rewards",
        duration: 3000,
      });
      return;
    }
    
    try {
      // Find the challenge
      const challenge = dailyChallenges.find(c => c.id === challengeId);
      if (!challenge) return;
      
      // Send SUI reward
      const result = await rewardUser(
        walletAddress,
        challenge.suiReward,
        `Daily Challenge Reward: ${challenge.title}`,
        'challenge'
      );
      
      if (result.success) {
        // Update challenge in Firestore
        const challengeRef = doc(db, 'daily_challenges', challengeId);
        await updateDoc(challengeRef, {
          rewardClaimed: true,
          rewardClaimedAt: serverTimestamp(),
          txDigest: result.txDigest
        });
        
        // Record the token transaction in user_rewards collection
        await addDoc(collection(db, 'user_rewards'), {
          userId: walletAddress,
          amount: challenge.suiReward,
          challengeId: challengeId,
          sourceName: challenge.title,
          txDigest: result.txDigest,
          timestamp: serverTimestamp(),
          source: 'challenge'
        });
        
        // Update user XP
        if (userData && walletAddress) {
          await updateUserXp(walletAddress, challenge.xpReward);
        }
        
        // Update total earned SUI for UI
        setTotalEarnedSui(prev => prev + challenge.suiReward);
        
        // Refresh user data to update UI immediately
        await refreshUserData();
        
        // Show toast notification
        toast({
          title: "Rewards Claimed!",
          description: `You've received ${challenge.xpReward} XP and ${challenge.suiReward} SUI tokens`,
          duration: 3000,
        });
        
        // Schedule a deferred refresh to avoid infinite loops
        setTimeout(() => {
          if (walletAddress === prevWalletRef.current) {
            hasInitiallyFetchedRef.current = false;
          }
        }, 500);
      } else {
        toast({
          title: "Token Transfer Failed",
          description: "SUI tokens couldn't be transferred. Please try again later.",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error claiming reward:', error);
      toast({
        title: "Error",
        description: "There was an error claiming your rewards. Please try again.",
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
        userXp={userStats.xp}
        userStreak={userStats.streak}
        userLevel={userStats.level}
        username={userStats.username}
        avatarSrc={userStats.avatarSrc}
      />
      
      <main className="container mx-auto pt-24 px-4 pb-20">
        {currentGame ? (
          <>
            {currentGame === 'code-completion' && (
              <CodeCompletion 
                onComplete={(score) => handleGameComplete('code-completion', score)} 
                onCancel={handleCancelGame}
              />
            )}
            {currentGame === 'bug-hunter' && (
              <BugHunter 
                onComplete={(score, bugsFound) => handleGameComplete('bug-hunter', score, {bugsFound})} 
                onCancel={handleCancelGame}
              />
            )}
            {currentGame === 'smart-contract-puzzle' && (
              <SmartContractPuzzle 
                onComplete={(score, timeLeft) => handleGameComplete('smart-contract-puzzle', score, {timeLeft})} 
                onCancel={handleCancelGame}
              />
            )}
            {currentGame === 'race-your-knowledge' && (
              <RaceYourKnowledge 
                onComplete={(score, timeUsed, extraInfo) => handleGameComplete('race-your-knowledge', score, extraInfo)} 
                onCancel={handleCancelGame}
              />
            )}
          </>
        ) : (
          <>
            <section className="text-center mb-12">
              <motion.h1 
                className="text-3xl md:text-4xl font-heading font-bold mb-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="text-gradient">SuiVerse Games</span>
              </motion.h1>
              
              <motion.p
                className="text-lg text-foreground/80 max-w-2xl mx-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                Test your Sui development skills with fun interactive games,
                earn rewards, and climb the leaderboard!
              </motion.p>
            </section>
            
            <motion.div
              className="mb-8 flex flex-col md:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <div className="w-full md:w-2/3">
                <div className="galaxy-card p-4 flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center mr-4">
                      <Trophy className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm text-foreground/70">Your Top Score</div>
                      <div className="text-2xl font-bold">{isLoading ? '...' : topScore} pts</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="h-12 w-12 rounded-full bg-secondary/20 flex items-center justify-center mr-4">
                      <Star className="h-6 w-6 text-secondary" />
                    </div>
                    <div>
                      <div className="text-sm text-foreground/70">Total Earned</div>
                      <div className="text-2xl font-bold">{isLoading ? '...' : totalEarnedSui.toFixed(2)} SUI</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center mr-4">
                      <Calendar className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <div className="text-sm text-foreground/70">Daily Challenges</div>
                      <div className="text-2xl font-bold">{isLoading ? '...' : `${completedChallenges}/${dailyChallenges.length}`}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="w-full md:w-1/3">
                <div className="galaxy-card p-4">
                  <h3 className="font-medium mb-2">Game Category</h3>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      className={`px-3 py-1 rounded-full text-sm ${gameCategory === 'all' ? 'bg-primary text-white' : 'bg-muted'}`}
                      onClick={() => setGameCategory('all')}
                    >
                      All Games
                    </button>
                    <button 
                      className={`px-3 py-1 rounded-full text-sm ${gameCategory === 'coding' ? 'bg-primary text-white' : 'bg-muted'}`}
                      onClick={() => setGameCategory('coding')}
                    >
                      Coding
                    </button>
                    <button 
                      className={`px-3 py-1 rounded-full text-sm ${gameCategory === 'debugging' ? 'bg-primary text-white' : 'bg-muted'}`}
                      onClick={() => setGameCategory('debugging')}
                    >
                      Debugging
                    </button>
                    <button 
                      className={`px-3 py-1 rounded-full text-sm ${gameCategory === 'puzzle' ? 'bg-primary text-white' : 'bg-muted'}`}
                      onClick={() => setGameCategory('puzzle')}
                    >
                      Puzzle
                    </button>
                    <button 
                      className={`px-3 py-1 rounded-full text-sm ${gameCategory === 'quiz' ? 'bg-primary text-white' : 'bg-muted'}`}
                      onClick={() => setGameCategory('quiz')}
                    >
                      Quiz
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
            
            <Tabs defaultValue="games" onValueChange={setActiveTab}>
              <TabsList className="mb-8 galaxy-card">
                <TabsTrigger value="games" className="flex gap-2 items-center">
                  <Gamepad className="h-4 w-4" />
                  Mini Games
                </TabsTrigger>
                <TabsTrigger value="daily" className="flex gap-2 items-center">
                  <Calendar className="h-4 w-4" />
                  Daily Challenges
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="games" className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredGames.map(game => (
                    <GameCard
                      key={game.id}
                      id={game.id}
                      title={game.title}
                      description={game.description}
                      image={game.image}
                      difficulty={game.difficulty}
                      progress={game.progress}
                      rewards={game.rewards}
                      highScore={game.highScore}
                      completed={game.completed}
                      onPlay={() => handleSelectGame(game.id === 'code-racer' ? 'code-completion' : 
                                                    game.id === 'bug-hunter' ? 'bug-hunter' : 
                                                    game.id === 'race-your-knowledge' ? 'race-your-knowledge' :
                                                    'smart-contract-puzzle')}
                    />
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="daily">
                <DailyChallenges 
                  challenges={dailyChallenges}
                  onStartChallenge={handleStartChallenge}
                  onClaimReward={handleClaimReward}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
};

export default Games;