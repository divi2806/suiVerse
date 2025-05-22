
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Clock, Bug, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface BugHunterProps {
  onComplete: (score: number, bugsFound: number) => void;
  onCancel: () => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  timeLimit?: number; // in seconds
}

const BugHunter: React.FC<BugHunterProps> = ({ 
  onComplete, 
  onCancel, 
  difficulty = 'medium',
  timeLimit = 240 
}) => {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [currentSnippet, setCurrentSnippet] = useState(0);
  const [selectedBugs, setSelectedBugs] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [bugsFound, setBugsFound] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [message, setMessage] = useState('');

  // Sample bug hunting challenges
  const codeSnippets = [
    {
      id: '1',
      name: 'Token Transfer Function',
      code: `module sui_token::basic_token {
    use sui::transfer;
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};

    struct Token has key, store {
        id: UID,
        value: u64
    }

    public fun mint(ctx: &mut TxContext): Token {
        Token {
            id: object::new(ctx),
            value: 100
        }
    }

    public fun transfer_token(token: Token, recipient: address) {
        transfer::transfer(token, recipient);
        // BUG: Use after move error - token is already moved
        let value = token.value;
    }
}`,
      bugLines: [12, 13],
      bugExplanations: [
        "The token object is moved in the transfer function but then accessed again",
        "After transfer::transfer(token, recipient), the token is no longer accessible"
      ]
    },
    {
      id: '2',
      name: 'Coin Implementation',
      code: `module example::my_coin {
    use sui::coin::{Self, Coin};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    
    struct MY_COIN has drop {}
    
    fun init(witness: MY_COIN, ctx: &mut TxContext) {
        let cap = coin::create_currency(witness, 8, ctx);
        transfer::public_transfer(cap, tx_context::sender(ctx));
    }
    
    public fun mint(amount: u64, ctx: &mut TxContext): Coin<MY_COIN> {
        // BUG: Missing treasury cap parameter
        coin::mint(amount, ctx)
    }
}`,
      bugLines: [14, 15],
      bugExplanations: [
        "The mint function is missing the treasury cap parameter",
        "Should be: coin::mint(treasury_cap, amount, ctx)"
      ]
    },
    {
      id: '3',
      name: 'Object Ownership Check',
      code: `module example::ownership {
    use sui::object::{Self, ID, UID};
    use sui::tx_context::{Self, TxContext};
    
    struct Item has key {
        id: UID,
        owner: address
    }
    
    public fun create(ctx: &mut TxContext): Item {
        Item {
            id: object::new(ctx),
            owner: tx_context::sender(ctx)
        }
    }
    
    public fun is_owner(item: &Item, addr: address): bool {
        // BUG: Wrong ownership check
        item.owner == addr
        // Should use object::owner(item) == addr
    }
}`,
      bugLines: [17, 18],
      bugExplanations: [
        "The ownership check is incorrect - looking at a field instead of actual ownership",
        "In Sui, ownership is tracked by the system, not in object fields"
      ]
    }
  ];

  useEffect(() => {
    // Timer countdown
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Time's up - submit current score
          onComplete(score, bugsFound);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [score, bugsFound, onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLineClick = (lineIndex: number) => {
    if (showResult) return;

    if (selectedBugs.includes(lineIndex)) {
      setSelectedBugs(prev => prev.filter(idx => idx !== lineIndex));
    } else {
      setSelectedBugs(prev => [...prev, lineIndex]);
    }
  };

  const checkAnswers = () => {
    const currentBugLines = codeSnippets[currentSnippet].bugLines;
    const correctSelections = selectedBugs.filter(line => currentBugLines.includes(line));
    const incorrectSelections = selectedBugs.filter(line => !currentBugLines.includes(line));
    
    // Calculate score
    const newPoints = 
      (correctSelections.length * 50) - 
      (incorrectSelections.length * 20) + 
      (correctSelections.length === currentBugLines.length && incorrectSelections.length === 0 ? 100 : 0);
    
    const updatedScore = score + Math.max(0, newPoints);
    setScore(updatedScore);
    setBugsFound(prev => prev + correctSelections.length);
    
    if (correctSelections.length === currentBugLines.length && incorrectSelections.length === 0) {
      setMessage("Perfect! You found all the bugs!");
    } else if (correctSelections.length > 0 && correctSelections.length < currentBugLines.length && incorrectSelections.length === 0) {
      setMessage(`Good job! You found ${correctSelections.length} out of ${currentBugLines.length} bugs.`);
    } else if (incorrectSelections.length > 0) {
      setMessage(`You selected ${incorrectSelections.length} incorrect lines. Keep practicing!`);
    } else {
      setMessage("You didn't find any bugs. Let's try again!");
    }
    
    setShowResult(true);

    // Move to next snippet after showing result
    setTimeout(() => {
      if (currentSnippet < codeSnippets.length - 1) {
        setCurrentSnippet(prev => prev + 1);
        setSelectedBugs([]);
        setShowResult(false);
        setMessage('');
      } else {
        // Game complete
        onComplete(updatedScore, bugsFound + correctSelections.length);
      }
    }, 4000);
  };

  const currentSnippetData = codeSnippets[currentSnippet];
  const codeLines = currentSnippetData.code.split('\n');

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="galaxy-card p-6 border border-primary/30">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-medium">Bug Hunter Challenge</h3>
            <p className="text-sm text-foreground/70">
              Find and mark all the bugs in the Move code
            </p>
          </div>
          
          <div className={`flex items-center px-3 py-1 rounded-lg ${
            timeLeft < 30 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-primary/20'
          }`}>
            <Clock className="h-4 w-4 mr-1" />
            <span className="font-mono">{formatTime(timeLeft)}</span>
          </div>
        </header>

        <div className="mb-4 flex justify-between items-center">
          <div className="flex items-center">
            <Bug className="h-4 w-4 mr-1 text-primary" />
            <span className="text-sm font-medium">
              {currentSnippetData.name} ({currentSnippet + 1} of {codeSnippets.length})
            </span>
          </div>
          <div className="text-sm">
            Score: <span className="font-bold">{score}</span> | 
            Bugs Found: <span className="font-bold">{bugsFound}</span>
          </div>
        </div>

        <div className="bg-muted/30 rounded-lg mb-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <tbody className="font-mono text-sm">
                {codeLines.map((line, index) => (
                  <motion.tr 
                    key={index}
                    className={`
                      cursor-pointer border-l-2 hover:bg-muted/40
                      ${selectedBugs.includes(index) ? 'border-l-primary bg-primary/10' : 'border-l-transparent'}
                      ${showResult && currentSnippetData.bugLines.includes(index) ? 'bg-red-500/15' : ''}
                    `}
                    onClick={() => handleLineClick(index)}
                    whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                  >
                    <td className="py-0.5 px-2 text-right text-foreground/50 select-none w-10 border-r border-r-muted/20">
                      {index + 1}
                    </td>
                    <td className="py-0.5 px-4 whitespace-pre">
                      {line}
                      {showResult && currentSnippetData.bugLines.includes(index) && (
                        <span className="inline-flex items-center ml-2 text-red-400">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          Bug
                        </span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showResult && (
          <motion.div
            className={`p-3 rounded-lg mb-6 ${
              message.includes("Perfect") ? 'bg-green-500/10 text-green-500' : 
              message.includes("Good job") ? 'bg-yellow-500/10 text-yellow-500' :
              'bg-red-500/10 text-red-500'
            }`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="font-medium mb-1">{message}</p>
            <div className="space-y-2 mt-2 text-foreground/80 text-sm">
              <p>Bug explanations:</p>
              <ul className="list-disc pl-5">
                {currentSnippetData.bugExplanations.map((explanation, i) => (
                  <li key={i}>{explanation}</li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={onCancel}>
            Quit Game
          </Button>
          
          <div className="space-x-2">
            <Button 
              className="neon-button"
              disabled={selectedBugs.length === 0 || showResult}
              onClick={checkAnswers}
            >
              Submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BugHunter;
