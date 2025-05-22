import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Rocket, Trophy, Star, CircleCheck, BookOpen, ScrollText, Package, Wallet, Coins, Gift, ArrowRight, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface OnboardingTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OnboardingTutorialModal: React.FC<OnboardingTutorialModalProps> = ({ 
  isOpen, 
  onClose 
}) => {
  const [step, setStep] = useState(0);
  const { userData, updateUserData } = useAuth();
  const totalSteps = 5;
  const navigate = useNavigate();

  // Fire confetti when modal first opens
  useEffect(() => {
    if (isOpen) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.5, y: 0.3 },
        colors: ['#4f46e5', '#8b5cf6', '#ec4899']
      });
    }
  }, [isOpen]);

  // Add a new useEffect to ensure the onboarding data is correctly saved when the component mounts
  useEffect(() => {
    // When the component loads, make sure we set a flag that will prevent future onboarding
    // This is a safety measure in case updateUserData fails elsewhere
    if (isOpen && userData) {
      const saveOnboardingStatus = async () => {
        try {
          // Only update if needed
          if (userData.hasSeenOnboarding === false) {
            console.log("Setting onboarding flag on component mount");
            
            // Instead of spreading the entire userData object which may contain undefined values,
            // explicitly set each property we need
            const updatedData = {
              ...userData,
              hasSeenOnboarding: true
            };
            
            // Remove any undefined values before updating
            Object.keys(updatedData).forEach(key => {
              if (updatedData[key] === undefined) {
                delete updatedData[key];
              }
            });
            
            await updateUserData(updatedData);
          }
        } catch (error) {
          console.error("Error updating onboarding status:", error);
        }
      };
      
      saveOnboardingStatus();
    }
  }, [isOpen, userData, updateUserData]);

  // Play confetti when completing the tutorial
  const handleComplete = async () => {
    try {
      // Fire celebration confetti
      confetti({
        particleCount: 200,
        spread: 90,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#4f46e5', '#8b5cf6', '#ec4899', '#f59e0b', '#fbbf24']
      });

      // Update user data to mark onboarding as completed
      if (userData) {
        // Create a clean copy of userData with hasSeenOnboarding set to true
        const updatedData = {
          ...userData,
          hasSeenOnboarding: true
        };
        
        // Remove any undefined values before updating
        Object.keys(updatedData).forEach(key => {
          if (updatedData[key] === undefined) {
            delete updatedData[key];
          }
        });
        
        await updateUserData(updatedData);
      }
      
      // Close the modal
      onClose();
      
      // Navigate to learning page
      setTimeout(() => {
        navigate('/learning');
      }, 200);
    } catch (error) {
      console.error("Error completing onboarding:", error);
      // Make sure we still close the modal even if there's an error
      onClose();
    }
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  if (!isOpen) return null;

  const tutorialSteps = [
    // Step 1: Welcome to Stellar Academy
    {
      title: "Welcome to Sui Stellar Academy!",
      description: "Your journey into blockchain development begins here. Connect your wallet to track progress, earn rewards, and compete with other learners!",
      icon: <Rocket className="h-10 w-10 text-primary" />,
      details: [
        { icon: <Star className="h-5 w-5 text-yellow-400" />, text: "Earn XP by completing learning modules" },
        { icon: <Trophy className="h-5 w-5 text-amber-500" />, text: "Level up and unlock achievements" },
        { icon: <Coins className="h-5 w-5 text-blue-400" />, text: "Collect SUI tokens as you progress" }
      ]
    },
    // Step 2: Learning Path
    {
      title: "Galaxy Learning Map",
      description: "Travel through different galaxies, each containing modules about Sui blockchain development.",
      icon: <BookOpen className="h-10 w-10 text-blue-500" />,
      details: [
        { icon: <ArrowRight className="h-5 w-5 text-green-400" />, text: "Progress from beginner to advanced topics" },
        { icon: <ScrollText className="h-5 w-5 text-purple-400" />, text: "Complete flashcards, quizzes, and challenges" },
        { icon: <CircleCheck className="h-5 w-5 text-green-500" />, text: "Unlock new galaxies as you advance" }
      ]
    },
    // Step 3: Daily Streaks
    {
      title: "Daily Streaks",
      description: "Visit daily to maintain your learning streak and earn bonus rewards!",
      icon: <Sparkles className="h-10 w-10 text-yellow-500" />,
      details: [
        { icon: <Star className="h-5 w-5 text-yellow-400" />, text: "Earn 25 XP for daily logins" },
        { icon: <Gift className="h-5 w-5 text-purple-400" />, text: "Receive mystery boxes every 7 days" },
        { icon: <Trophy className="h-5 w-5 text-amber-500" />, text: "Unlock streak achievements (3, 7, 30 days)" }
      ]
    },
    // Step 4: Mystery Boxes & Rewards
    {
      title: "Mystery Boxes & Rewards",
      description: "Collect and open mystery boxes to receive XP, SUI tokens, and exclusive cosmetic items!",
      icon: <Package className="h-10 w-10 text-purple-500" />,
      details: [
        { icon: <Coins className="h-5 w-5 text-blue-400" />, text: "Earn SUI tokens for completing modules" },
        { icon: <Gift className="h-5 w-5 text-green-400" />, text: "Mystery boxes contain valuable rewards" },
        { icon: <Star className="h-5 w-5 text-yellow-400" />, text: "Use rewards to customize your profile" }
      ]
    },
    // Step 5: Let's Start!
    {
      title: "Ready for Takeoff!",
      description: "Your space journey begins now. Complete your first module to earn XP and start climbing the ranks!",
      icon: <Rocket className="h-10 w-10 text-primary" />,
      details: [
        { icon: <Trophy className="h-5 w-5 text-amber-500" />, text: "Track your progress in your profile" },
        { icon: <Wallet className="h-5 w-5 text-green-500" />, text: "Monitor your SUI rewards in your inventory" },
        { icon: <Star className="h-5 w-5 text-yellow-400" />, text: "Start with the 'Intro to Sui' module" }
      ],
      buttonText: "Start My Journey"
    }
  ];

  const currentStep = tutorialSteps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-lg p-8 max-w-lg w-full mx-4 border-2 border-indigo-500/30 shadow-[0_0_40px_rgba(79,70,229,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="level-up-stars absolute inset-0 overflow-hidden opacity-20 rounded-lg"></div>
        
        {/* Progress indicator */}
        <div className="flex justify-center mb-6">
          <div className="flex gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-full ${i === step ? 'bg-primary' : 'bg-gray-600'}`} 
              />
            ))}
          </div>
        </div>
        
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto bg-indigo-500/20 rounded-full flex items-center justify-center mb-4">
            {currentStep.icon}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{currentStep.title}</h2>
          <p className="text-white/80 mb-6">
            {currentStep.description}
          </p>
        </div>
        
        <div className="space-y-4 mb-8">
          {currentStep.details.map((detail, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className="flex items-start gap-3 bg-white/5 p-3 rounded-lg"
            >
              <div className="mt-0.5">{detail.icon}</div>
              <p className="text-white/90 text-sm">{detail.text}</p>
            </motion.div>
          ))}
        </div>
        
        <div className="flex justify-center">
          <Button 
            className="bg-primary hover:bg-primary/90 text-white relative z-10 px-6"
            onClick={handleNext}
          >
            {step === totalSteps - 1 ? (currentStep.buttonText || "Complete") : "Next"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingTutorialModal; 