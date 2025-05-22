import React, { useState, useRef } from 'react';
import NavBar from '@/components/NavBar';
import StarField from '@/components/StarField';
import BlazoChat, { BlazoChatHandle } from '@/components/BlazoChat';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Bot, Sparkles, Rocket, FileCode2, Database } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Blazo = () => {
  const { userData, walletAddress } = useAuth();
  const currentAccount = useCurrentAccount();
  const [connected, setConnected] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const blazoChatRef = useRef<BlazoChatHandle>(null);

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
    avatarSrc: userData?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=cosmic',
    suiTokens: userData?.suiTokens || 0
  };

  // Function to handle example prompt clicks
  const handleExampleClick = (prompt: string) => {
    // Set the text in the textarea
    if (textareaRef.current) {
      textareaRef.current.value = prompt;
      
      // Dispatch input event to trigger React's onChange
      const inputEvent = new Event('input', { bubbles: true });
      textareaRef.current.dispatchEvent(inputEvent);
    }
    
    // Send the prompt directly via the BlazoChat reference
    if (blazoChatRef.current) {
      blazoChatRef.current.sendPrompt(prompt);
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
      
      <main className="container mx-auto pt-20 px-4 pb-10 min-h-screen">
        <section className="mb-4">
          <motion.div
            className="text-center space-y-2"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-block relative">
              <h1 className="text-3xl md:text-4xl font-heading font-bold relative z-10">
                <span className="text-gradient">Blazo <span className="relative">
                  AI<span className="absolute -top-1 -right-1 text-xs text-blue-300">β</span>
                </span></span>
              </h1>
              <div className="absolute -bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 blur-sm"></div>
            </div>
            <p className="text-lg text-foreground/80 max-w-2xl mx-auto">
              Your AI sidekick for Move smart contract development
            </p>
          </motion.div>
        </section>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 min-h-[80vh]">
          {/* Main Chat Interface */}
          <motion.div 
            className="md:col-span-8 lg:col-span-9 galaxy-card overflow-hidden flex flex-col h-[95vh]"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="h-full">
              <BlazoChat ref={blazoChatRef} textareaRef={textareaRef} />
            </div>
          </motion.div>
          
          {/* Sidebar */}
          <motion.div 
            className="md:col-span-4 lg:col-span-3 space-y-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {/* Info Card */}
            <div className="galaxy-card p-5 border-primary/20 space-y-4">
              <h2 className="text-xl font-heading font-bold flex items-center">
                <Bot className="h-5 w-5 text-primary mr-2" />
                Meet Blazo
              </h2>
              
              <div className="p-4 bg-primary/5 rounded-lg relative overflow-hidden">
                <div className="relative z-10">
                  <div className="w-20 h-20 mx-auto mb-3 bg-primary/10 rounded-full p-1 border border-primary/20">
                    <div className="w-full h-full rounded-full overflow-hidden">
                      <img 
                        src="https://api.dicebear.com/7.x/bottts/svg?seed=blazo&backgroundColor=2563eb&eyes=bulging" 
                        alt="Blazo" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  
                  <p className="text-center text-sm text-foreground/80 mb-3">
                    I'm your AI assistant for building Move smart contracts. Let me help you code on the Sui blockchain!
                  </p>
                  
                  <div className="flex justify-around text-xs">
                    <span className="flex items-center">
                      <Sparkles className="h-3 w-3 text-yellow-400 mr-1" />
                      Brainstorming
                    </span>
                    <span className="flex items-center">
                      <FileCode2 className="h-3 w-3 text-green-400 mr-1" />
                      Code Generation
                    </span>
                  </div>
                </div>
                <div className="absolute inset-0 level-up-stars opacity-10"></div>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-sm font-medium">What I can help with:</h3>
                <ul className="space-y-2 text-sm text-foreground/80">
                  <li className="flex items-start">
                    <Rocket className="h-4 w-4 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span>Generate complete Sui Move smart contracts</span>
                  </li>
                  <li className="flex items-start">
                    <Database className="h-4 w-4 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span>Create on-chain storage and data models</span>
                  </li>
                  <li className="flex items-start">
                    <Bot className="h-4 w-4 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span>Explain Move concepts and code functionality</span>
                  </li>
                </ul>
              </div>
            </div>
            
            {/* Examples Card */}
            <div className="galaxy-card p-5 border-primary/20">
              <h2 className="text-sm font-medium mb-3">Try asking Blazo:</h2>
              <div className="space-y-2 text-xs">
                <div 
                  className="p-2 bg-primary/5 rounded hover:bg-primary/10 transition-colors cursor-pointer"
                  onClick={() => handleExampleClick("Create a smart contract for a decentralized voting system")}
                >
                  "Create a smart contract for a decentralized voting system"
                </div>
                <div 
                  className="p-2 bg-primary/5 rounded hover:bg-primary/10 transition-colors cursor-pointer"
                  onClick={() => handleExampleClick("Make a token that has a built-in tax for each transfer")}
                >
                  "Make a token that has a built-in tax for each transfer"
                </div>
                <div 
                  className="p-2 bg-primary/5 rounded hover:bg-primary/10 transition-colors cursor-pointer"
                  onClick={() => handleExampleClick("Generate a simple NFT marketplace with bidding")}
                >
                  "Generate a simple NFT marketplace with bidding"
                </div>
              </div>
            </div>
            
            {/* XP Info */}
            {connected && (
              <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg p-4 border border-blue-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Blazo XP Rewards</span>
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                </div>
                <p className="text-xs text-foreground/80 mb-3">
                  Earn XP for generating smart contracts with Blazo!
                </p>
                <div className="bg-background/30 backdrop-blur-sm rounded p-2 text-xs">
                  <div className="flex justify-between">
                    <span>Generate contract</span>
                    <span className="font-medium">+15 XP</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Deploy on-chain</span>
                    <span className="font-medium">+50 XP</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Blazo; 