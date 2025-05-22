import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Box, Coins, Star, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import EnhancedMysteryBox from './EnhancedMysteryBox';
import { PAYMENT_AMOUNTS } from '@/hooks/useSuiPayment';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Achievement } from '@/services/achievementsService';
import AchievementNotification from './AchievementNotification';
import { useNavigate } from 'react-router-dom';

interface MysteryBoxStoreProps {
  walletAddress: string;
}

const MysteryBoxStore: React.FC<MysteryBoxStoreProps> = ({ walletAddress }) => {
  const [selectedBoxType, setSelectedBoxType] = useState<'common' | 'rare' | 'epic' | 'legendary' | null>(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [unlockedAchievement, setUnlockedAchievement] = useState<Achievement | null>(null);
  const { toast } = useToast();
  const currentAccount = useCurrentAccount();
  const navigate = useNavigate();

  const boxes = [
    {
      type: 'common',
      name: 'Common Mystery Box',
      description: 'Contains a small amount of SUI and XP rewards',
      price: PAYMENT_AMOUNTS.common,
      color: 'from-green-600 to-teal-500',
      iconColor: 'text-teal-500'
    },
    {
      type: 'rare',
      name: 'Rare Mystery Box',
      description: 'Better chances for higher SUI and XP rewards',
      price: PAYMENT_AMOUNTS.rare,
      color: 'from-blue-600 to-cyan-500',
      iconColor: 'text-blue-500'
    },
    {
      type: 'epic',
      name: 'Epic Mystery Box',
      description: 'An epic mystery box with excellent rewards and special items',
      price: PAYMENT_AMOUNTS.epic,
      color: 'from-purple-600 to-orange-500',
      iconColor: 'text-purple-500'
    },
    {
      type: 'legendary',
      name: 'Legendary Mystery Box',
      description: 'Guaranteed large rewards and special items',
      price: PAYMENT_AMOUNTS.legendary,
      color: 'from-purple-600 to-orange-500',
      iconColor: 'text-purple-500'
    }
  ];

  const handleBoxSelect = (boxType: 'common' | 'rare' | 'epic' | 'legendary') => {
    if (!currentAccount) {
      toast({
        title: "Wallet Required",
        description: "Connect your wallet to purchase mystery boxes.",
        variant: "destructive"
      });
      return;
    }
    
    setSelectedBoxType(boxType);
    setShowPurchaseDialog(true);
  };

  const handleBoxPurchaseComplete = () => {
    toast({
      title: "Purchase Complete",
      description: "Your mystery box has been added to your inventory!",
      action: (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/inventory')}
        >
          View in Inventory
        </Button>
      ),
      duration: 5000,
    });
    
    // Explicitly close the dialog after purchase
    setTimeout(() => {
      setShowPurchaseDialog(false);
    }, 500);
  };

  const handleAchievementUnlocked = (achievement: Achievement) => {
    setUnlockedAchievement(achievement);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-heading font-bold">Mystery Boxes</h2>
        
        <div className="flex items-center bg-primary/10 px-3 py-2 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
          <span className="text-sm">Purchases require SUI tokens</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {boxes.map((box) => (
          <motion.div
            key={box.type}
            className="galaxy-card border border-primary/20 overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            whileHover={{ scale: 1.02 }}
          >
            <div className="p-4">
              <h3 className="font-medium text-base mb-1">{box.name}</h3>
              <p className="text-xs text-foreground/70 mb-3">{box.description}</p>

              <div className="h-32 flex items-center justify-center mb-4">
                <div className={`w-20 h-20 rounded-lg bg-gradient-to-br ${box.color} 
                    flex items-center justify-center border-2 border-white/20`}
                >
                  <Box className="w-10 h-10 text-white" />
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center">
                  <Coins className="h-4 w-4 text-blue-500 mr-1" />
                  <span className="font-medium">{box.price} SUI</span>
                </div>

                <Button 
                  size="sm" 
                  className="neon-button px-3 py-1 h-8"
                  onClick={() => handleBoxSelect(box.type as any)}
                >
                  Purchase
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Purchase Dialog */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Purchase Mystery Box</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-4 py-4">
            {selectedBoxType && (
              <>
                <p className="text-sm text-center text-foreground/70 mb-2">
                  This will send {PAYMENT_AMOUNTS[selectedBoxType]} SUI to the game treasury address.
                  The mystery box will be added to your inventory.
                </p>
                
                <EnhancedMysteryBox 
                  boxType={selectedBoxType}
                  onOpen={handleBoxPurchaseComplete}
                  walletAddress={walletAddress}
                  requirePurchase={true}
                  onAchievementUnlocked={handleAchievementUnlocked}
                  fromInventory={false}
                />
                
                <p className="text-sm text-center text-primary/70 italic mt-2">
                  After purchase, go to your inventory to open the box and claim rewards!
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Achievement Notification */}
      {unlockedAchievement && (
        <AchievementNotification 
          achievement={unlockedAchievement} 
          onClose={() => setUnlockedAchievement(null)} 
        />
      )}
    </div>
  );
};

export default MysteryBoxStore; 