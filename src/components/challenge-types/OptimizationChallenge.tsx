import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Zap, ArrowRightLeft, CheckCircle } from 'lucide-react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OptimizationContent {
  scenario: string;
  originalCode: string;
  optimizationGoals: string[];
  hints: string[];
  sampleSolution: string;
  optimizationPoints: {
    description: string;
    explanation: string;
  }[];
}

interface OptimizationChallengeProps {
  challenge: OptimizationContent;
  onComplete: (score: number) => void;
  onCancel: () => void;
}

const OptimizationChallenge: React.FC<OptimizationChallengeProps> = ({
  challenge,
  onComplete,
  onCancel
}) => {
  const [optimizedCode, setOptimizedCode] = useState('');
  const [activeTab, setActiveTab] = useState('original');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [identifiedPoints, setIdentifiedPoints] = useState<boolean[]>(
    new Array(challenge.optimizationPoints.length).fill(false)
  );
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');

  const handleOptimizedCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setOptimizedCode(e.target.value);
  };

  const handleSubmit = () => {
    // Simple check to see if the user has made changes
    if (!optimizedCode || optimizedCode === challenge.originalCode) {
      setFeedback("You haven't made any changes to the code.");
      return;
    }

    // Auto-evaluate optimization points based on keywords/patterns
    // In a real implementation, this would be more sophisticated
    const newIdentifiedPoints = [...identifiedPoints];
    let pointsFound = 0;
    
    challenge.optimizationPoints.forEach((point, index) => {
      // Simple approach: check if the optimization description keywords exist in the user's code
      const keywords = point.description.toLowerCase().split(' ');
      const significantKeywords = keywords.filter(word => 
        word.length > 4 && !['the', 'and', 'that', 'with', 'for', 'this'].includes(word)
      );
      
      // Count how many keywords are in the user's solution
      const keywordsFound = significantKeywords.filter(keyword => 
        optimizedCode.toLowerCase().includes(keyword)
      ).length;
      
      // If more than 30% of keywords are found, consider this point addressed
      if (keywordsFound / significantKeywords.length > 0.3) {
        newIdentifiedPoints[index] = true;
        pointsFound++;
      }
    });
    
    // Calculate score based on optimization points identified
    const calculatedScore = Math.round((pointsFound / challenge.optimizationPoints.length) * 100);
    setScore(calculatedScore);
    setIdentifiedPoints(newIdentifiedPoints);
    setIsSubmitted(true);
    
    if (pointsFound === 0) {
      setFeedback("We couldn't detect any specific optimizations. Try to address the goals mentioned.");
    } else if (pointsFound < challenge.optimizationPoints.length / 2) {
      setFeedback("You've made some optimizations, but there's room for improvement!");
    } else if (pointsFound < challenge.optimizationPoints.length) {
      setFeedback("Great job! You've addressed most of the optimization points!");
    } else {
      setFeedback("Excellent! You've addressed all the optimization points!");
    }
  };

  const handleFinish = () => {
    onComplete(score);
  };

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
            <Zap className="h-5 w-5 mr-2 text-primary" />
            <CardTitle>Code Optimization Challenge</CardTitle>
          </div>
          <CardDescription>
            Optimize the provided code to improve performance or efficiency
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Optimization Scenario</h3>
            <p className="text-foreground/80 mb-4">{challenge.scenario}</p>
            
            <div className="mb-4">
              <h3 className="text-md font-medium mb-2">Optimization Goals:</h3>
              <ul className="list-disc pl-5 space-y-1">
                {challenge.optimizationGoals.map((goal, index) => (
                  <li key={index} className="text-foreground/80">{goal}</li>
                ))}
              </ul>
            </div>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="original" className="flex-1">Original Code</TabsTrigger>
                <TabsTrigger value="optimized" className="flex-1">Your Optimized Code</TabsTrigger>
                {isSubmitted && (
                  <TabsTrigger value="solution" className="flex-1">Sample Solution</TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="original" className="mt-0">
                <div className="mb-4">
                  <ScrollArea className="h-[300px] rounded-md border">
                    <SyntaxHighlighter 
                      language="rust" 
                      style={atomOneDark}
                      showLineNumbers={true}
                      className="text-sm"
                    >
                      {challenge.originalCode}
                    </SyntaxHighlighter>
                  </ScrollArea>
                </div>
              </TabsContent>
              
              <TabsContent value="optimized" className="mt-0">
                <div className="mb-4">
                  {!isSubmitted ? (
                    <Textarea
                      value={optimizedCode}
                      onChange={handleOptimizedCodeChange}
                      placeholder="Enter your optimized code here..."
                      className="font-mono h-[300px] resize-none"
                    />
                  ) : (
                    <ScrollArea className="h-[300px] rounded-md border">
                      <SyntaxHighlighter 
                        language="rust" 
                        style={atomOneDark}
                        showLineNumbers={true}
                        className="text-sm"
                      >
                        {optimizedCode}
                      </SyntaxHighlighter>
                    </ScrollArea>
                  )}
                </div>
              </TabsContent>
              
              {isSubmitted && (
                <TabsContent value="solution" className="mt-0">
                  <div className="mb-4">
                    <ScrollArea className="h-[300px] rounded-md border">
                      <SyntaxHighlighter 
                        language="rust" 
                        style={atomOneDark}
                        showLineNumbers={true}
                        className="text-sm"
                      >
                        {challenge.sampleSolution}
                      </SyntaxHighlighter>
                    </ScrollArea>
                  </div>
                </TabsContent>
              )}
            </Tabs>
            
            {!isSubmitted ? (
              <>
                <div className="my-4">
                  <h3 className="text-md font-medium mb-2">Hints:</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {challenge.hints.map((hint, index) => (
                      <li key={index} className="text-foreground/80">{hint}</li>
                    ))}
                  </ul>
                </div>
                
                <Button 
                  onClick={handleSubmit} 
                  className="w-full mt-4" 
                  disabled={!optimizedCode.trim() || optimizedCode === challenge.originalCode}
                >
                  Submit Optimization
                </Button>
                
                {feedback && !isSubmitted && (
                  <Alert className="mt-4">
                    <AlertDescription>{feedback}</AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <>
                <div className="my-4">
                  <h3 className="text-lg font-medium mb-3 flex items-center">
                    <ArrowRightLeft className="h-5 w-5 mr-2 text-primary" />
                    Optimization Results
                  </h3>
                  
                  <div className="p-4 border rounded-md mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">Your Score:</div>
                      <Badge variant={score >= 70 ? "default" : "outline"}>
                        {score}/100
                      </Badge>
                    </div>
                    
                    <p className="text-foreground/80 mb-4">{feedback}</p>
                    
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Optimization Points:</h4>
                      {challenge.optimizationPoints.map((point, index) => (
                        <div key={index} className="p-3 border rounded-md bg-card/50">
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5">
                              {identifiedPoints[index] ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border-2" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{point.description}</p>
                              <p className="text-foreground/70 text-sm mt-1">{point.explanation}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Button onClick={handleFinish} className="w-full">
                    Complete Challenge
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OptimizationChallenge; 