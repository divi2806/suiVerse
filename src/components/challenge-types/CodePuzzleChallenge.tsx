import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Zap, Trophy, Check, X, HelpCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";

interface CodePuzzleContent {
  challenge: string;
  codeTemplate: string;
  solution: string;
  hint1: string;
  hint2: string;
}

interface CodePuzzleChallengeProps {
  challenge: CodePuzzleContent;
  onComplete: (score: number, isCorrect?: boolean) => void;
  onCancel: () => void;
}

const CodePuzzleChallenge: React.FC<CodePuzzleChallengeProps> = ({ 
  challenge, 
  onComplete, 
  onCancel 
}) => {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState<number>(0); // 0 = no hint, 1 = first hint, 2 = second hint
  const [timeLeft, setTimeLeft] = useState<number>(180); // 3 minutes
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
  
  // Calculate score based on time left and hints used
  const calculateScore = () => {
    const baseScore = 100;
    const timeBonus = Math.floor((timeLeft / 180) * 50); // Up to 50 points for time
    const hintPenalty = showHint * 15; // -15 points per hint
    
    return Math.max(baseScore + timeBonus - hintPenalty, 50); // Minimum 50 points
  };
  
  // Handle code submission
  const handleSubmit = () => {
    if (!selectedOption) {
      toast({
        title: "Selection Required",
        description: "Please select a solution before submitting",
        variant: "destructive"
      });
      return;
    }
    
    // Check if solution is correct (case insensitive and whitespace trimmed)
    const normalizedSolution = challenge.solution.replace(/\s+/g, ' ').trim().toLowerCase();
    const normalizedSelection = selectedOption.replace(/\s+/g, ' ').trim().toLowerCase();
    
    const correct = normalizedSolution === normalizedSelection;
    setIsCorrect(correct);
    
    if (correct) {
      const finalScore = calculateScore();
      setScore(finalScore);
      
      // Delay completion to show success message
      setTimeout(() => {
        onComplete(finalScore, true);
      }, 2000);
    } else {
      // If incorrect, wait a bit then notify with isCorrect=false
      setTimeout(() => {
        onComplete(0, false);
      }, 2000);
    }
  };
  
  // Display another hint
  const showNextHint = () => {
    if (showHint < 2) {
      setShowHint(prev => prev + 1);
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
        onComplete(25, false); // Minimum score for attempt, failed due to timeout
      }, 2000);
    }
  }, [timeLeft, onComplete]);
  
  return (
    <div className="w-full max-w-4xl mx-auto bg-card/60 backdrop-blur-md rounded-lg border border-border/40 p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <Zap className="h-5 w-5 text-blue-500" />
          <h2 className="text-xl font-semibold">Code Puzzle Challenge</h2>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className={`text-sm font-medium px-3 py-1 rounded-full ${
            timeLeft > 120 ? "bg-green-500/20 text-green-500" :
            timeLeft > 60 ? "bg-yellow-500/20 text-yellow-500" :
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
      
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">{challenge.challenge}</h3>
        <div className="bg-black/60 text-green-400 p-4 rounded-md font-mono text-sm overflow-x-auto mb-4">
          <pre>{challenge.codeTemplate}</pre>
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-md font-medium mb-2">Your Solution:</h3>
        <textarea 
          className="w-full h-32 bg-black/60 text-green-400 p-4 rounded-md font-mono text-sm resize-none"
          placeholder="Type your solution here..."
          value={selectedOption}
          onChange={(e) => setSelectedOption(e.target.value)}
          disabled={isCorrect !== null}
        />
      </div>
      
      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={showNextHint}
                  disabled={showHint >= 2}
                >
                  <HelpCircle className="h-4 w-4 mr-1" />
                  {showHint === 0 ? 'Show Hint' : 'Next Hint'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Using hints reduces your score</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <Button 
          onClick={handleSubmit} 
          disabled={!selectedOption.trim() || isCorrect !== null}
        >
          Submit Solution
        </Button>
      </div>
      
      {showHint > 0 && (
        <div className="mt-4 p-3 rounded-md bg-blue-500/20 border border-blue-500/30">
          <h4 className="font-medium text-sm text-blue-400 mb-1">
            Hint {showHint}:
          </h4>
          <p className="text-sm">{showHint === 1 ? challenge.hint1 : challenge.hint2}</p>
        </div>
      )}
      
      {isCorrect !== null && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-4 p-3 rounded-md ${
            isCorrect 
              ? "bg-green-500/20 border border-green-500/30" 
              : "bg-red-500/20 border border-red-500/30"
          }`}
        >
          <div className="flex items-center">
            {isCorrect ? (
              <Check className="h-5 w-5 text-green-500 mr-2" />
            ) : (
              <X className="h-5 w-5 text-red-500 mr-2" />
            )}
            <h4 className="font-medium text-sm">
              {isCorrect ? "Correct Solution!" : "Incorrect Solution"}
            </h4>
          </div>
          
          {isCorrect && (
            <p className="text-sm mt-1">
              You scored {score} points!
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default CodePuzzleChallenge; 