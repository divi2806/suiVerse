import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { DailyChallenge } from '@/services/dailyChallengesService';
import { ChallengeType } from '@/services/challengeTypes';
import CodePuzzleChallenge from './challenge-types/CodePuzzleChallenge';
import QuizChallenge from './challenge-types/QuizChallenge';
import ConceptReviewChallenge from './challenge-types/ConceptReviewChallenge';
import SecurityAuditChallenge from './challenge-types/SecurityAuditChallenge';
import DeFiScenarioChallenge from './challenge-types/DeFiScenarioChallenge';
import OptimizationChallenge from './challenge-types/OptimizationChallenge';
import Confetti from './ui/confetti';

// Create a VisuallyHidden component for accessibility
const VisuallyHidden = ({ children }: { children: React.ReactNode }) => (
  <span 
    className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0" 
    style={{ clip: 'rect(0, 0, 0, 0)' }}
  >
    {children}
  </span>
);

interface ChallengeRunnerProps {
  challenge: DailyChallenge;
  onComplete: (score: number, isCorrect?: boolean) => void;
  onCancel: () => void;
}

const ChallengeRunner: React.FC<ChallengeRunnerProps> = ({ 
  challenge, 
  onComplete, 
  onCancel 
}) => {
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  // Log challenge content for debugging
  useEffect(() => {
    
    
    
    
    
    if (challenge.type === 'code_puzzle') {
      
      const content = challenge.content;
      
      
      
      
      
    } 
    else if (challenge.type === 'quiz') {
      
      const content = challenge.content;
      
      
      
      
      
    }
    else if (challenge.type === 'security_audit') {
      
      const content = challenge.content;
      
      
      
      
      
    }
    
    
  }, [challenge]);
  
  // Handle challenge completion
  const handleComplete = (score: number, isCorrect: boolean = true) => {
    setFinalScore(score);
    
    // Only show the reward dialog if the answer was correct
    if (isCorrect) {
      setShowRewardDialog(true);
      
      // Start confetti animation
      const confetti = document.getElementById('reward-confetti');
      if (confetti) {
        (confetti as any).start();
      }
    } else {
      // Immediately notify parent of incorrect completion
      onComplete(score, isCorrect);
    }
  };
  
  // Handle confirmation of rewards
  const handleConfirmReward = () => {
    setShowRewardDialog(false);
    onComplete(finalScore, true); // Pass isCorrect=true when rewards are confirmed
  };
  
  // Render the appropriate challenge component based on type
  const renderChallenge = () => {
    switch (challenge.type as ChallengeType) {
      case 'code_puzzle':
        return (
          <CodePuzzleChallenge
            challenge={challenge.content}
            onComplete={handleComplete}
            onCancel={onCancel}
          />
        );
        
      case 'quiz':
        return (
          <QuizChallenge
            challenge={challenge.content}
            onComplete={handleComplete}
            onCancel={onCancel}
          />
        );
        
      case 'concept_review':
        return (
          <ConceptReviewChallenge
            challenge={challenge.content}
            onComplete={handleComplete}
            onCancel={onCancel}
          />
        );
        
      case 'security_audit':
        return (
          <SecurityAuditChallenge
            challenge={challenge.content}
            onComplete={handleComplete}
            onCancel={onCancel}
          />
        );
      
      case 'defi_scenario':
        return (
          <DeFiScenarioChallenge
            challenge={challenge.content}
            onComplete={handleComplete}
            onCancel={onCancel}
          />
        );
        
      case 'optimization':
        return (
          <OptimizationChallenge
            challenge={challenge.content}
            onComplete={handleComplete}
            onCancel={onCancel}
          />
        );
        
      default:
        return (
          <div className="p-8 text-center">
            <p>Challenge type not supported: {challenge.type}</p>
            <Button onClick={onCancel} className="mt-4">
              Go Back
            </Button>
          </div>
        );
    }
  };
  
  return (
    <>
      {renderChallenge()}
      
      {/* Reward Dialog */}
      <Dialog open={showRewardDialog} onOpenChange={setShowRewardDialog}>
        <DialogContent className="sm:max-w-[425px] text-center p-0 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="sr-only">Challenge Complete</DialogTitle>
          </DialogHeader>
          <div className="relative">
            {/* Background effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-background z-0" />
            
            {/* Confetti */}
            <Confetti id="reward-confetti" />
            
            <div className="relative z-10 p-6">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="w-20 h-20 mx-auto bg-primary/20 rounded-full flex items-center justify-center mb-4"
              >
                <Trophy className="h-10 w-10 text-primary" />
              </motion.div>
              
              <motion.h2 
                className="text-2xl font-bold mb-2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
              >
                Challenge Complete!
              </motion.h2>
              
              <motion.p
                className="text-foreground/70 mb-6"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                Great job! You've earned rewards.
              </motion.p>
              
              <DialogFooter className="flex flex-col sm:flex-row sm:justify-center gap-2 mt-4">
                <Button onClick={handleConfirmReward}>
                  Claim Rewards
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChallengeRunner; 