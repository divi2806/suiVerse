import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Coins, ArrowRight, Check, ChevronsRight } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { motion } from 'framer-motion';

interface ScenarioStep {
  id: string;
  description: string;
  options: {
    id: string;
    text: string;
    outcome?: string;
    isCorrect: boolean;
    nextStep?: string; // ID of the next step or null for end
  }[];
}

interface DeFiScenarioContent {
  title: string;
  introduction: string;
  steps: {
    [key: string]: ScenarioStep;
  };
  firstStepId: string;
  conclusion: {
    success: string;
    failure: string;
  };
}

interface DeFiScenarioChallengeProps {
  challenge: DeFiScenarioContent;
  onComplete: (score: number) => void;
  onCancel: () => void;
}

const DeFiScenarioChallenge: React.FC<DeFiScenarioChallengeProps> = ({
  challenge,
  onComplete,
  onCancel
}) => {
  // Using startedScenario to track if the user has started the scenario
  const [startedScenario, setStartedScenario] = useState(false);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [decisionHistory, setDecisionHistory] = useState<Array<{
    stepId: string;
    optionId: string;
    isCorrect: boolean;
  }>>([]);
  const [showOutcome, setShowOutcome] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState(0);
  
  // Get current step from steps object if we have a currentStepId
  const currentStep = currentStepId ? challenge.steps[currentStepId] : null;
  const isScenarioOver = isCompleted && !currentStep;
  
  // Function to begin the scenario
  const beginScenario = () => {
    setStartedScenario(true);
    setCurrentStepId(challenge.firstStepId);
    setDecisionHistory([]);
    setShowOutcome(false);
    setIsCompleted(false);
    setScore(0);
  };
  
  const handleOptionSelect = (optionId: string) => {
    setSelectedOption(optionId);
  };
  
  const handleContinue = () => {
    if (!selectedOption || !currentStep) return;
    
    const selectedOptionData = currentStep.options.find(opt => opt.id === selectedOption);
    if (!selectedOptionData) return;
    
    // Record this decision
    const newDecisionHistory = [
      ...decisionHistory,
      {
        stepId: currentStepId!,
        optionId: selectedOption,
        isCorrect: selectedOptionData.isCorrect
      }
    ];
    setDecisionHistory(newDecisionHistory);
    
    // Calculate score based on correct decisions
    const correctDecisions = newDecisionHistory.filter(d => d.isCorrect).length;
    const totalDecisions = newDecisionHistory.length;
    const calculatedScore = Math.round((correctDecisions / totalDecisions) * 100);
    setScore(calculatedScore);
    
    // Show the outcome of this decision before moving to next step
    setShowOutcome(true);
    
    // Check if this is the end of the scenario
    if (!selectedOptionData.nextStep) {
      setIsCompleted(true);
    }
  };
  
  const moveToNextStep = () => {
    if (!currentStep || !selectedOption) return;
    
    const selectedOptionData = currentStep.options.find(opt => opt.id === selectedOption);
    if (!selectedOptionData) return;
    
    if (selectedOptionData.nextStep) {
      setCurrentStepId(selectedOptionData.nextStep);
      setSelectedOption(null);
      setShowOutcome(false);
    } else {
      // End of scenario
      setIsCompleted(true);
      setCurrentStepId(null);
    }
  };
  
  const handleFinish = () => {
    onComplete(score);
  };
  
  const correctChoices = decisionHistory.filter(d => d.isCorrect).length;
  const totalChoices = decisionHistory.length;
  const successRate = totalChoices > 0 ? (correctChoices / totalChoices) * 100 : 0;
  const isSuccess = successRate >= 70;
  
  if (isScenarioOver) {
    return (
      <div className="container mx-auto py-4 px-4 max-w-4xl">
        <Card className="mb-6">
          <CardHeader className="pb-4 text-center">
            <div className="flex items-center justify-center">
              <Coins className="h-8 w-8 mb-2 text-primary" />
            </div>
            <CardTitle className="text-2xl">DeFi Scenario Complete</CardTitle>
            <CardDescription>
              You've completed the DeFi simulation scenario
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="mb-6 text-center">
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">Your Performance</h3>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>{correctChoices} correct choices out of {totalChoices}</span>
                </div>
                <Progress value={successRate} className="w-full h-2 mb-1" />
                <div className="text-sm text-foreground/70">
                  Success Rate: {Math.round(successRate)}%
                </div>
              </div>
              
              <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 mb-6">
                <h3 className="text-lg font-medium mb-2">{isSuccess ? 'Success!' : 'Scenario Result'}</h3>
                <p className="text-foreground/80">
                  {isSuccess ? challenge.conclusion.success : challenge.conclusion.failure}
                </p>
              </div>
              
              <Button onClick={handleFinish} className="w-full">
                Complete Challenge
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
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
            <Coins className="h-5 w-5 mr-2 text-primary" />
            <CardTitle>DeFi Scenario Challenge</CardTitle>
          </div>
          <CardDescription>
            Navigate through this DeFi scenario by making the best decisions
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {!startedScenario ? (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Introduction</h3>
              <p className="text-foreground/80 mb-4">{challenge.introduction}</p>
              <Button 
                onClick={beginScenario} 
                className="w-full"
              >
                Begin Scenario
              </Button>
            </div>
          ) : (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Scenario Progress</h3>
                <div className="text-sm text-foreground/70">
                  Step {decisionHistory.length + (showOutcome && !isCompleted ? 0 : 1)}
                </div>
              </div>
              
              {!showOutcome && currentStep ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="p-4 rounded-lg bg-card/50 border mb-4">
                    <p className="text-foreground/90">{currentStep.description}</p>
                  </div>
                  
                  <div className="my-4">
                    <h3 className="text-md font-medium mb-3">What will you do?</h3>
                    
                    <RadioGroup value={selectedOption || ''} className="space-y-3">
                      {currentStep.options.map((option) => (
                        <div key={option.id} className="flex items-center space-x-2 rounded-md border p-3 cursor-pointer">
                          <RadioGroupItem 
                            value={option.id} 
                            id={option.id} 
                            onClick={() => handleOptionSelect(option.id)}
                          />
                          <Label 
                            htmlFor={option.id} 
                            className="flex-1 cursor-pointer"
                          >
                            {option.text}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                  
                  <Button 
                    onClick={handleContinue} 
                    className="w-full" 
                    disabled={!selectedOption}
                  >
                    Make Decision
                  </Button>
                </motion.div>
              ) : currentStep ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-4">
                    <h3 className="text-md font-medium mb-2">Your Decision</h3>
                    <div className="p-3 rounded-lg bg-card/50 border">
                      {currentStep.options.find(opt => opt.id === selectedOption)?.text}
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h3 className="text-md font-medium mb-2">Outcome</h3>
                    <Alert 
                      className={`border ${
                        currentStep.options.find(opt => opt.id === selectedOption)?.isCorrect
                          ? "border-green-500/50 bg-green-500/20"
                          : "border-amber-500/50 bg-amber-500/20"
                      }`}
                    >
                      <AlertDescription>
                        {currentStep.options.find(opt => opt.id === selectedOption)?.outcome || 
                          "This decision led to an interesting outcome."}
                      </AlertDescription>
                    </Alert>
                  </div>
                  
                  <Button 
                    onClick={moveToNextStep} 
                    className="w-full"
                    variant={isCompleted ? "default" : "outline"}
                  >
                    {isCompleted ? (
                      <>View Results</>
                    ) : (
                      <>Continue <ChevronsRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                </motion.div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeFiScenarioChallenge; 