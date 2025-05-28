import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { CheckCircle, AlertTriangle, ArrowLeft, Shield } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DailyChallenge } from '@/services/dailyChallengesService';

interface SecurityIssue {
  severity: 'high' | 'medium' | 'low';
  description: string;
  location: string;
  recommendation: string;
}

interface SecurityAuditContent {
  scenario: string;
  contractCode: string;
  securityIssues: SecurityIssue[];
}

interface SecurityAuditChallengeProps {
  challenge: DailyChallenge;
  onComplete: (score: number, isCorrect?: boolean) => void;
  onCancel: () => void;
}

const SecurityAuditChallenge: React.FC<SecurityAuditChallengeProps> = ({
  challenge,
  onComplete,
  onCancel
}) => {
  // Extract the content from the challenge
  const content = challenge.content as SecurityAuditContent;
  
  const [identifiedIssues, setIdentifiedIssues] = useState<boolean[]>(
    new Array(content.securityIssues.length).fill(false)
  );
  const [userComments, setUserComments] = useState<string[]>(
    new Array(content.securityIssues.length).fill('')
  );
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const handleIssueIdentified = (index: number) => {
    const newIdentifiedIssues = [...identifiedIssues];
    newIdentifiedIssues[index] = !newIdentifiedIssues[index];
    setIdentifiedIssues(newIdentifiedIssues);
  };

  const handleCommentChange = (index: number, comment: string) => {
    const newComments = [...userComments];
    newComments[index] = comment;
    setUserComments(newComments);
  };

  const handleSubmit = () => {
    // Calculate score based on correctly identified issues
    const correctlyIdentified = identifiedIssues.filter(Boolean).length;
    const maxScore = content.securityIssues.length * 100;
    const earnedScore = Math.round((correctlyIdentified / content.securityIssues.length) * 100);
    
    setScore(earnedScore);
    setIsSubmitted(true);
  };

  const handleFinish = () => {
    // Pass isCorrect=true if the score is above a certain threshold
    const isCorrect = score >= 60; // Consider 60% or higher as correct
    onComplete(score, isCorrect);
  };

  // Helper to render severity badge
  const renderSeverityBadge = (severity: string) => {
    const classes = {
      high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    };
    
    return (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${classes[severity]}`}>
        {severity.toUpperCase()}
      </span>
    );
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
            <Shield className="h-5 w-5 mr-2 text-primary" />
            <CardTitle>Security Audit Challenge</CardTitle>
          </div>
          <CardDescription>
            Find and identify security vulnerabilities in the smart contract
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Scenario</h3>
            <p className="text-foreground/80">{content.scenario}</p>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Contract Code</h3>
            <ScrollArea className="h-[300px] rounded-md border">
              <SyntaxHighlighter 
                language="rust" 
                style={atomOneDark}
                showLineNumbers={true}
                wrapLines={true}
                className="text-sm"
              >
                {content.contractCode}
              </SyntaxHighlighter>
            </ScrollArea>
          </div>
          
          {!isSubmitted ? (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Identify Security Issues</h3>
                <p className="text-foreground/70 mb-4">
                  Review the code and identify the security issues present. Check the boxes for 
                  each vulnerability you find and provide your analysis.
                </p>
                
                <div className="space-y-4">
                  {content.securityIssues.map((_, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Checkbox 
                          id={`issue-${index}`} 
                          checked={identifiedIssues[index]}
                          onCheckedChange={() => handleIssueIdentified(index)}
                        />
                        <div className="space-y-2 flex-1">
                          <Label 
                            htmlFor={`issue-${index}`}
                            className="text-md font-medium cursor-pointer"
                          >
                            Security Issue #{index + 1}
                          </Label>
                          <Textarea
                            placeholder="Describe the vulnerability you've identified..."
                            value={userComments[index]}
                            onChange={(e) => handleCommentChange(index, e.target.value)}
                            className="resize-none h-24"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <Button 
                onClick={handleSubmit} 
                className="w-full" 
                disabled={!identifiedIssues.some(Boolean)}
              >
                Submit Audit
              </Button>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Audit Results</h3>
                <div className="p-4 border rounded-lg mb-4 bg-card/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                      <span className="font-medium">Your Score: {score}%</span>
                    </div>
                    <div>
                      {renderSeverityBadge(
                        score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low'
                      )}
                    </div>
                  </div>
                  <p className="text-foreground/70">
                    You correctly identified {identifiedIssues.filter(Boolean).length} out of {content.securityIssues.length} security issues.
                  </p>
                </div>
                
                <div className="space-y-4">
                  {content.securityIssues.map((issue, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-card/50">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center">
                          <AlertTriangle className="h-5 w-5 mr-2 text-primary" />
                          <h4 className="font-medium">Security Issue #{index + 1}</h4>
                        </div>
                        {renderSeverityBadge(issue.severity)}
                      </div>
                      
                      <div className="grid gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground/70">Location:</p>
                          <p className="text-foreground">{issue.location}</p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-foreground/70">Description:</p>
                          <p className="text-foreground">{issue.description}</p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-foreground/70">Recommendation:</p>
                          <p className="text-foreground">{issue.recommendation}</p>
                        </div>
                        
                        {userComments[index] && (
                          <div>
                            <p className="text-sm font-medium text-foreground/70">Your Analysis:</p>
                            <p className="text-foreground italic">{userComments[index]}</p>
                          </div>
                        )}
                        
                        <div className="mt-2">
                          <div className="flex items-center">
                            <div className="w-5 h-5 mr-2 flex items-center justify-center">
                              {identifiedIssues[index] ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              )}
                            </div>
                            <p className="text-sm font-medium">
                              {identifiedIssues[index] 
                                ? "You identified this issue" 
                                : "You missed this issue"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <Button onClick={handleFinish} className="w-full">
                Claim Rewards
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityAuditChallenge; 