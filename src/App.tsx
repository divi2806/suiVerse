import React, { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import NotFound from "./pages/NotFound";
import Learning from "./pages/Learning";
import Games from "./pages/Games";
import Duels from "./pages/Duels";
import Rewards from "./pages/Rewards";
import Leaderboard from "./pages/Leaderboard";
import ModulePage from "./pages/ModulePage";
import Profile from "./pages/Profile";
import Inventory from "./pages/Inventory";
import Settings from "./pages/Settings";
import Blazo from "./pages/Blazo";
import { SuiClientProvider, WalletProvider as SuiWalletProvider } from '@mysten/dapp-kit';
import { networkConfig, defaultNetwork } from './lib/sui-config';
import '@mysten/dapp-kit/dist/index.css';
import WalletProvider from "./contexts/AuthContext";
import NavBar from './components/NavBar';
import WalletConnect from './components/WalletConnect';
import AuthProvider from './contexts/AuthContext';
import StarField from './components/StarField';
import ModuleCompletionPopup from './components/ModuleCompletionPopup';
import DailyStreakModal from './components/DailyStreakModal';
import LevelUpCelebration from './components/LevelUpCelebration';
import { initializeGalaxiesMetadata } from '@/services/learningService';
import Admin from '@/pages/Admin';
import '@/utils/devTools'; // Import devTools to expose to window

const queryClient = new QueryClient();

const App = () => {
  // State for module completion popup
  const [moduleCompletionData, setModuleCompletionData] = useState<{
    isOpen: boolean;
    moduleId: number;
    moduleName: string;
    walletAddress: string;
    xpEarned: number;
    suiEarned: number;
    quizScore?: number;
    correctAnswers?: number;
    totalQuestions?: number;
  }>({
    isOpen: false,
    moduleId: 0,
    moduleName: '',
    walletAddress: '',
    xpEarned: 0,
    suiEarned: 0
  });

  // Add state for user data
  const [userData, setUserData] = useState({
    connected: false,
    userXp: 0,
    userStreak: 0,
    userLevel: 1,
    username: 'Guest',
    avatarSrc: '',
    walletAddress: ''
  });

  // Handle wallet connection
  const handleConnect = (address: string) => {
    setUserData(prev => ({
      ...prev,
      connected: true,
      walletAddress: address,
      username: `${address.slice(0, 6)}...${address.slice(-4)}`
    }));
  };

  // Handle wallet disconnection
  const handleDisconnect = () => {
    setUserData(prev => ({
      ...prev,
      connected: false,
      walletAddress: ''
    }));
  };

  // Function to show module completion popup
  const showModuleCompletionPopup = (data: {
    moduleId: number;
    moduleName: string;
    walletAddress: string;
    xpEarned: number;
    suiEarned: number;
    quizScore?: number;
    correctAnswers?: number;
    totalQuestions?: number;
  }) => {
    setModuleCompletionData({
      isOpen: true,
      ...data
    });
  };

  // Function to close module completion popup
  const closeModuleCompletionPopup = () => {
    setModuleCompletionData(prev => ({
      ...prev,
      isOpen: false
    }));
  };

  // Handle navigation to learning page
  const handleReturnToMap = () => {
    window.location.href = '/learning';
  };

  // Make the showModuleCompletionPopup function available globally
  useEffect(() => {
    
    // @ts-ignore
    window.showModuleCompletionPopup = showModuleCompletionPopup;
    
    // Also attach as a direct property for when TypeScript is not aware
    const win = window as any;
    win.showModuleCompletionPopup = showModuleCompletionPopup;

    // Debug: Add a test function
    const testPopup = () => {
      // Get the current wallet address from userData instead of using a test address
      const walletAddress = userData.walletAddress || 'test-wallet';
      
      if (walletAddress === 'test-wallet') {
        console.warn('[NFT] Warning: Using test wallet address. Connect a real wallet for NFT minting.');
      }
      
      showModuleCompletionPopup({
        moduleId: 2, // Use module 2 for testing
        moduleName: 'Sui Move Basics',
        walletAddress: walletAddress,
        xpEarned: 200,
        suiEarned: 0.5,
        quizScore: 85,
        correctAnswers: 17,
        totalQuestions: 20
      });
    };
    win.testModulePopup = testPopup;
    
    return () => {
      
      // @ts-ignore
      delete window.showModuleCompletionPopup;
      delete win.showModuleCompletionPopup;
      delete win.testModulePopup;
    };
  }, [userData.walletAddress]); // Add userData.walletAddress as a dependency

  // Add event listener for moduleCompleted custom event
  useEffect(() => {
    const handleModuleCompleted = (event: CustomEvent) => {
      
      showModuleCompletionPopup(event.detail);
    };
    
    document.addEventListener('moduleCompleted', handleModuleCompleted as EventListener);
    
    return () => {
      document.removeEventListener('moduleCompleted', handleModuleCompleted as EventListener);
    };
  }, []);

  // Add event listener for forceModulePopup custom event
  useEffect(() => {
    const handleForcePopup = (event: CustomEvent) => {
      
      setModuleCompletionData({
        isOpen: true,
        ...event.detail
      });
    };
    
    document.addEventListener('forceModulePopup', handleForcePopup as EventListener);
    
    return () => {
      document.removeEventListener('forceModulePopup', handleForcePopup as EventListener);
    };
  }, []);

  // Initialize galaxy metadata when app loads
  useEffect(() => {
    const initializeData = async () => {
      try {
        await initializeGalaxiesMetadata();
      } catch (error) {
        console.error("[App] Error initializing galaxy metadata:", error);
      }
    };
    
    initializeData();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={defaultNetwork}>
        <SuiWalletProvider>
          <WalletProvider>
            <TooltipProvider>
              <AuthProvider>
                <Router>
                  <div className="min-h-screen bg-background text-foreground">
                    <StarField />
                    <NavBar 
                      connected={userData.connected}
                      onConnect={handleConnect}
                      onDisconnect={handleDisconnect}
                    />
                    <main className="container mx-auto py-4 px-4 relative z-10">
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/learning" element={<Learning />} />
                        <Route path="/learning/:moduleId" element={<ModulePage />} />
                        <Route path="/games" element={<Games />} />
                        <Route path="/games/:gameId" element={<Games />} />
                        <Route path="/duels" element={<Duels />} />
                        <Route path="/duels/:duelId" element={<Duels />} />
                        <Route path="/rewards" element={<Rewards />} />
                        <Route path="/store" element={<Rewards />} />
                        <Route path="/leaderboard" element={<Leaderboard />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/inventory" element={<Inventory />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/blazo" element={<Blazo />} />
                        <Route path="/admin" element={<Admin />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </main>
                    <WalletConnect 
                      onConnect={handleConnect}
                      onDisconnect={handleDisconnect}
                    />
                    <Toaster />
                    
                    {/* Module Completion Popup */}
                    <ModuleCompletionPopup
                      isOpen={moduleCompletionData.isOpen}
                      onClose={closeModuleCompletionPopup}
                      moduleId={moduleCompletionData.moduleId}
                      moduleName={moduleCompletionData.moduleName}
                      walletAddress={moduleCompletionData.walletAddress}
                      xpEarned={moduleCompletionData.xpEarned}
                      suiEarned={moduleCompletionData.suiEarned}
                      quizScore={moduleCompletionData.quizScore}
                      correctAnswers={moduleCompletionData.correctAnswers}
                      totalQuestions={moduleCompletionData.totalQuestions}
                      onReturnToMap={handleReturnToMap}
                    />
                    
                    {/* Daily Streak Modal - available globally */}
                    <DailyStreakModal />
                    
                    {/* Level Up Celebration - available globally */}
                    <LevelUpCelebration />
                  </div>
                </Router>
              </AuthProvider>
            </TooltipProvider>
          </WalletProvider>
        </SuiWalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
};

export default App;
