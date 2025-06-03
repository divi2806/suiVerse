import React, { useState, useEffect, useCallback } from 'react';
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
  Wallet,
  Gift,
  Package,
  Gem,
  Eye,
  ExternalLink,
  Loader2,
  ShoppingCart
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/use-toast';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, Timestamp, addDoc, increment, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import CosmeticsStore from '@/components/CosmeticsStore';
import { sendSuiReward } from '@/services/suiPaymentService';
import { rewardUser } from '@/services/userRewardsService';
import EnhancedMysteryBox from '@/components/EnhancedMysteryBox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import MysteryBox from '@/components/MysteryBox';

interface NFTItem {
  id: string;
  name: string;
  description: string;
  image: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  acquiredDate: Date;
  type: 'badge' | 'collectible' | 'avatar' | 'mystery';
}

interface TokenItem {
  id: string;
  name: string;
  symbol: string;
  amount: number;
  iconUrl: string;
}

interface MysteryBox {
  id: string;
  name: string;
  description: string;
  acquiredDate: Date;
  image: string;
  rarity: 'common' | 'rare' | 'epic';
}

const Inventory = () => {
  const [connected, setConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const currentAccount = useCurrentAccount();
  const { userData, refreshUserData, updateUserData, updateAvatar } = useAuth();
  const disconnectMutation = useDisconnectWallet();
  
  // State for real-time data
  const [nftItems, setNftItems] = useState<NFTItem[]>([]);
  const [tokenItems, setTokenItems] = useState<TokenItem[]>([]);
  const [mysteryBoxes, setMysteryBoxes] = useState<MysteryBox[]>([]);
  const [activeTab, setActiveTab] = useState("nfts");
  const [loading, setLoading] = useState({
    nfts: true,
    tokens: true,
    mysteryBoxes: true
  });
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  
  // Add these to the component state
  const [selectedMysteryBox, setSelectedMysteryBox] = useState<MysteryBox | null>(null);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  
  // Check for wallet connection on component mount
  useEffect(() => {
    if (currentAccount) {
      setConnected(true);
      setWalletAddress(currentAccount.address);
    } else {
      setConnected(false);
      setWalletAddress(null);
    }
  }, [currentAccount]);

  // Handle wallet connection
  const handleConnect = useCallback((address: string) => {
    handleWalletConnect(address, (addr) => {
      setConnected(true);
      setWalletAddress(addr);
    }, true);
  }, []);

  // Handle wallet disconnection
  const disconnect = useCallback(() => {
    setConnected(false);
    setWalletAddress(null);
  }, []);

  const handleDisconnect = useCallback(async () => {
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
  }, [disconnectMutation, disconnect]);

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

  // Handle tab change to refresh data when coming back from store
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    
    // If returning from cosmetics store to NFTs tab, refresh NFT data
    if (value === "nfts" && activeTab === "cosmetics-store") {
      fetchNFTs();
    }
  };

  // Fetch user NFTs from Firestore
  const fetchNFTs = async () => {
    if (!walletAddress) return;
    
    try {
      setLoading(prev => ({ ...prev, nfts: true }));
      
      // Fetch regular NFTs
      const nftsQuery = query(
        collection(db, 'user_nfts'),
        where('userId', '==', walletAddress)
      );
      
      const nftsSnapshot = await getDocs(nftsQuery);
      const nftsData: NFTItem[] = [];
      
      nftsSnapshot.forEach(doc => {
        const data = doc.data();
        nftsData.push({
          id: doc.id,
          name: data.name,
          description: data.description,
          image: data.imageUrl,
          rarity: data.rarity || 'common',
          acquiredDate: data.acquiredAt?.toDate() || new Date(),
          type: data.type || 'collectible'
        });
      });
      
      // Fetch module achievement NFTs
      const moduleNftsQuery = query(
        collection(db, 'user_nfts'),
        where('walletAddress', '==', walletAddress)
      );
      
      const moduleNftsSnapshot = await getDocs(moduleNftsQuery);
      
      moduleNftsSnapshot.forEach(doc => {
        const data = doc.data();
        // Only add if not already in the array (avoid duplicates)
        if (!nftsData.some(nft => nft.id === doc.id)) {
          nftsData.push({
            id: doc.id,
            name: data.moduleName || `Module ${data.moduleId} Achievement`,
            description: data.description || `Achievement NFT for completing module ${data.moduleId}`,
            image: data.imageUrl,
            rarity: 'rare', // Achievement NFTs are rare by default
            acquiredDate: data.timestamp?.toDate() || new Date(),
            type: 'badge'
          });
        }
      });
      
      setNftItems(nftsData);
      setLoading(prev => ({ ...prev, nfts: false }));
    } catch (error) {
      
      setLoading(prev => ({ ...prev, nfts: false }));
    }
  };

  // Call fetchNFTs when wallet address changes
  useEffect(() => {
    fetchNFTs();
  }, [walletAddress]);

  // Fetch user tokens from Firestore
  useEffect(() => {
    const fetchTokens = async () => {
      if (!walletAddress) return;
      
      try {
        setLoading(prev => ({ ...prev, tokens: true }));
        const tokensRef = doc(db, 'user_tokens', walletAddress);
        const tokensDoc = await getDoc(tokensRef);
        
        if (tokensDoc.exists()) {
          const tokensData = tokensDoc.data();
          const formattedTokens: TokenItem[] = [];
          
          // Add SUI token
          formattedTokens.push({
            id: 'sui',
            name: 'Sui',
            symbol: 'SUI',
            amount: userData?.suiTokens || 0,
            iconUrl: 'https://cryptologos.cc/logos/sui-sui-logo.png'
          });
          
          // Add any other tokens from the document (except LP)
          if (tokensData.otherTokens) {
            tokensData.otherTokens.forEach((token: any) => {
              if (token.symbol !== 'LP') {
                formattedTokens.push({
                  id: token.id,
                  name: token.name,
                  symbol: token.symbol,
                  amount: token.amount,
                  iconUrl: token.iconUrl
                });
              }
            });
          }
          
          setTokenItems(formattedTokens);
        } else {
          // If no tokens document exists, create default tokens (just SUI)
          setTokenItems([
            {
              id: 'sui',
              name: 'Sui',
              symbol: 'SUI',
              amount: userData?.suiTokens || 0,
              iconUrl: 'https://cryptologos.cc/logos/sui-sui-logo.png'
            }
          ]);
        }
        
        setLoading(prev => ({ ...prev, tokens: false }));
      } catch (error) {
        
        setLoading(prev => ({ ...prev, tokens: false }));
      }
    };
    
    fetchTokens();
  }, [walletAddress, userData]);

  // Fetch mystery boxes from Firestore
  useEffect(() => {
    const fetchMysteryBoxes = async () => {
      if (!walletAddress) return;
      
      try {
        setLoading(prev => ({ ...prev, mysteryBoxes: true }));
        const boxesQuery = query(
          collection(db, 'mystery_boxes'),
          where('userId', '==', walletAddress),
          where('opened', '==', false)
        );
        
        const boxesSnapshot = await getDocs(boxesQuery);
        const boxesData: MysteryBox[] = [];
        
        boxesSnapshot.forEach(doc => {
          const data = doc.data();
          boxesData.push({
            id: doc.id,
            name: data.name,
            description: data.description,
            acquiredDate: data.acquiredAt?.toDate() || new Date(),
            image: `https://api.dicebear.com/7.x/shapes/svg?seed=mysterybox${data.rarity}`,
            rarity: data.rarity
          });
        });
        
        setMysteryBoxes(boxesData);
        setLoading(prev => ({ ...prev, mysteryBoxes: false }));
      } catch (error) {
        
        setLoading(prev => ({ ...prev, mysteryBoxes: false }));
      }
    };
    
    fetchMysteryBoxes();
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

  // Helper function to safely format dates
  const formatDate = (date: Date | undefined): string => {
    return date instanceof Date ? date.toLocaleDateString() : 'Unknown date';
  };

  // Function to get color based on rarity
  const getRarityColor = (rarity: NFTItem['rarity']) => {
    switch (rarity) {
      case 'common':
        return 'text-gray-400';
      case 'uncommon':
        return 'text-green-400';
      case 'rare':
        return 'text-blue-400';
      case 'epic':
        return 'text-purple-400';
      case 'legendary':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  // Function to handle mystery box opening
  const handleOpenMysteryBox = async (boxId: string, boxRarity: MysteryBox['rarity']) => {
    if (!walletAddress) return;
    
    try {
      // Get the mystery box document
      const boxRef = doc(db, 'mystery_boxes', boxId);
      const boxDoc = await getDoc(boxRef);
      
      if (!boxDoc.exists()) {
        toast({
          title: "Error",
          description: "Mystery box not found.",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
      
      const boxData = boxDoc.data() as MysteryBox & { boxType?: string };
      
      // Set the selected box and show dialog
      setSelectedMysteryBox({
        ...boxData,
        id: boxId,
        rarity: boxRarity,
        name: boxData.name || `${boxRarity.charAt(0).toUpperCase() + boxRarity.slice(1)} Mystery Box`,
        description: boxData.description || 'A mystery box containing valuable rewards',
        acquiredDate: boxData.acquiredDate instanceof Timestamp ? 
                      boxData.acquiredDate.toDate() : 
                      (boxData.acquiredDate || new Date()),
        image: boxData.image || `https://api.dicebear.com/7.x/shapes/svg?seed=${boxRarity}Box`,
      });
      
      setShowOpenDialog(true);
    } catch (error) {
      
      toast({
        title: "Error",
        description: "Failed to open mystery box. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };
  
  // Callback for when rewards are generated by EnhancedMysteryBox
  const handleBoxRewardsGenerated = async (rewards: any) => {
    if (!walletAddress || !selectedMysteryBox) return;
    
    try {
      // Update the mystery box as opened
      const boxRef = doc(db, 'mystery_boxes', selectedMysteryBox.id);
      
      // Format rewards for Firestore
      const rewardsArray = [
        { type: 'xp', amount: rewards.xp },
        { type: 'token', name: 'SUI Tokens', amount: rewards.suiTokens, symbol: 'SUI' },
      ];
      
      if (rewards.specialItem) {
        rewardsArray.push({ 
          type: 'nft', 
          name: rewards.specialItem, 
          description: `A special item from a ${selectedMysteryBox.rarity} mystery box`
        } as any); // Use type assertion to avoid type error
      }
      
      // Update the mystery box as opened
      await updateDoc(boxRef, {
        opened: true,
        openedAt: Timestamp.now(),
        rewards: rewardsArray
      });
      
      // Process the rewards
      await processRewards(rewardsArray);
      
      // Show success toast
      toast({
        title: "Mystery Box Opened!",
        description: `You received: ${rewards.xp} XP, ${rewards.suiTokens} SUI${rewards.specialItem ? ` and ${rewards.specialItem}` : ''}`,
        duration: 5000,
      });
      
      // Update local state to remove the opened box
      setMysteryBoxes(prev => prev.filter(box => box.id !== selectedMysteryBox.id));
      
      // Close the dialog
      setShowOpenDialog(false);
      setSelectedMysteryBox(null);
    } catch (error) {
      
      toast({
        title: "Error",
        description: "Failed to process rewards. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  // Function to process rewards (update user data)
  const processRewards = async (rewards: any[]) => {
    if (!walletAddress) return;
    
    const userRef = doc(db, 'learningProgress', walletAddress);
    const tokensRef = doc(db, 'user_tokens', walletAddress);
    
    for (const reward of rewards) {
      if (reward.type === 'xp') {
        try {
          // Update user XP correctly using both xp and totalXpEarned fields
          await updateDoc(userRef, {
            xp: increment(reward.amount),
            totalXpEarned: increment(reward.amount)
          });
          
          // Force a refresh of user data to update UI
          if (refreshUserData) {
            await refreshUserData();
          }
          
          
        } catch (error) {
          
        }
      } else if (reward.type === 'token') {
        if (reward.symbol === 'SUI') {
          // For SUI tokens, use the rewardUser function to transfer from admin wallet
          try {
            
            const result = await rewardUser(
              walletAddress, 
              reward.amount, 
              'Mystery Box Reward',
              'mystery_box'
            );
            
            if (result.success) {
              // Force a refresh of user data
              if (refreshUserData) {
                await refreshUserData();
              }
              
              
            } else {
              
              
              // Still update the user's record in Firestore even if the transaction failed
              // This way we can retry the payment later if needed
              await updateDoc(userRef, {
                pendingSuiRewards: increment(reward.amount)
              });
            }
          } catch (error) {
            
          }
        } else {
          // Update other tokens (like Learning Points)
          try {
            const tokenDoc = await getDoc(tokensRef);
            
            if (tokenDoc.exists()) {
              await updateDoc(tokensRef, {
                learningPoints: increment(reward.amount)
              });
            } else {
              // Create tokens document if it doesn't exist
              await setDoc(tokensRef, {
                learningPoints: reward.amount,
                otherTokens: []
              });
            }
          } catch (error) {
            
          }
        }
      } else if (reward.type === 'nft') {
        // Add NFT to user's collection
        await addNFTToCollection(reward);
      }
    }
    
    // After all rewards are processed, force a data refresh
    if (refreshUserData) {
      await refreshUserData();
    }
  };
  
  // Helper function to add NFT to collection
  const addNFTToCollection = async (nftData: any) => {
    if (!walletAddress) return;
    
    const nftsCollection = collection(db, 'user_nfts');
    
    await addDoc(nftsCollection, {
      userId: walletAddress,
      name: nftData.name,
      description: nftData.description,
      imageUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${nftData.name.replace(/\s+/g, '')}`,
      rarity: nftData.rarity,
      type: 'collectible',
      acquiredAt: Timestamp.now()
    });
  };
  
  // Helper function to format reward for display
  const formatReward = (rewards: any[]): string => {
    return rewards.map(reward => {
      if (reward.type === 'xp') {
        return `${reward.amount} XP`;
      } else if (reward.type === 'token') {
        return `${reward.amount} ${reward.name}`;
      } else if (reward.type === 'nft') {
        return `${reward.name} (${reward.rarity})`;
      }
      return '';
    }).join(', ');
  };

  // Add callback for when a purchase is made in the cosmetics store
  const handlePurchaseSuccess = () => {
    fetchNFTs();
  };

  // Function to update user's profile avatar
  const handleSetAvatar = async (avatarUrl: string) => {
    if (!walletAddress || !userData) return;
    
    try {
      setIsUpdatingAvatar(true);
      
      // Use the dedicated updateAvatar function from AuthContext
      await updateAvatar(avatarUrl);
      
      // Show success message
      toast({
        title: "Avatar Updated",
        description: "Your profile avatar has been updated successfully.",
      });
      
    } catch (error) {
      
      toast({
        title: "Update Failed",
        description: "Failed to update your profile avatar. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingAvatar(false);
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
      
      {/* Mystery Box Opening Dialog */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open Mystery Box</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center py-4">
            {selectedMysteryBox && (
              <div className="w-full">
                <p className="text-center mb-4">
                  Open this mystery box to reveal the rewards inside!
                </p>
                
                <MysteryBox
                  id={selectedMysteryBox.id}
                  name={selectedMysteryBox.name}
                  description={selectedMysteryBox.description}
                  rarity={selectedMysteryBox.rarity as 'common' | 'rare' | 'epic' | 'legendary'}
                  image={selectedMysteryBox.image}
                  acquiredDate={selectedMysteryBox.acquiredDate}
                  walletAddress={walletAddress || ''}
                  onBoxOpened={() => {
                    // Close the dialog
                    setShowOpenDialog(false);
                    // Remove the box from local state
                    setMysteryBoxes(prev => prev.filter(b => b.id !== selectedMysteryBox.id));
                    // Reset selected box
                    setSelectedMysteryBox(null);
                  }}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <main className="container mx-auto pt-24 px-4 pb-20">
        <section className="mb-8">
          <motion.h1 
            className="text-3xl md:text-4xl font-heading font-bold mb-6 text-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-gradient">Your Space Inventory</span>
          </motion.h1>
          
          {!connected && (
            <div className="text-center mb-8">
              <p className="text-lg text-muted-foreground mb-4">Connect your wallet to view your inventory</p>
              <Button 
                onClick={() => document.querySelector('.neon-button')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))}
                className="neon-button"
              >
                Connect Wallet
              </Button>
            </div>
          )}
        </section>
        
        {connected && (
          <div className="space-y-8">
            {/* Inventory Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="bg-card/30 p-5 rounded-lg border border-primary/20 backdrop-blur-sm flex items-center"
              >
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mr-4">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Collectibles</div>
                  <div className="text-2xl font-bold">
                    {loading.nfts || loading.mysteryBoxes ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary ml-1" />
                    ) : (
                      nftItems.length + mysteryBoxes.length
                    )}
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="bg-card/30 p-5 rounded-lg border border-primary/20 backdrop-blur-sm flex items-center"
              >
                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center mr-4">
                  <Wallet className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">SUI Balance</div>
                  <div className="text-2xl font-bold">
                    {suiBalance ? (parseInt(suiBalance.totalBalance) / 1000000000).toFixed(3) : '0'} SUI
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="bg-card/30 p-5 rounded-lg border border-primary/20 backdrop-blur-sm flex items-center"
              >
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mr-4">
                  <Gift className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Mystery Boxes</div>
                  <div className="text-2xl font-bold">
                    {loading.mysteryBoxes ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary ml-1" />
                    ) : (
                      mysteryBoxes.length
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
            
            {/* Inventory Tabs */}
            <Tabs defaultValue="nfts" className="w-full" onValueChange={handleTabChange}>
              <TabsList className="mb-8">
                <TabsTrigger value="nfts" className="flex items-center">
                  <Package className="h-4 w-4 mr-2" />
                  Collectibles
                </TabsTrigger>
                <TabsTrigger value="tokens" className="flex items-center">
                  <Wallet className="h-4 w-4 mr-2" />
                  Tokens
                </TabsTrigger>
                <TabsTrigger value="mystery-boxes" className="flex items-center">
                  <Gift className="h-4 w-4 mr-2" />
                  Mystery Boxes
                </TabsTrigger>
                <TabsTrigger value="cosmetics-store" className="flex items-center">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Cosmetics Store
                </TabsTrigger>
              </TabsList>
              
              {/* NFTs Tab */}
              <TabsContent value="nfts">
                {loading.nfts ? (
                  <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : nftItems.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {nftItems.map(nft => (
                      <motion.div
                        key={nft.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="group"
                      >
                        <Card className="galaxy-card overflow-hidden h-full transition-transform duration-300 hover:scale-[1.02] hover:shadow-lg relative">
                          <div className="h-48 overflow-hidden">
                            <img 
                              src={nft.image} 
                              alt={nft.name} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                            />
                            <Badge 
                              className={`absolute top-2 right-2 ${getRarityColor(nft.rarity)} bg-background/80 backdrop-blur-sm`}
                            >
                              {nft.rarity}
                            </Badge>
                            {nft.type && (
                              <Badge 
                                className="absolute top-2 left-2 bg-secondary/80 backdrop-blur-sm"
                              >
                                {nft.type === 'badge' ? 'Badge' : 
                                 nft.type === 'avatar' ? 'Avatar' :
                                 nft.type === 'collectible' ? 'Collectible' : 
                                 nft.type === 'mystery' ? 'Mystery' : 
                                 nft.type}
                              </Badge>
                            )}
                          </div>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg">{nft.name}</CardTitle>
                            <CardDescription className="text-xs">
                              Acquired {formatDate(nft.acquiredDate)}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">{nft.description}</p>
                          </CardContent>
                          <CardFooter className="flex justify-between pt-0">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-xs"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            {nft.type === 'avatar' && (
                              <Button 
                                variant="default" 
                                size="sm"
                                className="text-xs"
                                onClick={() => handleSetAvatar(nft.image)}
                                disabled={isUpdatingAvatar}
                              >
                                {isUpdatingAvatar ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Updating...
                                  </>
                                ) : (
                                  'Use Avatar'
                                )}
                              </Button>
                            )}
                          </CardFooter>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                    <h3 className="text-lg font-medium mb-2">No Collectibles Found</h3>
                    <p className="text-muted-foreground">Buy cosmetics or mystery boxes from store or complete modules to unlock them</p>
                  </div>
                )}
              </TabsContent>
              
              {/* Tokens Tab */}
              <TabsContent value="tokens" className="space-y-6">
                {loading.tokens ? (
                  <div className="py-12 flex flex-col items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Loading your tokens...</p>
                  </div>
                ) : tokenItems.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {tokenItems.map(token => (
                      <motion.div
                        key={token.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Card className="galaxy-card">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <div className="h-12 w-12 mr-4">
                                  <img 
                                    src={token.iconUrl} 
                                    alt={token.symbol} 
                                    className="w-full h-full object-contain rounded-full bg-card p-1" 
                                  />
                                </div>
                                <div>
                                  <h3 className="font-medium">{token.name}</h3>
                                  <p className="text-sm text-muted-foreground">{token.symbol}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold">
                                  {token.symbol === 'SUI' 
                                    ? (suiBalance ? (parseInt(suiBalance.totalBalance) / 1000000000).toFixed(3) : '0')
                                    : token.amount.toLocaleString()
                                  }
                                </div>
                                {token.symbol === 'SUI' && walletAddress && (
                                  <a 
                                    href={`https://explorer.sui.io/address/${walletAddress}?network=testnet`}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs flex items-center justify-end text-primary hover:underline"
                                  >
                                    View on Explorer
                                    <ExternalLink className="h-3 w-3 ml-1" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                    <h3 className="text-lg font-medium mb-2">No Tokens Found</h3>
                    <p className="text-muted-foreground">Complete challenges to earn tokens</p>
                  </div>
                )}
              </TabsContent>
              
              {/* Mystery Boxes Tab */}
              <TabsContent value="mystery-boxes" className="space-y-6">
                {loading.mysteryBoxes ? (
                  <div className="py-12 flex flex-col items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Loading your mystery boxes...</p>
                  </div>
                ) : mysteryBoxes.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {mysteryBoxes.map(box => (
                      <MysteryBox
                        key={box.id}
                        id={box.id}
                        name={box.name}
                        description={box.description}
                        rarity={box.rarity}
                        image={box.image}
                        acquiredDate={box.acquiredDate}
                        walletAddress={walletAddress || ''}
                        onBoxOpened={() => {
                          // Remove the box from local state when opened
                          setMysteryBoxes(prev => prev.filter(b => b.id !== box.id));
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                    <h3 className="text-lg font-medium mb-2">No Mystery Boxes</h3>
                    <p className="text-muted-foreground">Complete daily challenges to earn mystery boxes</p>
                  </div>
                )}
              </TabsContent>
              
              {/* Cosmetics Store Tab */}
              <TabsContent value="cosmetics-store">
                {walletAddress ? (
                  <CosmeticsStore 
                    walletAddress={walletAddress} 
                    onPurchaseSuccess={handlePurchaseSuccess}
                  />
                ) : (
                  <div className="text-center py-16">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                    <h3 className="text-lg font-medium mb-2">Connect Your Wallet</h3>
                    <p className="text-muted-foreground mb-4">Connect your wallet to browse and purchase cosmetic items</p>
                    <Button onClick={() => document.querySelector('.neon-button')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))}>
                      Connect Wallet
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
};

export default Inventory; 