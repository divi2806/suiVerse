import React from 'react';
import { motion } from 'framer-motion';
import { Gamepad, Code, Bug, Rocket, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Game {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  difficulty: 'easy' | 'medium' | 'hard';
  rewards: {
    xp: number;
    coins: number;
  };
  timeEstimate: string;
  action?: 'play' | 'locked' | 'coming-soon';
}

interface MiniGamesProps {
  onSelectGame: (gameId: string) => void;
}

const MiniGames: React.FC<MiniGamesProps> = ({ onSelectGame }) => {
  const games: Game[] = [
    {
      id: 'code-completion',
      title: 'Code Completion Challenge',
      description: 'Complete Move code snippets to test your knowledge of Sui',
      icon: Code,
      difficulty: 'medium',
      rewards: {
        xp: 250,
        coins: 0.05
      },
      timeEstimate: '5-10 min',
      action: 'play'
    },
    {
      id: 'bug-hunter',
      title: 'Bug Hunter',
      description: 'Find bugs in the Move code to improve your debugging skills',
      icon: Bug,
      difficulty: 'hard',
      rewards: {
        xp: 350,
        coins: 0.08
      },
      timeEstimate: '10-15 min',
      action: 'play'
    },
    {
      id: 'smart-contract-puzzle',
      title: 'Smart Contract Puzzle',
      description: 'Arrange code blocks to create valid Sui smart contracts',
      icon: Rocket,
      difficulty: 'medium',
      rewards: {
        xp: 300,
        coins: 0.05
      },
      timeEstimate: '10-15 min',
      action: 'play'
    },
    {
      id: 'race-your-knowledge',
      title: 'Race Your Knowledge',
      description: 'Answer quiz questions about Sui blockchain in the shortest time',
      icon: Timer,
      difficulty: 'easy',
      rewards: {
        xp: 200,
        coins: 0.07
      },
      timeEstimate: '5-10 min',
      action: 'play'
    }
  ];

  const getDifficultyColors = (difficulty: string) => {
    switch(difficulty) {
      case 'easy':
        return 'bg-green-500/20 text-green-500';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-500';
      case 'hard':
        return 'bg-red-500/20 text-red-500';
      default:
        return 'bg-primary/20 text-primary';
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-heading font-bold">
        <Gamepad className="inline-block mr-2 h-5 w-5" />
        Mini-Games
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {games.map((game) => (
          <motion.div
            key={game.id}
            className="galaxy-card border border-primary/20 overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            whileHover={{ scale: 1.02 }}
          >
            <div className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <game.icon className="h-6 w-6 text-primary" />
                </div>
                
                <div className={`text-xs px-2 py-1 rounded ${getDifficultyColors(game.difficulty)}`}>
                  {game.difficulty.toUpperCase()}
                </div>
              </div>
              
              <h3 className="text-lg font-medium mb-2">{game.title}</h3>
              <p className="text-sm text-foreground/70 mb-4 line-clamp-2">{game.description}</p>
              
              <div className="flex justify-between items-center text-xs text-foreground/70 mb-4">
                <div>
                  🏆 {game.rewards.xp} XP / {game.id === 'code-completion' ? '0.05' :
                                      game.id === 'bug-hunter' ? '0.08' :
                                      game.id === 'smart-contract-puzzle' ? '0.05' : '0.07'} SUI
                </div>
                <div>
                  ⏱️ {game.timeEstimate}
                </div>
              </div>
              
              <Button 
                className={`w-full ${
                  game.action === 'play' ? 'neon-button' : 
                  game.action === 'locked' ? 'bg-muted/50 text-muted-foreground' :
                  'bg-secondary/20 text-secondary hover:bg-secondary/30'
                }`}
                disabled={game.action === 'locked'}
                onClick={() => game.action === 'play' && onSelectGame(game.id)}
              >
                {game.action === 'play' ? 'Play Now' : 
                 game.action === 'locked' ? 'Unlock at Level 10' : 
                 'Coming Soon'}
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default MiniGames;
