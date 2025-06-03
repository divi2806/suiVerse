import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { XP_REWARDS } from '@/constants/xpRewards';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Rocket, Star, Trophy, Award, CircleCheck, CheckCircle } from 'lucide-react';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import './module-page.css';
import confetti from 'canvas-confetti';
import { getFirestore, doc, collection, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import DailyStreakModal from '@/components/DailyStreakModal';
// Import the streakUtils functions explicitly with a different name to avoid conflicts
import * as streakUtils from '@/utils/streakUtils';
// Add logger import at the top of the file
import logger from '@/utils/logger';

// Revert to original interface
declare global {
  interface Window {
    hasShownStreakModalThisSession?: boolean;
    showModuleCompletionPopup: (data: {
      moduleId: number;
      moduleName: string;
      walletAddress: string;
      xpEarned: number;
      suiEarned: number;
      quizScore?: number;
    }) => void;
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
  const [showDailyStreakModal, setShowDailyStreakModal] = useState(false);
  const [streakDetails, setStreakDetails] = useState({ streak: 0, xpEarned: 0, isMilestone: false });
  const [galaxyName, setGalaxyName] = useState<string>("");
  const [moduleNumber, setModuleNumber] = useState<number>(0);
  const [completionData, setCompletionData] = useState<{
    moduleId: number;
    moduleName: string;
    xpEarned: number;
    suiEarned: number;
    quizScore?: number;
  }>({
    moduleId: 1,
    moduleName: '',
    xpEarned: 0,
    suiEarned: 0
  });
  
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
      
      
      // Try to reload the module content if we have it
      if (moduleId && walletAddress) {
        fetchModuleContent();
      }
    };
    
    const handleQuizFallbackLoaded = (event: CustomEvent) => {
      
      
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
      if (content.quiz && content.quiz.length > 0) {
        logger.log(`[ModulePage] Module ${moduleId} has ${content.quiz.length} quiz questions`);
      } else {
        logger.warn(`[ModulePage] No quiz questions found for module ${moduleId}`);
      }

      // Ensure the module has alienChallenges
      if (!content.alienChallenges || content.alienChallenges.length === 0) {
        logger.warn(`[ModulePage] No alien challenges found for module ${moduleId}, adding fallback challenge`);
        
        // Create a fallback alien challenge
        content.alienChallenges = [{
          id: `${moduleId}-fallback-challenge`,
          scenario: "An alien programmer challenges you to implement a basic Sui module.",
          task: "Complete the implementation of this module based on the template.",
          codeSnippet: `module example::my_module {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  
  // TODO: Define a custom struct with appropriate abilities
  
  // TODO: Implement a function to create and transfer the object
}`,
          solution: `module example::my_module {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  
  struct MyObject has key, store {
      id: UID,
      data: u64
  }
  
  entry fun create(data: u64, ctx: &mut TxContext) {
      let obj = MyObject {
          id: object::new(ctx),
          data
      };
      transfer::transfer(obj, tx_context::sender(ctx));
  }
}`,
          hints: [
            "Define a struct with the key ability",
            "Create a function to mint your object",
            "Transfer the object to the sender"
          ]
        }];
      }
      
      // Log alien challenges for debugging
      if (content.alienChallenges && content.alienChallenges.length > 0) {
        logger.log(`[ModulePage] Module ${moduleId} has ${content.alienChallenges.length} alien challenges`);
      }
      
      setModuleContent(content);
      
      // Determine which galaxy this module belongs to
      let foundGalaxy = "";
      let moduleNum = 0;
      
      // Import galaxy modules mapping from geminiService
      const GALAXY_MODULES = {
        'genesis': ['intro-to-sui', 'smart-contracts-101'],
        'explorer': ['move-language', 'objects-ownership'],
        'nebula': ['advanced-concepts', 'nft-marketplace'],
        'cosmic': ['defi-protocols', 'blockchain-security'],
        'nova': ['tokenomics', 'cross-chain-apps'],
        'stellar': ['sui-governance', 'zk-applications'],
        'quantum': ['gaming-on-blockchain', 'social-networks'],
        'aurora': ['identity-solutions', 'real-world-assets'],
        'home': ['graduation-galaxy']
      };
      
      // Find galaxy and module number
      for (const [galaxyId, modules] of Object.entries(GALAXY_MODULES)) {
        if (modules.includes(moduleId)) {
          foundGalaxy = galaxyId;
          moduleNum = modules.indexOf(moduleId) + 1;
          break;
        }
      }
      
      // Format galaxy name for display (capitalize first letter)
      const formattedGalaxyName = foundGalaxy.charAt(0).toUpperCase() + foundGalaxy.slice(1);
      setGalaxyName(formattedGalaxyName);
      setModuleNumber(moduleNum);
      
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
        // Always check if alienChallenges exists and has at least one item
        if (moduleContent.alienChallenges && moduleContent.alienChallenges.length > 0) {
          logger.log(`[ModulePage] Moving to alien challenge for module ${moduleId}`);
          setCurrentSection('alienChallenge');
        } else {
          logger.log(`[ModulePage] No alien challenges found for module ${moduleId}, moving to completion`);
          setCurrentSection('completion');
        }
      }, 1000);
    } catch (err) {
      
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
      
      // Get the next module ID for navigation
      if (!nextModuleId) {
        // Get galaxies data to determine next module properly
        const galaxiesData = await getGalaxiesWithModules(walletAddress);
        let foundCurrentModule = false;
        let nextId = '';
      
        // Find the current module and determine the next one
        for (const galaxy of galaxiesData) {
          for (let i = 0; i < galaxy.modules.length; i++) {
            const module = galaxy.modules[i];
            
            if (foundCurrentModule) {
              nextId = module.id;
              break;
            }
            
            if (module.id === moduleId) {
              foundCurrentModule = true;
              // If this is the last module in the galaxy, check the next galaxy
              if (i === galaxy.modules.length - 1) {
                const nextGalaxyIndex = galaxiesData.findIndex(g => g.id === galaxy.id) + 1;
                if (nextGalaxyIndex < galaxiesData.length) {
                  const nextGalaxy = galaxiesData[nextGalaxyIndex];
                  if (nextGalaxy.modules.length > 0) {
                    nextId = nextGalaxy.modules[0].id;
                  }
                }
              } else {
                // Otherwise, next module in same galaxy
                nextId = galaxy.modules[i + 1].id;
              }
            }
          }
          if (foundCurrentModule && nextId) break;
        }
        
        if (nextId) {
          // We found the next module
          setNextModuleId(nextId);
          
          // We need to wait for state update
          await new Promise(resolve => setTimeout(resolve, 50));
        } else {
          // Fallback to the sequence-based approach
          if (moduleId === 'intro-to-sui') {
            setNextModuleId('smart-contracts-101');
          } else if (moduleId === 'smart-contracts-101') {
            setNextModuleId('move-language');
          } else {
            const currentNum = parseInt(moduleId.replace('module-', ''), 10);
            setNextModuleId(`module-${currentNum + 1}`);
          }
      
          // We need to wait for state update
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      // Special handling for module-16 (last module)
      if (moduleId === 'module-16') {
        // This is the last module, show a special celebration
        
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
          
          // Parse module ID to get a numeric ID
          let moduleNumId = 16;
          
          // Show the global module completion popup
          try {
            window.showModuleCompletionPopup({
              moduleId: moduleNumId,
              moduleName: moduleContent?.title || 'Final Module',
              walletAddress: walletAddress,
              xpEarned: result.xpEarned,
              suiEarned: result.suiEarned || 0.5,
              quizScore: quizScore
            });
          } catch (error) {
            logger.error('[ModulePage] Error showing completion popup:', error);
          }
        } else {
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
      
      // Force a reasonable XP value for modules even if there's a sync issue
      // This ensures users always see some reward
      const minXpReward = 200;
      
      // Save module completion with rewards
      let retryCount = 0;
      let result;
      
      while (retryCount < 3) {
        try {
          result = await completeModule(walletAddress, moduleId, nextModuleId);
          break; // Success, exit the loop
        } catch (error) {
          logger.error('[ModulePage] Error completing module:', error);
          retryCount++;
          if (retryCount < 3) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          }
        }
      }
      
      // Update local state even if there's a server error
      if (!result) {
        logger.warn('[ModulePage] Using fallback completion logic');
        
        // Create a fallback result with reasonable default values
        result = {
          xpEarned: minXpReward,
          suiEarned: 0.5,
          leveledUp: false,
          mysteryBoxAwarded: false
        };
        
        // Make a final attempt to update Firebase directly
        try {
          const db = getFirestore();
          const userProgressRef = doc(db, 'learningProgress', walletAddress);
          
          await updateDoc(userProgressRef, {
            completedModules: arrayUnion(moduleId),
            currentModuleId: nextModuleId,
            lastActivityTimestamp: serverTimestamp()
          });
          
          logger.log('[ModulePage] Manual Firebase update successful');
        } catch (directError) {
          logger.error('[ModulePage] Manual Firebase update failed:', directError);
        }
        
        toast({
          title: "Module Completed",
          description: "Your progress was saved but rewards might be delayed. Please continue to the next module.",
          duration: 7000,
        });
        
        // Force navigation to next module anyway
        navigate(`/learning/${nextModuleId}`);
        return;
      }
      
      // Success path
      setTotalXpEarned(result.xpEarned);
      
      // Refresh user data from firestore to update the navbar
      await refreshUserData();
      
      // Check if we've already shown the mission completed modal for this module in this session
      const missionCompletedKey = `module_${moduleId}_completed`;
      const hasShownMissionCompletedModal = sessionStorage.getItem(missionCompletedKey) === 'true';
      
      if (!hasShownMissionCompletedModal) {
        // Set the flag to prevent showing it again
        sessionStorage.setItem(missionCompletedKey, 'true');
        
        // Parse module ID to get a numeric ID
        let moduleNumId = 1;
        if (moduleId === 'intro-to-sui') {
          moduleNumId = 1;
        } else if (moduleId === 'smart-contracts-101') {
          moduleNumId = 2;
        } else if (moduleId === 'move-language') {
          moduleNumId = 3;
        } else if (moduleId === 'objects-ownership') {
          moduleNumId = 4;
        } else {
          const match = moduleId.match(/\d+/);
          if (match) {
            moduleNumId = parseInt(match[0], 10);
          }
        }
        
        // Show the global module completion popup
        try {
          window.showModuleCompletionPopup({
            moduleId: moduleNumId,
            moduleName: moduleContent?.title || 'Module',
            walletAddress: walletAddress,
            xpEarned: result.xpEarned,
            suiEarned: result.suiEarned,
            quizScore: quizScore
          });
        } catch (error) {
          logger.error('[ModulePage] Error showing completion popup:', error);
        }
      
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
      } else {
        logger.log(`[ModulePage] Mission completed modal already shown for module ${moduleId}, skipping`);
      }
      
      // Check if this was the last module in the current galaxy and unlock the next galaxy if needed
      try {
        const galaxiesData = await getGalaxiesWithModules(walletAddress);
        
        // Find current galaxy
        const currentGalaxy = galaxiesData.find(g => g.modules.some(m => m.id === moduleId));
        
        if (currentGalaxy) {
          // For the galaxy completion check, we need to include the current module in our completion check
          const allModulesInGalaxyCompleted = currentGalaxy.modules.every(m => 
            m.id === moduleId || // This is the module we just completed
            m.completed || // This module was already marked as completed
            isModuleCompleted(walletAddress, m.id) // Check completion through API
          );
          
          logger.log(`[ModulePage] Galaxy completion check in handleCompleteModule:`, {
            galaxyId: currentGalaxy.id,
            moduleId,
            allModulesInGalaxyCompleted
          });
          
          // Find the next galaxy to check if it's already unlocked
          const nextGalaxyIndex = galaxiesData.findIndex(g => g.id === currentGalaxy.id) + 1;
          
          if (allModulesInGalaxyCompleted && nextGalaxyIndex < galaxiesData.length) {
            const nextGalaxy = galaxiesData[nextGalaxyIndex];
            
            // Check if next galaxy is already unlocked to prevent duplicate unlocks
            const isNextGalaxyAlreadyUnlocked = nextGalaxy.unlocked === true;
            
            if (!isNextGalaxyAlreadyUnlocked) {
              logger.log(`[ModulePage] All modules in galaxy ${currentGalaxy.id} completed, unlocking next galaxy`);
              
              // Import unlockNextGalaxy from learningService
              const { unlockNextGalaxy } = await import('@/services/learningService');
              
              // Unlock the next galaxy
              const unlocked = await unlockNextGalaxy(walletAddress, currentGalaxy.id);
              
              if (unlocked) {
                // Set a session flag to prevent duplicate notifications
                const galaxyUnlockKey = `galaxy_${currentGalaxy.id}_unlocked_${nextGalaxy.id}`;
                if (!sessionStorage.getItem(galaxyUnlockKey)) {
                  sessionStorage.setItem(galaxyUnlockKey, 'true');
                  
                  // Dispatch a galaxy unlocked event
                  const galaxyUnlockedEvent = new CustomEvent('galaxyUnlocked', {
                    detail: { 
                      galaxyId: currentGalaxy.id,
                      nextGalaxyId: currentGalaxy.id + 1
                    }
                  });
                  document.dispatchEvent(galaxyUnlockedEvent);
                  
                  logger.log(`[ModulePage] Galaxy ${nextGalaxy.id} (${nextGalaxy.name}) unlocked`);
                }
              }
      } else {
              logger.log(`[ModulePage] Next galaxy ${nextGalaxy.id} already unlocked, skipping unlock process`);
            }
          }
        }
      } catch (galaxyError) {
        logger.error('[ModulePage] Error checking galaxy completion:', galaxyError);
      }
      
      // Trigger a custom event for module completion to ensure the galaxy map updates
      const moduleCompletionEvent = new CustomEvent('moduleCompleted', {
        detail: {
          moduleId,
          nextModuleId,
          walletAddress,
          xpEarned: result.xpEarned,
          suiEarned: result.suiEarned
        }
      });
      document.dispatchEvent(moduleCompletionEvent);
      
      // Ensure the event is processed before navigation
      setTimeout(() => {
      // Don't automatically navigate to the next module - let the user do it from the Mission Complete modal
      // This will fix the issue where modules auto-complete without user interaction
      
      // Instead of this:
      // if (result.leveledUp) {
      //   setTimeout(() => {
      //     navigate(`/learning/${nextModuleId}`);
      //   }, 3000);
      // } else {
      //   navigate(`/learning/${nextModuleId}`);
      // }
      
      // Just show appropriate modals and let the user proceed manually
      }, 100);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to save module completion. Please try again or refresh the page.",
        variant: "destructive",
      });
      
      // Try a minimal update to at least mark progress
      try {
        const db = getFirestore();
        const userProgressRef = doc(db, 'learningProgress', walletAddress || '');
        
        // Simple update to just mark completed
        const moduleProgressRef = doc(collection(userProgressRef, 'moduleProgress'), moduleId);
        await setDoc(moduleProgressRef, { completed: true }, { merge: true });
        
        // Parse the next module ID 
        let nextModuleId = '';
        if (moduleId === 'intro-to-sui') {
          nextModuleId = 'smart-contracts-101';
        } else if (moduleId === 'smart-contracts-101') {
          nextModuleId = 'move-language';
        } else if (moduleId === 'move-language') {
          nextModuleId = 'objects-ownership';
        } else if (moduleId === 'objects-ownership') {
          nextModuleId = 'advanced-concepts';
        } else if (moduleId === 'advanced-concepts') {
          nextModuleId = 'nft-marketplace';
        } else {
          // Get current module ID and increment it
          try {
            // Try to parse an ID like module-2
            const matches = moduleId?.match(/^([a-z-]+)-(\d+)$/);
            if (matches && matches.length === 3) {
              const prefix = matches[1];
              const num = parseInt(matches[2], 10);
              nextModuleId = `${prefix}-${num + 1}`;
            } else {
              // Default to returning to galaxy map if we can't determine next module
              navigate('/learning');
              return;
            }
          } catch (error) {
            logger.error('[ModulePage] Error determining next module:', error);
            // Default to returning to galaxy map on error
            navigate('/learning');
            return;
          }
        }
        
        // Also update the main progress document to ensure completedModules array is updated
        await updateDoc(userProgressRef, {
          completedModules: arrayUnion(moduleId),
          currentModuleId: nextModuleId,
          lastUpdated: serverTimestamp()
        });
        
        // Dispatch event to update the galaxy map
        const moduleCompletionEvent = new CustomEvent('moduleCompleted', {
          detail: {
            moduleId,
            nextModuleId,
            walletAddress: walletAddress || '',
            xpEarned: 0
          }
        });
        document.dispatchEvent(moduleCompletionEvent);
        
        // Navigate to next module anyway
        navigate(`/learning/${nextModuleId}`);
      } catch (recoveryError) {
        logger.error('[ModulePage] Recovery error:', recoveryError);
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
        
        return;
      }
      
      try {
        
        const streakResult = await checkDailyStreak(walletAddress);
        
        if (streakResult.isNewDay) {
          
          
          // Set our local flag
          hasShownPopupInThisInstance = true;
          
          // Use imported showDailyStreakModal instead of local state
          streakUtils.showDailyStreakModal({
            streak: streakResult.currentStreak,
            xpEarned: streakResult.xpAwarded,
            isMilestone: streakResult.isMilestone || false
          });
          
          // Refresh user data to update the streak count in the UI
          if (refreshUserData) {
            await refreshUserData();
          }
        } else {
          
        }
      } catch (error) {
        
      }
    };
    
    // Listen for streak check events from the AuthContext
    const handleStreakChecked = (event: CustomEvent) => {
      const streakData = event.detail;
      
      
      // Skip if we've already shown the popup in this component instance
      if (hasShownPopupInThisInstance || window.hasShownStreakModalThisSession === true) {
        
        return;
      }
      
      if (streakData.isNewDay) {
        // Set our local flag
        hasShownPopupInThisInstance = true;
        
        // Use imported showDailyStreakModal function
        streakUtils.showDailyStreakModal({
          streak: streakData.currentStreak,
          xpEarned: streakData.xpAwarded,
          isMilestone: streakData.isMilestone || false
        });
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
                <div className="mb-4 flex items-center">
                  <div className="bg-primary/20 rounded-lg px-3 py-1 text-sm font-medium text-primary flex items-center">
                    <Rocket className="h-4 w-4 mr-1.5" />
                    {galaxyName} Galaxy • Module {moduleNumber}
                  </div>
                </div>
                <h2 className="text-3xl font-bold mb-6">{moduleContent.title}</h2>
                <p className="text-lg mb-8">{moduleContent.description}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-primary/10 rounded-lg p-4 flex items-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mr-4">
                      <Star className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Flashcards</h3>
                      <p className="text-sm">15 learning cards</p>
                    </div>
                  </div>
                  
                  <div className="bg-secondary/10 rounded-lg p-4 flex items-center">
                    <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center mr-4">
                      <Trophy className="h-6 w-6 text-secondary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Knowledge Quiz</h3>
                      <p className="text-sm">10 time-based questions</p>
                    </div>
                  </div>
                  
                    <div className="md:col-span-2 bg-purple-500/10 rounded-lg p-4 flex items-center">
                      <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mr-4">
                        <Rocket className="h-6 w-6 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Alien Challenge</h3>
                        <p className="text-sm">Defeat aliens with code!</p>
                      </div>
                    </div>
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
          logger.warn(`[ModulePage] No alien challenges found for module ${moduleId}, using fallback`);
          
          // If no alien challenges are available, create a fallback challenge
          const fallbackChallenge = {
            id: `${moduleId}-fallback-challenge`,
            scenario: "An alien programmer challenges you to implement a basic Sui module.",
            task: "Complete the implementation of this module based on the template.",
            codeSnippet: `module example::my_module {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  
  // TODO: Define a custom struct with appropriate abilities
  
  // TODO: Implement a function to create and transfer the object
}`,
            solution: `module example::my_module {
  use sui::object::{Self, UID};
  use sui::transfer;
  use sui::tx_context::{Self, TxContext};
  
  struct MyObject has key, store {
      id: UID,
      data: u64
  }
  
  entry fun create(data: u64, ctx: &mut TxContext) {
      let obj = MyObject {
          id: object::new(ctx),
          data
      };
      transfer::transfer(obj, tx_context::sender(ctx));
  }
}`,
            hints: [
              "Define a struct with the key ability",
              "Create a function to mint your object",
              "Transfer the object to the sender"
            ]
          };
          
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AlienChallenge 
                challenge={fallbackChallenge}
                onComplete={handleAlienChallengeComplete}
              />
            </motion.div>
          );
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
                      <div className="text-4xl font-bold text-primary mb-1">{totalXpEarned || XP_REWARDS.COMPLETE_MODULE}</div>
                      <div className="text-sm">XP Earned</div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-cyan-400">{masteredFlashcards.length}/{moduleContent.flashcards.length}</div>
                      <div className="text-sm text-muted-foreground">Cards Mastered</div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-accent mb-1">{quizScore || 0}%</div>
                      <div className="text-sm">Quiz Score</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-card/20 backdrop-blur-sm rounded-lg p-4 mb-8">
                  <h3 className="text-lg font-bold mb-3">Rewards Earned</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-background/30 rounded-lg flex items-center">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mr-3">
                        <Star className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium">{totalXpEarned || XP_REWARDS.COMPLETE_MODULE} XP</div>
                        <div className="text-xs text-foreground/70">Experience Points</div>
                      </div>
                    </div>
                    <div className="p-3 bg-background/30 rounded-lg flex items-center">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center mr-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-amber-500">
                          <path d="M12 2L8 6H16L12 2Z" fill="currentColor" />
                          <path d="M12 22L16 18H8L12 22Z" fill="currentColor" />
                          <circle cx="12" cy="12" r="6" fill="currentColor" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium">0.5 SUI</div>
                        <div className="text-xs text-foreground/70">Tokens Awarded</div>
                      </div>
                    </div>
                    <div className="p-3 bg-background/30 rounded-lg flex items-center">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mr-3">
                        <Trophy className="h-5 w-5 text-purple-500" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium">Module NFT</div>
                        <div className="text-xs text-foreground/70">Minted Successfully</div>
                      </div>
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
                
                <div className="mt-6 text-center">
                  <Button onClick={handleCompleteModule} className="w-full">
                      Click to Claim Rewards
                    </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Your progress has been saved
                  </p>
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
      
      
      // Add keyboard event listener to close with Escape key
      const handleEscKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && showLevelUpModal) {
          
          setShowLevelUpModal(false);
        }
      };
      
      // Add auto-close timeout as a fallback (15 seconds)
      const autoCloseTimeout = setTimeout(() => {
        if (showLevelUpModal) {
          
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
      
      try {
        setShowLevelUpModal(false);
        
      } catch (error) {
        
      }
    };
    
    if (!showLevelUpModal) return null;
    
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center z-50 bg-black/70"
        onClick={() => {
          
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
              <span className="text-sm">{galaxyName} Galaxy • {moduleProgress}% Complete</span>
            </div>
            
            {/* Test button for development mode */}
            {process.env.NODE_ENV !== 'production' && (
              <Button
                variant="outline"
                size="sm"
                className="ml-2 text-xs"
                onClick={() => {
                  // Set test streak details with proper XP reward values
                  // For a milestone (7 days), we use 25 (regular) + 100 (milestone) = 125 XP
                  const milestoneXp = 125;
                  
                  // Use the streakUtils function to show the modal
                  streakUtils.showDailyStreakModal({
                    streak: 7,
                    xpEarned: milestoneXp, // Proper XP for 7-day milestone
                    isMilestone: true
                  });
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
                // Show module completion popup directly
                if (moduleId && window.showModuleCompletionPopup) {
                  // Parse module ID to get a numeric ID
                  let moduleNumId = 1;
                  if (moduleId === 'intro-to-sui') {
                    moduleNumId = 1;
                  } else if (moduleId === 'smart-contracts-101') {
                    moduleNumId = 2;
                  } else if (moduleId === 'move-language') {
                    moduleNumId = 3;
                  } else if (moduleId === 'objects-ownership') {
                    moduleNumId = 4;
                  } else {
                    const match = moduleId.match(/\d+/);
                    if (match) {
                      moduleNumId = parseInt(match[0], 10);
                    }
                  }
                  
                  // Check if wallet is connected
                  if (!walletAddress) {
                    toast({
                      title: "Wallet Not Connected",
                      description: "Please connect your wallet to mint NFTs",
                      variant: "destructive",
                      duration: 3000,
                    });
                    return;
                  }
                  
                  // Use actual accumulated XP and quiz score if available
                  const actualXpEarned = totalXpEarned > 0 ? totalXpEarned : (flashcardXpPool + 200);
                  const actualQuizScore = quizScore > 0 ? quizScore : 90;
                  
                  // Use the global popup
                  try {
                    logger.log(`[ModulePage] Opening completion popup for module ${moduleNumId} with wallet ${walletAddress}`);
                    
                    // Use a simple object without extra properties to avoid type issues
                    const popupData = {
                      moduleId: moduleNumId,
                      moduleName: moduleContent?.title || 'Test Module',
                      walletAddress: walletAddress,
                      xpEarned: actualXpEarned,
                      suiEarned: 0.75,
                      quizScore: actualQuizScore
                    };
                    
                    // Call the popup function
                    window.showModuleCompletionPopup(popupData);
                    
                    // Show success toast
                    toast({
                      title: "Test Popup Triggered",
                      description: "Opening module completion popup with NFT minting",
                      duration: 3000,
                    });
                  } catch (error) {
                    logger.error('[ModulePage] Error showing test completion popup:', error);
                    toast({
                      title: "Error",
                      description: "Failed to show completion popup",
                      variant: "destructive",
                      duration: 3000,
                    });
                  }
                }
              }}
            >
              Test Completion Popup
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="text-xs bg-green-500/10"
              onClick={async () => {
                try {
                  if (!walletAddress) {
                    toast({
                      title: "Wallet Not Connected",
                      description: "Please connect your wallet to mint NFTs",
                      variant: "destructive",
                      duration: 3000,
                    });
                    return;
                  }
                  
                  if (!moduleId) {
                    toast({
                      title: "Error",
                      description: "Module ID not found",
                      variant: "destructive",
                      duration: 3000,
                    });
                    return;
                  }
                  
                  // Parse the module ID to extract a number
                  let moduleNumber = 1;
                  if (moduleId === 'intro-to-sui') {
                    moduleNumber = 1;
                  } else if (moduleId === 'smart-contracts-101') {
                    moduleNumber = 2;
                  } else if (moduleId === 'move-language') {
                    moduleNumber = 3;
                  } else if (moduleId === 'objects-ownership') {
                    moduleNumber = 4;
                  } else {
                    const match = moduleId.match(/\d+/);
                    if (match) {
                      moduleNumber = parseInt(match[0], 10);
                    }
                  }
                  
                  toast({
                    title: "Test NFT Mint",
                    description: `Creating NFT mint transaction for module ${moduleNumber}...`,
                    duration: 3000,
                  });
                  
                  logger.log(`[Test NFT Mint] Creating transaction for module ${moduleNumber}, wallet ${walletAddress}`);
                  
                  // Import the NFT service functions
                  const { mintModuleCompletionNFT } = await import('@/services/nftService');
                  
                  // Create the NFT mint transaction
                  const result = await mintModuleCompletionNFT(walletAddress, moduleNumber);
                  
                  if (result.success) {
                    if (result.transaction) {
                      toast({
                        title: "NFT Transaction Created",
                        description: "Transaction created successfully. Ready for wallet signature.",
                        duration: 3000,
                      });
                      
                      // Display transaction details to console for debugging
                      logger.log('[Test NFT Mint] Transaction created:', result.transaction);
                      
                      // Now open the completion modal to handle the actual minting process
                      const actualXpEarned = totalXpEarned > 0 ? totalXpEarned : (flashcardXpPool + 200);
                      const actualQuizScore = quizScore > 0 ? quizScore : 90;
                      
                      // Use the global popup
                      try {
                        logger.log(`[Test NFT Mint] Opening completion popup to handle minting`);
                        window.showModuleCompletionPopup({
                          moduleId: moduleNumber,
                          moduleName: moduleContent?.title || 'Test Module',
                          walletAddress: walletAddress,
                          xpEarned: actualXpEarned,
                          suiEarned: 0.75,
                          quizScore: actualQuizScore
                        });
                      } catch (error) {
                        logger.error('[ModulePage] Error showing NFT mint completion popup:', error);
                        toast({
                          title: "Error",
                          description: "Failed to show completion popup",
                          variant: "destructive",
                          duration: 3000,
                        });
                      }
                    } else {
                      toast({
                        title: "NFT Transaction Result",
                        description: result.message || "Transaction was processed",
                        duration: 3000,
                      });
                    }
                  } else {
                    toast({
                      title: "NFT Transaction Failed",
                      description: result.message || "Unknown error",
                      variant: "destructive",
                      duration: 3000,
                    });
                  }
                } catch (err) {
                  logger.error('[Test NFT Mint] Error:', err);
                  toast({
                    title: "Error",
                    description: "Failed to create NFT mint transaction",
                    variant: "destructive",
                    duration: 3000,
                  });
                }
              }}
            >
              Test NFT Mint
            </Button>
          </div>
          <p className="text-xs mt-2 text-yellow-500">These buttons are only visible in development mode</p>
        </div>
      )}
    </div>
  );
};

export default ModulePage; 