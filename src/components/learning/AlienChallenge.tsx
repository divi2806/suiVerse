import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CodingChallenge } from '@/services/geminiService';
import { Bug, CheckCircle, HelpCircle, Rocket, XCircle, Loader2, Code, ArrowRight, Save } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { generateContent } from '@/services/geminiService';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
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
  const [currentStep, setCurrentStep] = useState<'intro' | 'coding' | 'battle' | 'result'>('intro');
  const { toast } = useToast();
  
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
    setCurrentStep('intro');
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
    setCurrentStep('battle');
    setBattleAnimation(true);
    
    try {
      // Evaluate the code using AI
      const evaluation = await checkCodeSolution(code, challenge.solution);
      
      // Set the result and feedback
      setResult(evaluation.success ? 'success' : 'failure');
      setEvaluationFeedback(evaluation.feedback);
      setCurrentStep('result');
      
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
      setCurrentStep('result');
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
    setCurrentStep('coding');
  };

  const handleGiveUp = () => {
    setShowSolution(true);
    setResult('failure');
    onComplete(challenge.id, false);
  };
  
  const handleStartCoding = () => {
    setCurrentStep('coding');
  };

  const renderIntroScreen = () => {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          <h3 className="text-2xl font-bold mb-2">Alien Challenge: Code Battle</h3>
          <p className="text-lg">An alien has challenged you to write a Move smart contract to solve a problem!</p>
        </div>
        
        <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-500/30 space-y-4">
          <div className="space-y-2">
            <h4 className="text-lg font-semibold text-purple-300">Scenario</h4>
            <p className="text-foreground/90">{challenge.scenario}</p>
          </div>
          
          <div className="space-y-2">
            <h4 className="text-lg font-semibold text-purple-300">Your Task</h4>
            <p className="text-foreground/90">{challenge.task}</p>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button 
            onClick={handleStartCoding}
            className="neon-button flex items-center gap-2"
          >
            Begin Coding
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };
  
  const renderCodingScreen = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between">
          <h3 className="text-2xl font-bold">Alien Challenge: Coding</h3>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShowHint}
              disabled={showHint && currentHint >= challenge.hints.length - 1}
              className="flex items-center gap-1"
            >
              <HelpCircle className="h-4 w-4" />
              {showHint ? 'Next Hint' : 'Get Hint'}
            </Button>
          </div>
        </div>
        
        {showHint && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-primary/10 rounded-md border border-primary/30"
          >
            <div className="flex">
              <HelpCircle className="h-5 w-5 text-primary mr-2 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-primary mb-1">Hint {currentHint + 1}:</p>
                <p className="text-sm text-foreground/90">{challenge.hints[currentHint]}</p>
                
                {currentHint < challenge.hints.length - 1 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleNextHint}
                    className="mt-2 text-xs"
                  >
                    Show next hint
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
        
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-blue-400" />
                <h4 className="font-medium">Your Code</h4>
              </div>
              
              {showSolution && (
                <span className="text-xs text-yellow-400">
                  Solution shown below
                </span>
              )}
            </div>
            
            <div className="relative min-h-[350px] rounded-md overflow-hidden">
              <textarea
                className="absolute inset-0 w-full h-full p-4 font-mono text-sm bg-black/50 text-foreground/90 border border-primary/20 rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                value={showSolution ? challenge.solution : code}
                onChange={handleCodeChange}
                readOnly={showSolution}
                placeholder="Write your solution here..."
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep('intro')}
              className="flex items-center gap-1"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
              Back to Instructions
            </Button>
            
            <div className="flex gap-2">
              {!showSolution && (
                <Button
                  variant="secondary"
                  onClick={handleShowSolution}
                  className="flex items-center gap-1"
                >
                  <CheckCircle className="h-4 w-4" />
                  Show Solution
                </Button>
              )}
              
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || showSolution}
                className="neon-button flex items-center gap-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Submit Solution
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  const renderBattleScreen = () => {
    return (
      <div className="battle-animation-container">
        <div className="battle-scene">
          <div className="alien">
            <div className="alien-body">
              <div className="alien-eyes"></div>
            </div>
            <div className="alien-tentacles"></div>
          </div>
          
          <div className="code-warrior">
            <div className="code-warrior-body">
              <div className="code-warrior-helmet"></div>
            </div>
            <div className="code-warrior-weapon"></div>
          </div>
          
          <div className="battle-effects"></div>
        </div>
        
        <div className="battle-text">
          <h3 className="text-xl font-bold mb-2">Code Battle in Progress...</h3>
          <p>Your code is being analyzed and tested against the alien's challenge!</p>
        </div>
      </div>
    );
  };
  
  const renderResultScreen = () => {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <div className="inline-flex justify-center items-center w-20 h-20 rounded-full mb-4">
            {result === 'success' ? (
              <div className="success-glow">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
            ) : (
              <div className="failure-glow">
                <XCircle className="h-16 w-16 text-red-500" />
              </div>
            )}
          </div>
          
          <h2 className="text-2xl font-bold mb-2">
            {result === 'success' ? 'Challenge Completed!' : 'Not Quite Right'}
          </h2>
          
          <p className="text-lg">
            {result === 'success' 
              ? 'Your code defeated the alien challenge!' 
              : 'Your code needs some adjustments. Try again!'}
          </p>
        </div>
        
        <div className="p-4 bg-background/50 rounded-lg border border-border">
          <h3 className="text-lg font-medium mb-2">Feedback</h3>
          <p className="text-foreground/90">{evaluationFeedback}</p>
        </div>
        
        {/* Code display with syntax highlighting */}
        <div className="overflow-hidden rounded-md border border-border">
          <div className="bg-black/20 p-2 text-xs font-medium">Your Submission</div>
          <SyntaxHighlighter
            language="rust"
            style={atomOneDark}
            showLineNumbers={true}
            customStyle={{ margin: 0, borderRadius: 0, maxHeight: '200px' }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
        
        <div className="flex justify-between pt-4">
          {result === 'success' ? (
            <div className="flex-1"></div>
          ) : (
            <Button
              onClick={handleTryAgain}
              variant="outline"
              className="flex items-center gap-1"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
              Try Again
            </Button>
          )}
          
          <Button
            onClick={result === 'success' ? () => onComplete(challenge.id, true) : handleGiveUp}
            className={`neon-button flex items-center gap-1 ${result === 'success' ? 'bg-green-600 hover:bg-green-700' : ''}`}
          >
            {result === 'success' ? (
              <>
                <Rocket className="h-4 w-4" />
                Continue Journey
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                View Solution & Continue
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="alien-challenge-container p-4 my-8 max-w-5xl mx-auto">
      <Card className="galaxy-card p-6 overflow-hidden">
        <div className="space-stars absolute inset-0 overflow-hidden opacity-20"></div>
        
        <div className="relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {currentStep === 'intro' && renderIntroScreen()}
              {currentStep === 'coding' && renderCodingScreen()}
              {currentStep === 'battle' && renderBattleScreen()}
              {currentStep === 'result' && renderResultScreen()}
            </motion.div>
          </AnimatePresence>
        </div>
      </Card>
    </div>
  );
};

export default AlienChallenge; 