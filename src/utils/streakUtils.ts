import type { StreakDetails } from '@/components/DailyStreakModal';

// XP rewards constants matching learningService.ts
const XP_REWARDS = {
  DAILY_STREAK: 25,
  STREAK_MILESTONE: 100
};

// Track if we've shown the streak modal in this browser session
let hasShownStreakModalThisSession = false;

// Make sure we access the global variable properly
if (typeof window !== 'undefined') {
  hasShownStreakModalThisSession = !!(window as any).hasShownStreakModalThisSession;
}

/**
 * Shows the daily streak modal with the given details
 * This function is separated from the component to avoid Fast Refresh issues
 */
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
    return !(hasShownStreakModalThisSession || (window as any).hasShownStreakModalThisSession === true);
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
  if (typeof window !== 'undefined') {
    (window as any).hasShownStreakModalThisSession = true;
  }
  sessionStorage.setItem('streak_popup_session', 'true');
  localStorage.setItem('streak_popup_last_timestamp', Date.now().toString());
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem('last_streak_popup_day', today);
  
  // Remove login flag after successfully showing
  sessionStorage.removeItem('just_connected_wallet');
  
  // Use the global window method to show the modal if it exists
  if (typeof window !== 'undefined' && (window as any).showStreakModal) {
    // Ensure streak details has non-zero XP value
    const updatedDetails = {
      ...details,
      xpEarned: details.xpEarned > 0 ? details.xpEarned : (
        details.isMilestone ? 
          XP_REWARDS.DAILY_STREAK + XP_REWARDS.STREAK_MILESTONE : 
          XP_REWARDS.DAILY_STREAK
      )
    };
    
    (window as any).showStreakModal(updatedDetails);
  } else {
    console.warn('[streakUtils] Cannot show streak modal: window.showStreakModal not found');
  }
}; 