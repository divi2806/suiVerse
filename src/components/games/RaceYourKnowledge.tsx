import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, XCircle, Trophy, Star, Coins } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { generateQuizQuestions } from '@/services/geminiService';
import { doc, setDoc, collection, addDoc, serverTimestamp, getFirestore, getDoc, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserXp } from '@/services/firebaseService';
import { sendSuiReward } from '@/services/suiPaymentService';
import { rewardUser } from '@/services/userRewardsService';
import { useToast } from '@/components/ui/use-toast';

interface RaceYourKnowledgeProps {
  onComplete: (score: number, timeUsed: number, extraInfo?: any) => void;
  onCancel: () => void;
  difficulty?: 'easy' | 'medium' | 'hard';
}

const RaceYourKnowledge: React.FC<RaceYourKnowledgeProps> = ({ 
  onComplete, 
  onCancel,
  difficulty = 'medium' 
}) => {
  const [questions, setQuestions] = useState<Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }>>([]);
  
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeUsed, setTimeUsed] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [finalRank, setFinalRank] = useState('');
  const [errorLoading, setErrorLoading] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [rewardSuccess, setRewardSuccess] = useState(false);
  const [rewardTxDigest, setRewardTxDigest] = useState<string | null>(null);
  const [rewardAwarded, setRewardAwarded] = useState(false);
  const [awarding, setAwarding] = useState(false);
  
  const timerRef = useRef<number | null>(null);
  const { userData, walletAddress, refreshUserData } = useAuth();
  const db = getFirestore();
  const { toast } = useToast();
  
  // Generate quiz questions using Gemini API
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        const generatedQuestions = await generateQuizQuestions('Sui blockchain', 10, difficulty);
        setQuestions(generatedQuestions);
        setLoading(false);
      } catch (error) {
        console.error('Error generating questions:', error);
        setErrorLoading(true);
        setLoading(false);
      }
    };
    
    fetchQuestions();
  }, [difficulty]);
  
  // Start/stop timer
  useEffect(() => {
    if (gameStarted && !gameFinished) {
      const startTimeValue = Date.now();
      setStartTime(startTimeValue);
      
      // Update timer every 10ms for a smooth display
      const timerId = window.setInterval(() => {
        setTimeUsed(Date.now() - startTimeValue);
      }, 10);
      
      timerRef.current = timerId;
      
      return () => {
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
        }
      };
    }
  }, [gameStarted, gameFinished]);

  // Format time in MM:SS.ms format
  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((milliseconds % 1000) / 10);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };
  
  const handleStartGame = () => {
    setGameStarted(true);
  };
  
  const handleAnswerSelect = async (answerIndex: number) => {
    if (selectedAnswer !== null) return; // Prevent multiple selections
    
    setSelectedAnswer(answerIndex.toString());
    
    // Check if answer is correct
    const correct = answerIndex === questions[currentQuestion].correctAnswer;
    setIsCorrect(correct);
    
    if (correct) {
      setCorrectAnswers(prev => prev + 1);
      
      // Add points based on difficulty
      const points = difficulty === 'easy' ? 100 : 
                    difficulty === 'medium' ? 150 : 
                    200;
      setScore(prev => prev + points);
    }
    
    // Wait a moment to show correctness, then move to next question
    setTimeout(async () => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(prev => prev + 1);
        setSelectedAnswer(null);
        setIsCorrect(null);
      } else {
        // Game complete
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
        }
        
        const finalTime = Date.now() - (startTime || Date.now());
        const finalScore = calculateFinalScore(score, finalTime, correctAnswers);
        
        // Rank based on performance
        let rank = '';
        if (correctAnswers >= 9) {
          rank = 'Sui Master';
        } else if (correctAnswers >= 7) {
          rank = 'Blockchain Expert';
        } else if (correctAnswers >= 5) {
          rank = 'Sui Enthusiast';
        } else {
          rank = 'Blockchain Novice';
        }
        
        setFinalRank(rank);
        setGameFinished(true);
        
        // Save results to Firestore
        saveGameResults(finalScore, finalTime, correctAnswers, rank);
        
        // Award XP and SUI tokens
        if (walletAddress) {
          try {
            // Calculate XP award - base it on score and difficulty
            const difficultyMultiplier = difficulty === 'easy' ? 1 : 
                                        difficulty === 'medium' ? 1.5 : 2;
            const xpToAward = Math.floor((finalScore / 10) * difficultyMultiplier);
            
            if (walletAddress) {
              try {
                await updateUserXp(walletAddress, xpToAward);
                // Refresh user data to update the UI
                await refreshUserData();
                
                toast({
                  title: "XP Awarded!",
                  description: `You've earned ${xpToAward} XP for your performance!`,
                  duration: 3000
                });
              } catch (xpError) {
                console.error('Error updating XP:', xpError);
                // Don't break the game flow, just log the error
                toast({
                  title: "XP Update Failed",
                  description: "We couldn't update your XP at this time, but your score has been recorded.",
                  variant: "destructive",
                  duration: 5000
                });
              }
            }
            
            // Award SUI tokens based on performance and difficulty
            let suiReward = 0;
            if (correctAnswers >= 8) {
              // Calculate SUI reward based on difficulty and performance
              const baseReward = 0.05; // Base reward amount
              suiReward = correctAnswers >= 9 ? baseReward + 0.02 : baseReward;
              
              // Add difficulty bonus
              if (difficulty === 'hard') {
                suiReward += 0.01;
              }
              
              // Cap reward at 0.07 SUI
              suiReward = Math.min(0.07, suiReward);
              
              try {
                const result = await rewardUser(
                  walletAddress, 
                  suiReward, 
                  'Race Your Knowledge Quiz Reward',
                  'game'
                );
                
                if (result.success) {
                  setRewardAwarded(true);
                  setRewardAmount(suiReward);
                  
                  toast({
                    title: "SUI Reward Received!",
                    description: `You earned ${suiReward} SUI for your performance!`,
                    duration: 5000,
                  });
                  
                  // Refresh user data to update UI with new token balance
                  refreshUserData();
                } else {
                  toast({
                    title: "Reward Error",
                    description: "There was a problem sending your SUI reward. Please try again.",
                    variant: "destructive",
                  });
                }
              } catch (error) {
                console.error("Error awarding SUI tokens:", error);
                toast({
                  title: "Reward Error",
                  description: "There was a problem sending your SUI reward. Please try again.",
                  variant: "destructive",
                });
              }
            }
          } catch (error) {
            console.error('Error processing rewards:', error);
          }
        }
      }
    }, 1500);
  };
  
  const calculateFinalScore = (baseScore: number, time: number, correct: number) => {
    // Calculate time penalty (faster times get better scores)
    const timeInSeconds = time / 1000;
    const timeFactor = Math.max(0, 1 - (timeInSeconds / 300)); // Normalize time, max 5 minutes
    
    // Calculate accuracy bonus
    const accuracyBonus = correct / questions.length;
    
    // Final score formula
    const finalScore = Math.floor(baseScore * (0.7 + timeFactor * 0.3) * (0.5 + accuracyBonus * 0.5));
    
    return Math.max(0, finalScore);
  };
  
  const saveGameResults = async (finalScore: number, time: number, correct: number, rank: string) => {
    if (!walletAddress) return;
    
    try {
      // Generate a unique game ID
      const gameId = `${walletAddress}-${Date.now()}`;
      
      // Save to game_results collection
      await addDoc(collection(db, 'game_results'), {
        userId: walletAddress,
        gameId,
        game: 'race_your_knowledge',
        score: finalScore,
        timeUsed: time,
        correctAnswers: correct,
        totalQuestions: questions.length,
        difficulty,
        rank,
        timestamp: serverTimestamp()
      });
      
      // Check if user has played this game before
      const leaderboardRef = doc(db, 'leaderboard', walletAddress);
      const leaderboardDoc = await getDoc(leaderboardRef);
      
      if (leaderboardDoc.exists()) {
        const userData = leaderboardDoc.data();
        const currentBestScore = userData.raceYourKnowledge?.bestScore || 0;
        const gamesPlayed = userData.raceYourKnowledge?.gamesPlayed || 0;
        
        // Update only if the new score is better
        if (finalScore > currentBestScore) {
          await updateDoc(leaderboardRef, {
            'raceYourKnowledge.bestScore': finalScore,
            'raceYourKnowledge.bestTime': time,
            'raceYourKnowledge.bestRank': rank,
            'raceYourKnowledge.gamesPlayed': gamesPlayed + 1,
            'raceYourKnowledge.lastPlayed': serverTimestamp(),
            'raceYourKnowledge.progress': Math.min(100, (gamesPlayed + 1) * 10) // 10% progress per game, max 100%
          });
        } else {
          // Just increment games played
          await updateDoc(leaderboardRef, {
            'raceYourKnowledge.gamesPlayed': gamesPlayed + 1,
            'raceYourKnowledge.lastPlayed': serverTimestamp(),
            'raceYourKnowledge.progress': Math.min(100, (gamesPlayed + 1) * 10)
          });
        }
      } else {
        // First time playing, create new document
        await setDoc(leaderboardRef, {
          username: userData?.displayName || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
          raceYourKnowledge: {
            bestScore: finalScore,
            bestTime: time,
            bestRank: rank,
            gamesPlayed: 1,
            lastPlayed: serverTimestamp(),
            progress: 10 // 10% progress for first game
          }
        });
      }
    } catch (error) {
      console.error('Error saving game results:', error);
    }
  };
  
  const handleCompleteGame = () => {
    onComplete(score, timeUsed, {
      correctAnswers,
      rank: finalRank,
      rewardAmount,
      rewardSuccess: rewardAwarded,
      txDigest: rewardTxDigest
    });
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 p-8 max-w-4xl mx-auto">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="h-16 w-16 border-4 border-primary border-t-transparent rounded-full"
        />
        <p className="text-xl font-medium">Generating Quiz Questions...</p>
        <p className="text-sm text-muted-foreground">
          We're preparing challenging Sui blockchain questions for you.
        </p>
      </div>
    );
  }
  
  // Error state
  if (errorLoading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 p-8 max-w-4xl mx-auto">
        <XCircle className="h-16 w-16 text-destructive" />
        <p className="text-xl font-medium">Something went wrong</p>
        <p className="text-sm text-muted-foreground mb-4">
          We couldn't generate questions right now. Please try again later.
        </p>
        <Button onClick={onCancel} variant="outline">Go Back</Button>
      </div>
    );
  }
  
  // Game intro screen
  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 p-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold mb-2">Race Your Knowledge</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Test your Sui blockchain knowledge against the clock!
          </p>
          
          <Card className="p-6 mb-8 text-left">
            <h2 className="text-xl font-semibold mb-4">How To Play</h2>
            <ul className="space-y-2 mb-6">
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <span>Answer 10 questions about Sui blockchain as fast as you can</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <span>Your score depends on speed and accuracy</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <span>Get 8+ correct answers to earn SUI tokens!</span>
              </li>
            </ul>
            
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium mb-1">Difficulty</p>
                <Badge
                  className={
                    difficulty === 'easy' ? 'bg-green-500/20 text-green-500' : 
                    difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-500' : 
                    'bg-red-500/20 text-red-500'
                  }
                >
                  {difficulty.toUpperCase()}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Questions</p>
                <Badge className="bg-primary/20 text-primary">
                  {questions.length}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Reward</p>
                <Badge className="bg-secondary/20 text-secondary">
                  Up to 0.07 SUI
                </Badge>
              </div>
            </div>
          </Card>
          
          <div className="flex gap-4 justify-center">
            <Button onClick={onCancel} variant="outline">
              Cancel
            </Button>
            <Button 
              onClick={handleStartGame} 
              className="neon-button"
            >
              Start Quiz
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }
  
  // Results screen
  if (gameFinished) {
    const minutes = Math.floor(timeUsed / 60000);
    const seconds = Math.floor((timeUsed % 60000) / 1000);
    const milliseconds = Math.floor((timeUsed % 1000) / 10);
    
    return (
      <div className="flex flex-col items-center justify-center space-y-6 p-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Trophy className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Quiz Completed!</h1>
          <p className="text-lg text-muted-foreground mb-8">
            You've earned the rank of <span className="text-primary font-medium">{finalRank}</span>
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="p-6 text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 text-blue-400" />
              <p className="text-sm text-muted-foreground">Time Used</p>
              <p className="text-2xl font-mono font-bold">
                {`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`}
              </p>
            </Card>
            
            <Card className="p-6 text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400" />
              <p className="text-sm text-muted-foreground">Accuracy</p>
              <p className="text-2xl font-mono font-bold">
                {correctAnswers}/{questions.length}
              </p>
            </Card>
            
            <Card className="p-6 text-center">
              <Star className="h-8 w-8 mx-auto mb-2 text-yellow-400" />
              <p className="text-sm text-muted-foreground">Final Score</p>
              <p className="text-2xl font-mono font-bold">{score}</p>
            </Card>
          </div>
          
          {correctAnswers >= 8 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-8">
              <p className="text-green-500 font-medium flex items-center">
                <Coins className="h-5 w-5 mr-2" />
                {rewardAwarded 
                  ? `Congratulations! You've earned ${rewardAmount} SUI tokens for your excellent performance!`
                  : `You qualified for a SUI token reward! We'll process it shortly.`}
              </p>
              {rewardTxDigest && (
                <p className="text-xs text-muted-foreground mt-2">
                  Transaction: {rewardTxDigest.slice(0, 10)}...{rewardTxDigest.slice(-8)}
                </p>
              )}
            </div>
          )}
          
          <Button 
            onClick={handleCompleteGame} 
            className="neon-button"
          >
            Return to Games
          </Button>
        </motion.div>
      </div>
    );
  }
  
  // Main game screen
  return (
    <div className="flex flex-col space-y-6 p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="px-2">
            Exit Quiz
          </Button>
          <Badge variant="outline" className="text-xs">
            Question {currentQuestion + 1}/{questions.length}
          </Badge>
        </div>
        
        <div className="flex items-center">
          <Clock className="h-4 w-4 mr-1 text-primary" />
          <span className="font-mono text-lg font-medium">{formatTime(timeUsed)}</span>
        </div>
      </div>
      
      <Progress value={(currentQuestion / questions.length) * 100} className="h-2" />
      
      <motion.div
        key={currentQuestion}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="galaxy-card p-6"
      >
        <h2 className="text-xl font-medium mb-6">{questions[currentQuestion].question}</h2>
        
        <div className="space-y-3 mb-6">
          {questions[currentQuestion].options.map((option, index) => (
            <motion.div
              key={index}
              className={`p-4 rounded-lg border cursor-pointer ${
                selectedAnswer === index.toString() && isCorrect === true
                  ? 'border-green-500 bg-green-500/10'
                  : selectedAnswer === index.toString() && isCorrect === false
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-primary/30 hover:border-primary/60 bg-card/50'
              }`}
              onClick={() => !selectedAnswer && handleAnswerSelect(index)}
              whileHover={!selectedAnswer ? { scale: 1.01 } : {}}
              animate={
                selectedAnswer === index.toString() && isCorrect
                  ? { x: [0, -5, 5, -5, 5, 0] }
                  : {}
              }
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-start">
                <div className="font-mono text-sm bg-muted/50 px-2 py-1 rounded mr-2 flex-shrink-0">
                  {String.fromCharCode(65 + index)}
                </div>
                <div className="text-sm flex-grow">
                  {option}
                </div>
                {selectedAnswer === index.toString() && (
                  <div className="ml-2 flex-shrink-0">
                    {isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
        
        {selectedAnswer && isCorrect !== null && (
          <div className={`p-3 rounded-lg mb-6 text-sm ${
            isCorrect ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
          }`}>
            <p className="font-medium mb-1">
              {isCorrect ? 'Correct!' : 'Incorrect!'}
            </p>
            <p className="text-foreground/80">{questions[currentQuestion].explanation}</p>
          </div>
        )}
      </motion.div>
      
      <div className="flex justify-between items-center">
        <div className="text-sm text-foreground/70">
          Score: <span className="font-medium">{score}</span>
        </div>
        
        <div className="text-sm text-foreground/70 flex items-center">
          Correct: <span className="font-medium ml-1">{correctAnswers}</span>
          <span className="mx-1">/</span>
          <span>{currentQuestion + (selectedAnswer ? 1 : 0)}</span>
        </div>
      </div>
    </div>
  );
};

export default RaceYourKnowledge; 