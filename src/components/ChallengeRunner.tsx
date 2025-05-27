import React, { useState, useEffect } from 'react';
import CodePuzzleChallenge from './challenge-types/CodePuzzleChallenge';
import QuizChallenge from './challenge-types/QuizChallenge';
import BugHuntChallenge from './challenge-types/BugHuntChallenge';
import ConceptReviewChallenge from './challenge-types/ConceptReviewChallenge';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/ui/confetti";
import { Trophy, Star, Gift } from 'lucide-react';
import { motion } from 'framer-motion';
import { DailyChallenge } from '@/services/dailyChallengesService';

interface ChallengeRunnerProps {
  challenge: DailyChallenge;
  onComplete: (score: number) => void;
  onCancel: () => void;
}

const ChallengeRunner: React.FC<ChallengeRunnerProps> = ({ 
  challenge, 
  onComplete, 
  onCancel 
}) => {
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  
  // Log challenge content when component mounts
  useEffect(() => {
    console.log("===== CHALLENGE CONTENT START =====");
    console.log("Challenge Type:", challenge.type);
    console.log("Challenge Title:", challenge.title);
    console.log("Challenge Content:", challenge.content);
    console.log("===== CHALLENGE CONTENT END =====");
  }, [challenge]);
  
  // Handle challenge completion
  const handleComplete = (score: number) => {
    setFinalScore(score);
    setShowRewardDialog(true);
    
    // Start confetti animation
    const confetti = document.getElementById('reward-confetti');
    if (confetti) {
      (confetti as any).start();
    }
    
    // Send completion to parent after dialog is shown
    // This lets the user see their rewards
  };
  
  // Handle confirmation of rewards
  const handleConfirmReward = () => {
    setShowRewardDialog(false);
    onComplete(finalScore);
  };
  
  // Render appropriate challenge type
  const renderChallenge = () => {
    switch (challenge.type) {
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
      case 'bug_hunt':
        return (
          <BugHuntChallenge 
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
              
              <motion.div 
                className="space-y-4 mb-6"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <div className="flex items-center justify-center gap-3 p-3 bg-card/60 rounded-lg">
                  <Star className="h-5 w-5 text-yellow-500" />
                  <span className="font-medium">{challenge.xpReward} XP</span>
                </div>
                
                <div className="flex items-center justify-center gap-3 p-3 bg-card/60 rounded-lg">
                  <Gift className="h-5 w-5 text-primary" />
                  <span className="font-medium">{challenge.suiReward} SUI Tokens</span>
                </div>
                
                <div className="flex items-center justify-center gap-3 p-3 bg-card/60 rounded-lg">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  <span className="font-medium">{finalScore} Points</span>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <Button 
                  className="w-full neon-button" 
                  onClick={handleConfirmReward}
                >
                  Claim Rewards
                </Button>
              </motion.div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChallengeRunner; 