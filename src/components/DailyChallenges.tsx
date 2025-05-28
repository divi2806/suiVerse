import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Star, Trophy, Gift, Clock, Loader2, Zap, AlertTriangle, BookOpen, X, Coins, Check, ArrowRight, Gauge, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Confetti } from "@/components/ui/confetti";
import { 
  doc, 
  updateDoc, 
  Timestamp, 
  serverTimestamp, 
  increment 
} from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { 
  DailyChallenge,
  updateChallengeProgress,
  completeChallengeAndClaimRewards
} from '@/services/dailyChallengesService';
import ChallengeRunner from './ChallengeRunner';

// Helper function to get today's date string in YYYY-MM-DD format
const getTodayString = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

interface DailyChallengesProps {
  challenges: DailyChallenge[];
  onStartChallenge: (challengeId: string) => void;
  onClaimReward: (challengeId: string) => void;
  walletAddress?: string;
  userId?: string;
}

const DailyChallenges: React.FC<DailyChallengesProps> = ({ 
  challenges, 
  onStartChallenge, 
  onClaimReward,
  walletAddress,
  userId
}) => {
  const { toast } = useToast();
  const [timeRemaining, setTimeRemaining] = useState<string>("24h 00m");
  const [claimingReward, setClaimingReward] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<DailyChallenge | null>(null);
  
  // State for reward confirmation dialog
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const [pendingRewardChallenge, setPendingRewardChallenge] = useState<DailyChallenge | null>(null);
  
  // State for reward celebration modal
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<{suiAmount: number, xpAmount: number}>({suiAmount: 0, xpAmount: 0});
  
  // Log wallet connection status on component mount and when wallet changes
  useEffect(() => {
    
    
    
    
    
  }, [walletAddress, userId, challenges.length]);
  
  // Calculate time until reset
  useEffect(() => {
    const calculateResetTime = () => {
      // Reset happens at midnight UTC
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 0, 0, 0);
      
      const diff = tomorrow.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    };
    
    // Set initial time
    setTimeRemaining(calculateResetTime());
    
    // Update every minute
    const interval = setInterval(() => {
      setTimeRemaining(calculateResetTime());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Handle claiming rewards with loading state
  const handleClaimReward = async (challengeId: string) => {
    // Additional debug info
    
    
    
    
    // Prevent multiple claim attempts
    if (claimingReward) {
      
      return;
    }
    
    // If we have a valid wallet address, proceed with claiming
    if (walletAddress) {
      
      
      // Find the challenge being claimed
      const challenge = challenges.find(c => c.id === challengeId);
      if (!challenge) {
        
        toast({
          title: "Error",
          description: "Challenge not found. Please try again.",
          variant: "destructive"
        });
        return;
      }
      
      // Check if this challenge is already claimed
      if (challenge.rewardClaimed) {
        
        toast({
          title: "Already Claimed",
          description: "You've already claimed rewards for this challenge.",
          variant: "default"
        });
        return;
      }
      
      // Show the reward confirmation dialog
      setPendingRewardChallenge(challenge);
      setShowRewardDialog(true);
      return;
    }
    
    // Only try to connect wallet if we truly don't have an address
    
    // Try to connect wallet if not connected
    const connectWalletButton = document.getElementById('connect-wallet-button');
    if (connectWalletButton) {
      connectWalletButton.click();
      toast({
        title: "Wallet Connection Required",
        description: "Please connect your wallet to claim rewards",
        variant: "default"
      });
    } else {
      toast({
        title: "Wallet Connection Required",
        description: "Please connect your wallet to claim rewards",
        variant: "default"
      });
    }
  };
  
  // Start confetti effect
  const startConfetti = () => {
    const confetti = document.getElementById('reward-confetti');
    if (confetti) {
      (confetti as any).start();
    }
  };
  
  // Actually process the reward claim after confirmation
  const processRewardClaim = async () => {
    if (!pendingRewardChallenge || !walletAddress) {
      setShowRewardDialog(false);
      return;
    }
    
    const challengeId = pendingRewardChallenge.id;
    setClaimingReward(challengeId);
    
    try {
      // Use the service to claim rewards - do NOT call onClaimReward which would trigger the parent handler
      const result = await completeChallengeAndClaimRewards(challengeId, walletAddress);
      
      if (!result.success) {
        throw new Error('Failed to claim rewards');
      }
      
      // Store claimed rewards for celebration modal
      setClaimedRewards({
        suiAmount: result.reward,
        xpAmount: result.xpReward
      });
      
      // Close confirmation dialog and open celebration modal
      setShowRewardDialog(false);
      setShowCelebrationModal(true);
      
      // Start confetti effect with slight delay to ensure modal is visible
      setTimeout(startConfetti, 300);
      
      // Refresh the challenges list via parent
      onClaimReward(challengeId);
      
      // Show success toast in addition to modal
      toast({
        title: "Rewards Claimed!",
        description: `${result.reward} SUI and ${result.xpReward} XP have been added to your balance.`,
        duration: 5000,
      });
    } catch (error) {
      
      toast({
        title: "Error Claiming Reward",
        description: "There was a problem claiming your reward. Please try again.",
        variant: "destructive"
      });
    } finally {
      setClaimingReward(null);
      setPendingRewardChallenge(null);
    }
  };

  // Update challenge progress
  const updateProgress = async (challengeId: string, newProgress: number) => {
    if (!walletAddress) return;
    
    try {
      await updateChallengeProgress(challengeId, walletAddress, newProgress);
      
      // Update local state if completed
      if (newProgress >= 100) {
        setCompleted(prev => [...prev, challengeId]);
      }
    } catch (error) {
      
      toast({
        title: "Error",
        description: "Failed to update challenge progress.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  // Handle starting a challenge with the interactive runner
  const handleStartChallengeWithRunner = (challenge: DailyChallenge) => {
    // Additional debug info
    
    
    
    
    // If this is happening but we're still seeing the wallet connection prompt,
    // it's likely that the walletAddress prop isn't being passed correctly
    if (walletAddress) {
      
      setActiveChallenge(challenge);
      return;
    }
    
    // Only try to connect wallet if we truly don't have an address
    
    // Try to connect wallet if not connected
    const connectWalletButton = document.getElementById('connect-wallet-button');
    if (connectWalletButton) {
      connectWalletButton.click();
      toast({
        title: "Wallet Connection Required",
        description: "Please connect your wallet to track progress",
        variant: "default"
      });
    } else {
      toast({
        title: "Wallet Connection Required", 
        description: "Please connect your wallet to track progress",
        variant: "default"
      });
    }
  };
  
  // Handle challenge completion from the runner
  const handleChallengeComplete = async (score: number, isCorrect: boolean = false) => {
    if (!activeChallenge || !walletAddress) {
      setActiveChallenge(null);
      return;
    }
    
    try {
      if (isCorrect) {
        // Only update progress to 100% and award XP if the answer was correct
        await updateChallengeProgress(activeChallenge.id, walletAddress, 100);
        
        // Add to completed challenges
        setCompleted(prev => [...prev, activeChallenge.id]);
        
        // Show success message
        toast({
          title: "Challenge Completed!",
          description: `You earned ${activeChallenge.xpReward} XP and can now claim your rewards.`,
          duration: 5000,
        });
      } else {
        // For incorrect answers, show an error message
        toast({
          title: "Incorrect Answer",
          description: "Your answer was incorrect. No XP or rewards have been earned.",
          variant: "destructive",
          duration: 5000,
        });
      }
      
      // Reset active challenge
      setActiveChallenge(null);
    } catch (error) {
      
      toast({
        title: "Error",
        description: "Failed to save challenge progress.",
        variant: "destructive",
      });
      setActiveChallenge(null);
    }
  };
  
  // Cancel active challenge
  const handleCancelChallenge = () => {
    setActiveChallenge(null);
  };

  const getChallengeIcon = (type: string) => {
    switch (type) {
      case 'code_puzzle': return <Zap className="h-4 w-4 text-blue-500" />;
      case 'quiz': return <Star className="h-4 w-4 text-yellow-500" />;
      case 'concept_review': return <BookOpen className="h-4 w-4 text-purple-500" />;
      case 'security_audit': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'optimization': return <Gauge className="h-4 w-4 text-green-500" />;
      case 'defi_scenario': return <Wallet className="h-4 w-4 text-pink-500" />;
      default: return <Star className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (activeChallenge) {
    return (
      <ChallengeRunner 
        challenge={activeChallenge}
        onComplete={handleChallengeComplete}
        onCancel={handleCancelChallenge}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-heading font-bold flex items-center">
          <Calendar className="mr-2 h-5 w-5 text-primary" />
          Daily Challenges
        </h3>
        <div className="text-sm text-foreground/70 flex items-center">
          <Clock className="h-4 w-4 text-yellow-500 mr-1" /> 
          Resets in {timeRemaining}
        </div>
      </div>

      {challenges.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-primary/30 rounded-lg">
          <Calendar className="h-12 w-12 text-primary/40 mx-auto mb-2" />
          <p className="text-foreground/70">
            {walletAddress ? 'No challenges available right now.' : 'No challenges available right now.'}
          </p>
          {!walletAddress && (
            <p className="text-sm text-foreground/50">Connect your wallet to get daily challenges.</p>
          )}
        </div>
      ) : (
        challenges.map((challenge) => (
          <motion.div 
            key={challenge.id}
            className="galaxy-card p-4 border border-primary/20"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-start gap-2">
                <div className="mt-1">
                  {getChallengeIcon(challenge.type)}
                </div>
                <div>
                  <h4 className="font-medium text-base">{challenge.title}</h4>
                  <p className="text-sm text-foreground/70">{challenge.description}</p>
                </div>
              </div>
              <div className={`text-xs px-2 py-1 rounded ${
                challenge.difficulty === 'easy' ? 'bg-green-500/20 text-green-500' :
                challenge.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                'bg-red-500/20 text-red-500'
              }`}>
                {challenge.difficulty}
              </div>
            </div>

            {challenge.progress > 0 && challenge.progress < 100 && (
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span>Progress</span>
                  <span>{challenge.progress}%</span>
                </div>
                <Progress value={challenge.progress} className="h-2" />
              </div>
            )}

            <div className="flex justify-between items-center mt-3">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs">{challenge.xpReward} XP</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="text-xs">{challenge.tokenReward} SUI</span>
                </div>
              </div>

              {challenge.completed ? (
                <Button 
                  size="sm" 
                  className={`h-8 ${
                    claimingReward === challenge.id ? 
                      'bg-green-500/20 text-green-500' : 
                      'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                  }`}
                  onClick={() => handleClaimReward(challenge.id)}
                  disabled={claimingReward === challenge.id || challenge.rewardClaimed}
                >
                  {claimingReward === challenge.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      Processing...
                    </>
                  ) : challenge.rewardClaimed ? (
                    <>
                      <Trophy className="h-3.5 w-3.5 mr-1" />
                      Claimed
                    </>
                  ) : (
                    <>
                      <Gift className="h-3.5 w-3.5 mr-1" />
                      Claim Rewards
                    </>
                  )}
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  className="h-8 neon-button"
                  onClick={() => handleStartChallengeWithRunner(challenge)}
                >
                  {challenge.progress > 0 ? 'Continue' : 'Start Challenge'}
                </Button>
              )}
            </div>
            
            {challenge.expiresAt && (
              <div className="text-xs text-foreground/60 mt-2 text-right">
                Expires: {challenge.expiresAt instanceof Date 
                  ? challenge.expiresAt.toLocaleString() 
                  : challenge.expiresAt instanceof Timestamp 
                    ? challenge.expiresAt.toDate().toLocaleString()
                    : 'Unknown'}
              </div>
            )}
          </motion.div>
        ))
      )}
      
      {/* Only show the wallet connection message at the bottom if we have no wallet */}
      {!walletAddress && challenges.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-card/90 backdrop-blur-md p-4 rounded-lg shadow-lg border border-primary/20 max-w-md">
          <h4 className="font-bold text-primary mb-2">Wallet Connection Required</h4>
          <p className="text-sm mb-3">Please connect your wallet to track progress and claim rewards.</p>
          <Button 
            className="neon-button w-full"
            onClick={() => {
              const connectWalletButton = document.getElementById('connect-wallet-button');
              if (connectWalletButton) connectWalletButton.click();
            }}
          >
            Connect Wallet
          </Button>
        </div>
      )}
      
      {/* Reward Confirmation Dialog */}
      <Dialog open={showRewardDialog} onOpenChange={setShowRewardDialog}>
        <DialogContent className="sm:max-w-md bg-card/80 backdrop-blur-lg border-primary/30">
          <DialogTitle className="flex items-center">
            <Trophy className="h-5 w-5 text-primary mr-2" />
            Claim Challenge Rewards
          </DialogTitle>
          
          <DialogDescription className="text-foreground/70">
            You're about to claim rewards for completing: 
            <span className="font-semibold text-foreground block mt-1">
              {pendingRewardChallenge?.title}
            </span>
          </DialogDescription>
          
          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center p-3 bg-card/50 rounded-lg border border-border/50">
              <div className="flex items-center">
                <Star className="h-5 w-5 text-yellow-500 mr-2" />
                <span>Experience Points</span>
              </div>
              <span className="font-bold text-lg">{pendingRewardChallenge?.xpReward} XP</span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-card/50 rounded-lg border border-border/50">
              <div className="flex items-center">
                <Coins className="h-5 w-5 text-primary mr-2" />
                <span>SUI Tokens</span>
              </div>
              <span className="font-bold text-lg">{pendingRewardChallenge?.tokenReward} SUI</span>
            </div>
          </div>
          
          <DialogFooter className="flex sm:justify-between gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setPendingRewardChallenge(null);
                setShowRewardDialog(false);
              }}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button 
              onClick={processRewardClaim} 
              className="flex-1 neon-button"
              disabled={claimingReward !== null}
            >
              {claimingReward ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Gift className="h-4 w-4 mr-1" />
                  Claim Rewards
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Reward Celebration Modal */}
      <Dialog open={showCelebrationModal} onOpenChange={setShowCelebrationModal}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-gradient-to-b from-background to-background/95 border-primary/30">
          <div className="relative">
            {/* Confetti effect */}
            <Confetti id="reward-confetti" />
            
            <div className="p-6 text-center relative z-10">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="flex justify-center mb-4"
              >
                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                  <Trophy className="h-12 w-12 text-primary" />
                </div>
              </motion.div>
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-2xl font-bold mb-2">Rewards Claimed!</h2>
                <p className="text-muted-foreground mb-8">Congratulations on completing the challenge!</p>
              </motion.div>
              
              <div className="space-y-4 mb-6">
                <motion.div 
                  className="bg-card/30 backdrop-blur-sm p-4 rounded-xl border border-primary/20 flex justify-between items-center"
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.4, type: "spring" }}
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mr-3">
                      <Star className="h-6 w-6 text-yellow-500" />
                    </div>
                    <span className="font-medium">Experience Points</span>
                  </div>
                  <div className="text-2xl font-bold">+{claimedRewards.xpAmount} XP</div>
                </motion.div>
                
                <motion.div 
                  className="bg-card/30 backdrop-blur-sm p-4 rounded-xl border border-primary/20 flex justify-between items-center"
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.6, type: "spring" }}
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mr-3">
                      <Coins className="h-6 w-6 text-primary" />
                    </div>
                    <span className="font-medium">SUI Tokens</span>
                  </div>
                  <div className="text-2xl font-bold">+{claimedRewards.suiAmount} SUI</div>
                </motion.div>
              </div>
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <Button 
                  className="w-full neon-button text-base py-6" 
                  onClick={() => setShowCelebrationModal(false)}
                >
                  <Check className="h-5 w-5 mr-2" />
                  Continue Learning
                </Button>
                
                <div className="mt-4 text-sm text-foreground/60">
                  Your rewards have been added to your profile
                </div>
              </motion.div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DailyChallenges;
