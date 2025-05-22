
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

interface CodeCompletionProps {
  onComplete: (score: number, timeLeft: number) => void;
  onCancel: () => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  timeLimit?: number; // in seconds
}

const CodeCompletion: React.FC<CodeCompletionProps> = ({ 
  onComplete, 
  onCancel, 
  difficulty = 'medium',
  timeLimit = 180 
}) => {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // Sample code completion questions
  const questions = [
    {
      id: '1',
      prompt: `
// Complete the Move function to create a new Coin
module sui::coin {
    public fun create<T>(
        value: u64,
        ctx: &mut TxContext
    ): Coin<T> {
        // Complete the code
`,
      options: [
        `        let id = object::new(ctx);
        Coin { id, value }`,
        
        `        Coin { 
            id: object::new(ctx),
            balance: balance::create_with_value(value)
        }`,
        
        `        Coin { 
            id: object::new(ctx),
            value 
        }`,
        
        `        return Coin::new(value, object::new(ctx))`
      ],
      correctAnswer: 1,
      explanation: "The Coin struct in Sui Move requires an ID and a balance field that holds the value."
    },
    {
      id: '2',
      prompt: `
// Complete the function to verify ownership
public fun verify_ownership<T: key>(
    object: &T,
    owner: address
): bool {
    // Complete the code
`,
      options: [
        `    object::owner(object) == owner`,
        `    object::owner::address(object) == owner`,
        `    object.owner == owner`,
        `    get_owner_address(object) == owner`
      ],
      correctAnswer: 0,
      explanation: "The object::owner function is used to get the owner's address of an object."
    },
    {
      id: '3',
      prompt: `
// Complete the transfer function
public fun transfer<T: key>(
    object: T,
    recipient: address,
) {
    // Complete the code
`,
      options: [
        `    object::transfer(object, recipient)`,
        `    transfer::public_transfer(object, recipient)`,
        `    sui::transfer(object, recipient)`,
        `    sui::transfer::transfer(object, recipient)`
      ],
      correctAnswer: 2,
      explanation: "In Sui Move, sui::transfer is the function used to transfer an object to a new owner."
    }
  ];

  useEffect(() => {
    // Timer countdown
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Time's up - submit current score
          onComplete(score, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [score, onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex.toString());
    
    // Check if answer is correct
    const correct = answerIndex === questions[currentQuestion].correctAnswer;
    setIsCorrect(correct);
    
    if (correct) {
      // Add score based on difficulty and time left
      let pointsEarned = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 30;
      // Bonus points for answering quickly
      const timeBonus = Math.floor((timeLeft / timeLimit) * 10);
      pointsEarned += timeBonus;
      
      setScore(prev => prev + pointsEarned);
    }

    // Wait a moment to show correctness, then move to next question
    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(prev => prev + 1);
        setSelectedAnswer(null);
        setIsCorrect(null);
      } else {
        // Game complete
        onComplete(score + (correct ? 20 : 0), timeLeft);
      }
    }, 1500);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="galaxy-card p-6 border border-primary/30">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-medium">Move Code Completion Challenge</h3>
            <p className="text-sm text-foreground/70">
              Complete the code snippets by choosing the correct options
            </p>
          </div>
          
          <div className={`flex items-center px-3 py-1 rounded-lg ${
            timeLeft < 30 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-primary/20'
          }`}>
            <Clock className="h-4 w-4 mr-1" />
            <span className="font-mono">{formatTime(timeLeft)}</span>
          </div>
        </header>

        <div className="mb-4 flex justify-between items-center">
          <div className="text-sm font-medium">
            Question {currentQuestion + 1} of {questions.length}
          </div>
          <div className="text-sm">
            Score: <span className="font-bold">{score}</span>
          </div>
        </div>

        <div className="bg-muted/30 p-4 rounded-lg mb-6 overflow-x-auto">
          <pre className="text-sm font-mono whitespace-pre">
            {questions[currentQuestion].prompt}
          </pre>
        </div>

        <div className="space-y-3 mb-6">
          {questions[currentQuestion].options.map((option, index) => (
            <motion.div
              key={index}
              className={`p-3 rounded-lg border cursor-pointer ${
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
                <div className="font-mono text-xs bg-muted/50 px-2 py-1 rounded mr-2 flex-shrink-0">
                  {String.fromCharCode(65 + index)}
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap break-words flex-grow">
                  {option}
                </pre>
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

        <div className="flex justify-between">
          <Button variant="outline" onClick={onCancel}>
            Quit Game
          </Button>
          
          <div className="text-sm text-foreground/70 flex items-center">
            Difficulty: 
            <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
              difficulty === 'easy' ? 'bg-green-500/20 text-green-500' : 
              difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-500' : 
              'bg-red-500/20 text-red-500'
            }`}>
              {difficulty.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeCompletion;
