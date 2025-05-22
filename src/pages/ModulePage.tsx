import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import NavBar from "@/components/NavBar";
import StarField from '@/components/StarField';
import Flashcard from '@/components/learning/Flashcard';
import Quiz from '@/components/learning/Quiz';
import AlienChallenge from '@/components/learning/AlienChallenge';
import { ModuleContent, getModule } from '@/services/geminiService';
import { 
  completeLesson, 
  completeQuiz, 
  completeAlienChallenge, 
  completeModule,
  getGalaxiesWithModules,
  unlockAchievement,
  checkDailyStreak,
  restoreStreak,
  ensureLearningProgressInitialized,
  isModuleCompleted
} from '@/services/learningService';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Rocket, Star, Trophy, Award, CircleCheck } from 'lucide-react';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import './module-page.css';
import confetti from 'canvas-confetti';
import { getFirestore, doc, collection, setDoc } from 'firebase/firestore';

// Add type declaration for the window object at the top of the file
declare global {
  interface Window {
    hasShownStreakModalThisSession?: boolean;
  }
}

type ModuleSection = 'intro' | 'flashcards' | 'quiz' | 'alienChallenge' | 'completion';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  xpReward: number;
}

const ModulePage: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { walletAddress, userData, refreshUserData } = useAuth();
  const currentAccount = useCurrentAccount();
  const disconnectMutation = useDisconnectWallet();
  const [connected, setConnected] = useState(false);
  
  // Update connection status when wallet changes
  useEffect(() => {
    setConnected(!!currentAccount);
  }, [currentAccount]);

  // Handle wallet connection
  const handleConnect = (address: string) => {
    setConnected(true);
    
    toast({
      title: "Wallet Connected",
      description: "Your progress will now be tracked and saved.",
      duration: 3000,
    });
  };

  // Handle wallet disconnection
  const handleDisconnect = async () => {
    try {
      // First update our local state
      setConnected(false);
      
      // Notify user
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected from this session.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      toast({
        title: "Error",
        description: "Failed to disconnect wallet.",
        variant: "destructive",
      });
    }
  };
  
  const [moduleContent, setModuleContent] = useState<ModuleContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState<ModuleSection>('intro');
  const [completedFlashcards, setCompletedFlashcards] = useState<string[]>([]);
  const [masteredFlashcards, setMasteredFlashcards] = useState<string[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [alienChallengeCompleted, setAlienChallengeCompleted] = useState(false);
  const [nextModuleId, setNextModuleId] = useState<string | null>(null);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const [moduleProgress, setModuleProgress] = useState(0);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([]);
  const [flashcardXpPool, setFlashcardXpPool] = useState(0);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpDetails, setLevelUpDetails] = useState({ oldLevel: 0, newLevel: 0 });
  const [showMissionCompletedModal, setShowMissionCompletedModal] = useState(false);
  const [showDailyStreakModal, setShowDailyStreakModal] = useState(false);
  const [streakDetails, setStreakDetails] = useState({ streak: 0, xpEarned: 0, isMilestone: false });
  
  // Handle flashcard completion
  const handleFlashcardComplete = async (cardId: string, mastered: boolean) => {
    if (!moduleId || !walletAddress || !moduleContent) return;
    
    try {
      // Track completed flashcard
      if (!completedFlashcards.includes(cardId)) {
        setCompletedFlashcards([...completedFlashcards, cardId]);
      }
      
      // Track mastered flashcards
      if (mastered && !masteredFlashcards.includes(cardId)) {
        setMasteredFlashcards([...masteredFlashcards, cardId]);
      }
      
      // Update module progress
      const flashcardsWeight = moduleContent.flashcards.length;
      const quizWeight = moduleContent.quiz.length;
      const aliensWeight = moduleContent.alienChallenges?.length || 0;
      
      const completedWeight = completedFlashcards.length + (quizCompleted ? quizWeight : 0) + 
        (alienChallengeCompleted ? aliensWeight : 0);
      
      const newProgress = Math.floor((completedWeight / (flashcardsWeight + quizWeight + aliensWeight)) * 100);
      setModuleProgress(newProgress);
      
      // Save progress to backend (XP will be awarded on module completion)
      const deferredXp = await completeLesson(walletAddress, moduleId, cardId);
      
      // Add to the flashcard XP pool (will be awarded on module completion)
      setFlashcardXpPool(flashcardXpPool + deferredXp);
      
      // Check for achievements
      await checkForAchievements();
      
      // Show progress toast for newly completed cards
      if (!completedFlashcards.includes(cardId)) {
        toast({
          title: `Flashcard Completed!`,
          description: mastered ? "Great job mastering this concept!" : "You've reviewed this flashcard",
          duration: 2000,
        });
      }
    } catch (err) {
      console.error('Error saving flashcard progress:', err);
      toast({
        title: "Error",
        description: "Failed to save your progress",
        variant: "destructive",
      });
    }
  };

  // Handle flashcards finished
  const handleFlashcardsFinished = () => {
    setTimeout(() => {
      setCurrentSection('quiz');
    }, 500);
  };
  
  // Listen for quiz reload events
  useEffect(() => {
    const handleQuizReload = () => {
      console.log("Quiz reload requested - attempting to refresh module content");
      
      // Try to reload the module content if we have it
      if (moduleId && walletAddress) {
        fetchModuleContent();
      }
    };
    
    const handleQuizFallbackLoaded = (event: CustomEvent) => {
      console.log("Using fallback quiz questions");
      
      // Use the fallback questions provided by the Quiz component
      if (event.detail && event.detail.questions && moduleContent) {
        // Create a new moduleContent object with the fallback questions
        setModuleContent({
          ...moduleContent,
          quiz: event.detail.questions
        });
      }
    };
    
    // Add event listeners
    document.addEventListener('reloadQuiz', handleQuizReload);
    document.addEventListener('quizFallbackLoaded', handleQuizFallbackLoaded as EventListener);
    
    // Clean up
    return () => {
      document.removeEventListener('reloadQuiz', handleQuizReload);
      document.removeEventListener('quizFallbackLoaded', handleQuizFallbackLoaded as EventListener);
    };
  }, [moduleId, walletAddress, moduleContent]);
  
  // Fetch module content (moved from useEffect for reusability)
  const fetchModuleContent = async () => {
    if (!moduleId) return;
    
    try {
      setLoading(true);
      
      // Fetch module content
      const content = await getModule(moduleId);
      
      // Log the generated quiz questions for debugging
      console.log(`%c[Quiz Debug] Module ${moduleId} questions loaded:`, 'background: #333; color: #bada55; padding: 2px 4px; border-radius: 2px;');
      if (content.quiz && content.quiz.length > 0) {
        console.table(content.quiz.map(q => ({
          question: q.question.substring(0, 50) + (q.question.length > 50 ? '...' : ''),
          options: q.options.length,
          correctAnswer: q.correctAnswer,
          hasExplanation: !!q.explanation
        })));
        console.log(`Total questions: ${content.quiz.length}`);
      } else {
        console.warn('No quiz questions were generated or returned!');
      }
      
      setModuleContent(content);
      
      if (walletAddress) {
        // Ensure learning progress documents are initialized before proceeding
        await ensureLearningProgressInitialized(walletAddress, moduleId);
        
        // Now we can safely fetch module progress and other data
        const galaxies = await getGalaxiesWithModules(walletAddress);
        let foundNextModule = false;
        let nextModule = null;
        
        // Find next module in progression
        for (const galaxy of galaxies) {
          for (let i = 0; i < galaxy.modules.length; i++) {
            const module = galaxy.modules[i];
            
            if (foundNextModule) {
              nextModule = module.id;
              break;
            }
            
            if (module.id === moduleId) {
              // If this is the last module in the galaxy, check the next galaxy
              if (i === galaxy.modules.length - 1) {
                const nextGalaxyIndex = galaxies.findIndex(g => g.id === galaxy.id) + 1;
                if (nextGalaxyIndex < galaxies.length) {
                  const nextGalaxy = galaxies[nextGalaxyIndex];
                  if (nextGalaxy.modules.length > 0) {
                    nextModule = nextGalaxy.modules[0].id;
                  }
                }
              } else {
                // Otherwise, next module in same galaxy
                nextModule = galaxy.modules[i + 1].id;
              }
              foundNextModule = true;
              break;
            }
          }
          if (foundNextModule) break;
        }
        
        setNextModuleId(nextModule);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching module content:', err);
      setError('Failed to load module content. Please try again.');
      setLoading(false);
    }
  };
  
  // Fetch module content on mount
  useEffect(() => {
    fetchModuleContent();
  }, [moduleId, walletAddress]);
  
  // Handle quiz completion
  const handleQuizComplete = async (
    score: number, 
    correctAnswers: number, 
    totalQuestions: number
  ) => {
    if (!moduleId || !walletAddress || !moduleContent) return;
    
    try {
      setQuizScore(score);
      setQuizCompleted(true);
      
      // Update module progress
      const flashcardsWeight = moduleContent.flashcards.length;
      const quizWeight = moduleContent.quiz.length;
      const aliensWeight = moduleContent.alienChallenges?.length || 0;
      
      const completedWeight = completedFlashcards.length + quizWeight + 
        (alienChallengeCompleted ? aliensWeight : 0);
      
      const newProgress = Math.floor((completedWeight / (flashcardsWeight + quizWeight + aliensWeight)) * 100);
      setModuleProgress(newProgress);
      
      // Save progress to backend (XP will be awarded on module completion)
      const deferredXp = await completeQuiz(
        walletAddress, 
        moduleId, 
        score, 
        correctAnswers, 
        totalQuestions
      );
      
      // Check for achievements
      await checkForAchievements();
      
      // Show quiz completion toast (without XP notification)
      toast({
        title: `Quiz Completed!`,
        description: `You scored ${score}% on the quiz`,
        duration: 2000,
      });
      
      // Move to alien challenge or completion
      setTimeout(() => {
        if (moduleContent.alienChallenges && moduleContent.alienChallenges.length > 0) {
          setCurrentSection('alienChallenge');
        } else {
          setCurrentSection('completion');
        }
      }, 1000);
    } catch (err) {
      console.error('Error saving quiz progress:', err);
      toast({
        title: "Error",
        description: "Failed to save your quiz results",
        variant: "destructive",
      });
    }
  };
  
  // Handle alien challenge completion
  const handleAlienChallengeComplete = async (challengeId: string, success: boolean) => {
    if (!moduleId || !walletAddress) return;
    
    try {
      setAlienChallengeCompleted(true);
      
      if (success) {
        // Save progress to backend (XP will be awarded on module completion)
        const deferredXp = await completeAlienChallenge(walletAddress, moduleId, challengeId);
        
        // Check for achievements
        await checkForAchievements();
        
        // Show completion toast (without XP notification)
        toast({
          title: `Alien Defeated!`,
          description: "You've completed the coding challenge",
          duration: 2000,
        });
      }
      
      // Move to completion section
      setTimeout(() => {
        setCurrentSection('completion');
        setModuleProgress(100);
      }, 2000);
    } catch (err) {
      console.error('Error saving alien challenge progress:', err);
      toast({
        title: "Error",
        description: "Failed to save your alien challenge results",
        variant: "destructive",
      });
    }
  };
  
  // Check for achievement unlocks
  const checkForAchievements = async () => {
    if (!moduleId || !walletAddress || !moduleContent) return;
    
    try {
      const newAchievements: Achievement[] = [];
      
      // First module completion
      if (moduleId === 'intro-to-sui' && currentSection === 'completion') {
        const achievement = {
          id: 'first-module-complete',
          title: 'First Steps',
          description: 'Complete your first learning module',
          icon: <Rocket className="h-5 w-5 text-purple-400" />,
          xpReward: 100
        };
        
        const awarded = await unlockAchievement(walletAddress, achievement.id, achievement.xpReward);
        if (awarded) {
          newAchievements.push(achievement);
        }
      }
      
      // Perfect quiz score
      if (quizScore === 100 && quizCompleted) {
        const achievement = {
          id: 'perfect-quiz',
          title: 'Quiz Master',
          description: 'Score 100% on a module quiz',
          icon: <Star className="h-5 w-5 text-yellow-400" />,
          xpReward: 150
        };
        
        const awarded = await unlockAchievement(walletAddress, achievement.id, achievement.xpReward);
        if (awarded) {
          newAchievements.push(achievement);
        }
      }
      
      // Master all flashcards
      if (moduleContent && masteredFlashcards.length === moduleContent.flashcards.length) {
        const achievement = {
          id: 'flashcard-master',
          title: 'Memory Master',
          description: 'Master all flashcards in a module',
          icon: <Trophy className="h-5 w-5 text-amber-400" />,
          xpReward: 200
        };
        
        const awarded = await unlockAchievement(walletAddress, achievement.id, achievement.xpReward);
        if (awarded) {
          newAchievements.push(achievement);
        }
      }
      
      if (newAchievements.length > 0) {
        setUnlockedAchievements([...unlockedAchievements, ...newAchievements]);
        
        // Show achievement unlocked toast
        newAchievements.forEach(achievement => {
          toast({
            title: `🏆 Achievement Unlocked: ${achievement.title}`,
            description: `${achievement.description} (+${achievement.xpReward} XP)`,
            duration: 5000,
          });
        });
      }
    } catch (err) {
      console.error('Error checking achievements:', err);
    }
  };
  
  // Complete module and navigate to next module
  const handleCompleteModule = async () => {
    try {
      if (!walletAddress) {
        toast({
          title: "Wallet Required",
          description: "Please connect your wallet to save progress",
          variant: "destructive",
        });
        return;
      }
      
      console.log(`Starting module completion process for ${moduleId} by user ${walletAddress}`);
      
      // Get the next module ID for navigation
      let nextModuleId = '';
      
      // Parse the current module id to determine the next one
      if (moduleId === 'intro-to-sui') {
        nextModuleId = 'module-2';
      } else {
        const currentNum = parseInt(moduleId.replace('module-', ''), 10);
        nextModuleId = `module-${currentNum + 1}`;
      }
      
      console.log(`Next module ID: ${nextModuleId}`);
      
      // Special handling for module-16 (last module)
      if (moduleId === 'module-16') {
        // This is the last module, show a special celebration
        setShowMissionCompletedModal(true);
        
        // Refresh user data from firestore to update the navbar
        await refreshUserData();
        
        // Record completion but don't navigate away
        let retryCount = 0;
        let result;
        
        while (retryCount < 3) {
          try {
            result = await completeModule(walletAddress, moduleId, moduleId);
            break; // Success, exit the loop
          } catch (error) {
            console.error(`Error completing module (attempt ${retryCount + 1}):`, error);
            retryCount++;
            if (retryCount < 3) {
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
            }
          }
        }
        
        if (result) {
          setTotalXpEarned(result.xpEarned);
          
          // Show special toast
          toast({
            title: `🌎 Mission Accomplished!`,
            description: `You've completed your journey and returned to Earth!`,
            duration: 5000,
          });
        } else {
          console.error("Failed to complete module after multiple attempts");
          toast({
            title: "Sync Error",
            description: "Your progress was saved but rewards might be delayed. Please refresh the page.",
            variant: "destructive",
            duration: 7000,
          });
        }
        
        return; // Don't proceed with normal navigation
      }
      
      // For regular modules
      if (!nextModuleId) return;
      
      // Save module completion with rewards
      let retryCount = 0;
      let result;
      
      while (retryCount < 3) {
        try {
          result = await completeModule(walletAddress, moduleId, nextModuleId);
          break; // Success, exit the loop
        } catch (error) {
          console.error(`Error completing module (attempt ${retryCount + 1}):`, error);
          retryCount++;
          if (retryCount < 3) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          }
        }
      }
      
      if (!result) {
        console.error("Failed to complete module after multiple attempts");
        toast({
          title: "Sync Error",
          description: "Your progress was saved but rewards might be delayed. Please refresh the page.",
          variant: "destructive",
          duration: 7000,
        });
        // Force navigation to next module anyway
        navigate(`/learning/${nextModuleId}`);
        return;
      }
      
      setTotalXpEarned(result.xpEarned);
      
      // Refresh user data from firestore to update the navbar
      await refreshUserData();
      
      // Check if user leveled up
      if (result.leveledUp && result.newLevel) {
        setLevelUpDetails({
          oldLevel: (result.newLevel - 1),
          newLevel: result.newLevel
        });
        setShowLevelUpModal(true);
      } else {
        // If no level up, just show XP toast
        toast({
          title: `Module Completed!`,
          description: `+${result.xpEarned} XP Earned`,
          duration: 3000,
        });
      }
      
      // Show SUI token reward toast
      toast({
        title: `🪙 SUI Tokens Awarded!`,
        description: `You've earned ${result.suiEarned} SUI for completing this module.`,
        duration: 4000,
        variant: "default",
        className: "sui-reward-toast",
      });
      
      // Show mystery box notification if awarded
      if (result.mysteryBoxAwarded) {
        toast({
          title: `🎁 Mystery Box Acquired!`,
          description: `You received a mystery box. Check the Rewards page to open it!`,
          duration: 5000,
          variant: "default",
          className: "mystery-box-toast",
        });
      }
      
      // Navigate to next module (after a short delay if showing level up modal)
      if (result.leveledUp) {
        setTimeout(() => {
          navigate(`/learning/${nextModuleId}`);
        }, 3000);
      } else {
        navigate(`/learning/${nextModuleId}`);
      }
    } catch (err) {
      console.error('Critical error in handleCompleteModule:', err);
      toast({
        title: "Error",
        description: "Failed to save module completion. Please try again or refresh the page.",
        variant: "destructive",
      });
      
      // Try a minimal update to at least mark progress
      try {
        console.log("Attempting minimal module completion");
        const db = getFirestore();
        const userProgressRef = doc(db, 'learningProgress', walletAddress || '');
        
        // Simple update to just mark completed
        const moduleProgressRef = doc(collection(userProgressRef, 'moduleProgress'), moduleId);
        await setDoc(moduleProgressRef, { completed: true }, { merge: true });
        
        console.log("Minimal module completion successful");
        
        // Parse the next module ID 
        let nextModuleId = '';
        if (moduleId === 'intro-to-sui') {
          nextModuleId = 'module-2';
        } else {
          const currentNum = parseInt(moduleId.replace('module-', ''), 10);
          nextModuleId = `module-${currentNum + 1}`;
        }
        
        // Navigate to next module anyway
        navigate(`/learning/${nextModuleId}`);
      } catch (recoveryError) {
        console.error("Recovery attempt failed:", recoveryError);
      }
    }
  };
  
  // Return to learning map
  const handleReturnToMap = () => {
    navigate('/learning');
  };
  
  // Simulated user data
  const userStats = {
    xp: userData?.xp || 0,
    streak: userData?.streak || 0,
    level: userData?.level || 1,
    username: userData?.displayName || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Explorer'),
    avatarSrc: userData?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=cosmic'
  };
  
  // Check for daily streak updates on initial load
  useEffect(() => {
    // Add a memory-based flag to track if we've shown the popup in this component
    let hasShownPopupInThisInstance = false;
    
    const updateDailyStreak = async () => {
      if (!walletAddress || hasShownPopupInThisInstance) return;
      
      // First check if we need to skip showing the popup
      const shouldSkipPopup = () => {
        // Check memory flag first
        if (hasShownPopupInThisInstance) return true;
        
        // Check global flag
        if (window.hasShownStreakModalThisSession === true) return true;
        
        // Check session storage
        const shownThisSession = sessionStorage.getItem('streak_popup_session') === 'true';
        if (shownThisSession) return true;
        
        // Check if we've already shown it today using ISO date string
        const today = new Date().toISOString().split('T')[0];
        const lastShownDay = localStorage.getItem('last_streak_popup_day');
        if (lastShownDay === today) return true;
        
        // Check if shown in last 6 hours via localStorage
        const lastTimestampStr = localStorage.getItem('streak_popup_last_timestamp');
        if (lastTimestampStr) {
          const lastTimestamp = parseInt(lastTimestampStr, 10);
          const sixHoursMs = 6 * 60 * 60 * 1000;
          return (Date.now() - lastTimestamp < sixHoursMs);
        }
        
        return false;
      };
      
      // Skip if we've already shown it
      if (shouldSkipPopup()) {
        console.log("ModulePage: Skipping streak popup due to recent display");
        return;
      }
      
      try {
        console.log("ModulePage: Checking daily streak...");
        const streakResult = await checkDailyStreak(walletAddress);
        
        if (streakResult.isNewDay) {
          console.log("ModulePage: New day detected, showing streak popup");
          
          // Set our local flag
          hasShownPopupInThisInstance = true;
          
          // Set global flag
          window.hasShownStreakModalThisSession = true;
          
          // Save to session and localStorage for other components
          sessionStorage.setItem('streak_popup_session', 'true');
          localStorage.setItem('streak_popup_last_timestamp', Date.now().toString());
          const today = new Date().toISOString().split('T')[0];
          localStorage.setItem('last_streak_popup_day', today);
          
          // Show streak notification as modal
          setStreakDetails({
            streak: streakResult.currentStreak,
            xpEarned: streakResult.xpAwarded,
            isMilestone: streakResult.isMilestone || false
          });
          setShowDailyStreakModal(true);
          
          // Refresh user data to update the streak count in the UI
          if (refreshUserData) {
            await refreshUserData();
          }
        } else {
          console.log("ModulePage: Not a new day, skipping streak popup");
        }
      } catch (error) {
        console.error("ModulePage: Error checking daily streak:", error);
      }
    };
    
    // Listen for streak check events from the AuthContext
    const handleStreakChecked = (event: CustomEvent) => {
      const streakData = event.detail;
      console.log("Streak event received in ModulePage:", streakData);
      
      // Skip if we've already shown the popup in this component instance
      if (hasShownPopupInThisInstance || window.hasShownStreakModalThisSession === true) {
        console.log("ModulePage: Already shown streak popup, skipping event");
        return;
      }
      
      if (streakData.isNewDay) {
        // Set our local flag
        hasShownPopupInThisInstance = true;
        
        // Set global flag
        window.hasShownStreakModalThisSession = true;
        
        // Set global storage flags
        sessionStorage.setItem('streak_popup_session', 'true');
        localStorage.setItem('streak_popup_last_timestamp', Date.now().toString());
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem('last_streak_popup_day', today);
        
        // Set popup details and show it
        setStreakDetails({
          streak: streakData.currentStreak,
          xpEarned: streakData.xpAwarded,
          isMilestone: streakData.isMilestone || false
        });
        setShowDailyStreakModal(true);
      }
    };
    
    // Add event listener for streak checks
    document.addEventListener('dailyStreakChecked', handleStreakChecked as EventListener);
    
    // Run streak check logic directly as well
    updateDailyStreak();
    
    // Cleanup event listener on unmount
    return () => {
      document.removeEventListener('dailyStreakChecked', handleStreakChecked as EventListener);
    };
  }, [walletAddress, refreshUserData]);

  // Handle streak restoration
  const handleRestoreStreak = async () => {
    if (!walletAddress) return;
    
    const success = await restoreStreak(walletAddress);
    
    if (success) {
      toast({
        title: "🔥 Streak Restored!",
        description: "Your daily streak has been restored.",
        duration: 3000,
      });
    } else {
      toast({
        title: "Error",
        description: "Not enough SUI tokens to restore streak.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };
  
  // Render appropriate section based on learning progress
  const renderSection = () => {
    if (!moduleContent) return null;
    
    switch (currentSection) {
      case 'intro':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="galaxy-card p-8 max-w-4xl mx-auto">
              <div className="space-stars absolute inset-0 overflow-hidden opacity-20"></div>
              <div className="relative z-10">
                <h2 className="text-3xl font-bold mb-6">{moduleContent.title}</h2>
                <p className="text-lg mb-8">{moduleContent.description}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-primary/10 rounded-lg p-4 flex items-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mr-4">
                      <Star className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Flashcards</h3>
                      <p className="text-sm">{moduleContent.flashcards.length} learning cards</p>
                    </div>
                  </div>
                  
                  <div className="bg-secondary/10 rounded-lg p-4 flex items-center">
                    <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center mr-4">
                      <Trophy className="h-6 w-6 text-secondary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Knowledge Quiz</h3>
                      <p className="text-sm">{moduleContent.quiz.length} time-based questions</p>
                    </div>
                  </div>
                  
                  {moduleContent.alienChallenges && moduleContent.alienChallenges.length > 0 && (
                    <div className="md:col-span-2 bg-purple-500/10 rounded-lg p-4 flex items-center">
                      <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mr-4">
                        <Rocket className="h-6 w-6 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Alien Challenge</h3>
                        <p className="text-sm">Defeat aliens with code!</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="text-center">
                  <Button 
                    onClick={() => setCurrentSection('flashcards')}
                    className="neon-button"
                    size="lg"
                  >
                    Begin Learning
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        );
        
      case 'flashcards':
        return (
          <motion.div
            key="flashcards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Flashcard 
              cards={moduleContent.flashcards}
              onComplete={handleFlashcardComplete}
              onFinish={handleFlashcardsFinished}
            />
          </motion.div>
        );
        
      case 'quiz':
        console.log("ModulePage: Rendering quiz section", moduleContent?.quiz ? `(${moduleContent.quiz.length} questions)` : '(no questions)');
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Quiz 
              questions={moduleContent.quiz}
              onComplete={handleQuizComplete}
            />
          </motion.div>
        );
        
      case 'alienChallenge':
        if (!moduleContent.alienChallenges || moduleContent.alienChallenges.length === 0) {
          return null;
        }
        
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AlienChallenge 
              challenge={moduleContent.alienChallenges[0]}
              onComplete={handleAlienChallengeComplete}
            />
          </motion.div>
        );
        
      case 'completion':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="galaxy-card p-8 max-w-4xl mx-auto">
              <div className="celebration-animation absolute inset-0 overflow-hidden opacity-30"></div>
              <div className="relative z-10 text-center">
                <h2 className="text-3xl font-bold mb-2">Mission Complete!</h2>
                <p className="text-lg mb-8">{moduleContent.summary}</p>
                
                <div className="bg-primary/10 rounded-lg p-6 mb-8 inline-block">
                  <h3 className="text-xl font-bold mb-4">Module Summary</h3>
                  <div className="flex flex-wrap justify-center gap-6">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-primary mb-1">{totalXpEarned}</div>
                      <div className="text-sm">XP Earned</div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-secondary mb-1">
                        {masteredFlashcards.length}/{moduleContent.flashcards.length}
                      </div>
                      <div className="text-sm">Cards Mastered</div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-accent mb-1">{quizScore}%</div>
                      <div className="text-sm">Quiz Score</div>
                    </div>
                  </div>
                </div>
                
                {unlockedAchievements.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-bold mb-4">Achievements Unlocked</h3>
                    <div className="flex flex-wrap justify-center gap-4">
                      {unlockedAchievements.map(achievement => (
                        <div key={achievement.id} className="achievement-card bg-card/50 backdrop-blur-sm p-4 rounded-lg border border-primary/30 text-center">
                          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                            <Award className="h-6 w-6 text-primary" />
                          </div>
                          <h4 className="font-semibold">{achievement.title}</h4>
                          <p className="text-xs text-foreground/70">{achievement.description}</p>
                          <div className="text-xs mt-2 text-yellow-500">+{achievement.xpReward} XP</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  {nextModuleId ? (
                    <Button 
                      onClick={handleCompleteModule}
                      className="neon-button"
                      size="lg"
                    >
                      <Rocket className="mr-2 h-5 w-5" />
                      Continue to Next Module
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleReturnToMap}
                      className="neon-button"
                      size="lg"
                    >
                      <Star className="mr-2 h-5 w-5" />
                      Complete Galaxy
                    </Button>
                  )}
                  
                  <Button 
                    onClick={handleReturnToMap}
                    variant="outline"
                    className="border-primary/50 text-primary"
                    size="lg"
                  >
                    Return to Galaxy Map
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        );
        
      default:
        return null;
    }
  };
  
  // Level up modal component
  const LevelUpModal = () => {
    // Add logging for modal visibility changes
    useEffect(() => {
      console.log(`LevelUpModal visibility changed: ${showLevelUpModal ? 'VISIBLE' : 'HIDDEN'}`);
      
      // Add keyboard event listener to close with Escape key
      const handleEscKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && showLevelUpModal) {
          console.log('Escape key pressed - closing modal');
          setShowLevelUpModal(false);
        }
      };
      
      // Add auto-close timeout as a fallback (15 seconds)
      const autoCloseTimeout = setTimeout(() => {
        if (showLevelUpModal) {
          console.log('Auto-closing modal after timeout');
          setShowLevelUpModal(false);
        }
      }, 15000);
      
      // Add event listener
      document.addEventListener('keydown', handleEscKey);
      
      // Cleanup
      return () => {
        document.removeEventListener('keydown', handleEscKey);
        clearTimeout(autoCloseTimeout);
      };
    }, [showLevelUpModal]);
    
    // Handle button click with event stopping
    const handleContinueClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent event from bubbling up to backdrop
      console.log('Continue button clicked directly');
      try {
        setShowLevelUpModal(false);
        console.log('Modal state updated to false via button handler');
      } catch (error) {
        console.error('Error in continue button handler:', error);
      }
    };
    
    if (!showLevelUpModal) return null;
    
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center z-50 bg-black/70"
        onClick={() => {
          console.log('Backdrop clicked - closing modal');
          setShowLevelUpModal(false);
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-lg p-8 max-w-md w-full mx-4 text-center border-2 border-primary shadow-[0_0_30px_rgba(79,70,229,0.5)]"
          onClick={(e) => e.stopPropagation()} // Prevent clicks on the modal from closing it
        >
          <div className="level-up-stars absolute inset-0 overflow-hidden opacity-20"></div>
          <div className="mb-4">
            <div className="w-20 h-20 mx-auto bg-primary/20 rounded-full flex items-center justify-center">
              <Trophy className="h-10 w-10 text-yellow-300" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Level Up!</h2>
          <p className="text-lg text-white/80 mb-6">
            Congratulations! You've reached level {levelUpDetails.newLevel}
          </p>
          
          <div className="flex justify-center items-center gap-6 mb-6">
            <div className="text-center">
              <div className="text-2xl font-semibold text-white/70">
                {levelUpDetails.oldLevel}
              </div>
              <div className="text-xs text-white/60">Previous</div>
            </div>
            <div className="w-16 h-1 bg-gradient-to-r from-purple-400 to-primary rounded-full"></div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                {levelUpDetails.newLevel}
              </div>
              <div className="text-xs text-white/60">Current</div>
            </div>
          </div>
          
          <Button 
            className="bg-primary hover:bg-primary/90 text-white"
            onClick={handleContinueClick}
            data-testid="level-up-continue-button"
          >
            Continue
          </Button>
        </motion.div>
      </div>
    );
  };
  
  // Mission completed modal component for Earth completion
  const MissionCompletedModal = () => {
    if (!showMissionCompletedModal) return null;
    
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/80">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-gradient-to-br from-blue-900 to-green-900 rounded-lg p-8 max-w-lg w-full mx-4 text-center border-2 border-blue-400 shadow-[0_0_40px_rgba(0,120,255,0.7)]"
        >
          <div className="mission-complete-stars absolute inset-0 overflow-hidden opacity-20"></div>
          <div className="mb-6">
            <div className="w-32 h-32 mx-auto rounded-full overflow-hidden earth-module">
              <div className="earth-icon w-full h-full"></div>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Mission Accomplished!</h2>
          <div className="text-lg text-white/80 mb-6 space-y-3">
            <p>
              Congratulations! You've completed your journey through the Sui universe 
              and safely returned to Earth.
            </p>
            <p>
              You are now a master of Sui blockchain development, ready to build amazing 
              applications with your new skills.
            </p>
          </div>
          
          <div className="mb-6 space-y-3">
            <div className="p-3 bg-blue-800/40 rounded-lg">
              <p className="text-sm text-white/90">
                <span className="font-bold">16 Modules Completed</span>
                <br />
                You've mastered all aspects of Sui development
              </p>
            </div>
            <div className="p-3 bg-green-800/40 rounded-lg">
              <p className="text-sm text-white/90">
                <span className="font-bold">Mission Success</span>
                <br />
                The knowledge you've gained will help create the future of web3
              </p>
            </div>
          </div>
          
          <div className="flex justify-center gap-4">
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => navigate('/learning')}
            >
              Return to Map
            </Button>
            <Button 
              variant="outline"
              className="border-white text-white hover:bg-white/10"
              onClick={() => setShowMissionCompletedModal(false)}
            >
              Continue Exploring
            </Button>
          </div>
        </motion.div>
      </div>
    );
  };
  
  // Daily streak modal component
  const DailyStreakModal = () => {
    if (!showDailyStreakModal) return null;
    
    // Launch confetti when the modal appears
    useEffect(() => {
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
    }, [streakDetails.isMilestone]);
    
    // Handle background click (close modal on backdrop click)
    const handleBackdropClick = () => {
      setShowDailyStreakModal(false);
    };
    
    // Handle button click - with stopPropagation to prevent backdrop handler from firing
    const handleButtonClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent event from bubbling up to backdrop
      setShowDailyStreakModal(false);
    };

    // Get appropriate message based on streak
    const getStreakMessage = () => {
      if (streakDetails.streak === 0) {
        return "Welcome back! Start your learning streak today!";
      } else if (streakDetails.streak === 1) {
        return "You've started your learning streak! Come back tomorrow to continue.";
      } else if (streakDetails.isMilestone) {
        return `Impressive! You've reached a ${streakDetails.streak}-day streak milestone!`;
      } else {
        return `You've logged in for ${streakDetails.streak} days in a row!`;
      }
    };
    
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center z-50 bg-black/70"
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-gradient-to-br from-orange-500 to-amber-700 rounded-lg p-8 max-w-md w-full mx-4 text-center border-2 border-yellow-400 shadow-[0_0_30px_rgba(249,115,22,0.5)]"
          onClick={(e) => e.stopPropagation()} // Prevent clicks on the modal from closing it
        >
          <div className="level-up-stars absolute inset-0 overflow-hidden opacity-20"></div>
          <div className="mb-4">
            <div className="w-20 h-20 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center">
              <CircleCheck className="h-10 w-10 text-yellow-300" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Daily Streak!</h2>
          <p className="text-lg text-white/80 mb-6">
            {getStreakMessage()}
          </p>
          
          <div className="flex justify-center items-center gap-6 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                {streakDetails.streak}
              </div>
              <div className="text-xs text-white/60">Day Streak</div>
            </div>
            
            {streakDetails.xpEarned > 0 && (
              <>
                <div className="h-12 w-[1px] bg-white/20"></div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center text-2xl font-semibold text-white">
                    <Star className="h-5 w-5 text-yellow-300 mr-1" />
                    +{streakDetails.xpEarned}
                  </div>
                  <div className="text-xs text-white/60">XP Earned</div>
                </div>
              </>
            )}
          </div>
          
          {streakDetails.isMilestone && (
            <div className="mb-6 p-3 bg-yellow-600/40 rounded-lg">
              <p className="text-sm text-white/90">
                <span className="font-bold">🎁 Bonus Reward!</span>
                <br />
                You've earned a Rare Mystery Box for your dedication!
              </p>
            </div>
          )}
          
          <Button 
            className="bg-yellow-500 hover:bg-yellow-600 text-white relative z-10"
            onClick={handleButtonClick}
          >
            Awesome!
          </Button>
        </motion.div>
      </div>
    );
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="relative min-h-screen">
        <StarField />
        <NavBar 
          connected={connected}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          userXp={userStats.xp}
          userStreak={userStats.streak}
          userLevel={userStats.level}
          username={userStats.username}
          avatarSrc={userStats.avatarSrc}
        />
        <div className="container mx-auto pt-24 px-4 pb-20 flex justify-center items-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-xl font-medium">Loading Module Content...</h3>
            <p className="text-foreground/60">Preparing your learning journey</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="relative min-h-screen">
        <StarField />
        <NavBar 
          connected={connected}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          userXp={userStats.xp}
          userStreak={userStats.streak}
          userLevel={userStats.level}
          username={userStats.username}
          avatarSrc={userStats.avatarSrc}
        />
        <div className="container mx-auto pt-24 px-4 pb-20 flex justify-center items-center min-h-[60vh]">
          <Card className="galaxy-card p-8 max-w-xl">
            <div className="text-center">
              <h3 className="text-xl font-medium mb-2">Error Loading Module</h3>
              <p className="text-foreground/60 mb-4">{error}</p>
              <Button onClick={handleReturnToMap}>Return to Galaxy Map</Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="relative min-h-screen">
      <StarField />
      <NavBar 
        connected={connected}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        userXp={userStats.xp}
        userStreak={userStats.streak}
        userLevel={userStats.level}
        username={userStats.username}
        avatarSrc={userStats.avatarSrc}
      />
      
      <main className="container mx-auto pt-24 px-4 pb-20">
        {/* Module header */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <Button 
              variant="ghost" 
              onClick={handleReturnToMap}
              className="mb-2"
            >
              ← Back to Galaxy Map
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold">
              {moduleContent?.title || 'Learning Module'}
            </h1>
          </div>
          
          <div className="mt-4 md:mt-0">
            <div className="bg-primary/10 rounded-full px-4 py-1 flex items-center">
              <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
              <span className="text-sm">Progress: {moduleProgress}%</span>
            </div>
            
            {/* Test button for development mode */}
            {process.env.NODE_ENV !== 'production' && (
              <Button
                variant="outline"
                size="sm"
                className="ml-2 text-xs"
                onClick={() => {
                  // Set test streak details
                  setStreakDetails({
                    streak: 7, // Test with milestone
                    xpEarned: 125, // Combined regular + milestone reward
                    isMilestone: true
                  });
                  setShowDailyStreakModal(true);
                }}
              >
                Test Streak Modal
              </Button>
            )}
          </div>
        </div>
        
        {/* Module content section */}
        <section className="py-4">
          <AnimatePresence mode="wait">
            {renderSection()}
          </AnimatePresence>
        </section>
      </main>
      
      {/* Modals */}
      <AnimatePresence>
        {showLevelUpModal && <LevelUpModal />}
        {showMissionCompletedModal && <MissionCompletedModal />}
        {showDailyStreakModal && <DailyStreakModal />}
      </AnimatePresence>
      
      {/* Test buttons for development mode */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="mt-4 p-4 border border-yellow-500 rounded-md bg-yellow-500/10">
          <h3 className="text-sm font-bold mb-2">Debug Tools</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={async () => {
                const isCompleted = await isModuleCompleted(walletAddress || '', moduleId || '');
                toast({
                  title: `Module Status: ${isCompleted ? 'COMPLETED' : 'NOT COMPLETED'}`,
                  description: `Check console for details`,
                  duration: 3000,
                });
              }}
            >
              Check Module Status
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                const win = window as any;
                if (win.testModulePopup) {
                  win.testModulePopup();
                  toast({
                    title: "Test Popup Triggered",
                    description: "Check if popup appears",
                    duration: 3000,
                  });
                } else {
                  toast({
                    title: "Error",
                    description: "Test function not found",
                    variant: "destructive",
                    duration: 3000,
                  });
                }
              }}
            >
              Test Popup Function
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                const win = window as any;
                if (win.showDirectModuleCompletionPopup) {
                  win.showDirectModuleCompletionPopup({
                    moduleId: parseInt(moduleId?.replace(/\D/g, '') || '1', 10),
                    moduleName: moduleContent?.title || 'Debug Module',
                    walletAddress: walletAddress || 'debug-wallet',
                    xpEarned: 200,
                    suiEarned: 0.75
                  });
                  toast({
                    title: "Direct Popup Triggered",
                    description: "Using direct component access",
                    duration: 3000,
                  });
                } else {
                  toast({
                    title: "Error",
                    description: "Direct popup function not found",
                    variant: "destructive",
                    duration: 3000,
                  });
                }
              }}
            >
              Force Module Popup
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="text-xs bg-red-500/10"
              onClick={async () => {
                try {
                  if (!walletAddress || !moduleId) {
                    toast({
                      title: "Error",
                      description: "Wallet or module ID missing",
                      variant: "destructive",
                      duration: 3000,
                    });
                    return;
                  }
                  
                  const nextId = moduleId === 'intro-to-sui' ? 'module-2' : 
                    `module-${parseInt(moduleId.replace(/\D/g, '') || '1', 10) + 1}`;
                  
                  toast({
                    title: "Manual Module Completion",
                    description: "Processing...",
                    duration: 3000,
                  });
                  
                  const result = await completeModule(walletAddress, moduleId, nextId);
                  
                  toast({
                    title: "Module Completed Manually",
                    description: `XP: ${result.xpEarned}, SUI: ${result.suiEarned}`,
                    duration: 3000,
                  });
                } catch (err) {
                  console.error("Manual completion error:", err);
                  toast({
                    title: "Error",
                    description: "Failed to manually complete module",
                    variant: "destructive",
                    duration: 3000,
                  });
                }
              }}
            >
              Force Module Completion
            </Button>
          </div>
          <p className="text-xs mt-2 text-yellow-500">These buttons are only visible in development mode</p>
        </div>
      )}
    </div>
  );
};

export default ModulePage; 