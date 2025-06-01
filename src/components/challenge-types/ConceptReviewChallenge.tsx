import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { BookOpen, Trophy, Check, ArrowLeft, Star, Lightbulb, ArrowDownCircle, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";

interface ConceptReviewContent {
  concept: string;
  description: string;
  questionPrompt: string;
  keyPoints: string[];
  practicalExample: string;
}

interface ConceptReviewChallengeProps {
  challenge: ConceptReviewContent;
  onComplete: (score: number, isCorrect?: boolean) => void;
  onCancel: () => void;
}

const ConceptReviewChallenge: React.FC<ConceptReviewChallengeProps> = ({ 
  challenge, 
  onComplete, 
  onCancel 
}) => {
  const [answer, setAnswer] = useState<string>('');
  const [showKeyPoints, setShowKeyPoints] = useState<boolean>(false);
  const [showExample, setShowExample] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
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
  
  // Calculate score based on time left and hints used
  const calculateScore = () => {
    const baseScore = 100;
    const timeBonus = Math.floor((timeLeft / 300) * 50); // Up to 50 points for time
    const hintPenalty = (showKeyPoints ? 15 : 0) + (showExample ? 15 : 0); // -15 points per hint
    
    return Math.max(baseScore + timeBonus - hintPenalty, 50); // Minimum 50 points
  };
  
  // Handle submission
  const handleSubmit = () => {
    if (!answer.trim()) {
      toast({
        title: "Answer Required",
        description: "Please provide an answer before submitting",
        variant: "destructive"
      });
      return;
    }
    
    // Calculate final score
    const finalScore = calculateScore();
    setScore(finalScore);
    setSubmitted(true);
    
    // Consider any submission as correct for concept review
    // Delay completion to show results
    setTimeout(() => {
      onComplete(finalScore, true);
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
      
      // Give minimum score and complete
      setSubmitted(true);
      setScore(25);
      
      setTimeout(() => {
        onComplete(25, false);
      }, 2000);
    }
  }, [timeLeft, onComplete, submitted]);
  
  return (
    <div className="w-full max-w-4xl mx-auto bg-card/60 backdrop-blur-md rounded-lg border border-border/40 p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <BookOpen className="h-5 w-5 text-purple-500" />
          <h2 className="text-xl font-semibold">Concept Review Challenge</h2>
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
      
      <Card className="bg-card/30 backdrop-blur-sm mb-6 border-primary/20">
        <CardContent className="p-4">
          <h3 className="text-xl font-medium text-primary mb-2">{challenge.concept}</h3>
          <p className="mb-4 text-foreground/80">{challenge.description}</p>
          
          <div className="bg-card/30 backdrop-blur-sm p-4 rounded-lg border border-border/40 mb-4">
            <h4 className="font-medium mb-2 flex items-center">
              <Info className="h-4 w-4 mr-2 text-blue-400" />
              Challenge Question:
            </h4>
            <p className="text-foreground/90 font-medium">{challenge.questionPrompt}</p>
          </div>
        </CardContent>
      </Card>
      
      {!submitted ? (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Your Answer:</label>
            <Textarea 
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here..."
              className="min-h-[200px] bg-card/20 backdrop-blur-sm"
            />
          </div>
          
          <div className="flex justify-between items-center mb-6">
            <div className="space-y-2">
              <Accordion type="single" collapsible className="w-full max-w-md">
                <AccordionItem value="key-points" className="border-none">
                  <AccordionTrigger 
                    onClick={() => setShowKeyPoints(true)}
                    className="py-2 px-3 text-sm bg-card/30 rounded-lg hover:bg-card/50 transition-all"
                  >
                    <div className="flex items-center">
                      <Lightbulb className="h-4 w-4 mr-2 text-yellow-400" />
                      <span>Show Key Points</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-card/10 rounded-lg mt-2 p-3 border border-border/20">
                    <ul className="space-y-2 list-disc pl-5">
                      {challenge.keyPoints.map((point: string, index: number) => (
                        <li key={index} className="text-sm">{point}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="example" className="border-none">
                  <AccordionTrigger 
                    onClick={() => setShowExample(true)}
                    className="py-2 px-3 text-sm bg-card/30 rounded-lg hover:bg-card/50 transition-all"
                  >
                    <div className="flex items-center">
                      <ArrowDownCircle className="h-4 w-4 mr-2 text-blue-400" />
                      <span>Show Practical Example</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-card/10 rounded-lg mt-2 p-3 border border-border/20">
                    <p className="text-sm">{challenge.practicalExample}</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
            
            <Button 
              onClick={handleSubmit}
              disabled={!answer.trim() || submitted}
            >
              Submit Answer
            </Button>
          </div>
        </>
      ) : (
        <motion.div 
          className="p-4 rounded-md bg-green-500/20 border border-green-500/30 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center mb-3">
            <Check className="h-5 w-5 text-green-500 mr-2" />
            <h3 className="font-medium text-green-500">Answer Submitted!</h3>
          </div>
          
          <p className="mb-4 text-sm">
            Thank you for reviewing this concept and submitting your answer. Your response has been recorded.
          </p>
          
          <div className="flex items-center mt-2">
            <Trophy className="h-4 w-4 text-yellow-500 mr-2" />
            <span className="font-medium">Score: {score} points</span>
          </div>
        </motion.div>
      )}
      
      <div className="text-sm text-foreground/60 mt-6">
        <p>Note: Your understanding of blockchain concepts is essential for building secure and efficient applications. Take your time to absorb the information.</p>
      </div>
    </div>
  );
};

export default ConceptReviewChallenge; 