import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Star, Trophy, Check, X, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

interface QuizContent {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuizChallengeProps {
  challenge: QuizContent;
  onComplete: (score: number, isCorrect?: boolean) => void;
  onCancel: () => void;
}

const QuizChallenge: React.FC<QuizChallengeProps> = ({ 
  challenge, 
  onComplete, 
  onCancel 
}) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(120); // 2 minutes
  const [score, setScore] = useState<number>(0);
  
  // Setup timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Calculate score based on time left
  const calculateScore = () => {
    const baseScore = 100;
    const timeBonus = Math.floor((timeLeft / 120) * 50); // Up to 50 points for time
    
    return baseScore + timeBonus;
  };
  
  // Handle answer submission
  const handleSubmit = () => {
    if (selectedOption === null) {
      toast({
        title: "Selection Required",
        description: "Please select an answer before submitting",
        variant: "destructive"
      });
      return;
    }
    
    // Check if answer is correct
    const correct = selectedOption === challenge.correctAnswer;
    setIsCorrect(correct);
    
    if (correct) {
      const finalScore = calculateScore();
      setScore(finalScore);
      
      // Delay completion to show success message
      setTimeout(() => {
        onComplete(finalScore, true);
      }, 2000);
    } else {
      // If incorrect, wait a bit and then notify with score 0 and isCorrect=false
      setTimeout(() => {
        onComplete(0, false);
      }, 2000);
    }
  };
  
  // Handle time expiration
  useEffect(() => {
    if (timeLeft === 0) {
      toast({
        title: "Time's Up!",
        description: "You've run out of time for this challenge.",
        variant: "destructive"
      });
      
      setTimeout(() => {
        onComplete(25); // Minimum score for attempt
      }, 2000);
    }
  }, [timeLeft, onComplete]);
  
  return (
    <div className="w-full max-w-4xl mx-auto bg-card/60 backdrop-blur-md rounded-lg border border-border/40 p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <Star className="h-5 w-5 text-yellow-500" />
          <h2 className="text-xl font-semibold">Blockchain Quiz Challenge</h2>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className={`text-sm font-medium px-3 py-1 rounded-full ${
            timeLeft > 80 ? "bg-green-500/20 text-green-500" :
            timeLeft > 40 ? "bg-yellow-500/20 text-yellow-500" :
            "bg-red-500/20 text-red-500"
          }`}>
            {formatTime(timeLeft)}
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onCancel}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Exit
          </Button>
        </div>
      </div>
      
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-6">{challenge.question}</h3>
        
        <RadioGroup value={selectedOption?.toString()} onValueChange={(value) => setSelectedOption(parseInt(value))}>
          {challenge.options.map((option: string, index: number) => (
            <div 
              key={index} 
              className={`mb-4 p-4 rounded-md border ${
                isCorrect !== null && index === challenge.correctAnswer ? 'border-green-500 bg-green-500/10' :
                isCorrect === false && index === selectedOption ? 'border-red-500 bg-red-500/10' :
                'border-border hover:border-primary hover:bg-primary/5'
              }`}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value={index.toString()} 
                  id={`option-${index}`} 
                  disabled={isCorrect !== null}
                />
                <Label 
                  htmlFor={`option-${index}`}
                  className={`flex-grow cursor-pointer ${
                    isCorrect !== null && index === challenge.correctAnswer ? 'text-green-500' :
                    isCorrect === false && index === selectedOption ? 'text-red-500' : ''
                  }`}
                >
                  {option}
                </Label>
                
                {isCorrect !== null && index === challenge.correctAnswer && (
                  <Check className="h-5 w-5 text-green-500" />
                )}
                {isCorrect === false && index === selectedOption && (
                  <X className="h-5 w-5 text-red-500" />
                )}
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>
      
      <div className="flex justify-end">
        <Button 
          className="neon-button"
          onClick={handleSubmit}
          disabled={isCorrect !== null || selectedOption === null}
        >
          Submit Answer
        </Button>
      </div>
      
      {isCorrect !== null && (
        <motion.div 
          className={`mt-6 p-4 rounded-md ${isCorrect ? 'bg-green-500/20' : 'bg-red-500/20'}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center mb-2">
            {isCorrect ? (
              <>
                <Check className="h-5 w-5 text-green-500 mr-2" />
                <p className="font-medium text-green-500">Correct! Well done!</p>
              </>
            ) : (
              <>
                <X className="h-5 w-5 text-red-500 mr-2" />
                <p className="font-medium text-red-500">Incorrect. The right answer was: {challenge.options[challenge.correctAnswer]}</p>
              </>
            )}
          </div>
          
          <div className="mt-2 p-3 bg-primary/5 rounded-md">
            <h4 className="text-sm font-medium mb-1">Explanation:</h4>
            <p className="text-sm">{challenge.explanation}</p>
          </div>
          
          {isCorrect && (
            <div className="mt-3">
              <p className="text-sm mb-2">You earned:</p>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium">{score} points</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default QuizChallenge; 