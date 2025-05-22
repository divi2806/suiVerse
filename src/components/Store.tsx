
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Coins, Star, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import MysteryBox from '@/components/MysteryBox';

interface StoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'box' | 'booster' | 'avatar' | 'theme';
  boxType?: 'common' | 'rare' | 'epic' | 'legendary';
  boostAmount?: number;
  boostDuration?: string;
  image?: string;
}

interface StoreProps {
  userCoins: number;
  onPurchase: (itemId: string) => void;
}

const Store: React.FC<StoreProps> = ({ userCoins, onPurchase }) => {
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);

  const storeItems: StoreItem[] = [
    {
      id: 'common-box',
      name: 'Common Mystery Box',
      description: 'Contains common rewards and a small chance for rare items',
      price: 150,
      type: 'box',
      boxType: 'common',
    },
    {
      id: 'rare-box',
      name: 'Rare Mystery Box',
      description: 'Higher chance for rare rewards and a chance for epic items',
      price: 300,
      type: 'box',
      boxType: 'rare',
    },
    {
      id: 'epic-box',
      name: 'Epic Mystery Box',
      description: 'Guaranteed rare rewards and high chance for epic items',
      price: 600,
      type: 'box',
      boxType: 'epic',
    },
    {
      id: 'legendary-box',
      name: 'Legendary Mystery Box',
      description: 'Guaranteed epic rewards and a chance for legendary items',
      price: 1200,
      type: 'box',
      boxType: 'legendary',
    },
    {
      id: 'xp-booster-small',
      name: 'XP Booster: Small',
      description: '1.5x XP boost for 24 hours',
      price: 250,
      type: 'booster',
      boostAmount: 1.5,
      boostDuration: '24 hours',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=boost-small'
    },
    {
      id: 'xp-booster-medium',
      name: 'XP Booster: Medium',
      description: '2x XP boost for 24 hours',
      price: 450,
      type: 'booster',
      boostAmount: 2,
      boostDuration: '24 hours',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=boost-medium'
    },
    {
      id: 'xp-booster-large',
      name: 'XP Booster: Large',
      description: '3x XP boost for 12 hours',
      price: 600,
      type: 'booster',
      boostAmount: 3,
      boostDuration: '12 hours',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=boost-large'
    }
  ];

  const handlePurchase = (item: StoreItem) => {
    if (userCoins < item.price) {
      toast({
        title: "Insufficient Coins",
        description: "You don't have enough coins to purchase this item.",
        variant: "destructive"
      });
      return;
    }

    onPurchase(item.id);
    toast({
      title: "Purchase Successful",
      description: `You've purchased ${item.name}!`,
      variant: "default"
    });
  };

  const renderBoxPreview = (type: 'common' | 'rare' | 'epic' | 'legendary') => {
    return (
      <div className="flex justify-center my-4">
        <MysteryBox 
          boxType={type} 
          onOpen={() => {}}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-heading font-bold flex items-center">
          <ShoppingCart className="mr-2 h-5 w-5 text-primary" />
          Galactic Store
        </h2>
        <div className="flex items-center bg-primary/10 px-3 py-2 rounded-lg">
          <Coins className="h-5 w-5 text-yellow-500 mr-2" />
          <span className="font-medium">{userCoins} coins</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {storeItems.map((item) => (
          <motion.div
            key={item.id}
            className="galaxy-card border border-primary/20 overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => setSelectedItem(item)}
          >
            <div className="p-4">
              <h3 className="font-medium text-base mb-1">{item.name}</h3>
              <p className="text-xs text-foreground/70 mb-3 line-clamp-2">{item.description}</p>

              {item.type === 'booster' && (
                <div className="bg-accent/10 p-2 rounded flex items-center justify-center mb-3">
                  <Star className="h-5 w-5 text-accent mr-2" />
                  <span className="text-sm font-medium">{item.boostAmount}x for {item.boostDuration}</span>
                </div>
              )}

              {item.type === 'box' && item.boxType && (
                <div className="h-20 flex items-center justify-center relative overflow-hidden">
                  <div className={`w-12 h-12 rounded-lg 
                    ${item.boxType === 'legendary' ? 'bg-purple-500/50 animate-pulse' :
                    item.boxType === 'epic' ? 'bg-pink-500/50 animate-pulse' :
                    item.boxType === 'rare' ? 'bg-blue-500/50 animate-pulse' :
                    'bg-green-500/50 animate-pulse'}`}
                  >
                    <Box className="w-full h-full p-2 text-white" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80"></div>
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center">
                  <Coins className="h-4 w-4 text-yellow-500 mr-1" />
                  <span className="font-medium">{item.price}</span>
                </div>

                <Button 
                  size="sm" 
                  className={`px-3 py-1 h-8 ${userCoins >= item.price ? 'neon-button' : 'bg-muted/50 text-muted-foreground'}`}
                  disabled={userCoins < item.price}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePurchase(item);
                  }}
                >
                  Buy Now
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {selectedItem && selectedItem.type === 'box' && selectedItem.boxType && (
        <div className="galaxy-card p-6 mt-8 border border-primary/30">
          <h3 className="text-lg font-medium text-center mb-4">{selectedItem.name} Preview</h3>
          {renderBoxPreview(selectedItem.boxType)}
          <div className="text-center mt-4">
            <p className="text-sm text-foreground/80 mb-4">{selectedItem.description}</p>
            <Button 
              className="neon-button" 
              onClick={() => handlePurchase(selectedItem)}
              disabled={userCoins < selectedItem.price}
            >
              Purchase for {selectedItem.price} coins
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Store;
