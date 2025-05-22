import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface PuzzlePiece {
  id: string;
  content: string;
  lineNumber?: number;
}

interface PuzzleChallenge {
  id: string;
  title: string;
  description: string;
  initialCode: string;
  pieces: PuzzlePiece[];
  solution: string[];
}

interface SmartContractPuzzleProps {
  onComplete: (score: number, timeLeft: number) => void;
  onCancel: () => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  timeLimit?: number; // in seconds
}

const SmartContractPuzzle: React.FC<SmartContractPuzzleProps> = ({ 
  onComplete, 
  onCancel, 
  difficulty = 'medium',
  timeLimit = 300 
}) => {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [currentPuzzle, setCurrentPuzzle] = useState(0);
  const [pieces, setPieces] = useState<PuzzlePiece[]>([]);
  const [solutionArea, setSolutionArea] = useState<PuzzlePiece[]>([]);
  const [score, setScore] = useState(0);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);

  // Sample puzzles
  const puzzles: PuzzleChallenge[] = [
    {
      id: 'puzzle-1',
      title: 'NFT Creation Module',
      description: 'Arrange the code blocks to create a valid NFT module in Sui',
      initialCode: 'module examples::my_nft {\n    // Complete the NFT module\n}',
      pieces: [
        { id: 'p1', content: '    use sui::object::{Self, UID};' },
        { id: 'p2', content: '    use sui::tx_context::{Self, TxContext};' },
        { id: 'p3', content: '    use sui::transfer;' },
        { id: 'p4', content: '    use sui::url::{Self, Url};' },
        { id: 'p5', content: '    struct NFT has key, store {' },
        { id: 'p6', content: '        id: UID,' },
        { id: 'p7', content: '        name: String,' },
        { id: 'p8', content: '        description: String,' },
        { id: 'p9', content: '        url: Url,' },
        { id: 'p10', content: '    }' },
        { id: 'p11', content: '    public fun mint(' },
        { id: 'p12', content: '        name: String,' },
        { id: 'p13', content: '        description: String,' },
        { id: 'p14', content: '        url: Url,' },
        { id: 'p15', content: '        ctx: &mut TxContext' },
        { id: 'p16', content: '    ) {' },
        { id: 'p17', content: '        let nft = NFT {' },
        { id: 'p18', content: '            id: object::new(ctx),' },
        { id: 'p19', content: '            name,' },
        { id: 'p20', content: '            description,' },
        { id: 'p21', content: '            url,' },
        { id: 'p22', content: '        };' },
        { id: 'p23', content: '        transfer::public_transfer(nft, tx_context::sender(ctx));' },
        { id: 'p24', content: '    }' },
      ],
      solution: [
        'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 
        'p11', 'p12', 'p13', 'p14', 'p15', 'p16', 'p17', 'p18', 'p19', 
        'p20', 'p21', 'p22', 'p23', 'p24'
      ]
    },
    {
      id: 'puzzle-2',
      title: 'Coin Module',
      description: 'Arrange the code blocks to create a valid custom coin module',
      initialCode: 'module examples::my_coin {\n    // Complete the coin module\n}',
      pieces: [
        { id: 'p1', content: '    use sui::coin::{Self, Coin, TreasuryCap};' },
        { id: 'p2', content: '    use sui::transfer;' },
        { id: 'p3', content: '    use sui::tx_context::{Self, TxContext};' },
        { id: 'p4', content: '    struct MYCOIN has drop {}' },
        { id: 'p5', content: '    fun init(witness: MYCOIN, ctx: &mut TxContext) {' },
        { id: 'p6', content: '        let (treasury, metadata) = coin::create_currency(' },
        { id: 'p7', content: '            witness,' },
        { id: 'p8', content: '            9,' },
        { id: 'p9', content: '            b"MYCOIN",' },
        { id: 'p10', content: '            b"My Example Coin",' },
        { id: 'p11', content: '            b"An example coin created for learning",' },
        { id: 'p12', content: '            option::none(),' },
        { id: 'p13', content: '            ctx' },
        { id: 'p14', content: '        );' },
        { id: 'p15', content: '        transfer::public_transfer(treasury, tx_context::sender(ctx));' },
        { id: 'p16', content: '        transfer::public_transfer(metadata, tx_context::sender(ctx));' },
        { id: 'p17', content: '    }' },
      ],
      solution: [
        'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10',
        'p11', 'p12', 'p13', 'p14', 'p15', 'p16', 'p17'
      ]
    }
  ];

  useEffect(() => {
    // Initialize puzzle pieces in random order
    if (puzzles.length > 0) {
      const currentPuzzlePieces = [...puzzles[currentPuzzle].pieces];
      // Shuffle pieces
      for (let i = currentPuzzlePieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentPuzzlePieces[i], currentPuzzlePieces[j]] = [currentPuzzlePieces[j], currentPuzzlePieces[i]];
      }
      setPieces(currentPuzzlePieces);
      setSolutionArea([]);
    }
  }, [currentPuzzle]);

  useEffect(() => {
    // Timer countdown
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Time's up - submit current score
          onComplete(score, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [score, onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDragEnd = (result: any) => {
    const { source, destination } = result;

    // Dropped outside the list
    if (!destination) {
      return;
    }

    // Moving within the same list
    if (source.droppableId === destination.droppableId) {
      const list = source.droppableId === 'pieces' ? pieces : solutionArea;
      const reordered = Array.from(list);
      const [removed] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, removed);
      
      if (source.droppableId === 'pieces') {
        setPieces(reordered);
      } else {
        setSolutionArea(reordered);
      }
    } else {
      // Moving between lists
      const sourceList = source.droppableId === 'pieces' ? pieces : solutionArea;
      const destList = destination.droppableId === 'pieces' ? pieces : solutionArea;
      
      const sourceClone = Array.from(sourceList);
      const destClone = Array.from(destList);
      const [removed] = sourceClone.splice(source.index, 1);
      
      destClone.splice(destination.index, 0, removed);
      
      if (source.droppableId === 'pieces') {
        setPieces(sourceClone);
        setSolutionArea(destClone);
      } else {
        setPieces(destClone);
        setSolutionArea(sourceClone);
      }
    }
  };

  const handleCheckSolution = () => {
    const currentSolution = puzzles[currentPuzzle].solution;
    const userSolution = solutionArea.map(piece => piece.id);
    
    // Check if solution is correct
    const correct = currentSolution.length === userSolution.length &&
      currentSolution.every((id, index) => id === userSolution[index]);
    
    setIsCorrect(correct);
    
    // Calculate score based on difficulty, time left, and hints used
    if (correct) {
      let basePoints = difficulty === 'easy' ? 100 : difficulty === 'medium' ? 200 : 300;
      const timeBonus = Math.floor((timeLeft / timeLimit) * 100);
      const hintPenalty = hintsUsed * 20;
      
      const puzzleScore = Math.max(0, basePoints + timeBonus - hintPenalty);
      setScore(prev => prev + puzzleScore);
      
      // Move to next puzzle after delay
      setTimeout(() => {
        if (currentPuzzle < puzzles.length - 1) {
          setCurrentPuzzle(prev => prev + 1);
          setIsCorrect(null);
          setShowHint(false);
          setHintsUsed(prev => prev + (showHint ? 1 : 0));
        } else {
          // Game complete
          onComplete(score + puzzleScore, timeLeft);
        }
      }, 2000);
    }
  };
  
  const handleUseHint = () => {
    setShowHint(true);
    setHintsUsed(prev => prev + 1);
  };

  const currentPuzzleData = puzzles[currentPuzzle];

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="galaxy-card p-6 border border-primary/30">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-medium">Smart Contract Puzzle Challenge</h3>
            <p className="text-sm text-foreground/70">
              {currentPuzzleData.description}
            </p>
          </div>
          
          <div className={`flex items-center px-3 py-1 rounded-lg ${
            timeLeft < 60 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-primary/20'
          }`}>
            <Clock className="h-4 w-4 mr-1" />
            <span className="font-mono">{formatTime(timeLeft)}</span>
          </div>
        </header>

        <div className="mb-4 flex justify-between items-center">
          <div className="text-sm font-medium">
            Puzzle {currentPuzzle + 1} of {puzzles.length}: {currentPuzzleData.title}
          </div>
          <div className="text-sm">
            Score: <span className="font-bold">{score}</span>
          </div>
        </div>

        <div className="bg-muted/30 p-4 rounded-lg mb-4">
          <pre className="text-sm font-mono whitespace-pre mb-2">
            {currentPuzzleData.initialCode}
          </pre>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          {/* Solution Area */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium">Your Solution</h4>
              <div className={`text-xs px-2 py-1 rounded ${
                isCorrect === null ? 'bg-muted/50' : 
                isCorrect ? 'bg-green-500/20 text-green-500' : 
                'bg-red-500/20 text-red-500'
              }`}>
                {isCorrect === null ? 'Not submitted' : 
                 isCorrect ? 'Correct! Well done!' : 
                 'Incorrect. Try again!'}
              </div>
            </div>
            
            <Droppable droppableId="solution">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`min-h-[150px] p-3 rounded-lg border-2 border-dashed transition-colors ${
                    snapshot.isDraggingOver ? 'border-primary/50 bg-primary/10' : 'border-muted'
                  }`}
                >
                  <div className="space-y-2">
                    {solutionArea.map((piece, index) => (
                      <Draggable key={piece.id} draggableId={piece.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="p-2 bg-card rounded border border-primary/20 font-mono text-sm"
                          >
                            {piece.content}
                          </div>
                        )}
                      </Draggable>
                    ))}
                  </div>
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
          
          {/* Available Pieces */}
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-2">Available Code Blocks</h4>
            <Droppable droppableId="pieces">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`p-3 rounded-lg border border-muted transition-colors ${
                    snapshot.isDraggingOver ? 'bg-muted/30' : ''
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {pieces.map((piece, index) => (
                      <Draggable key={piece.id} draggableId={piece.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="p-2 bg-card rounded border border-muted font-mono text-sm break-words"
                          >
                            {piece.content}
                          </div>
                        )}
                      </Draggable>
                    ))}
                  </div>
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        </DragDropContext>

        {showHint && (
          <motion.div 
            className="bg-primary/10 p-3 rounded-lg mb-4 text-sm"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center mb-2">
              <AlertCircle className="h-4 w-4 mr-2 text-primary" />
              <h4 className="font-medium">Hint</h4>
            </div>
            <p>
              {currentPuzzle === 0 
                ? "The structure should follow: imports, struct definition, and then the mint function. Make sure to handle the NFT creation and transfer to the sender."
                : "Order your pieces to first add the imports, then define the MYCOIN struct, and then implement the init function that creates and distributes the currency."}
            </p>
          </motion.div>
        )}

        <div className="flex justify-between">
          <div>
            <Button variant="outline" onClick={onCancel} className="mr-2">
              Quit Puzzle
            </Button>
            <Button 
              variant="outline" 
              onClick={handleUseHint}
              disabled={showHint || isCorrect !== null}
              className="text-yellow-500 border-yellow-500/50"
            >
              Use Hint (-20 points)
            </Button>
          </div>
          
          <Button 
            className="neon-button"
            onClick={handleCheckSolution}
            disabled={solutionArea.length === 0 || isCorrect !== null}
          >
            Check Solution
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SmartContractPuzzle;
