import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CodingChallenge } from '@/services/geminiService';
import { Bug, CheckCircle, HelpCircle, Rocket, XCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { generateContent } from '@/services/geminiService';
import './alien-challenge.css';

interface AlienChallengeProps {
  challenge: CodingChallenge;
  onComplete: (challengeId: string, success: boolean) => void;
}

const AlienChallenge: React.FC<AlienChallengeProps> = ({ challenge, onComplete }) => {
  const [code, setCode] = useState(challenge.codeSnippet);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<'success' | 'failure' | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [currentHint, setCurrentHint] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [battleAnimation, setBattleAnimation] = useState(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState('');
  const { toast } = useToast();
  
  // Debug log to see if the editor is getting initialized with the right value
  useEffect(() => {
    
    
  }, []);

  // Reset state when challenge changes
  useEffect(() => {
    setCode(challenge.codeSnippet);
    setIsSubmitting(false);
    setResult(null);
    setShowHint(false);
    setCurrentHint(0);
    setShowSolution(false);
    setBattleAnimation(false);
    setEvaluationFeedback('');
  }, [challenge.id]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    
    setCode(e.target.value);
  };

  // Production-ready code solution checker using Gemini AI
  const checkCodeSolution = async (userCode: string, solution: string): Promise<{
    success: boolean;
    feedback: string;
  }> => {
    try {
      // If user code is empty or unchanged from template, fail immediately
      if (!userCode.trim() || userCode === challenge.codeSnippet) {
        return {
          success: false,
          feedback: "You haven't modified the code template. Please implement your solution."
        };
      }
      
      // Craft a detailed prompt for Gemini API
      const prompt = `
        You are evaluating a student's solution to a Sui Move programming challenge.
        
        CHALLENGE CONTEXT:
        ${challenge.scenario}
        
        TASK:
        ${challenge.task}
        
        CORRECT SOLUTION:
        \`\`\`
        ${solution}
        \`\`\`
        
        STUDENT'S SOLUTION:
        \`\`\`
        ${userCode}
        \`\`\`
        
        Analyze the student's solution and determine if it correctly implements the required functionality.
        
        Respond in the following JSON format:
        {
          "isCorrect": true/false,
          "feedback": "Brief explanation of why the solution is correct or what's wrong",
          "correctnessScore": 0-100 (a score representing how close the solution is to being correct)
        }
        
        Only consider the solution correct if it properly implements the required logic, even if the implementation differs from the reference solution.
      `;
      
      // Call Gemini API
      
      const response = await generateContent(prompt);
      
      try {
        // Parse JSON response
        const parsedResponse = JSON.parse(response);
        
        
        // Check if solution is correct based on AI evaluation
        const isCorrect = parsedResponse.isCorrect === true || 
                          (parsedResponse.correctnessScore && parsedResponse.correctnessScore >= 80);
        
        return {
          success: isCorrect,
          feedback: parsedResponse.feedback || 
                    (isCorrect ? "Your solution works correctly!" : "Your solution has some issues.")
        };
      } catch (parseError) {
        
        
        
        // If JSON parsing fails, do a simpler text-based check
        const isCorrect = response.toLowerCase().includes("correct") && 
                         !response.toLowerCase().includes("incorrect") &&
                         !response.toLowerCase().includes("error");
        
        return {
          success: isCorrect,
          feedback: isCorrect ? 
            "Your solution appears to work correctly." : 
            "Your solution may have some issues. Check your implementation."
        };
      }
    } catch (error) {
      
      
      // Fallback to simple checks if AI evaluation fails
      const cleanUserCode = userCode.replace(/\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '').toLowerCase();
      const cleanSolution = solution.replace(/\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '').toLowerCase();
      
      // Extract key patterns that should be present in the solution
      const keyPatterns = [
        'struct',
        'fun',
        'public',
        'entry',
        'transfer',
      ].filter(pattern => cleanSolution.includes(pattern));
      
      // Count how many key patterns are present in user code
      const matchedPatterns = keyPatterns.filter(pattern => cleanUserCode.includes(pattern));
      const matchPercentage = (matchedPatterns.length / keyPatterns.length) * 100;
      
      return {
        success: matchPercentage >= 70,
        feedback: `Evaluation completed with ${Math.round(matchPercentage)}% pattern match.`
      };
    }
  };

  const handleSubmit = async () => {
    if (!code.trim() || code === challenge.codeSnippet) {
      toast({
        title: "Empty Solution",
        description: "Please implement your solution before submitting.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    setBattleAnimation(true);
    
    try {
      
      
      // Evaluate the code using AI
      const evaluation = await checkCodeSolution(code, challenge.solution);
      
      
      // Set the result and feedback
      setResult(evaluation.success ? 'success' : 'failure');
      setEvaluationFeedback(evaluation.feedback);
      
      // If successful, notify the parent component after a short delay
      if (evaluation.success) {
        setTimeout(() => {
          onComplete(challenge.id, true);
        }, 2000);
      }
    } catch (error) {
      
      toast({
        title: "Evaluation Error",
        description: "An error occurred while evaluating your code. Please try again.",
        variant: "destructive"
      });
      setResult('failure');
      setEvaluationFeedback("We couldn't properly evaluate your code due to a system error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShowHint = () => {
    setShowHint(true);
  };

  const handleNextHint = () => {
    if (currentHint < challenge.hints.length - 1) {
      setCurrentHint(currentHint + 1);
    }
  };

  const handleShowSolution = () => {
    setShowSolution(true);
  };

  const handleTryAgain = () => {
    setCode(challenge.codeSnippet);
    setResult(null);
    setBattleAnimation(false);
    setEvaluationFeedback('');
  };

  const handleGiveUp = () => {
    setShowSolution(true);
    setResult('failure');
    onComplete(challenge.id, false);
  };

  return (
    <div className="alien-challenge-container p-4 my-8 max-w-5xl mx-auto">
      <Card className="galaxy-card p-6 overflow-hidden">
        <div className="space-stars absolute inset-0 overflow-hidden opacity-20"></div>
        
        <div className="relative z-10">
          <div className="mb-6 flex items-center">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mr-3">
              <Bug className="h-6 w-6 text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold">Alien Challenge: Code Battle</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="mb-4">
                <h4 className="text-xl mb-2">Scenario</h4>
                <p className="text-foreground/80">{challenge.scenario}</p>
              </div>
              
              <div className="mb-4">
                <h4 className="text-xl mb-2">Your Task</h4>
                <p className="text-foreground/80">{challenge.task}</p>
              </div>
              
              <AnimatePresence>
                {showHint && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="hint-box p-4 rounded-lg bg-primary/10 border border-primary/30 mb-4"
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="text-lg flex items-center">
                        <HelpCircle className="h-5 w-5 mr-2 text-primary" />
                        Hint {currentHint + 1}:
                      </h4>
                      {challenge.hints.length > 1 && (
                        <div className="text-sm text-foreground/60">
                          {currentHint + 1}/{challenge.hints.length}
                          {currentHint < challenge.hints.length - 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleNextHint}
                              className="ml-2 h-6 text-primary hover:text-primary/80"
                            >
                              Next Hint
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="mt-2">{challenge.hints[currentHint]}</p>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {battleAnimation && (
                <div className="battle-animation-container mb-4 h-40 relative overflow-hidden rounded-lg bg-gradient-to-r from-purple-900/30 to-indigo-900/30">
                  <div className="battle-scene">
                    <div className="alien-ship"></div>
                    <div className="player-ship"></div>
                    <div className="laser-beams"></div>
                    <div className="stars"></div>
                    {result === 'success' && (
                      <div className="explosion"></div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex flex-wrap gap-2 mt-4">
                {!showHint && !isSubmitting && result === null && (
                  <Button 
                    variant="outline" 
                    onClick={handleShowHint}
                    className="text-primary border-primary/50"
                  >
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Get Hint
                  </Button>
                )}
                
                {!showSolution && result === 'failure' && (
                  <Button 
                    variant="outline" 
                    onClick={handleShowSolution}
                    className="text-primary border-primary/50"
                  >
                    Show Solution
                  </Button>
                )}
                
                {result === 'failure' && (
                  <Button 
                    variant="outline" 
                    onClick={handleTryAgain}
                    className="text-primary border-primary/50"
                  >
                    Try Again
                  </Button>
                )}
                
                {!result && !isSubmitting && (
                  <Button 
                    variant="outline" 
                    onClick={handleGiveUp}
                    className="text-destructive border-destructive/50"
                  >
                    Give Up
                  </Button>
                )}
              </div>
            </div>
            
            <div>
              <div className="code-editor-wrapper mb-4">
                <div className="code-editor-header flex justify-between items-center px-4 py-2 bg-card border-b border-border">
                  <span className="text-sm font-medium">Move Code Editor</span>
                  <div className="flex space-x-2">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  </div>
                </div>
                <textarea
                  value={showSolution ? challenge.solution : code}
                  onChange={handleCodeChange}
                  className="w-full h-60 bg-black/90 text-primary font-mono p-4 border-none focus:outline-none"
                  disabled={isSubmitting || showSolution || result === 'success'}
                  onClick={() => {}}
                />
              </div>
              
              <div className="flex justify-between mt-4">
                <div className="flex gap-2">
                  {isSubmitting && (
                    <Button disabled className="gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Evaluating...
                    </Button>
                  )}
                  
                  {result === null && !isSubmitting && (
                    <Button onClick={handleSubmit} className="gap-2 bg-gradient-to-r from-primary to-indigo-600">
                      <Rocket className="h-4 w-4" />
                      Submit Code
                    </Button>
                  )}
                </div>
                
                {evaluationFeedback && (
                  <div className={`p-3 rounded-md ${result === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'} max-w-full mt-4`}>
                    <div className="flex items-start gap-2">
                      {result === 'success' ? (
                        <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <p className="text-sm">{evaluationFeedback}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AlienChallenge; 