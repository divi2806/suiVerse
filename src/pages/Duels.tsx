import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import NavBar from '@/components/NavBar';
import StarField from '@/components/StarField';
import DuelMode from '@/components/DuelMode';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import GameCard from '@/components/GameCard';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { 
  Rocket, 
  Trophy, 
  Gamepad, 
  Joystick, 
  Hexagon, 
  Square,
  Star,
  Wallet
} from 'lucide-react';

const Duels = () => {
  const { userData, walletAddress } = useAuth();
  const currentAccount = useCurrentAccount();
  const [connected, setConnected] = useState(false);

  // Update connection status when wallet changes
  useEffect(() => {
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
    avatarSrc: userData?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=cosmic',
    suiTokens: userData?.suiTokens || 0
  };

  const [activeSection, setActiveSection] = useState<'duels' | 'duel-game' | null>('duels');
  const { toast } = useToast();

  // Active duels and invites
  const [activeDuels] = useState([
    {
      id: 'duel-1',
      opponent: {
        username: 'BlockNinja',
        avatarSrc: 'https://api.dicebear.com/7.x/bottts/svg?seed=ninja',
        level: 6
      },
      game: 'Bug Hunter',
      score: 1450,
      opponentScore: 1200,
      timeLeft: '23h 45m',
      yourTurn: true
    },
    {
      id: 'duel-2',
      opponent: {
        username: 'CryptoWizard',
        avatarSrc: 'https://api.dicebear.com/7.x/bottts/svg?seed=wizard',
        level: 4
      },
      game: 'Code Racer',
      score: 1800,
      opponentScore: 2100,
      timeLeft: '11h 20m',
      yourTurn: false
    }
  ]);

  const handleCreateDuel = (gameId: string, stake: number, opponentId?: string) => {
    toast({
      title: "Duel Created!",
      description: `Looking for an opponent for ${gameId} with ${stake} SUI staked.`,
      duration: 5000,
    });
  };

  const handleAcceptDuel = (duelId: string) => {
    toast({
      title: "Duel Accepted!",
      description: "Prepare for the challenge!",
      duration: 3000,
    });
  };

  const handleRejectDuel = (duelId: string) => {
    toast({
      title: "Duel Rejected",
      description: "You've declined the duel request.",
      duration: 3000,
    });
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
        <section className="text-center mb-12">
          <motion.h1 
            className="text-3xl md:text-4xl font-heading font-bold mb-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-accent glow-text">Duels Arena</span>
          </motion.h1>
          
          <motion.p
            className="text-lg text-foreground/80 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            Challenge your friends to skill-based duels and prove your Sui mastery.
            Win duels to earn XP, coins, and climb the leaderboard!
          </motion.p>
        </section>
        
        <motion.div 
          className="galaxy-card p-4 flex justify-between items-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center mr-4">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="text-sm text-foreground/70">Duels Record</div>
              <div className="text-2xl font-bold">12-5</div>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-secondary/20 flex items-center justify-center mr-4">
              <Star className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <div className="text-sm text-foreground/70">Win Rate</div>
              <div className="text-2xl font-bold">71%</div>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center mr-4">
              <Wallet className="h-6 w-6 text-accent" />
            </div>
            <div>
              <div className="text-sm text-foreground/70">Available</div>
              <div className="text-2xl font-bold">{userStats.suiTokens} SUI</div>
            </div>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <DuelMode 
            userSuiTokens={userStats.suiTokens}
            onCreateDuel={handleCreateDuel}
            onAcceptDuel={handleAcceptDuel}
            onRejectDuel={handleRejectDuel}
          />
        </motion.div>
      </main>
    </div>
  );
};

export default Duels;
