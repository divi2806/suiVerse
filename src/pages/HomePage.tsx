import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StarField from '@/components/StarField';
import NavBar from '@/components/NavBar';
import { motion } from 'framer-motion';
import { Rocket, Trophy, Star, CircleCheck } from 'lucide-react';
import { useCurrentAccount, useSuiClientQuery, useDisconnectWallet } from '@mysten/dapp-kit';
import SuiWalletInfo from '@/components/SuiWalletInfo';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { handleWalletConnect, handleWalletDisconnect } from '@/utils/walletHelpers';
import OnboardingTutorialModal from '@/components/OnboardingTutorialModal';

const HomePage = () => {
  const [connected, setConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const currentAccount = useCurrentAccount();
  const { userData, refreshUserData, updateUserData, checkUserStreak } = useAuth();
  const disconnectMutation = useDisconnectWallet();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check for wallet connection on component mount
  useEffect(() => {
    if (currentAccount) {
      setConnected(true);
      setWalletAddress(currentAccount.address);
      // Refresh user data to ensure latest XP is displayed
      refreshUserData();
      
      // Check for daily streak when page loads with connected wallet
      checkUserStreak();
    } else {
      setConnected(false);
      setWalletAddress(null);
    }
  }, [currentAccount, refreshUserData, checkUserStreak]);

  // Check if we should show onboarding when userData changes
  useEffect(() => {
    if (userData && connected && userData.hasSeenOnboarding === false) {
      setShowOnboarding(true);
    }
  }, [userData, connected]);

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

  const handleConnect = (address: string) => {
    handleWalletConnect(address, (addr) => {
      setConnected(true);
      setWalletAddress(addr);
      
      // Check streak immediately after connecting
      setTimeout(() => {
        checkUserStreak();
      }, 1000);
    }, true);
  };

  // Handle wallet disconnection
  const disconnect = () => {
    setConnected(false);
    setWalletAddress(null);
  };

  const handleDisconnect = async () => {
    try {
      // Call the disconnect mutation directly
      await disconnectMutation.mutateAsync();
      
      // Notify user of successful disconnection
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected. Connect again to continue tracking progress.",
        duration: 3000,
      });
      
      // Call the disconnect callback to update local state
      disconnect();
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      toast({
        title: "Disconnection Failed",
        description: "There was a problem disconnecting your wallet.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleCloseOnboarding = async () => {
    try {
      // Update user data to ensure the onboarding is marked as seen
      if (userData) {
        // Create a clean copy of userData with hasSeenOnboarding set to true
        const updatedData = {...userData};
        updatedData.hasSeenOnboarding = true;
        
        // Remove any undefined values before updating
        Object.keys(updatedData).forEach(key => {
          if (updatedData[key] === undefined) {
            delete updatedData[key];
          }
        });
        
        await updateUserData(updatedData);
      }
      setShowOnboarding(false);
    } catch (error) {
      
      // Make sure we always close the modal even if updating data fails
      setShowOnboarding(false);
    }
  };

  // Determine user stats from wallet data or defaults
  const userStats = {
    xp: userData?.xp || 0,
    streak: userData?.streak || 0,
    level: userData?.level || 1,
    username: userData?.displayName || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Explorer'),
    avatarSrc: userData?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=cosmic'
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
        {/* Hero Section */}
        <section className="flex flex-col items-center text-center py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-6 tracking-tight">
              <span className="text-gradient">Explore the </span>
              <span className="text-primary glow-text">Sui Network</span>
              <span className="text-gradient"> Universe</span>
            </h1>
            
            <p className="text-lg md:text-xl text-foreground/80 max-w-2xl mx-auto mb-10">
              Learn blockchain development, earn rewards, and compete with friends in
              an immersive space exploration adventure
            </p>
            
            {connected ? (
              <div className="flex flex-col md:flex-row gap-4 justify-center">
                <Link to="/learning">
                  <Button size="lg" className="neon-button font-medium">
                    Start Learning
                  </Button>
                </Link>
                <Link to="/games">
                  <Button size="lg" className="neon-button-secondary font-medium">
                    Play Mini-Games
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <p className="mb-4">Connect your Sui wallet to begin your journey</p>
                <div className="flex gap-4">
                  <Button 
                    size="lg" 
                    className="neon-button font-medium px-8"
                    onClick={() => document.querySelector('.neon-button')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))}
                  >
                    Connect Wallet
                  </Button>
                </div>
              </div>
            )}

            {walletAddress && suiBalance && (
              <div className="mt-4 text-sm text-accent">
                <p>Connected to Testnet: {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}</p>
                <p>SUI Balance: {parseInt(suiBalance.totalBalance) / 1000000000} SUI</p>
              </div>
            )}
          </motion.div>
        </section>
        
        {/* Wallet Connection Section - Only show when not connected */}
        {!connected && (
          <section className="py-8">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-2xl font-heading font-bold mb-4">
                <span className="text-gradient">Connect Your Wallet to Track Progress</span>
              </h2>
              <p className="text-foreground/70 mb-6">
                Connect your Sui wallet to track your learning progress, compete on leaderboards, and earn rewards.
              </p>
              <Button 
                size="lg" 
                className="neon-button font-medium"
                onClick={() => document.querySelector('.neon-button')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))}
              >
                Connect Wallet
              </Button>
            </div>
          </section>
        )}
        
        {/* Sui Wallet Info Section - Only show when connected */}
        {connected && (
          <section className="py-8">
            <h2 className="text-2xl font-heading font-bold text-center mb-8">
              <span className="text-gradient">Your Sui Wallet</span>
            </h2>
            <div className="max-w-2xl mx-auto">
              <SuiWalletInfo />
            </div>
          </section>
        )}
        
        {/* Features Section */}
        <section className="py-16">
          <h2 className="text-3xl font-heading font-bold text-center mb-12">
            <span className="text-gradient">Master Sui Network Through Play</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <motion.div 
              className="galaxy-card p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-heading font-bold mb-2">Galaxy Learning</h3>
              <p className="text-foreground/70">
                Navigate through interactive lessons organized as galaxies. Complete challenges to progress through the Sui Network universe.
              </p>
            </motion.div>
            
            <motion.div 
              className="galaxy-card p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <div className="h-12 w-12 rounded-full bg-secondary/20 flex items-center justify-center mb-4">
                <Trophy className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="text-xl font-heading font-bold mb-2">Compete & Earn</h3>
              <p className="text-foreground/70">
                Challenge friends to duels, climb the leaderboard, and earn XP and in-game currency as you master blockchain concepts.
              </p>
            </motion.div>
            
            <motion.div 
              className="galaxy-card p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center mb-4">
                <Star className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-heading font-bold mb-2">Mini-Games</h3>
              <p className="text-foreground/70">
                Test your knowledge with fun mini-games: Code Racer, Bug Hunter, Smart Contract Puzzle, and Cyber Defense.
              </p>
            </motion.div>
          </div>
        </section>
        
        {/* Call to Action Section */}
        <section className="py-16">
          <div className="relative galaxy-card p-8 md:p-12 overflow-hidden">
            <div className="star-bg"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center">
              <div className="mb-6 md:mb-0 md:mr-8">
                <h2 className="text-2xl md:text-3xl font-heading font-bold mb-4">Ready to explore the cosmos?</h2>
                <p className="text-foreground/70 max-w-md">
                  Start your journey through the Sui Network galaxy. Connect your wallet and begin earning rewards while mastering blockchain.
                </p>
                
                <div className="mt-6 flex flex-wrap gap-4">
                  <div className="flex items-center">
                    <CircleCheck className="h-5 w-5 text-secondary mr-2" />
                    <span className="text-sm">Daily rewards</span>
                  </div>
                  <div className="flex items-center">
                    <CircleCheck className="h-5 w-5 text-secondary mr-2" />
                    <span className="text-sm">Collectible badges</span>
                  </div>
                  <div className="flex items-center">
                    <CircleCheck className="h-5 w-5 text-secondary mr-2" />
                    <span className="text-sm">XP leaderboard</span>
                  </div>
                </div>
              </div>
              
              <div>
                {connected ? (
                  <Link to="/learning">
                    <Button size="lg" className="neon-button">
                      Launch Journey
                    </Button>
                  </Link>
                ) : (
                  <Button 
                    size="lg" 
                    className="neon-button"
                    onClick={() => document.querySelector('.neon-button')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))}
                  >
                    Connect Wallet
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      
      {/* Onboarding modal for first-time users */}
      <OnboardingTutorialModal 
        isOpen={showOnboarding} 
        onClose={handleCloseOnboarding} 
      />
    </div>
  );
};

export default HomePage; 