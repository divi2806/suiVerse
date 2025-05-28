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
import { completeChallengeAndClaimRewards, updateChallengeProgress, DailyChallenge, ChallengeType } from '@/services/dailyChallengesService';

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
  }, [currentAccount, connected, walletAddress]);

  // Consolidated data fetching effect - only runs when wallet or userData changes
  useEffect(() => {
    // Fetch user stats when wallet changes
    if (walletAddress && !isFetchingRef.current && 
        (!hasInitiallyFetchedRef.current || walletAddress !== prevWalletRef.current)) {
      // Force fetch any time wallet changes
      fetchStats();
    }
  }, [walletAddress, userData?.suiTokens, db]);

  // State for daily challenges
  const [dailyChallenges, setDailyChallenges] = useState<DailyChallenge[]>([]);
  
  // Ref to keep track of current challenges
  const challengesRef = useRef<DailyChallenge[]>([]);
  
  // Update ref when dailyChallenges changes
  useEffect(() => {
    challengesRef.current = dailyChallenges;
  }, [dailyChallenges]);

  // Load daily challenges
  useEffect(() => {
    const fetchDailyChallenges = async () => {
      
      
      if (!walletAddress) {
        
        setDailyChallenges([]);
        return;
      }
      
      try {
        
        // Get challenges from our service
        const challenges = await import('@/services/dailyChallengesService')
          .then(module => module.getUserDailyChallenges(walletAddress));
        
        
        
        // For development: Override with test challenges if needed
        if (process.env.NODE_ENV === 'development' && window.location.search.includes('test_challenge')) {
          const { testConceptReviewChallenge } = await import('@/services/hardcodedChallenges');
          
          // Extract the challenge type from URL params if specified
          const urlParams = new URLSearchParams(window.location.search);
          const testType = urlParams.get('test_challenge');
          
          if (testType === 'concept_review') {
            // Create a test concept review challenge
            const testChallenge: DailyChallenge = {
              id: `concept_review-test-${Date.now()}`,
              title: "Test Concept Review Challenge",
              description: "This is a test concept review challenge for development",
              type: 'concept_review' as ChallengeType,
              content: testConceptReviewChallenge,
              difficulty: 'medium',
              xpReward: 100,
              suiReward: 0.1,
              tokenReward: 0.1,
              dateCreated: new Date(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              completed: false,
              progress: 0
            };
            
            setDailyChallenges([testChallenge]);
            
            return;
          }
        }
        
        setDailyChallenges(challenges);
      } catch (error) {
        
        setDailyChallenges([]);
      }
    };

    if (walletAddress) {
      fetchDailyChallenges();
      
      // Set up a timer to check for expired challenges
      const checkExpiredInterval = setInterval(() => {
        const now = new Date();
        // If any challenge is expired, refresh the challenges
        if (challengesRef.current.some(challenge => challenge.expiresAt && 
            (challenge.expiresAt instanceof Date ? challenge.expiresAt < now : 
             challenge.expiresAt.toDate() < now))) {
          fetchDailyChallenges();
        }
      }, 60000); // Check every minute
      
      return () => clearInterval(checkExpiredInterval);
    }
  }, [walletAddress]);

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
    // This function is now handled by DailyChallenges component directly
    // It's only needed for backwards compatibility
    
  };
  
  const handleClaimReward = async (challengeId: string) => {
    if (!walletAddress) return;
    
    try {
      
      
      // Refresh user data to show updated balances
      if (refreshUserData) {
        await refreshUserData();
      }
      
      // Refresh challenges list
      const challenges = await import('@/services/dailyChallengesService')
        .then(module => module.getUserDailyChallenges(walletAddress));
      setDailyChallenges(challenges);
      
      // Refresh stats
      fetchStats();
    } catch (error) {
      
    }
  };

  // Add the fetchStats function
  const fetchStats = async () => {
    if (isFetchingRef.current) return; // Prevent concurrent fetch operations
    
    try {
      isFetchingRef.current = true;
      setIsLoading(true);
      
      
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
      
      // Get completed challenges count by checking completed challenges in the daily challenges
      let completedCount = 0;
      try {
        const challenges = await import('@/services/dailyChallengesService')
          .then(module => module.getUserDailyChallenges(walletAddress));
        
        completedCount = challenges.filter(c => c.completed).length;
      } catch (error) {
        
      }
      
      // If we don't have any transaction data but user has SUI tokens in their profile,
      // use that as a fallback
      if (totalSui === 0 && userData?.suiTokens) {
        totalSui = userData.suiTokens;
      }
      
      
      
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
      
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
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
                {/* Add debug information about challenges */}
                {process.env.NODE_ENV === 'development' && dailyChallenges.length > 0 && (
                  <div className="mb-4 p-2 bg-yellow-500/10 text-yellow-500 text-xs rounded border border-yellow-500/30">
                    <div>Debug Info - Challenge Types:</div>
                    <ul className="list-disc pl-5">
                      {dailyChallenges.map((challenge, idx) => (
                        <li key={idx}>
                          Challenge {idx+1}: {challenge.type} - {challenge.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <DailyChallenges 
                  challenges={dailyChallenges}
                  onStartChallenge={handleStartChallenge}
                  onClaimReward={handleClaimReward}
                  walletAddress={walletAddress}
                  userId={walletAddress}
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