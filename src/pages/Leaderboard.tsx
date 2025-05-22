import React, { useState } from 'react';
import NavBar from '@/components/NavBar';
import LeaderboardTable from '@/components/LeaderboardTable';
import StarField from '@/components/StarField';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from 'framer-motion';
import { Trophy, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentAccount } from '@mysten/dapp-kit';

const Leaderboard = () => {
  const { userData, walletAddress } = useAuth();
  const currentAccount = useCurrentAccount();
  const [connected, setConnected] = useState(!!currentAccount);

  // Update connection status when wallet changes
  React.useEffect(() => {
    setConnected(!!currentAccount);
  }, [currentAccount]);

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
    avatarSrc: userData?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=cosmic'
  };

  // Simulated leaderboard data
  const generateLeaderboardData = (currentUserRank: number) => {
    const names = [
      'GalacticCoder', 'NebulaNinja', 'StarDust', 'VoidWalker', 
      'CosmicExplorer', 'QuantumByte', 'SolarFlare', 'AstroHacker',
      'MoonRider', 'OrbitalDev', 'StellarMind', 'SuperNova',
      'CryptoWizard', 'BlockMaster', 'TokenHunter', 'ChainRanger'
    ];
    
    const players = Array(15).fill(0).map((_, idx) => {
      const rank = idx + 1;
      const isCurrentUser = rank === currentUserRank;
      const name = isCurrentUser ? userStats.username : names[idx >= 4 ? idx + 1 : idx];
      
      return {
        rank,
        username: name,
        avatarUrl: isCurrentUser ? userStats.avatarSrc : `https://api.dicebear.com/7.x/bottts/svg?seed=${name.toLowerCase()}`,
        level: isCurrentUser ? userStats.level : Math.floor(Math.random() * 10) + 1,
        experience: isCurrentUser ? userStats.xp : Math.floor((16 - rank) * 1000 * (Math.random() * 0.5 + 0.75)),
        streak: isCurrentUser ? userStats.streak : Math.floor(Math.random() * 30) + 1,
        completedGames: Math.floor(Math.random() * 50) + 10,
        isCurrentUser
      };
    });
    
    // Sort by XP
    return players.sort((a, b) => b.experience - a.experience);
  };

  const [weeklyLeaderboard] = useState(generateLeaderboardData(5));
  const [monthlyLeaderboard] = useState(generateLeaderboardData(8));
  const [allTimeLeaderboard] = useState(generateLeaderboardData(12));
  
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
            <span className="text-gradient">Space Explorer Leaderboard</span>
          </motion.h1>
          
          <motion.p
            className="text-lg text-foreground/80 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            See who's leading the mission to master the Sui Network.
            Earn XP, maintain streaks, and climb the ranks!
          </motion.p>
        </section>
        
        {/* Top Explorers Showcase */}
        <motion.section 
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 2nd place */}
            <div className="galaxy-card p-6 text-center order-2 md:order-1">
              <div className="w-20 h-20 mx-auto bg-gray-400/20 rounded-full flex items-center justify-center mb-4">
                <Trophy className="h-10 w-10 text-gray-300" />
              </div>
              
              <div className="inline-block bg-gray-500/20 px-3 py-1 rounded-full mb-2">
                <span className="text-gray-300 font-medium">#2</span>
              </div>
              
              <div className="flex justify-center mb-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-gray-300/10 rounded-full animate-pulse"></div>
                  <img 
                    src={weeklyLeaderboard[1].avatarUrl} 
                    alt={weeklyLeaderboard[1].username} 
                    className="w-16 h-16 rounded-full border-2 border-gray-300"
                  />
                </div>
              </div>
              
              <h3 className="text-lg font-medium mb-1">
                {weeklyLeaderboard[1].username}
              </h3>
              <p className="text-sm text-foreground/70 mb-2">Level {weeklyLeaderboard[1].level}</p>
              
              <div className="flex items-center justify-center">
                <Star className="h-4 w-4 text-accent mr-1" />
                <span className="font-mono">{weeklyLeaderboard[1].experience.toLocaleString()} XP</span>
              </div>
            </div>
            
            {/* 1st place */}
            <div className="galaxy-card border-2 border-yellow-500/30 p-6 text-center order-1 md:order-2">
              <div className="w-20 h-20 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center mb-4">
                <Trophy className="h-10 w-10 text-yellow-400" />
              </div>
              
              <div className="inline-block bg-yellow-500/20 px-3 py-1 rounded-full mb-2">
                <span className="text-yellow-400 font-medium">#1</span>
              </div>
              
              <div className="flex justify-center mb-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-yellow-400/20 rounded-full animate-pulse"></div>
                  <img 
                    src={weeklyLeaderboard[0].avatarUrl} 
                    alt={weeklyLeaderboard[0].username} 
                    className="w-20 h-20 rounded-full border-2 border-yellow-400"
                  />
                </div>
              </div>
              
              <h3 className="text-xl font-bold mb-1">
                {weeklyLeaderboard[0].username}
              </h3>
              <p className="text-sm text-foreground/70 mb-2">Level {weeklyLeaderboard[0].level}</p>
              
              <div className="flex items-center justify-center">
                <Star className="h-4 w-4 text-accent mr-1" />
                <span className="font-mono font-medium">{weeklyLeaderboard[0].experience.toLocaleString()} XP</span>
              </div>
            </div>
            
            {/* 3rd place */}
            <div className="galaxy-card p-6 text-center order-3">
              <div className="w-20 h-20 mx-auto bg-amber-600/20 rounded-full flex items-center justify-center mb-4">
                <Trophy className="h-10 w-10 text-amber-500" />
              </div>
              
              <div className="inline-block bg-amber-600/20 px-3 py-1 rounded-full mb-2">
                <span className="text-amber-500 font-medium">#3</span>
              </div>
              
              <div className="flex justify-center mb-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-amber-500/10 rounded-full animate-pulse"></div>
                  <img 
                    src={weeklyLeaderboard[2].avatarUrl} 
                    alt={weeklyLeaderboard[2].username} 
                    className="w-16 h-16 rounded-full border-2 border-amber-500"
                  />
                </div>
              </div>
              
              <h3 className="text-lg font-medium mb-1">
                {weeklyLeaderboard[2].username}
              </h3>
              <p className="text-sm text-foreground/70 mb-2">Level {weeklyLeaderboard[2].level}</p>
              
              <div className="flex items-center justify-center">
                <Star className="h-4 w-4 text-accent mr-1" />
                <span className="font-mono">{weeklyLeaderboard[2].experience.toLocaleString()} XP</span>
              </div>
            </div>
          </div>
        </motion.section>
        
        {/* Leaderboard Tabs */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <Tabs defaultValue="weekly">
            <div className="flex justify-center mb-6">
              <TabsList className="bg-card border border-primary/20">
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="all-time">All Time</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="weekly">
              <LeaderboardTable players={weeklyLeaderboard} />
            </TabsContent>
            
            <TabsContent value="monthly">
              <LeaderboardTable players={monthlyLeaderboard} />
            </TabsContent>
            
            <TabsContent value="all-time">
              <LeaderboardTable players={allTimeLeaderboard} />
            </TabsContent>
          </Tabs>
        </motion.section>
      </main>
    </div>
  );
};

export default Leaderboard;
