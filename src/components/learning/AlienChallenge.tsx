import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CodingChallenge } from '@/services/geminiService';
import { Bug, CheckCircle, HelpCircle, Rocket, XCircle } from 'lucide-react';
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
  
  // Debug log to see if the editor is getting initialized with the right value
  useEffect(() => {
    console.log("Challenge code snippet:", challenge.codeSnippet);
    console.log("Editor initialized with:", code);
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
  }, [challenge.id]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    console.log("Code changing to:", e.target.value);
    setCode(e.target.value);
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    setBattleAnimation(true);
    
    console.log("Submitting code:", code);
    
    // Simulate code evaluation - in a real app, this would actually check the code
    setTimeout(() => {
      const success = checkCodeSolution(code, challenge.solution);
      console.log("Code check result:", success);
      setResult(success ? 'success' : 'failure');
      setIsSubmitting(false);
      
      if (success) {
        setTimeout(() => {
          onComplete(challenge.id, true);
        }, 2000);
      }
    }, 3000);
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
  };

  const handleGiveUp = () => {
    setShowSolution(true);
    setResult('failure');
    onComplete(challenge.id, false);
  };

  // Simple code solution checker (in a real app, this would be more sophisticated)
  const checkCodeSolution = (userCode: string, solution: string): boolean => {
    // For debugging - always succeed if the string "transfer::transfer" is in the code
    if (userCode.includes("transfer::transfer")) {
      return true;
    }
    
    // Remove whitespace and comments for comparison
    const cleanUserCode = userCode.replace(/\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    const cleanSolution = solution.replace(/\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    
    // Very simple check - in a real app, you'd have a more sophisticated parser
    return cleanUserCode.includes(cleanSolution.substring(10, 40));
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
                  onClick={() => console.log("Editor clicked")}
                />
              </div>
              
              <div className="flex justify-end">
                {!result && (
                  <Button 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="neon-button"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="loading mr-2"></span>
                        Battling Alien...
                      </>
                    ) : (
                      <>
                        <Rocket className="mr-2 h-4 w-4" />
                        Launch Attack
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {result && (
                <div className={`mt-4 p-4 rounded-lg ${
                  result === 'success' ? 'bg-green-500/20 border border-green-500/50' : 
                  'bg-red-500/20 border border-red-500/50'
                }`}>
                  <div className="flex items-center">
                    {result === 'success' ? (
                      <>
                        <CheckCircle className="h-6 w-6 mr-2 text-green-400" />
                        <span className="font-medium">Success! You defeated the alien!</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-6 w-6 mr-2 text-red-400" />
                        <span className="font-medium">Your attack failed! Try again.</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AlienChallenge; 