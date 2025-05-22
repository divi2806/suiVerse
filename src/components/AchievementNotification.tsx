import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Star, Coins, XIcon } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Achievement } from '@/services/achievementsService';

interface AchievementNotificationProps {
  achievement: Achievement | null;
  onClose: () => void;
}

const AchievementNotification: React.FC<AchievementNotificationProps> = ({ 
  achievement, 
  onClose 
}) => {
  const [visible, setVisible] = useState(true);
  
  useEffect(() => {
    if (achievement) {
      // Trigger confetti when a new achievement is shown
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.5, y: 0.3 }
      });
      
      // Auto-close after 7 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 7000);
      
      return () => clearTimeout(timer);
    }
  }, [achievement]);
  
  const handleClose = () => {
    setVisible(false);
    // Delay the actual close callback to allow exit animation to complete
    setTimeout(onClose, 500);
  };
  
  if (!achievement) return null;
  
  // Helper function to get icon by string name
  const getIconComponent = (iconName: string) => {
    // You can expand this with more icons as needed
    switch (iconName) {
      case 'Award':
        return <Award className={`h-8 w-8 ${achievement.iconColor}`} />;
      case 'Star':
        return <Star className={`h-8 w-8 ${achievement.iconColor}`} />;
      case 'Coins':
        return <Coins className={`h-8 w-8 ${achievement.iconColor}`} />;
      default:
        return <Award className={`h-8 w-8 ${achievement.iconColor}`} />;
    }
  };
  
  return (
    <AnimatePresence>
      {visible && (
        <motion.div 
          className="fixed top-24 right-5 z-50 max-w-md"
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 100, opacity: 0 }}
          transition={{ duration: 0.5, type: 'spring', bounce: 0.3 }}
        >
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/30 rounded-lg p-4 shadow-lg backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <div className="bg-background/40 p-3 rounded-full">
                {getIconComponent(achievement.icon)}
              </div>
              
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-foreground">Achievement Unlocked!</h3>
                    <h4 className="font-medium text-primary">{achievement.title}</h4>
                  </div>
                  <button 
                    onClick={handleClose}
                    className="text-foreground/60 hover:text-foreground"
                  >
                    <XIcon className="h-5 w-5" />
                  </button>
                </div>
                
                <p className="mt-1 text-sm text-foreground/80">{achievement.description}</p>
                
                <div className="mt-2 flex gap-3">
                  <div className="flex items-center text-yellow-500">
                    <Star className="h-4 w-4 mr-1" />
                    <span className="text-sm font-medium">+{achievement.xpReward} XP</span>
                  </div>
                  
                  {achievement.suiReward > 0 && (
                    <div className="flex items-center text-blue-500">
                      <Coins className="h-4 w-4 mr-1" />
                      <span className="text-sm font-medium">+{achievement.suiReward} SUI</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AchievementNotification; 