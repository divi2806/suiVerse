import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Trophy, Star, Award, Gift, Coins } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import confetti from 'canvas-confetti';
import { useSuiPayment, PAYMENT_AMOUNTS } from '@/hooks/useSuiPayment';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { checkMysteryBoxPurchaseAchievement, checkLuckyDropAchievement } from '@/services/achievementsService';
import { Achievement } from '@/services/achievementsService';
import { doc, addDoc, collection, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';

interface MysteryBoxRewards {
  suiTokens: number;
  xp: number;
  specialItem?: string;
}

interface EnhancedMysteryBoxProps {
  boxType: 'common' | 'rare' | 'epic' | 'legendary';
  onOpen: (rewards: MysteryBoxRewards) => void;
  onAchievementUnlocked?: (achievement: Achievement) => void;
  animated?: boolean;
  walletAddress?: string;
  requirePurchase?: boolean;
  fromInventory?: boolean;
}

const EnhancedMysteryBox: React.FC<EnhancedMysteryBoxProps> = ({ 
  boxType, 
  onOpen,
  onAchievementUnlocked,
  animated = true,
  walletAddress,
  requirePurchase = false,
  fromInventory = false
}) => {
  const [isOpening, setIsOpening] = useState(false);
  const [isOpened, setIsOpened] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [rewards, setRewards] = useState<MysteryBoxRewards | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isPurchased, setIsPurchased] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const { toast } = useToast();
  const { payForMysteryBox, isLoading, isPaid, resetPaymentState, hasEnoughBalance } = useSuiPayment();
  const currentAccount = useCurrentAccount();

  // Reset payment state when component unmounts
  useEffect(() => {
    return () => {
      resetPaymentState();
    };
  }, []);

  // Define box appearance based on type
  const getBoxAppearance = () => {
    switch (boxType) {
      case 'legendary':
        return {
          bgColor: 'bg-gradient-to-br from-purple-600 to-orange-500',
          glowColor: 'shadow-[0_0_30px_rgba(168,85,247,0.7)]',
          borderColor: 'border-orange-400',
          name: 'Legendary Box',
        };
      case 'epic':
        return {
          bgColor: 'bg-gradient-to-br from-pink-600 to-purple-500',
          glowColor: 'shadow-[0_0_25px_rgba(219,39,119,0.6)]',
          borderColor: 'border-purple-400',
          name: 'Epic Box',
        };
      case 'rare':
        return {
          bgColor: 'bg-gradient-to-br from-blue-600 to-cyan-500',
          glowColor: 'shadow-[0_0_20px_rgba(59,130,246,0.6)]',
          borderColor: 'border-cyan-400',
          name: 'Rare Box',
        };
      case 'common':
      default:
        return {
          bgColor: 'bg-gradient-to-br from-green-600 to-teal-500',
          glowColor: 'shadow-[0_0_15px_rgba(16,185,129,0.5)]',
          borderColor: 'border-teal-400',
          name: 'Common Box',
        };
    }
  };

  const appearance = getBoxAppearance();

  // Add the box to the user's inventory instead of opening it immediately
  const addMysteryBoxToInventory = async (paymentTxDigest?: string) => {
    if (!walletAddress) return;
    
    try {
      // Add to mystery_boxes collection
      await addDoc(collection(db, 'mystery_boxes'), {
        userId: walletAddress,
        boxType: boxType,
        rarity: boxType,
        name: `${appearance.name}`,
        description: `A ${boxType} mystery box that contains valuable rewards.`,
        image: `https://api.dicebear.com/7.x/shapes/svg?seed=${boxType}Box`,
        acquiredDate: Timestamp.now(),
        opened: false,
        purchasedAt: serverTimestamp(),
        txDigest: paymentTxDigest || null
      });
      
      toast({
        title: "Mystery Box Purchased!",
        description: "The box has been added to your inventory. Go to your inventory to open it!",
        duration: 5000,
      });
      
      setIsPurchased(true);
      setIsPurchasing(false);
    } catch (error) {
      
      toast({
        title: "Purchase Error",
        description: "There was a problem adding the box to your inventory. Please try again.",
        variant: "destructive"
      });
      setIsPurchasing(false);
    }
  };

  const handlePurchase = async () => {
    if (!walletAddress || !currentAccount) {
      toast({
        title: "Wallet Required",
        description: "You need to connect your wallet to purchase a mystery box.",
        variant: "destructive"
      });
      return;
    }

    setIsPurchasing(true);
    
    try {
      // Proceed with payment
      const paymentResult = await payForMysteryBox(boxType);
      
      if (paymentResult.success) {
        // Check for achievement
        const purchaseAchievement = await checkMysteryBoxPurchaseAchievement(walletAddress, boxType as any);
        
        if (purchaseAchievement && onAchievementUnlocked) {
          onAchievementUnlocked(purchaseAchievement);
        }
        
        // Add to inventory instead of opening immediately
        await addMysteryBoxToInventory(paymentResult.txDigest);
        
        // Call onOpen to notify parent component that purchase is complete
        onOpen({ suiTokens: 0, xp: 0 });
      } else {
        setIsPurchasing(false);
      }
    } catch (error) {
      
      toast({
        title: "Purchase Failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive"
      });
      setIsPurchasing(false);
    }
  };

  const handleOpenBox = async () => {
    if (!fromInventory && requirePurchase && !isPurchased) {
      // If not from inventory and requires purchase but not purchased yet, don't open
      return;
    }
    
    setIsOpening(true);
    
    // Animate box opening
    await controls.start({
      scale: [1, 1.2, 0.9, 1.1, 1],
      rotate: [0, 10, -10, 15, -15, 0],
      transition: { duration: 1.5 }
    });
    
    // Generate rewards
    const generatedRewards = generateRewards(boxType);
    setRewards(generatedRewards);
    
    // Show opening animation
    setIsOpened(true);
    
    // Fire confetti for rare, epic and legendary boxes
    if (boxType === 'rare' || boxType === 'epic' || boxType === 'legendary') {
      if (boxRef.current) {
        const rect = boxRef.current.getBoundingClientRect();
        const x = (rect.left + rect.right) / 2 / window.innerWidth;
        const y = (rect.top + rect.bottom) / 2 / window.innerHeight;
        
        confetti({
          particleCount: boxType === 'legendary' ? 150 : boxType === 'epic' ? 130 : 100,
          spread: 70,
          origin: { x, y: y - 0.1 }
        });
      }
    }
    
    // Short delay then show rewards
    setTimeout(() => {
      setShowRewards(true);
      onOpen(generatedRewards);
      
      // Check for lucky drop achievement
      if (walletAddress && generatedRewards.suiTokens >= 0.04) {
        checkLuckyDropAchievement(walletAddress, boxType as any, generatedRewards.suiTokens)
          .then(achievement => {
            if (achievement && onAchievementUnlocked) {
              onAchievementUnlocked(achievement);
            }
          });
      }
    }, 1000);
  };

  const generateRewards = (type: string): MysteryBoxRewards => {
    // Generate rewards based on box type
    switch (type) {
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

  const renderRewards = () => {
    if (!rewards) return null;
    
    return (
      <motion.div 
        className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm rounded-lg p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h3 className="text-lg font-bold mb-3">Rewards!</h3>
        <div className="flex flex-wrap justify-center gap-2 mb-2">
          <motion.div 
            className="flex items-center bg-blue-500/20 px-2 py-1 rounded-lg"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <Coins className="h-4 w-4 text-blue-500 mr-1" />
            <span>{rewards.suiTokens} SUI</span>
          </motion.div>
          
          <motion.div 
            className="flex items-center bg-primary/20 px-2 py-1 rounded-lg"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <Star className="h-4 w-4 text-primary mr-1" />
            <span>{rewards.xp} XP</span>
          </motion.div>
        </div>
        
        {rewards.specialItem && (
          <motion.div 
            className="text-center mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            <span className="text-sm font-bold text-accent">+ {rewards.specialItem}!</span>
          </motion.div>
        )}
      </motion.div>
    );
  };
  
  // Display purchase price
  const renderPurchaseInfo = () => {
    if (!requirePurchase || isOpened || isOpening) return null;
    
    return (
      <div className="mt-2 text-center">
        <div className="flex items-center justify-center text-sm font-medium">
          <Coins className="h-4 w-4 text-blue-500 mr-1" />
          <span>{PAYMENT_AMOUNTS[boxType]} SUI</span>
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      className="flex flex-col items-center"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        ref={boxRef}
        className={`relative w-40 h-40 ${appearance.bgColor} rounded-lg border-2 ${appearance.borderColor} p-2 flex items-center justify-center cursor-pointer ${appearance.glowColor}`}
        animate={controls}
        whileHover={!isOpening && !isOpened && animated ? { scale: 1.05 } : {}}
        onClick={!isOpening && !isOpened && !requirePurchase ? handleOpenBox : undefined}
      >
        <div className="absolute inset-0 rounded-lg opacity-50">
          {animated && (!isOpened ? 
            <div className={`absolute inset-0 rounded-lg ${isOpening ? 'animate-pulse' : ''}`} /> : 
            null
          )}
        </div>

        {!isOpened ? (
          <div className="w-full h-full border-2 border-white/30 rounded flex items-center justify-center backdrop-blur-sm">
            <div className="text-white font-bold text-3xl">?</div>
            {animated && isOpening && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 border-t-4 border-primary rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        ) : (
          <>
            <motion.div 
              className="flex items-center justify-center"
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
            >
              <span className="text-white text-4xl">🎁</span>
            </motion.div>
            {showRewards && renderRewards()}
          </>
        )}
      </motion.div>
      
      <p className="text-white mt-4 font-medium">{appearance.name}</p>
      
      {renderPurchaseInfo()}
      
      {!isOpened && !isOpening && (
        <Button 
          onClick={requirePurchase ? handlePurchase : handleOpenBox} 
          className="mt-4 neon-button" 
          disabled={isOpening || isPurchasing || (requirePurchase && !currentAccount) || isPurchased}
        >
          {isOpening ? "Opening..." : 
           isPurchasing ? "Processing..." : 
           isPurchased ? "Purchased" : 
           requirePurchase ? "Purchase" : "Open Box"}
        </Button>
      )}
    </motion.div>
  );
};

export default EnhancedMysteryBox;
