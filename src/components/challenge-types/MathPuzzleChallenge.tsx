import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Calculator, Lightbulb } from 'lucide-react';
import { CheckCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from '@/components/ui/separator';

interface MathPuzzleContent {
  question: string;
  equation?: string;
  context: string;
  hint1: string;
  hint2: string;
  solution: string;
  answer: string | number;
}

interface MathPuzzleChallengeProps {
  challenge: MathPuzzleContent;
  onComplete: (score: number) => void;
  onCancel: () => void;
}

const MathPuzzleChallenge: React.FC<MathPuzzleChallengeProps> = ({
  challenge,
  onComplete,
  onCancel
}) => {
  const [userAnswer, setUserAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showHint1, setShowHint1] = useState(false);
  const [showHint2, setShowHint2] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Validate that we have all required content
  useEffect(() => {
    if (!challenge.question || !challenge.context || !challenge.hint1 || 
        !challenge.hint2 || !challenge.solution || !challenge.answer) {
      
      setError("This challenge is missing required content. Please try again later.");
    } else {
      setError(null);
    }
  }, [challenge]);

  const handleAnswerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserAnswer(e.target.value);
  };

  const checkAnswer = () => {
    if (!userAnswer.trim()) return;
    
    // Normalize answers for comparison
    let normalizedUserAnswer = userAnswer.trim().toLowerCase();
    let normalizedCorrectAnswer = String(challenge.answer).toLowerCase();
    
    // Remove common formatting that shouldn't affect correctness
    const normalize = (text: string): string => {
      return text
        .replace(/\s+/g, '') // Remove all whitespace
        .replace(/[,.'"\(\)]/g, '') // Remove punctuation
        .replace(/^0+(\d+)/, '$1'); // Remove leading zeros
    };
    
    normalizedUserAnswer = normalize(normalizedUserAnswer);
    normalizedCorrectAnswer = normalize(normalizedCorrectAnswer);
    
    // Check for numeric answers that might be equivalent
    let correct = normalizedUserAnswer === normalizedCorrectAnswer;
    
    // If not an exact match, try parsing as numbers for numeric comparison
    if (!correct) {
      try {
        // Handle fractions like "2/3" by evaluating them
        const evalFraction = (str: string): number => {
          if (str.includes('/')) {
            const [num, denom] = str.split('/').map(Number);
            return num / denom;
          }
          return parseFloat(str);
        };
        
        const userNumber = evalFraction(normalizedUserAnswer);
        const correctNumber = evalFraction(normalizedCorrectAnswer);
        
        // Check if the numbers are very close (handling floating point precision)
        if (!isNaN(userNumber) && !isNaN(correctNumber)) {
          const tolerance = 0.0001; // Tolerance for floating point comparison
          correct = Math.abs(userNumber - correctNumber) < tolerance;
        }
      } catch (e) {
        // If parsing fails, stick with the string comparison result
        
      }
    }
    
    setIsCorrect(correct);
    setIsSubmitted(true);
    setAttempts(attempts + 1);
    
    // Calculate score based on attempts and hints used
    if (correct) {
      let finalScore = 100;
      // Deduct points for each hint used
      if (showHint1) finalScore -= 15;
      if (showHint2) finalScore -= 15;
      // Deduct points for multiple attempts (but not below 50)
      finalScore -= Math.min(attempts * 10, 20);
      
      setScore(Math.max(50, finalScore));
    }
  };

  const handleTryAgain = () => {
    setIsSubmitted(false);
  };

  const handleFinish = () => {
    onComplete(score);
  };

  // Show error message if content is missing
  if (error) {
    return (
      <div className="container mx-auto py-4 px-4 max-w-4xl">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onCancel} 
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        
        <Card className="mb-6">
          <CardContent className="p-6 text-center">
            <div className="text-red-500 mb-4">Error: {error}</div>
            <Button onClick={onCancel}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 px-4 max-w-4xl">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onCancel} 
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>
      
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-center">
            <Calculator className="h-5 w-5 mr-2 text-primary" />
            <CardTitle>Math Puzzle Challenge</CardTitle>
          </div>
          <CardDescription>
            Solve this blockchain-related mathematical puzzle
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Problem Context</h3>
            <p className="text-foreground/80 mb-4">{challenge.context}</p>
            
            <div className="p-4 rounded-lg bg-card/50 border mb-4">
              <h3 className="text-lg font-medium mb-2">Problem</h3>
              <p className="text-foreground/90">{challenge.question}</p>
              
              {challenge.equation && (
                <div className="mt-4 text-center p-3 bg-card border rounded font-mono">
                  {challenge.equation}
                </div>
              )}
            </div>
            
            {/* Hints Section */}
            <div className="mb-6">
              <h3 className="text-md font-medium mb-2">Need help?</h3>
              
              {!showHint1 ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowHint1(true)}
                  className="mb-2"
                >
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Show Hint 1
                </Button>
              ) : (
                <Alert className="mb-2">
                  <Lightbulb className="h-4 w-4 mr-2" />
                  <AlertDescription>
                    {challenge.hint1}
                  </AlertDescription>
                </Alert>
              )}
              
              {showHint1 && !showHint2 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowHint2(true)}
                >
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Show Hint 2
                </Button>
              )}
              
              {showHint2 && (
                <Alert>
                  <Lightbulb className="h-4 w-4 mr-2" />
                  <AlertDescription>
                    {challenge.hint2}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            
            {!isSubmitted ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Your Answer:
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={userAnswer}
                      onChange={handleAnswerChange}
                      placeholder="Enter your answer here"
                      className="flex-1"
                    />
                    <Button onClick={checkAnswer} disabled={!userAnswer.trim()}>
                      Check Answer
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {isCorrect ? (
                  <Alert className="bg-green-500/20 border-green-500/50">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    <AlertDescription className="text-green-500">
                      Correct! You solved the math puzzle!
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-red-500/20 border-red-500/50">
                    <XCircle className="h-5 w-5 text-red-500 mr-2" />
                    <AlertDescription className="text-red-500">
                      Incorrect answer. Try again or check the solution.
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="flex gap-2">
                  {!isCorrect && (
                    <Button 
                      onClick={handleTryAgain} 
                      variant="outline" 
                      className="flex-1"
                    >
                      Try Again
                    </Button>
                  )}
                  
                  {isCorrect && (
                    <Button 
                      onClick={handleFinish}
                      className="flex-1"
                    >
                      Complete Challenge
                    </Button>
                  )}
                </div>
                
                {isCorrect && (
                  <div className="mt-4">
                    <h3 className="text-md font-medium mb-2">Your Score: {score}/100</h3>
                    <p className="text-foreground/70 text-sm">
                      {score === 100 ? (
                        "Perfect! You solved it on the first try without hints."
                      ) : score >= 80 ? (
                        "Great job! You solved it with minimal help."
                      ) : score >= 60 ? (
                        "Good work! You solved it with some assistance."
                      ) : (
                        "You solved it! With practice, you'll need fewer hints next time."
                      )}
                    </p>
                  </div>
                )}
                
                {isCorrect && (
                  <div className="mt-4 p-4 bg-card/50 rounded-lg border">
                    <h3 className="text-md font-medium mb-2">Solution Explanation</h3>
                    <p className="text-foreground/80">{challenge.solution}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MathPuzzleChallenge; 