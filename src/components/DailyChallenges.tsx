import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Star, Trophy, Gift, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { doc, updateDoc, collection, addDoc, Timestamp, serverTimestamp, increment, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { sendSuiReward } from '@/services/suiPaymentService';
import { rewardUser } from '@/services/userRewardsService';

// Helper function to get today's date string in YYYY-MM-DD format
const getTodayString = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export interface Challenge {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  suiReward: number;
  completed: boolean;
  progress: number;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLeft?: string;
  lastUpdated?: Date;
  expiresAt?: Date;
  tokenReward: number;
}

interface DailyChallengesProps {
  challenges: Challenge[];
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
    if (!walletAddress) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to claim rewards",
        variant: "destructive"
      });
      return;
    }
    
    setClaimingReward(challengeId);
    
    try {
      // Find the challenge
      const challenge = challenges.find(c => c.id === challengeId);
      if (!challenge) {
        throw new Error('Challenge not found');
      }

      // Send SUI reward using the admin wallet private key
      const result = await sendSuiReward(
        walletAddress,
        0.1, // Fixed amount as per requirement
        'Daily Challenge Reward'
      );

      if (!result.success) {
        throw new Error(result.message || 'Failed to send SUI reward');
      }
      
      // Record the successful transaction in Firestore
      await addDoc(collection(db, 'transactions'), {
        walletAddress,
        amount: 0.1, // Fixed amount as per requirement
        reason: 'Daily Challenge Reward',
        type: 'challenge_reward',
        challengeId,
        txDigest: result.txDigest,
        timestamp: serverTimestamp()
      });
      
      // Mark challenge as claimed in Firestore
      if (walletAddress) {
        const challengePath = `learningProgress/${walletAddress}/dailyChallenges/${challengeId}`;
        await updateDoc(doc(db, challengePath), {
          rewardClaimed: true,
          claimedAt: serverTimestamp()
        });
        
        // Update learningProgress document
        await updateDoc(doc(db, 'learningProgress', walletAddress), {
          totalSuiEarned: increment(0.1)
        });
      }
      
      // Trigger the parent component's handler
      onClaimReward(challengeId);
      
      // Show success toast
      toast({
        title: "Rewards Claimed!",
        description: `0.1 SUI has been sent to your wallet. Transaction ID: ${result.txDigest?.slice(0, 8)}...`,
        duration: 5000,
      });
    } catch (error) {
      console.error("Error claiming reward:", error);
      toast({
        title: "Error Claiming Reward",
        description: "There was a problem claiming your reward. Please try again.",
        variant: "destructive"
      });
    } finally {
      setClaimingReward(null);
    }
  };

  const completeChallenge = async (challengeId: string) => {
    if (!walletAddress || !userId) return;
    
    setCompletingId(challengeId);
    
    try {
      // Get the challenge details
      const challenge = challenges.find(c => c.id === challengeId);
      if (!challenge) {
        console.error('Challenge not found:', challengeId);
        return;
      }
      
      // Add to completed challenges in Firestore
      const userChallengesRef = doc(db, 'user_challenges', userId);
      const userChallengesDoc = await getDoc(userChallengesRef);
      
      if (userChallengesDoc.exists()) {
        await updateDoc(userChallengesRef, {
          completedChallenges: arrayUnion({
            challengeId: challenge.id,
            completedAt: serverTimestamp()
          }),
          ['challengeHistory.' + getTodayString()]: arrayUnion(challenge.id)
        });
      } else {
        await setDoc(userChallengesRef, {
          userId: walletAddress,
          completedChallenges: [{
            challengeId: challenge.id,
            completedAt: serverTimestamp()
          }],
          ['challengeHistory.' + getTodayString()]: [challenge.id]
        });
      }
      
      // Update XP
      const userRef = doc(db, 'learningProgress', walletAddress);
      await updateDoc(userRef, {
        xp: increment(challenge.xpReward),
        totalXpEarned: increment(challenge.xpReward),
        lastActivityTimestamp: serverTimestamp()
      });
      
      // Send token reward if applicable
      if (challenge.tokenReward > 0) {
        // Use the improved rewardUser function
        const result = await rewardUser(
          walletAddress,
          challenge.tokenReward,
          `Daily Challenge: ${challenge.title}`,
          'challenge'
        );
        
        if (result.success) {
          console.log('Tokens sent successfully:', result.txDigest);
        } else {
          console.error('Error sending tokens:', result.message);
        }
      }
      
      // Update UI state
      setCompleted(prev => [...prev, challengeId]);
      
      // Show toast
      toast({
        title: "Challenge Completed!",
        description: `You've earned ${challenge.xpReward} XP ${challenge.tokenReward > 0 ? `and ${challenge.tokenReward} SUI` : ''}!`,
        duration: 5000,
      });
      
    } catch (error) {
      console.error('Error completing challenge:', error);
      toast({
        title: "Error",
        description: "There was a problem completing the challenge. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setCompletingId(null);
    }
  };

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
          <p className="text-foreground/70">No challenges available right now.</p>
          <p className="text-sm text-foreground/50">Connect your wallet to get daily challenges.</p>
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
              <div>
                <h4 className="font-medium text-base">{challenge.title}</h4>
                <p className="text-sm text-foreground/70">{challenge.description}</p>
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
                  <span className="text-xs">0.1 SUI</span>
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
                  disabled={claimingReward === challenge.id}
                >
                  {claimingReward === challenge.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      Processing...
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
                  onClick={() => onStartChallenge(challenge.id)}
                >
                  {challenge.progress > 0 ? 'Continue' : 'Start Challenge'}
                </Button>
              )}
            </div>
            
            {challenge.timeLeft && (
              <div className="text-xs text-foreground/60 mt-2 text-right">
                Time remaining: {challenge.timeLeft}
              </div>
            )}
          </motion.div>
        ))
      )}
    </div>
  );
};

export default DailyChallenges;
