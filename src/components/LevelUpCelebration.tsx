import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trophy, Star, Award, Gift, Coins } from 'lucide-react';
import confetti from 'canvas-confetti';

// We'll store an instance of this component in a global variable
// so we can trigger it from anywhere
let globalShowLevelUpModal: ((details: LevelUpDetails) => void) | null = null;

export interface LevelUpDetails {
  oldLevel: number;
  newLevel: number;
  oldTier?: string;
  newTier?: string;
  xpAwarded?: number;
  suiAwarded?: number;
  cosmetics?: Array<{
    name: string;
    type: string;
    image?: string;
  }>;
}

// Export a function that can be called from anywhere
export const showLevelUpCelebration = (details: LevelUpDetails) => {
  if (globalShowLevelUpModal) {
    globalShowLevelUpModal(details);
  } else {
    console.error("Level up modal not initialized yet");
  }
};

// Function to determine if this is a tier change
const isTierChange = (details: LevelUpDetails) => {
  return details.oldTier !== details.newTier;
};

const LevelUpCelebration = () => {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<LevelUpDetails>({
    oldLevel: 0,
    newLevel: 0
  });

  // Register the global modal trigger
  useEffect(() => {
    globalShowLevelUpModal = (details: LevelUpDetails) => {
      setDetails(details);
      setOpen(true);
    };

    return () => {
      globalShowLevelUpModal = null;
    };
  }, []);

  // When the modal opens, trigger confetti
  useEffect(() => {
    if (open) {
      // Fire confetti with colors matching the level theme
      const isTierUp = isTierChange(details);
      
      // Tier change gets a more dramatic celebration
      if (isTierUp) {
        // First confetti burst
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { x: 0.5, y: 0.3 },
          colors: ['#4f46e5', '#8b5cf6', '#c084fc', '#d8b4fe']
        });
        
        // Second burst after a delay
        setTimeout(() => {
          confetti({
            particleCount: 100,
            spread: 100,
            origin: { x: 0.5, y: 0.3 },
            colors: ['#4f46e5', '#8b5cf6', '#c084fc', '#d8b4fe']
          });
        }, 300);
        
        // Third burst after another delay
        setTimeout(() => {
          confetti({
            particleCount: 80,
            angle: 60,
            spread: 55,
            origin: { x: 0.1, y: 0.5 },
            colors: ['#4f46e5', '#8b5cf6', '#c084fc', '#d8b4fe']
          });
          
          confetti({
            particleCount: 80,
            angle: 120,
            spread: 55,
            origin: { x: 0.9, y: 0.5 },
            colors: ['#4f46e5', '#8b5cf6', '#c084fc', '#d8b4fe']
          });
        }, 600);
      } else {
        // Regular level up gets a simpler celebration
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { x: 0.5, y: 0.3 },
          colors: ['#4f46e5', '#8b5cf6', '#c084fc', '#d8b4fe']
        });
      }
    }
  }, [open, details]);

  // Get an appropriate message based on the level details
  const getLevelUpMessage = () => {
    if (isTierChange(details)) {
      return `You've reached the ${details.newTier} rank!`;
    } else {
      return `You've reached level ${details.newLevel}!`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => setOpen(isOpen)}>
      <DialogContent className="sm:max-w-md bg-background border-2 border-primary/40 shadow-glow">
        <DialogHeader className="space-y-3 text-center">
          <DialogTitle className="text-2xl font-bold">
            {isTierChange(details) ? (
              <span className="text-primary">Rank Promotion!</span>
            ) : (
              <span className="text-primary">Level Up!</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-4 space-y-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            {isTierChange(details) ? (
              <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center">
                <Award className="h-14 w-14 text-primary" />
              </div>
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center">
                <Trophy className="h-14 w-14 text-primary" />
              </div>
            )}
            <div className="absolute -top-2 -right-2 bg-primary text-white rounded-full h-8 w-8 flex items-center justify-center font-bold">
              {details.newLevel}
            </div>
          </motion.div>

          <div className="text-center space-y-2">
            <p className="text-lg">
              Congratulations! {getLevelUpMessage()}
            </p>
            
            <div className="flex justify-center items-center gap-8 my-4">
              <div className="text-center">
                <div className="text-2xl font-semibold text-muted-foreground">
                  {details.oldLevel}
                </div>
                <div className="text-xs text-muted-foreground">Previous</div>
              </div>
              <div className="w-16 h-1 bg-gradient-to-r from-purple-400 to-primary rounded-full"></div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {details.newLevel}
                </div>
                <div className="text-xs text-muted-foreground">Current</div>
              </div>
            </div>
            
            {isTierChange(details) && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="p-3 bg-primary/10 rounded-lg border border-primary/30 mt-4"
              >
                <p className="font-semibold text-primary mb-1">Congratulations, new {details.newTier}!</p>
                <p className="text-sm">
                  You've ascended to a higher rank with new privileges and rewards!
                </p>
              </motion.div>
            )}
            
            {/* If XP was awarded, show it */}
            {details.xpAwarded && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="px-4 py-2 bg-primary/10 rounded-md border border-primary/30 inline-block mt-2"
              >
                <div className="flex items-center justify-center">
                  <Star className="h-5 w-5 text-primary mr-2" />
                  <span className="text-primary font-medium">+{details.xpAwarded} XP Bonus!</span>
                </div>
              </motion.div>
            )}
            
            {/* If SUI was awarded, show it */}
            {details.suiAwarded && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="px-4 py-2 bg-blue-500/10 rounded-md border border-blue-500/30 inline-block mt-2"
              >
                <div className="flex items-center justify-center">
                  <Coins className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-blue-500 font-medium">+{details.suiAwarded} SUI Tokens!</span>
                </div>
              </motion.div>
            )}

            {/* If cosmetics were awarded, show them */}
            {details.cosmetics && details.cosmetics.length > 0 && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="mt-4"
              >
                <p className="text-sm font-medium mb-2">Special Rewards Unlocked:</p>
                <div className="flex justify-center gap-2">
                  {details.cosmetics.map((item, index) => (
                    <div key={index} className="bg-card/60 border border-primary/20 rounded-lg p-2 text-center">
                      <div className="w-10 h-10 rounded-full mx-auto mb-1 bg-primary/10 flex items-center justify-center">
                        <Gift className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-xs">{item.name}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button 
            className="w-full"
            onClick={() => setOpen(false)}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LevelUpCelebration; 