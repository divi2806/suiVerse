import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuizQuestion } from '@/services/geminiService';
import { CheckCircle, XCircle, Clock, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import './quiz.css';

interface QuizProps {
  questions: QuizQuestion[];
  onComplete: (score: number, correctAnswers: number, totalQuestions: number) => void;
}

const Quiz: React.FC<QuizProps> = ({ questions, onComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30); // 30 seconds per question
  const [timerActive, setTimerActive] = useState(true);
  const [timeExpired, setTimeExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if questions are valid and set loading timeout
  useEffect(() => {
    
    
    if (questions && questions.length > 0) {
      
      setIsLoading(false);
      setLoadingTimeout(false);
      
      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    } else {
      
      setIsLoading(true);
      
      // Set a timeout to show retry option if questions don't load within 15 seconds
      if (!loadingTimeoutRef.current) {
        
        loadingTimeoutRef.current = setTimeout(() => {
          
          setLoadingTimeout(true);
        }, 15000); // 15 seconds timeout
      }
    }
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [questions]);

  // Reset state when questions change
  useEffect(() => {
    if (!questions || questions.length === 0) return;
    
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setShowExplanation(false);
    setScore(0);
    setCorrectAnswers(0);
    setQuizCompleted(false);
    setTimeRemaining(30);
    setTimerActive(true);
    setTimeExpired(false);
  }, [questions]);

  // Handle timer
  useEffect(() => {
    if (!questions || questions.length === 0) return;
    
    if (timerActive && timeRemaining > 0) {
      timerRef.current = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    } else if (timerActive && timeRemaining === 0) {
      // Time expired for this question
      setTimerActive(false);
      setTimeExpired(true);
      setShowExplanation(true);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [timerActive, timeRemaining, questions]);

  // Log when we're actually rendering quiz questions - moved outside conditional rendering
  useEffect(() => {
    if (!isLoading && questions && questions.length > 0) {
      
      
    }
  }, [isLoading, questions]);

  const handleOptionSelect = (optionIndex: number) => {
    if (!questions || questions.length === 0 || selectedOption !== null || showExplanation || timeExpired) return; // Prevent changing answer
    
    const currentQuestion = questions[currentQuestionIndex];
    
    // Stop the timer
    setTimerActive(false);
    setSelectedOption(optionIndex);
    
    // Calculate score based on time remaining and correctness
    if (optionIndex === currentQuestion.correctAnswer) {
      // Bonus points for answering quickly
      const timeBonus = Math.floor(timeRemaining / 3);
      const questionScore = 20 + timeBonus; // Base 20 points + time bonus
      setScore(score + questionScore);
      setCorrectAnswers(correctAnswers + 1);
    }
    
    // Show explanation after selection
    setShowExplanation(true);
  };

  const handleNextQuestion = () => {
    if (!questions || questions.length === 0) return;
    
    // Move to next question or finish quiz
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOption(null);
      setShowExplanation(false);
      setTimeRemaining(30);
      setTimerActive(true);
      setTimeExpired(false);
    } else {
      setQuizCompleted(true);
      onComplete(score, correctAnswers, questions.length);
    }
  };

  const getTimerColor = () => {
    if (timeRemaining > 20) return 'text-green-500';
    if (timeRemaining > 10) return 'text-yellow-500';
    return 'text-red-500';
  };
  
  // Function to force retry loading the quiz
  const handleRetry = () => {
    // Clear the timeout state
    setLoadingTimeout(false);
    
    // Create an event to notify the ModulePage that we need to reload
    const reloadEvent = new CustomEvent('reloadQuiz');
    document.dispatchEvent(reloadEvent);
    
    // Create fallback questions if needed
    if (!questions || questions.length === 0) {
      // Use mock questions as fallback
      const fallbackQuestions: QuizQuestion[] = [
        {
          id: 'fallback-1',
          question: "What is Sui?",
          options: [
            "A layer 1 blockchain designed for scalable apps",
            "A layer 2 solution for Ethereum",
            "A cryptocurrency exchange",
            "A blockchain gaming platform"
          ],
          correctAnswer: 0,
          explanation: "Sui is a layer 1 blockchain that's designed to be scalable and optimized for high-throughput applications."
        },
        {
          id: 'fallback-2',
          question: "What programming language is used for Sui smart contracts?",
          options: [
            "Solidity",
            "Rust",
            "Move",
            "JavaScript"
          ],
          correctAnswer: 2,
          explanation: "Move is the programming language used for developing smart contracts on Sui."
        },
        {
          id: 'fallback-3',
          question: "What is unique about Sui's object model?",
          options: [
            "It uses accounts instead of objects",
            "Objects have owners and can be transferred directly",
            "All objects are shared by default",
            "Sui doesn't use smart contracts"
          ],
          correctAnswer: 1,
          explanation: "Sui's object model is unique because objects have owners and can be transferred directly between addresses."
        }
      ];
      
      // Force use of fallback questions by simulating the props update
      setTimeout(() => {
        const event = new CustomEvent('quizFallbackLoaded', { detail: { questions: fallbackQuestions }});
        document.dispatchEvent(event);
      }, 1000);
    }
  };

  // Render loading state if needed
  if (isLoading || !questions || questions.length === 0) {
    return (
      <div className="quiz-container p-4 my-8 max-w-3xl mx-auto">
        <Card className="galaxy-card p-8 text-center">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h3 className="text-xl font-bold">Loading Quiz Questions...</h3>
            <p className="text-muted-foreground mt-2">Preparing your knowledge challenge</p>
            
            {loadingTimeout && (
              <div className="mt-6">
                <p className="text-amber-400 mb-2">It's taking longer than expected to load questions.</p>
                <Button 
                  variant="outline" 
                  onClick={handleRetry}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry Loading Questions
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Get the current question safely
  const currentQuestion = questions[currentQuestionIndex];

  // Render the quiz UI
  return (
    <div className="quiz-container p-4 my-8 max-w-3xl mx-auto">
      <AnimatePresence mode="wait">
        {!quizCompleted ? (
          <motion.div
            key={`question-${currentQuestionIndex}`}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="galaxy-card p-8">
              <div className="space-grid absolute inset-0 overflow-hidden opacity-10"></div>
              <div className="relative z-10">
                <div className="mb-6 flex justify-between items-center">
                  <h3 className="text-xl font-bold">Quiz Question {currentQuestionIndex + 1}/{questions.length}</h3>
                  <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded-full ${getTimerColor()} bg-primary/20 font-medium flex items-center`}>
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{timeRemaining}s</span>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-primary/20 text-primary font-medium">
                      Score: {score}
                    </div>
                  </div>
                </div>
                
                <div className="mb-8">
                  <h4 className="text-xl mb-6">{currentQuestion.question}</h4>
                  
                  <div className="space-y-3">
                    {currentQuestion.options.map((option, i) => (
                      <div
                        key={i}
                        className={`option-card p-4 rounded-lg cursor-pointer transition-all border ${
                          selectedOption === i 
                            ? (i === currentQuestion.correctAnswer 
                              ? 'border-green-500 bg-green-500/10' 
                              : 'border-red-500 bg-red-500/10')
                            : timeExpired && i === currentQuestion.correctAnswer
                              ? 'border-yellow-500 bg-yellow-500/10'
                              : 'border-primary/20 hover:border-primary/40 bg-card'
                        }`}
                        onClick={() => handleOptionSelect(i)}
                      >
                        <div className="flex items-center">
                          <div className={`option-marker w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                            selectedOption === i || (timeExpired && i === currentQuestion.correctAnswer) 
                              ? 'bg-primary' 
                              : 'bg-primary/20'
                          }`}>
                            {selectedOption === i && i === currentQuestion.correctAnswer && (
                              <CheckCircle className="h-5 w-5 text-green-300" />
                            )}
                            {selectedOption === i && i !== currentQuestion.correctAnswer && (
                              <XCircle className="h-5 w-5 text-red-300" />
                            )}
                            {timeExpired && i === currentQuestion.correctAnswer && !selectedOption && (
                              <CheckCircle className="h-5 w-5 text-yellow-300" />
                            )}
                            {selectedOption !== i && !(timeExpired && i === currentQuestion.correctAnswer) && (
                              <span className="text-sm">{String.fromCharCode(65 + i)}</span>
                            )}
                          </div>
                          <span className={selectedOption === i ? 'font-medium' : ''}>{option}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {timeExpired && !selectedOption && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="explanation-box p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-6"
                  >
                    <div className="flex items-center mb-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                      <h4 className="font-medium">Time's up!</h4>
                    </div>
                    <p>The correct answer was: {currentQuestion.options[currentQuestion.correctAnswer]}</p>
                  </motion.div>
                )}
                
                {showExplanation && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="explanation-box p-4 rounded-lg bg-primary/10 border border-primary/20 mb-6"
                  >
                    <h4 className="font-medium mb-2">Explanation:</h4>
                    <p>{currentQuestion.explanation}</p>
                  </motion.div>
                )}
                
                <div className="text-center">
                  {showExplanation && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Button 
                        onClick={handleNextQuestion}
                        className="neon-button"
                      >
                        {currentQuestionIndex < questions.length - 1 ? "Next Question" : "Complete Quiz"}
                      </Button>
                    </motion.div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="complete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-10"
          >
            <div className="loading-animation"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Quiz; 