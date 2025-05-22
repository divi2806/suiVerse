import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Flashcard as FlashcardType } from '@/services/geminiService';
import { ChevronLeft, ChevronRight, ArrowRight, BookOpen, Rocket } from 'lucide-react';
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
    // Mark card as seen and mastered when viewing
    if (currentCard) {
      setCardStatus(prev => ({
        ...prev,
        [currentCard.id]: 'learning'
      }));
      
      // Let the parent component know we've viewed this card
      onComplete(currentCard.id, false);
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
  
  // Combine question and answer content into a story format
  const getStoryContent = (card: FlashcardType) => {
    // Extract the concept name from the question (typically in "What is X?" format)
    const conceptMatch = card.question.match(/What is (.*?)(\?|$)/i);
    const concept = conceptMatch ? conceptMatch[1].trim() : '';
    
    return (
      <div>
        <h3 className="text-2xl font-bold mb-6">
          {concept ? `Exploring ${concept}` : card.question}
        </h3>
        <div className="prose prose-invert max-w-none">
          <p className="text-md mb-4">{card.answer}</p>
          
          {/* Add storytelling flair */}
          {concept && (
            <p className="text-md italic text-foreground/80 mt-6">
              As you journey through the Sui galaxy, understanding {concept} will be critical for your mission.
            </p>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="flashcard-container p-4 my-8 max-w-3xl mx-auto">
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
              <span>Learning Module {currentIndex + 1} of {cards.length}</span>
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
                disabled={currentIndex >= cards.length - 1}
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
          
          <Card className="galaxy-card p-8 flex flex-col items-start min-h-[350px]">
            <div className="space-stars absolute inset-0 overflow-hidden opacity-20"></div>
            <div className="relative z-10 w-full">
              {getStoryContent(currentCard)}
            </div>
          </Card>
          
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