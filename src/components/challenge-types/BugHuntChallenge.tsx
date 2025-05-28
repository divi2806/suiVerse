import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trophy, Check, X, ArrowLeft, BugOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { DailyChallenge } from '@/services/dailyChallengesService';

interface BugInfo {
  lineHint: string;
  description: string;
  fix: string;
}

interface BugHuntContent {
  scenario: string;
  buggyCode: string;
  bugs: BugInfo[];
}

interface BugHuntChallengeProps {
  challenge: DailyChallenge;
  onComplete: (score: number, isCorrect?: boolean) => void;
  onCancel: () => void;
}

const BugHuntChallenge: React.FC<BugHuntChallengeProps> = ({ 
  challenge, 
  onComplete, 
  onCancel 
}) => {
  // Extract content from challenge
  const content = challenge.content as BugHuntContent;
  
  const [identifiedBugs, setIdentifiedBugs] = useState<boolean[]>(
    new Array(content.bugs.length).fill(false)
  );
  const [fixes, setFixes] = useState<string[]>(
    new Array(content.bugs.length).fill('')
  );
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes
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
  
  const handleBugIdentified = (index: number) => {
    const newIdentifiedBugs = [...identifiedBugs];
    newIdentifiedBugs[index] = !newIdentifiedBugs[index];
    setIdentifiedBugs(newIdentifiedBugs);
  };
  
  const handleFixChange = (index: number, fix: string) => {
    const newFixes = [...fixes];
    newFixes[index] = fix;
    setFixes(newFixes);
  };
  
  // Calculate score based on identified bugs and fixes
  const calculateScore = () => {
    let baseScore = 100;
    const timeBonus = Math.floor((timeLeft / 300) * 50); // Up to 50 points for time
    
    // Calculate the percentage of bugs correctly identified
    const identifiedCount = identifiedBugs.filter(Boolean).length;
    const identificationScore = Math.floor((identifiedCount / content.bugs.length) * 50);
    
    // Calculate the quality of fixes
    let fixesScore = 0;
    let correctFixes = 0;
    
    identifiedBugs.forEach((identified, index) => {
      if (identified && fixes[index].trim()) {
        const expectedFix = content.bugs[index].fix.toLowerCase().replace(/\s+/g, ' ').trim();
        const providedFix = fixes[index].toLowerCase().replace(/\s+/g, ' ').trim();
        
        // Simple check for key parts of the fix
        if (providedFix.includes(expectedFix) || expectedFix.includes(providedFix)) {
          correctFixes++;
        }
      }
    });
    
    fixesScore = Math.floor((correctFixes / content.bugs.length) * 50);
    
    return Math.min(baseScore + timeBonus, 200) + identificationScore + fixesScore;
  };
  
  const handleSubmit = () => {
    if (!identifiedBugs.some(Boolean)) {
      toast({
        title: "No Bugs Identified",
        description: "Please identify at least one bug before submitting",
        variant: "destructive"
      });
      return;
    }
    
    // Calculate score
    const finalScore = calculateScore();
    setScore(finalScore);
    setSubmitted(true);
    
    // Delay completion to show results
    const correctProportion = identifiedBugs.filter(Boolean).length / content.bugs.length;
    const isCorrect = correctProportion >= 0.5; // Consider correct if identified at least half the bugs
    
    setTimeout(() => {
      onComplete(finalScore, isCorrect);
    }, 3000);
  };
  
  // Handle time expiration
  useEffect(() => {
    if (timeLeft === 0 && !submitted) {
      toast({
        title: "Time's Up!",
        description: "You've run out of time for this challenge.",
        variant: "destructive"
      });
      
      setSubmitted(true);
      setScore(25);
      
      setTimeout(() => {
        onComplete(25, false); // Failed due to timeout
      }, 2000);
    }
  }, [timeLeft, onComplete, submitted]);
  
  return (
    <div className="w-full max-w-4xl mx-auto bg-card/60 backdrop-blur-md rounded-lg border border-border/40 p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <BugOff className="h-5 w-5 text-red-500" />
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
        <h3 className="text-lg font-medium mb-2">Scenario</h3>
        <p className="text-foreground/80 mb-4">{content.scenario}</p>
        
        <h3 className="text-lg font-medium mb-2">Buggy Code</h3>
        <div className="bg-black/60 text-red-400 p-4 rounded-md font-mono text-sm overflow-x-auto mb-4">
          <pre>{content.buggyCode}</pre>
        </div>
      </div>
      
      {!submitted ? (
        <>
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Identify and Fix Bugs</h3>
            <p className="text-foreground/70 mb-4">
              Find and fix the bugs in the code above. Check the boxes for bugs you've identified and provide your fixes.
            </p>
            
            <div className="space-y-6">
              {content.bugs.map((bug, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-start gap-3 mb-3">
                    <Checkbox 
                      id={`bug-${index}`} 
                      checked={identifiedBugs[index]}
                      onCheckedChange={() => handleBugIdentified(index)}
                    />
                    <div>
                      <label 
                        htmlFor={`bug-${index}`}
                        className="text-md font-medium cursor-pointer"
                      >
                        Bug #{index + 1}
                      </label>
                      <p className="text-sm text-foreground/70 mt-1">Hint: {bug.lineHint}</p>
                    </div>
                  </div>
                  
                  {identifiedBugs[index] && (
                    <div className="ml-7">
                      <Textarea
                        placeholder="Describe your fix for this bug..."
                        value={fixes[index]}
                        onChange={(e) => handleFixChange(index, e.target.value)}
                        className="resize-none h-24"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <Button 
            onClick={handleSubmit} 
            className="w-full" 
            disabled={!identifiedBugs.some(Boolean)}
          >
            Submit Fixes
          </Button>
        </>
      ) : (
        <motion.div 
          className="mt-6 p-4 rounded-md bg-green-500/20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center mb-4">
            <Check className="h-5 w-5 text-green-500 mr-2" />
            <h3 className="text-lg font-medium text-green-500">Solution Submitted!</h3>
          </div>
          
          <div className="space-y-6 mb-4">
            {content.bugs.map((bug, index) => (
              <div key={index} className="p-4 border rounded-lg bg-card/50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
                    <h4 className="font-medium">Bug #{index + 1}</h4>
                  </div>
                  
                  <div className="flex items-center">
                    {identifiedBugs[index] ? (
                      <Check className="h-4 w-4 text-green-500 mr-1" />
                    ) : (
                      <X className="h-4 w-4 text-red-500 mr-1" />
                    )}
                    <span className="text-sm">
                      {identifiedBugs[index] ? "Identified" : "Missed"}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground/70">Location:</p>
                    <p className="text-foreground">{bug.lineHint}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-foreground/70">Description:</p>
                    <p className="text-foreground">{bug.description}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-foreground/70">Correct Fix:</p>
                    <p className="text-foreground font-mono text-sm bg-black/30 p-2 rounded">{bug.fix}</p>
                  </div>
                  
                  {identifiedBugs[index] && fixes[index] && (
                    <div>
                      <p className="text-sm font-medium text-foreground/70">Your Fix:</p>
                      <p className="text-foreground font-mono text-sm bg-black/30 p-2 rounded">{fixes[index]}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-border/40">
            <p className="text-sm mb-2">You earned:</p>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Trophy className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">{score} points</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default BugHuntChallenge; 