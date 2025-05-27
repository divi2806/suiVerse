import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trophy, Check, X, ArrowLeft, Bug } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

interface BugHuntChallengeProps {
  challenge: any;
  onComplete: (score: number) => void;
  onCancel: () => void;
}

const BugHuntChallenge: React.FC<BugHuntChallengeProps> = ({ 
  challenge, 
  onComplete, 
  onCancel 
}) => {
  const [selectedBugs, setSelectedBugs] = useState<number[]>([]);
  const [fixes, setFixes] = useState<string[]>(Array(challenge.bugs.length).fill(''));
  const [results, setResults] = useState<boolean[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes
  const [score, setScore] = useState<number>(0);
  const [showSolution, setShowSolution] = useState<boolean>(false);
  
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
  
  // Calculate score based on time left and correct fixes
  const calculateScore = (correctCount: number) => {
    const totalBugs = challenge.bugs.length;
    const baseScore = Math.floor((correctCount / totalBugs) * 100);
    const timeBonus = Math.floor((timeLeft / 300) * 50); // Up to 50 points for time
    
    return baseScore + timeBonus;
  };
  
  // Handle bug selection
  const toggleBug = (index: number) => {
    if (selectedBugs.includes(index)) {
      setSelectedBugs(selectedBugs.filter(i => i !== index));
    } else {
      setSelectedBugs([...selectedBugs, index]);
    }
  };
  
  // Handle fix input
  const updateFix = (index: number, value: string) => {
    const newFixes = [...fixes];
    newFixes[index] = value;
    setFixes(newFixes);
  };
  
  // Handle submit
  const handleSubmit = () => {
    if (selectedBugs.length === 0) {
      toast({
        title: "No Bugs Selected",
        description: "Please identify at least one bug before submitting",
        variant: "destructive"
      });
      return;
    }
    
    // Check which bugs were correctly identified and fixed
    const newResults = challenge.bugs.map((_: any, index: number) => {
      if (!selectedBugs.includes(index)) return false;
      
      const userFix = fixes[index].toLowerCase().trim();
      const correctFix = challenge.bugs[index].fix.toLowerCase().trim();
      
      // Basic check - if the fix contains some key parts of the correct fix
      // This is a simple approach, in a real app you'd need more sophisticated comparison
      const keyParts = correctFix.split(' ').filter(word => word.length > 3);
      const matchCount = keyParts.filter(part => userFix.includes(part)).length;
      
      return matchCount >= Math.ceil(keyParts.length / 2);
    });
    
    setResults(newResults);
    
    // Calculate score
    const correctCount = newResults.filter(Boolean).length;
    const finalScore = calculateScore(correctCount);
    setScore(finalScore);
    
    // Show solution
    setShowSolution(true);
    
    // Delay completion to show results
    setTimeout(() => {
      onComplete(finalScore);
    }, 5000);
  };
  
  // Handle time expiration
  useEffect(() => {
    if (timeLeft === 0) {
      toast({
        title: "Time's Up!",
        description: "You've run out of time for this challenge.",
        variant: "destructive"
      });
      
      // Calculate partial score based on what was completed
      const correctCount = selectedBugs.length > 0 ? 1 : 0; // Give some credit for trying
      const finalScore = Math.max(25, calculateScore(correctCount));
      
      // Show solution
      setShowSolution(true);
      
      setTimeout(() => {
        onComplete(finalScore);
      }, 3000);
    }
  }, [timeLeft, onComplete, selectedBugs.length, challenge.bugs.length]);
  
  return (
    <div className="w-full max-w-4xl mx-auto bg-card/60 backdrop-blur-md rounded-lg border border-border/40 p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h2 className="text-xl font-semibold">Bug Hunt Challenge</h2>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className={`text-sm font-medium px-3 py-1 rounded-full ${
            timeLeft > 180 ? "bg-green-500/20 text-green-500" :
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
        <h3 className="text-lg font-medium mb-2">Scenario:</h3>
        <p className="mb-4">{challenge.scenario}</p>
        
        <div className="bg-black/60 text-green-400 p-4 rounded-md font-mono text-sm overflow-x-auto mb-4">
          <pre>{challenge.buggyCode}</pre>
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-4">Identify and Fix Bugs:</h3>
        
        {challenge.bugs.map((bug: any, index: number) => (
          <div 
            key={index} 
            className={`mb-6 p-4 rounded-md border ${
              showSolution && results[index] ? 'border-green-500 bg-green-500/10' :
              showSolution && selectedBugs.includes(index) && !results[index] ? 'border-red-500 bg-red-500/10' :
              selectedBugs.includes(index) ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <Checkbox 
                  checked={selectedBugs.includes(index)} 
                  onCheckedChange={() => !showSolution && toggleBug(index)}
                  disabled={showSolution}
                />
              </div>
              
              <div className="flex-grow">
                <p className="font-medium mb-2">Potential Bug {index + 1}:</p>
                <p className="text-sm mb-3">{bug.lineHint}</p>
                
                <div className="mb-3">
                  <label className="text-sm font-medium block mb-2">Your Fix:</label>
                  <Textarea 
                    placeholder="Describe how you would fix this bug..."
                    value={fixes[index]}
                    onChange={(e) => !showSolution && updateFix(index, e.target.value)}
                    disabled={showSolution || !selectedBugs.includes(index)}
                    className="min-h-[80px]"
                  />
                </div>
                
                {showSolution && (
                  <div className="mt-3 p-3 bg-black/30 rounded-md">
                    <p className="text-sm font-medium mb-1">Actual Bug:</p>
                    <p className="text-sm mb-2">{bug.description}</p>
                    <p className="text-sm font-medium mb-1">Correct Fix:</p>
                    <p className="text-sm">{bug.fix}</p>
                  </div>
                )}
                
                {showSolution && (
                  <div className="mt-3 flex items-center">
                    {results[index] ? (
                      <>
                        <Check className="h-4 w-4 text-green-500 mr-2" />
                        <p className="text-sm text-green-500">Correctly fixed!</p>
                      </>
                    ) : selectedBugs.includes(index) ? (
                      <>
                        <X className="h-4 w-4 text-red-500 mr-2" />
                        <p className="text-sm text-red-500">Fix was incorrect or incomplete</p>
                      </>
                    ) : (
                      <>
                        <Bug className="h-4 w-4 text-yellow-500 mr-2" />
                        <p className="text-sm text-yellow-500">Bug was missed</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {!showSolution && (
        <div className="flex justify-end">
          <Button 
            className="neon-button"
            onClick={handleSubmit}
            disabled={selectedBugs.length === 0}
          >
            Submit Fixes
          </Button>
        </div>
      )}
      
      {showSolution && (
        <motion.div 
          className="mt-6 p-4 rounded-md bg-primary/10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-medium mb-2">Challenge Complete!</h3>
          <p className="mb-4">You found {results.filter(Boolean).length} out of {challenge.bugs.length} bugs correctly.</p>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span className="font-medium">{score} points</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default BugHuntChallenge; 