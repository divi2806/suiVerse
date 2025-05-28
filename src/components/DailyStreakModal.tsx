import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { CalendarCheck, Flame, Award, Star } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '@/contexts/AuthContext';

// Add type declaration for the window object
declare global {
  interface Window {
    hasShownStreakModalThisSession?: boolean;
  }
}

// Track if we've shown the streak modal in this browser session
let hasShownStreakModalThisSession = false;

// Make this global for better coordination across components
if (typeof window !== 'undefined') {
  window.hasShownStreakModalThisSession = false;
}

// Initialize from localStorage/sessionStorage at startup
if (typeof window !== 'undefined') {
  // Check when the last popup was shown (timestamp)
  const lastTimestampStr = localStorage.getItem('streak_popup_last_timestamp');
  if (lastTimestampStr) {
    const lastTimestamp = parseInt(lastTimestampStr, 10);
    const hoursSinceLastPopup = (Date.now() - lastTimestamp) / (1000 * 60 * 60);
    
    // If it's been less than 24 hours since last popup, respect the flags
    if (hoursSinceLastPopup < 24) {
      // Check if we've shown it today
      const today = new Date().toISOString().split('T')[0];
      const lastShownDay = localStorage.getItem('last_streak_popup_day');
      if (lastShownDay === today) {
        
        hasShownStreakModalThisSession = true;
        window.hasShownStreakModalThisSession = true;
      }
      
      // Also check session storage
      if (sessionStorage.getItem('streak_popup_session') === 'true') {
        
        hasShownStreakModalThisSession = true;
        window.hasShownStreakModalThisSession = true;
      }
    } else {
      // More than 24 hours have passed, reset flags
      
      hasShownStreakModalThisSession = false;
      window.hasShownStreakModalThisSession = false;
      localStorage.removeItem('last_streak_popup_day');
      sessionStorage.removeItem('streak_popup_session');
    }
  }
}

// We'll store an instance of this component in a global variable
// so we can trigger it from anywhere
let globalShowStreakModal: ((details: StreakDetails) => void) | null = null;

interface StreakDetails {
  streak: number;
  xpEarned: number;
  isMilestone: boolean;
  leveledUp?: boolean;
  newLevel?: number;
}

// Export a function that can be called from anywhere
export const showDailyStreakModal = (details: StreakDetails) => {
  // Check if this is a login event by checking session storage
  const isLoginEvent = sessionStorage.getItem('just_connected_wallet') === 'true';
  
  // Check if more than 24 hours have passed since last popup
  const shouldAllowNewPopup = () => {
    // If it's a login event, always allow
    if (isLoginEvent) {
      
      return true;
    }
    
    const lastTimestampStr = localStorage.getItem('streak_popup_last_timestamp');
    if (lastTimestampStr) {
      const lastTimestamp = parseInt(lastTimestampStr, 10);
      const hoursSinceLastPopup = (Date.now() - lastTimestamp) / (1000 * 60 * 60);
      
      // If it's been over 24 hours, allow a new popup regardless of other flags
      if (hoursSinceLastPopup >= 24) {
        
        return true;
      }
    } else {
      // No timestamp recorded, this is first time, allow popup
      return true;
    }
    
    // Otherwise, check session flags
    return !(hasShownStreakModalThisSession || window.hasShownStreakModalThisSession === true);
  };
  
  // Check if we should skip based on shorter time periods (same day/session)
  const shouldSkipStreak = () => {
    // If we're forcing a new popup due to login or 24+ hours, don't skip
    if (shouldAllowNewPopup()) {
      return false;
    }
    
    // Check session storage
    const shownThisSession = sessionStorage.getItem('streak_popup_session') === 'true';
    
    // Check if shown today already using ISO date string
    const today = new Date().toISOString().split('T')[0];
    const lastShownDay = localStorage.getItem('last_streak_popup_day');
    if (lastShownDay === today && !isLoginEvent) {
      
      return true;
    }
    
    // Check if shown in last 6 hours via localStorage
    const lastTimestampStr = localStorage.getItem('streak_popup_last_timestamp');
    if (lastTimestampStr && !isLoginEvent) {
      const lastTimestamp = parseInt(lastTimestampStr, 10);
      const sixHoursMs = 6 * 60 * 60 * 1000;
      if (Date.now() - lastTimestamp < sixHoursMs) {
        
        return true;
      }
    }
    
    return shownThisSession && !isLoginEvent;
  };
  
  if (shouldSkipStreak()) {
    
    return;
  }
  
  
  
  // Mark as shown - set ALL flags for maximum redundancy
  hasShownStreakModalThisSession = true;
  window.hasShownStreakModalThisSession = true;
  sessionStorage.setItem('streak_popup_session', 'true');
  localStorage.setItem('streak_popup_last_timestamp', Date.now().toString());
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem('last_streak_popup_day', today);
  
  // Remove login flag after successfully showing
  sessionStorage.removeItem('just_connected_wallet');
  
  // Actually show the modal
  if (globalShowStreakModal) {
    globalShowStreakModal(details);
  } else {
    
  }
};

const DailyStreakModal = () => {
  const [open, setOpen] = useState(false);
  const [streakDetails, setStreakDetails] = useState<StreakDetails>({
    streak: 0,
    xpEarned: 0,
    isMilestone: false
  });
  const { userData } = useAuth();

  // Register the global modal trigger
  useEffect(() => {
    globalShowStreakModal = (details: StreakDetails) => {
      setStreakDetails(details);
      setOpen(true);
    };

    // Listen for the dailyStreakChecked event
    const handleStreakChecked = (event: CustomEvent) => {
      const data = event.detail;
      
      // Check if this is a login event by checking session storage
      const isLoginEvent = sessionStorage.getItem('just_connected_wallet') === 'true';
      
      // Reset session flag if login event to ensure popup shows
      if (isLoginEvent) {
        hasShownStreakModalThisSession = false;
        window.hasShownStreakModalThisSession = false;
      }
      
      // Skip if we've already shown the modal this session and it's not a login event
      if (hasShownStreakModalThisSession && !isLoginEvent) {
        
        return;
      }
      
      if (data.isNewDay || isLoginEvent) {
        // Mark as shown
        hasShownStreakModalThisSession = true;
        sessionStorage.setItem('streak_popup_session', 'true');
        localStorage.setItem('streak_popup_last_timestamp', Date.now().toString());
        
        showDailyStreakModal({
          streak: data.currentStreak,
          xpEarned: data.xpAwarded,
          isMilestone: data.isMilestone || false,
          leveledUp: data.leveledUp || false,
          newLevel: data.newLevel
        });
      } else {
        
      }
    };

    document.addEventListener('dailyStreakChecked', handleStreakChecked as EventListener);

    return () => {
      globalShowStreakModal = null;
      document.removeEventListener('dailyStreakChecked', handleStreakChecked as EventListener);
    };
  }, []);

  // When the modal opens, trigger confetti
  useEffect(() => {
    if (open) {
      // Fire confetti with colors matching the streak theme
      confetti({
        particleCount: streakDetails.isMilestone ? 150 : 100,
        spread: 70,
        origin: { x: 0.5, y: 0.3 },
        colors: ['#f59e0b', '#fbbf24', '#fcd34d']
      });
      
      // If it's a milestone, add a second confetti burst after a delay
      if (streakDetails.isMilestone) {
        setTimeout(() => {
          confetti({
            particleCount: 100,
            spread: 90,
            origin: { x: 0.5, y: 0.3 },
            colors: ['#f59e0b', '#fbbf24', '#fcd34d']
          });
        }, 300);
      }
    }
  }, [open, streakDetails]);

  const getMilestoneText = (streak: number) => {
    if (streak === 7) return "One Week Streak!";
    if (streak === 30) return "One Month Streak!";
    if (streak === 100) return "Century Streak!";
    if (streak === 365) return "One Year Streak!";
    if (streak % 100 === 0) return `${streak} Day Streak!`;
    if (streak % 30 === 0) return `${Math.floor(streak / 30)} Month Streak!`;
    if (streak % 7 === 0) return `${Math.floor(streak / 7)} Week Streak!`;
    return `${streak} Day Streak!`;
  };

  // Set flags when modal is closed
  const handleCloseModal = () => {
    setOpen(false);
    
    // Make sure flags are set in all persistence mechanisms
    hasShownStreakModalThisSession = true;
    window.hasShownStreakModalThisSession = true;
    sessionStorage.setItem('streak_popup_session', 'true');
    localStorage.setItem('streak_popup_last_timestamp', Date.now().toString());
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('last_streak_popup_day', today);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        // Call our custom close function when the dialog is closed
        handleCloseModal();
      } else {
        setOpen(isOpen);
      }
    }}>
      <DialogContent className="sm:max-w-md bg-background border-2 border-yellow-500/40 shadow-glow-yellow">
        <DialogHeader className="space-y-3 text-center">
          <DialogTitle className="text-2xl font-bold">
            {streakDetails.streak === 1 ? (
              <span className="text-yellow-500">You started a streak!</span>
            ) : streakDetails.isMilestone ? (
              <span className="text-yellow-500">{getMilestoneText(streakDetails.streak)}</span>
            ) : (
              <span className="text-yellow-500">Streak continued!</span>
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
            {streakDetails.isMilestone ? (
              <div className="h-24 w-24 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Award className="h-14 w-14 text-yellow-500" />
              </div>
            ) : (
              <div className="h-24 w-24 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Flame className="h-14 w-14 text-yellow-500" />
              </div>
            )}
            <div className="absolute -top-2 -right-2 bg-primary text-white rounded-full h-8 w-8 flex items-center justify-center font-bold">
              {streakDetails.streak}
            </div>
          </motion.div>

          <div className="text-center space-y-2">
            <p className="text-lg">
              You've maintained your learning streak for{' '}
              <span className="font-bold text-yellow-500">{streakDetails.streak} {streakDetails.streak === 1 ? 'day' : 'days'}</span>!
            </p>
            <p className="text-sm text-gray-300">
              Keep learning every day to earn more rewards.
            </p>
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mt-4 px-4 py-2 bg-yellow-500/10 rounded-md border border-yellow-500/30"
            >
              <div className="flex items-center justify-center">
                <CalendarCheck className="h-5 w-5 text-yellow-500 mr-2" />
                <span className="text-yellow-500 font-medium">+{streakDetails.xpEarned} XP Earned!</span>
              </div>
            </motion.div>

            {streakDetails.leveledUp && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="mt-2 px-4 py-2 bg-blue-500/10 rounded-md border border-blue-500/30"
              >
                <div className="flex items-center justify-center">
                  <Star className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-blue-500 font-medium">Level Up! You reached level {streakDetails.newLevel}!</span>
                </div>
              </motion.div>
            )}

            {streakDetails.isMilestone && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="mt-2 text-sm text-yellow-500 font-semibold"
              >
                Milestone reached! Special rewards unlocked!
              </motion.div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleCloseModal}
            className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
          >
            Keep Learning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DailyStreakModal; 