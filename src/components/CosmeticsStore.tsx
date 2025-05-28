import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge, Palette, ShoppingCart, Coins, Award, Crown, Shield, Star, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useSuiPayment } from '@/hooks/useSuiPayment';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { doc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';

// Define cosmetic item types
export type CosmeticType = 'badge' | 'avatar' | 'theme' | 'nameplate';
export type CosmeticRarity = 'common' | 'rare' | 'epic' | 'legendary';

// Interface for cosmetic items
export interface CosmeticItem {
  id: string;
  name: string;
  description: string;
  price: number; // Price in SUI
  type: CosmeticType;
  rarity: CosmeticRarity;
  image: string;
  locked: boolean;
}

// Payment receiver address
const PAYMENT_RECEIVER_ADDRESS = '0x1a0653c5c65355eef0069f431f18ef8f829125e1ed20db0bfd054b4d338553ef';

interface CosmeticsStoreProps {
  walletAddress: string;
  onPurchaseSuccess?: () => void;
}

const CosmeticsStore: React.FC<CosmeticsStoreProps> = ({ walletAddress, onPurchaseSuccess }) => {
  const [selectedItem, setSelectedItem] = useState<CosmeticItem | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const { toast } = useToast();
  const currentAccount = useCurrentAccount();
  const { payForCosmetic, isLoading, hasEnoughBalance } = useSuiPayment();

  // Define cosmetic items available in the store
  const cosmeticItems: CosmeticItem[] = [
    // Badges
    {
      id: 'badge-cosmic-explorer',
      name: 'Cosmic Explorer Badge',
      description: 'Show off your cosmic exploration achievements with this special badge.',
      price: 0.05,
      type: 'badge',
      rarity: 'common',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=badge-cosmic-explorer',
      locked: true
    },
    {
      id: 'badge-sui-master',
      name: 'Sui Master Badge',
      description: 'A badge that signifies your mastery of the Sui blockchain.',
      price: 0.1,
      type: 'badge',
      rarity: 'rare',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=badge-sui-master',
      locked: true
    },
    {
      id: 'badge-stellar-programmer',
      name: 'Stellar Programmer Badge',
      description: 'For those who have demonstrated exceptional programming skills.',
      price: 0.15,
      type: 'badge',
      rarity: 'epic',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=badge-stellar-programmer',
      locked: true
    },
    {
      id: 'badge-blockchain-pioneer',
      name: 'Blockchain Pioneer Badge',
      description: 'A legendary badge for true blockchain pioneers.',
      price: 0.25,
      type: 'badge',
      rarity: 'legendary',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=badge-blockchain-pioneer',
      locked: true
    },
    // New badges
    {
      id: 'badge-quantum-coder',
      name: 'Quantum Coder Badge',
      description: 'For developers who understand the principles of quantum computing and blockchain.',
      price: 0.12,
      type: 'badge',
      rarity: 'rare',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=badge-quantum-coder&backgroundColor=b0e0e6',
      locked: true
    },
    {
      id: 'badge-night-owl',
      name: 'Night Owl Badge',
      description: 'For those who prefer to explore and learn during the quiet hours of the night.',
      price: 0.08,
      type: 'badge',
      rarity: 'common',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=badge-night-owl&backgroundColor=191970',
      locked: true
    },
    {
      id: 'badge-galaxy-ambassador',
      name: 'Galaxy Ambassador Badge',
      description: 'Represents those who actively help others in their journey through the Sui cosmos.',
      price: 0.18,
      type: 'badge',
      rarity: 'epic',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=badge-galaxy-ambassador&backgroundColor=9370db',
      locked: true
    },
    {
      id: 'badge-move-maestro',
      name: 'Move Maestro Badge',
      description: 'Showcases your expertise in Move programming language used in Sui.',
      price: 0.2,
      type: 'badge',
      rarity: 'epic',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=badge-move-maestro&backgroundColor=ff4500',
      locked: true
    },
    {
      id: 'badge-cosmic-guardian',
      name: 'Cosmic Guardian Badge',
      description: 'A legendary badge for those who protect and advance the principles of decentralization.',
      price: 0.3,
      type: 'badge',
      rarity: 'legendary',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=badge-cosmic-guardian&backgroundColor=4b0082',
      locked: true
    },
    
    // Avatars
    {
      id: 'avatar-space-explorer',
      name: 'Space Explorer Avatar',
      description: 'A cool avatar for space explorers.',
      price: 0.1,
      type: 'avatar',
      rarity: 'common',
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=avatar-space-explorer',
      locked: true
    },
    {
      id: 'avatar-cosmic-traveler',
      name: 'Cosmic Traveler Avatar',
      description: 'An avatar for the seasoned cosmic traveler.',
      price: 0.2,
      type: 'avatar',
      rarity: 'rare',
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=avatar-cosmic-traveler',
      locked: true
    },
    {
      id: 'avatar-galactic-guardian',
      name: 'Galactic Guardian Avatar',
      description: 'An epic avatar reserved for the guardians of the galaxy.',
      price: 0.4,
      type: 'avatar',
      rarity: 'epic',
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=avatar-galactic-guardian',
      locked: true
    },
    {
      id: 'avatar-celestial-overlord',
      name: 'Celestial Overlord Avatar',
      description: 'A legendary avatar for the true masters of the cosmos.',
      price: 0.8,
      type: 'avatar',
      rarity: 'legendary',
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=avatar-celestial-overlord',
      locked: true
    },
    
    // Themes
    {
      id: 'theme-cosmic-blue',
      name: 'Cosmic Blue Theme',
      description: 'A cool blue theme for your profile.',
      price: 0.15,
      type: 'theme',
      rarity: 'common',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=theme-cosmic-blue',
      locked: true
    },
    {
      id: 'theme-nebula-purple',
      name: 'Nebula Purple Theme',
      description: 'A mesmerizing purple theme inspired by cosmic nebulae.',
      price: 0.25,
      type: 'theme',
      rarity: 'rare',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=theme-nebula-purple',
      locked: true
    },
    {
      id: 'theme-solar-gold',
      name: 'Solar Gold Theme',
      description: 'An epic gold theme that shines like the sun.',
      price: 0.5,
      type: 'theme',
      rarity: 'epic',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=theme-solar-gold',
      locked: true
    },
    
    // Nameplates
    {
      id: 'nameplate-stellar-cadet',
      name: 'Stellar Cadet Nameplate',
      description: 'A nameplate for stellar cadets.',
      price: 0.1,
      type: 'nameplate',
      rarity: 'common',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=nameplate-stellar-cadet',
      locked: true
    },
    {
      id: 'nameplate-galaxy-commander',
      name: 'Galaxy Commander Nameplate',
      description: 'A nameplate for commanders of the galaxy.',
      price: 0.3,
      type: 'nameplate',
      rarity: 'epic',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=nameplate-galaxy-commander',
      locked: true
    },
    {
      id: 'nameplate-cosmic-deity',
      name: 'Cosmic Deity Nameplate',
      description: 'A legendary nameplate for the cosmic deities.',
      price: 1.0,
      type: 'nameplate',
      rarity: 'legendary',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=nameplate-cosmic-deity',
      locked: true
    }
  ];

  const getTypeIcon = (type: CosmeticType) => {
    switch (type) {
      case 'badge':
        return <Award className="h-5 w-5" />;
      case 'avatar':
        return <User className="h-5 w-5" />;
      case 'theme':
        return <Palette className="h-5 w-5" />;
      case 'nameplate':
        return <Crown className="h-5 w-5" />;
      default:
        return <Star className="h-5 w-5" />;
    }
  };

  const getRarityColor = (rarity: CosmeticRarity) => {
    switch (rarity) {
      case 'common':
        return 'text-green-400 bg-green-400/10';
      case 'rare':
        return 'text-blue-400 bg-blue-400/10';
      case 'epic':
        return 'text-purple-400 bg-purple-400/10';
      case 'legendary':
        return 'text-amber-400 bg-amber-400/10';
      default:
        return 'text-slate-400 bg-slate-400/10';
    }
  };

  const getBorderColor = (rarity: CosmeticRarity) => {
    switch (rarity) {
      case 'common':
        return 'border-green-400/30';
      case 'rare':
        return 'border-blue-400/30';
      case 'epic':
        return 'border-purple-400/30';
      case 'legendary':
        return 'border-amber-400/30';
      default:
        return 'border-slate-400/30';
    }
  };

  const handleSelectItem = (item: CosmeticItem) => {
    if (!currentAccount) {
      toast({
        title: "Wallet Required",
        description: "Connect your wallet to purchase cosmetic items.",
        variant: "destructive"
      });
      return;
    }
    
    setSelectedItem(item);
    setShowPurchaseDialog(true);
  };

  const handlePurchase = async () => {
    if (!currentAccount || !selectedItem) {
      return;
    }
    
    setIsPurchasing(true);
    
    try {
      // Check if user has enough balance
      if (!hasEnoughBalance(selectedItem.price)) {
        toast({
          title: "Insufficient Balance",
          description: `You need at least ${selectedItem.price} SUI to purchase this item.`,
          variant: "destructive"
        });
        setIsPurchasing(false);
        return;
      }
      
      // Process payment using custom amount
      const paymentResult = await payForCosmetic(selectedItem.price, selectedItem.name);
      
      if (paymentResult.success) {
        // Save to Firestore with the transaction digest
        await addCosmeticToUserCollection(selectedItem, paymentResult.txDigest);
        
        toast({
          title: "Purchase Successful",
          description: `You've successfully purchased ${selectedItem.name}!`,
        });
        
        // Close dialog and reset selection
        setShowPurchaseDialog(false);
        setSelectedItem(null);
        
        // Callback if provided
        if (onPurchaseSuccess) {
          onPurchaseSuccess();
        }
      } else {
        toast({
          title: "Purchase Failed",
          description: "There was an error processing your payment. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      
      toast({
        title: "Purchase Failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const addCosmeticToUserCollection = async (item: CosmeticItem, transactionDigest?: string) => {
    if (!walletAddress) return;
    
    try {
      // Add to user_nfts collection
      await addDoc(collection(db, 'user_nfts'), {
        userId: walletAddress,
        name: item.name,
        description: item.description,
        imageUrl: item.image,
        rarity: item.rarity,
        type: item.type,
        acquiredAt: serverTimestamp(),
        isCosmetic: true,
        cosmeticType: item.type,
        price: item.price,
        itemId: item.id,
        paymentTxDigest: transactionDigest, // Store transaction ID for reference
        unlocked: true,            // Mark as unlocked since it's purchased
        displayOnProfile: item.type === 'badge' || item.type === 'nameplate' // Auto-display badges and nameplates
      });
      
      // Also record transaction
      await addDoc(collection(db, 'transactions'), {
        walletAddress,
        amount: item.price,
        reason: `Purchase of ${item.name}`,
        type: 'cosmetic_purchase',
        itemId: item.id,
        itemType: item.type,
        timestamp: serverTimestamp(),
        txDigest: transactionDigest
      });
      
      // Mark the item as unlocked in the local state
      markCosmeticAsUnlocked(item.id);
    } catch (error) {
      
      throw error;
    }
  };
  
  // Function to mark a cosmetic item as unlocked in the local state
  const markCosmeticAsUnlocked = (itemId: string) => {
    const updatedItems = cosmeticItems.map(item => 
      item.id === itemId ? { ...item, locked: false } : item
    );
    
    // This won't persist between sessions but helps with UI during the current session
    // For persistence, we need to pull the data from Firestore on mount
    // which is handled by the Inventory component
  };

  const filterItemsByType = (type: CosmeticType) => {
    return cosmeticItems.filter(item => item.type === type);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-heading font-bold flex items-center">
          <ShoppingCart className="mr-2 h-5 w-5 text-primary" />
          Cosmetics Store
        </h2>
        <div className="flex items-center bg-primary/10 px-3 py-2 rounded-lg">
          <Coins className="h-5 w-5 text-blue-500 mr-2" />
          <span className="text-sm">Purchases require SUI tokens</span>
        </div>
      </div>

      {/* Badges Section */}
      <div>
        <h3 className="text-lg font-medium mb-3 flex items-center">
          <Award className="mr-2 h-5 w-5 text-amber-400" />
          Badges
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filterItemsByType('badge').map((item) => (
            <motion.div
              key={item.id}
              className={`galaxy-card border ${getBorderColor(item.rarity)} overflow-hidden`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleSelectItem(item)}
            >
              <div className="p-4">
                <div className="flex justify-between mb-2">
                  <h3 className="font-medium text-base">{item.name}</h3>
                  <div className={`px-2 py-0.5 rounded text-xs ${getRarityColor(item.rarity)}`}>
                    {item.rarity}
                  </div>
                </div>
                
                <p className="text-xs text-foreground/70 mb-3 line-clamp-2">{item.description}</p>

                <div className="h-20 flex items-center justify-center relative overflow-hidden mb-3">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="h-16 w-16 object-contain" 
                  />
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center">
                    <Coins className="h-4 w-4 text-blue-500 mr-1" />
                    <span className="font-medium">{item.price} SUI</span>
                  </div>

                  <Button 
                    size="sm" 
                    className="px-3 py-1 h-8 neon-button"
                  >
                    Purchase
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Avatars Section */}
      <div>
        <h3 className="text-lg font-medium mb-3 flex items-center">
          <User className="mr-2 h-5 w-5 text-purple-400" />
          Avatars
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filterItemsByType('avatar').map((item) => (
            <motion.div
              key={item.id}
              className={`galaxy-card border ${getBorderColor(item.rarity)} overflow-hidden`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleSelectItem(item)}
            >
              <div className="p-4">
                <div className="flex justify-between mb-2">
                  <h3 className="font-medium text-base">{item.name}</h3>
                  <div className={`px-2 py-0.5 rounded text-xs ${getRarityColor(item.rarity)}`}>
                    {item.rarity}
                  </div>
                </div>
                
                <p className="text-xs text-foreground/70 mb-3 line-clamp-2">{item.description}</p>

                <div className="h-20 flex items-center justify-center relative overflow-hidden mb-3">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="h-16 w-16 object-contain rounded-full" 
                  />
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center">
                    <Coins className="h-4 w-4 text-blue-500 mr-1" />
                    <span className="font-medium">{item.price} SUI</span>
                  </div>

                  <Button 
                    size="sm" 
                    className="px-3 py-1 h-8 neon-button"
                  >
                    Purchase
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Themes and Nameplates Section */}
      <div>
        <h3 className="text-lg font-medium mb-3 flex items-center">
          <Palette className="mr-2 h-5 w-5 text-cyan-400" />
          Themes & Nameplates
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...filterItemsByType('theme'), ...filterItemsByType('nameplate')].map((item) => (
            <motion.div
              key={item.id}
              className={`galaxy-card border ${getBorderColor(item.rarity)} overflow-hidden`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleSelectItem(item)}
            >
              <div className="p-4">
                <div className="flex justify-between mb-2">
                  <h3 className="font-medium text-base">{item.name}</h3>
                  <div className={`px-2 py-0.5 rounded text-xs ${getRarityColor(item.rarity)}`}>
                    {item.rarity}
                  </div>
                </div>
                
                <p className="text-xs text-foreground/70 mb-3 line-clamp-2">{item.description}</p>

                <div className="h-20 flex items-center justify-center relative overflow-hidden mb-3">
                  <div className={`w-full h-12 rounded-lg ${
                    item.type === 'theme' 
                      ? 'bg-gradient-to-r from-primary to-secondary'
                      : 'border-2 border-primary/50 flex items-center justify-center'
                  }`}>
                    {item.type === 'nameplate' && (
                      <span className="text-sm font-medium">Player Nameplate</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center">
                    <Coins className="h-4 w-4 text-blue-500 mr-1" />
                    <span className="font-medium">{item.price} SUI</span>
                  </div>

                  <Button 
                    size="sm" 
                    className="px-3 py-1 h-8 neon-button"
                  >
                    Purchase
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Purchase Dialog */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Purchase Cosmetic Item</DialogTitle>
            <DialogDescription>
              This will send {selectedItem?.price} SUI to the game treasury.
            </DialogDescription>
          </DialogHeader>
          
          {selectedItem && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className={`p-4 rounded-lg border ${getBorderColor(selectedItem.rarity)}`}>
                <img 
                  src={selectedItem.image} 
                  alt={selectedItem.name} 
                  className="h-24 w-24 object-contain mx-auto" 
                />
                
                <div className="mt-4 text-center">
                  <h3 className="font-medium">{selectedItem.name}</h3>
                  <div className={`inline-block px-2 py-0.5 rounded text-xs ${getRarityColor(selectedItem.rarity)} mt-1`}>
                    {selectedItem.rarity}
                  </div>
                  <p className="text-sm text-foreground/70 mt-2">{selectedItem.description}</p>
                </div>
              </div>
              
              <div className="flex gap-2 w-full mt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowPurchaseDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 neon-button"
                  onClick={handlePurchase}
                  disabled={isPurchasing || isLoading}
                >
                  {isPurchasing || isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>Purchase for {selectedItem.price} SUI</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CosmeticsStore; 