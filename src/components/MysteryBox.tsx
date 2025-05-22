import React, { useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Gift, Star, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import confetti from 'canvas-confetti';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, Timestamp, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { sendSuiReward } from '@/services/suiPaymentService';
import { rewardUser } from '@/services/userRewardsService';

interface MysteryBoxProps {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  image: string;
  acquiredDate: Date;
  walletAddress: string;
  onBoxOpened: () => void;
}

interface MysteryBoxRewards {
  suiTokens: number;
  xp: number;
  specialItem?: string;
}

const MysteryBox: React.FC<MysteryBoxProps> = ({ 
  id, 
  name, 
  description, 
  rarity, 
  image, 
  acquiredDate,
  walletAddress,
  onBoxOpened
}) => {
  const [isOpening, setIsOpening] = useState(false);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [rewards, setRewards] = useState<MysteryBoxRewards | null>(null);
  const [showRewards, setShowRewards] = useState(false);
  const controls = useAnimation();
  const { refreshUserData } = useAuth();

  const formatDate = (date: Date | undefined): string => {
    return date instanceof Date ? date.toLocaleDateString() : 'Unknown date';
  };

  const generateRewards = (): MysteryBoxRewards => {
    // Generate rewards based on box type
    switch (rarity) {
      case 'legendary':
        return {
          suiTokens: Number((Math.random() * 0.03 + 0.05).toFixed(3)), // 0.05 - 0.08 SUI
          xp: Math.floor(Math.random() * 200) + 300, // 300-500 XP
          specialItem: Math.random() > 0.7 ? 'Legendary Badge' : undefined
        };
      case 'epic':
        return {
          suiTokens: Number((Math.random() * 0.02 + 0.04).toFixed(3)), // 0.04 - 0.06 SUI
          xp: Math.floor(Math.random() * 150) + 200, // 200-350 XP
          specialItem: Math.random() > 0.8 ? 'Epic Avatar Frame' : undefined
        };
      case 'rare':
        return {
          suiTokens: Number((Math.random() * 0.015 + 0.03).toFixed(3)), // 0.03 - 0.045 SUI
          xp: Math.floor(Math.random() * 150) + 150, // 150-300 XP
          specialItem: Math.random() > 0.9 ? 'Rare Avatar Frame' : undefined
        };
      case 'common':
      default:
        return {
          suiTokens: Number((Math.random() * 0.004 + 0.01).toFixed(3)), // 0.01 - 0.014 SUI
          xp: Math.floor(Math.random() * 80) + 70 // 70-150 XP
        };
    }
  };

  const handleOpenBox = async () => {
    setShowOpenDialog(true);
  };
  
  const handleOpenAnimation = async () => {
    setIsOpening(true);
    
    // Generate rewards
    const generatedRewards = generateRewards();
    setRewards(generatedRewards);
    
    // Animate opening
    await controls.start({
      scale: [1, 1.2, 0.9, 1.1, 1],
      rotate: [0, 10, -10, 15, -15, 0],
      transition: { duration: 1.5 }
    });
    
    // Show confetti for rare and legendary boxes
    if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') {
      confetti({
        particleCount: rarity === 'legendary' ? 150 : rarity === 'epic' ? 120 : 100,
        spread: 70,
        origin: { x: 0.5, y: 0.5 }
      });
    }
    
    // Show rewards
    setShowRewards(true);
    
    // Save the rewards to Firestore in the next step
  };
  
  const handleConfirmOpen = async () => {
    if (!rewards || !walletAddress) return;
    
    try {
      // Mark the box as opened in Firestore
      const boxRef = doc(db, 'mystery_boxes', id);
      
      // Format rewards for Firestore
      const rewardsArray = [
        { type: 'xp', amount: rewards.xp },
        { type: 'token', name: 'SUI Tokens', amount: rewards.suiTokens, symbol: 'SUI' },
      ];
      
      if (rewards.specialItem) {
        rewardsArray.push({ 
          type: 'nft', 
          name: rewards.specialItem, 
          description: `A special item from a ${rarity} mystery box`,
          rarity: rarity
        } as any); // Use type assertion to avoid type error
      }
      
      // Update the mystery box as opened
      await updateDoc(boxRef, {
        opened: true,
        openedAt: serverTimestamp(),
        rewards: rewardsArray
      });
      
      // Process rewards
      
      // 1. Add XP to user account
      const userRef = doc(db, 'learningProgress', walletAddress);
      await updateDoc(userRef, {
        xp: increment(rewards.xp),
        totalXpEarned: increment(rewards.xp)
      });
      
      // 2. Send SUI tokens using the rewardUser function
      const result = await rewardUser(
        walletAddress,
        rewards.suiTokens,
        'Mystery Box Reward',
        'mystery_box'
      );
      
      // 3. Add special item if present
      if (rewards.specialItem) {
        await addDoc(collection(db, 'user_nfts'), {
          userId: walletAddress,
          name: rewards.specialItem,
          description: `A special item from a ${rarity} mystery box`,
          imageUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${rewards.specialItem.replace(/\s+/g, '')}`,
          rarity: rarity,
          type: 'collectible',
          acquiredAt: Timestamp.now()
        });
      }
      
      // Refresh user data to show updated stats
      if (refreshUserData) {
        refreshUserData();
      }
      
      // Show success toast
      toast({
        title: "Mystery Box Opened!",
        description: (
          <div className="space-y-1">
            <p>You received:</p>
            <p>+ {rewards.xp} XP</p>
            <p>+ {rewards.suiTokens} SUI</p>
            {rewards.specialItem && <p>+ {rewards.specialItem}</p>}
          </div>
        ),
        duration: 5000,
      });
      
      // Close dialog and notify parent
      setShowOpenDialog(false);
      onBoxOpened();
      
    } catch (error) {
      console.error('Error processing rewards:', error);
      toast({
        title: "Error",
        description: "There was a problem processing your rewards. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  // Get color class based on rarity
  const getRarityColor = () => {
    switch (rarity) {
      case 'legendary':
        return 'from-purple-600 to-orange-500 border-orange-400';
      case 'epic':
        return 'from-pink-600 to-purple-500 border-purple-400';
      case 'rare':
        return 'from-blue-600 to-cyan-500 border-cyan-400';
      case 'common':
      default:
        return 'from-green-600 to-teal-500 border-teal-400';
    }
  };

  return (
    <Card className="galaxy-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{name}</span>
          <span className="text-xs bg-primary/20 px-2 py-0.5 rounded-full">
            {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
          </span>
        </CardTitle>
        <CardDescription className="text-xs">
          Acquired {formatDate(acquiredDate)}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pb-2">
        <motion.div 
          className={`w-full h-48 bg-gradient-to-br ${getRarityColor()} rounded-lg border-2 flex items-center justify-center cursor-pointer mb-2`}
          whileHover={{ scale: 1.02 }}
          onClick={handleOpenBox}
        >
          <img 
            src={image} 
            alt={name} 
            className="w-32 h-32 object-contain" 
          />
        </motion.div>
        
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
      
      <CardFooter>
        <Button 
          className="w-full neon-button"
          onClick={handleOpenBox}
        >
          <Gift className="mr-2 h-4 w-4" />
          Open Box
        </Button>
      </CardFooter>
      
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent className="sm:max-w-md" id="mystery-box-dialog">
          <DialogHeader>
            <DialogTitle>Open Mystery Box</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-4 py-4">
            {!isOpening ? (
              <>
                <div className="h-40 w-40 p-5 bg-gradient-to-br from-primary/20 to-secondary/30 rounded-xl flex items-center justify-center">
                  <img 
                    src={image} 
                    alt={name} 
                    className="w-full h-full object-contain" 
                  />
                </div>
                
                <div className="text-center">
                  <h3 className="font-medium mb-1">{name}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                
                <Button 
                  onClick={handleOpenAnimation}
                  className="w-full neon-button mt-2"
                >
                  Open Box
                </Button>
              </>
            ) : (
              <motion.div
                className="flex flex-col items-center"
                animate={controls}
              >
                <div className="h-40 w-40 p-5 bg-gradient-to-br from-primary/20 to-secondary/30 rounded-xl flex items-center justify-center mb-4">
                  <span className="text-6xl">🎁</span>
                </div>
                
                {showRewards && rewards && (
                  <motion.div
                    className="space-y-4 w-full"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <h3 className="text-xl font-bold text-center mb-2">Rewards!</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center justify-center bg-blue-500/20 p-3 rounded-lg">
                        <Coins className="h-5 w-5 text-blue-500 mr-2" />
                        <span className="font-medium">{rewards.suiTokens} SUI</span>
                      </div>
                      
                      <div className="flex items-center justify-center bg-primary/20 p-3 rounded-lg">
                        <Star className="h-5 w-5 text-primary mr-2" />
                        <span className="font-medium">{rewards.xp} XP</span>
                      </div>
                    </div>
                    
                    {rewards.specialItem && (
                      <div className="bg-purple-500/20 p-3 rounded-lg text-center">
                        <span className="font-medium">+ {rewards.specialItem}!</span>
                      </div>
                    )}
                    
                    <Button 
                      onClick={handleConfirmOpen}
                      className="w-full neon-button mt-4"
                    >
                      Claim Rewards
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MysteryBox;