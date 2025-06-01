import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flashcard as FlashcardType } from '@/services/geminiService';
import { ChevronLeft, ChevronRight, ArrowRight, BookOpen, Rocket, Code, Brain, Lightbulb, CheckCircle2 } from 'lucide-react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import './flashcard.css';

interface FlashcardProps {
  cards: FlashcardType[];
  onComplete: (cardId: string, mastered: boolean) => void;
  onFinish: () => void;
}

const Flashcard: React.FC<FlashcardProps> = ({ cards, onComplete, onFinish }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardStatus, setCardStatus] = useState<Record<string, 'mastered' | 'learning' | 'unseen'>>({});
  const [cardHistory, setCardHistory] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("learn");
  const [quizAnswer, setQuizAnswer] = useState("");
  const [showQuizAnswer, setShowQuizAnswer] = useState(false);
  
  const currentCard = cards[currentIndex];
  
  // Initialize card statuses
  useEffect(() => {
    const initialStatuses: Record<string, 'mastered' | 'learning' | 'unseen'> = {};
    
    cards.forEach(card => {
      initialStatuses[card.id] = 'unseen';
    });
    
    setCardStatus(initialStatuses);
    setProgress(0);
  }, [cards]);
  
  useEffect(() => {
    // Mark card as seen and reset state for new card
    if (currentCard) {
      setCardStatus(prev => ({
        ...prev,
        [currentCard.id]: 'learning'
      }));
      
      // Let the parent component know we've viewed this card
      onComplete(currentCard.id, false);
      
      // Reset state for new card
      // Don't reset activeTab to preserve user's tab selection
      setQuizAnswer("");
      setShowQuizAnswer(false);
    }
  }, [currentIndex, currentCard, onComplete]);
  
  const handlePreviousCard = () => {
    if (cardHistory.length > 0) {
      const prevIndex = cardHistory[cardHistory.length - 1];
      setCurrentIndex(prevIndex);
      setCardHistory(cardHistory.slice(0, -1));
    }
  };
  
  const handleNextCard = () => {
    if (currentIndex < cards.length - 1) {
      // Mark current card as mastered before moving to next
      setCardStatus(prev => ({
        ...prev,
        [currentCard.id]: 'mastered'
      }));
      
      onComplete(currentCard.id, true);
      
      setCardHistory([...cardHistory, currentIndex]);
      setCurrentIndex(currentIndex + 1);
      setProgress(Math.floor(((currentIndex + 1) / cards.length) * 100));
    } else {
      // Mark the last card as mastered
      setCardStatus(prev => ({
        ...prev,
        [currentCard.id]: 'mastered'
      }));
      
      onComplete(currentCard.id, true);
      
      // All cards viewed, go to next section
      onFinish();
    }
  };
  
  // Format code blocks in the content
  const formatContent = (content: string) => {
    if (!content) return <p>No content available</p>;
    
    // Split by code blocks
    const parts = content.split(/```(?:move|sui)?([\s\S]*?)```/g);
    
    return (
      <>
        {parts.map((part, i) => {
          // Even indexes are regular text, odd indexes are code
          if (i % 2 === 0) {
            return (
              <div key={i} className="mb-4">
                {part.split('\n').map((line, j) => {
                  // Check if this is a heading
                  if (line.startsWith('# ')) {
                    return <h3 key={j} className="text-xl font-bold mt-4 mb-2">{line.replace('# ', '')}</h3>;
                  } else if (line.startsWith('## ')) {
                    return <h4 key={j} className="text-lg font-bold mt-3 mb-2">{line.replace('## ', '')}</h4>;
                  } else if (line.startsWith('* ') || line.startsWith('- ')) {
                    return <li key={j} className="ml-4 mb-1">{line.replace(/^\*\s|-\s/, '')}</li>;
                  } else if (line.trim() === '') {
                    return <br key={j} />;
                  } else {
                    return <p key={j} className="mb-2">{line}</p>;
                  }
                })}
              </div>
            );
          } else {
            // This is a code block
            return (
              <div key={i} className="mb-4 rounded-md overflow-hidden">
                <SyntaxHighlighter 
                  language="rust" 
                  style={atomOneDark}
                  showLineNumbers={true}
                  wrapLines={true}
                >
                  {part}
                </SyntaxHighlighter>
              </div>
            );
          }
        })}
      </>
    );
  };
  
  // Extract the concept name from the question
  const getConceptName = () => {
    const conceptMatch = currentCard.question.match(/What is (.*?)(\?|$)/i);
    return conceptMatch ? conceptMatch[1].trim() : '';
  };
  
  // Generate a quiz question based on the card content
  const getQuizQuestion = () => {
    const concept = getConceptName();
    if (concept) {
      return `What is the primary purpose of ${concept} in Sui Move?`;
    } else {
      return currentCard.question;
    }
  };
  
  const checkQuizAnswer = () => {
    setShowQuizAnswer(true);
  };
  
  return (
    <div className="flashcard-container p-4 my-8 max-w-4xl mx-auto">
      <AnimatePresence mode="wait">
        <motion.div 
          key={`card-${currentIndex}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex justify-between items-center mb-3 text-sm text-foreground/70">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span>Learning Card {currentIndex + 1} of {cards.length}</span>
            </div>
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handlePreviousCard}
                disabled={cardHistory.length === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleNextCard}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="flex justify-end mt-1">
              <span className="text-xs text-foreground/70">{progress}% complete</span>
            </div>
          </div>
          
          <Tabs 
            defaultValue="learn" 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="learn" className="flex items-center gap-1">
                <Brain className="h-4 w-4" />
                <span>Learn</span>
              </TabsTrigger>
              <TabsTrigger value="practice" className="flex items-center gap-1">
                <Code className="h-4 w-4" />
                <span>Practice</span>
              </TabsTrigger>
              <TabsTrigger value="quiz" className="flex items-center gap-1">
                <Lightbulb className="h-4 w-4" />
                <span>Quiz</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="learn">
              <Card className="galaxy-card p-8 flex flex-col items-start min-h-[350px]">
                <div className="space-stars absolute inset-0 overflow-hidden opacity-20"></div>
                <div className="relative z-10 w-full">
                  <h3 className="text-2xl font-bold mb-6">
                    {currentCard.question}
                  </h3>
                  <div className="mt-6 border-t border-primary/20 pt-4">
                    <h4 className="text-lg font-semibold mb-3 text-primary">Answer:</h4>
                    <div className="overflow-y-auto max-h-[350px] prose prose-invert max-w-none">
                      {formatContent(currentCard.answer)}
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
            
            <TabsContent value="practice">
              <Card className="galaxy-card p-8 flex flex-col items-start min-h-[350px]">
                <div className="space-stars absolute inset-0 overflow-hidden opacity-20"></div>
                <div className="relative z-10 w-full">
                  <h3 className="text-2xl font-bold mb-6">Practice Mode</h3>
                  
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold mb-2">Concept:</h4>
                    <p className="text-lg">{currentCard.question}</p>
                  </div>
                  
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold mb-2">Key Points:</h4>
                    <div className="prose prose-invert max-w-none">
                      {formatContent(currentCard.answer)}
                    </div>
                  </div>
                  
                  <div className="mt-4 p-4 bg-primary/10 rounded-md">
                    <h4 className="text-md font-semibold mb-2 flex items-center">
                      <Lightbulb className="h-4 w-4 mr-2 text-yellow-400" />
                      Try This:
                    </h4>
                    <p>Review this concept and try to explain it in your own words. This will help reinforce your understanding.</p>
                  </div>
                </div>
              </Card>
            </TabsContent>
            
            <TabsContent value="quiz">
              <Card className="galaxy-card p-8 flex flex-col items-start min-h-[350px]">
                <div className="space-stars absolute inset-0 overflow-hidden opacity-20"></div>
                <div className="relative z-10 w-full">
                  <h3 className="text-2xl font-bold mb-6">Quick Quiz</h3>
                  
                  <p className="text-lg mb-4">{getQuizQuestion()}</p>
                  
                  <textarea
                    className="w-full h-24 bg-black/30 border border-primary/30 rounded-md p-3 text-foreground/90 mb-4"
                    placeholder="Type your answer here..."
                    value={quizAnswer}
                    onChange={(e) => setQuizAnswer(e.target.value)}
                  />
                  
                  <div className="flex justify-end">
                    <Button 
                      onClick={checkQuizAnswer}
                      disabled={!quizAnswer.trim() || showQuizAnswer}
                      className="neon-button"
                    >
                      Check Answer
                    </Button>
                  </div>
                  
                  {showQuizAnswer && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-primary/10 rounded-md border border-primary/30"
                    >
                      <div className="flex items-start mb-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
                        <div>
                          <h4 className="font-semibold mb-1">Model Answer:</h4>
                          <div className="text-foreground/90">
                            {formatContent(currentCard.answer.split('\n').slice(0, 2).join('\n'))}
                          </div>
                          <p className="text-sm text-foreground/70 mt-2">
                            Compare your answer with the explanation. It's okay if they're not identical as long as you captured the key concepts!
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
          
          <div className="mt-6 flex justify-between">
            <Button 
              onClick={handlePreviousCard}
              variant="outline" 
              disabled={cardHistory.length === 0}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <Button 
              onClick={handleNextCard}
              className="neon-button flex items-center gap-2"
            >
              {currentIndex >= cards.length - 1 ? (
                <>
                  <Rocket className="h-4 w-4" />
                  Complete & Continue to Quiz
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Flashcard; 