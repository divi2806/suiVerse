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
  // Check if we've shown it today
  const today = new Date().toISOString().split('T')[0];
  const lastShownDay = localStorage.getItem('last_streak_popup_day');
  if (lastShownDay === today) {
    console.log("DailyStreakModal: Found record of showing popup today already - setting flags");
    hasShownStreakModalThisSession = true;
    window.hasShownStreakModalThisSession = true;
  }
  
  // Also check session storage
  if (sessionStorage.getItem('streak_popup_session') === 'true') {
    console.log("DailyStreakModal: Found session storage flag for popup - setting flags");
    hasShownStreakModalThisSession = true;
    window.hasShownStreakModalThisSession = true;
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
  // Check for restrictions
  if (hasShownStreakModalThisSession || window.hasShownStreakModalThisSession === true) {
    console.log("Streak modal already shown this session, ignoring request");
    return;
  }
  
  // Check if we should skip based on localStorage/sessionStorage
  const shouldSkipStreak = () => {
    // Check session storage
    const shownThisSession = sessionStorage.getItem('streak_popup_session') === 'true';
    
    // Check if shown today already using ISO date string
    const today = new Date().toISOString().split('T')[0];
    const lastShownDay = localStorage.getItem('last_streak_popup_day');
    if (lastShownDay === today) {
      console.log("Already shown streak popup today (date check)");
      return true;
    }
    
    // Check if shown in last 6 hours via localStorage
    const lastTimestampStr = localStorage.getItem('streak_popup_last_timestamp');
    if (lastTimestampStr) {
      const lastTimestamp = parseInt(lastTimestampStr, 10);
      const sixHoursMs = 6 * 60 * 60 * 1000;
      if (Date.now() - lastTimestamp < sixHoursMs) {
        console.log("Already shown streak popup in last 6 hours");
        return true;
      }
    }
    
    return shownThisSession;
  };
  
  if (shouldSkipStreak()) {
    console.log("Streak modal skipped due to recent display");
    return;
  }
  
  // Mark as shown - set ALL flags for maximum redundancy
  hasShownStreakModalThisSession = true;
  window.hasShownStreakModalThisSession = true;
  sessionStorage.setItem('streak_popup_session', 'true');
  localStorage.setItem('streak_popup_last_timestamp', Date.now().toString());
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem('last_streak_popup_day', today);
  
  // Actually show the modal
  if (globalShowStreakModal) {
    globalShowStreakModal(details);
  } else {
    console.error("Daily streak modal not initialized yet");
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
      // Skip if we've already shown the modal this session
      if (hasShownStreakModalThisSession) {
        console.log("DailyStreakModal: Already shown this session, ignoring event");
        return;
      }
      
      const data = event.detail;
      if (data.isNewDay) {
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
        console.log("Skipping streak modal - not a new day");
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