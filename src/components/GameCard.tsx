import React from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Trophy, Star, Coins } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from '@/components/ui/badge';

interface GameCardProps {
  id: string;
  title: string;
  description: string;
  image: string;
  progress: number;
  difficulty: 'easy' | 'medium' | 'hard';
  rewards: {
    xp: number;
    coins?: number;
    booster?: boolean;
  };
  completed?: boolean;
  highScore?: number;
  onPlay?: () => void;
}

const GameCard: React.FC<GameCardProps> = ({
  id,
  title,
  description,
  image,
  progress,
  difficulty,
  rewards,
  completed = false,
  highScore,
  onPlay,
}) => {
  const difficultyColor = 
    difficulty === 'easy' ? 'text-green-500' :
    difficulty === 'medium' ? 'text-yellow-500' :
    'text-red-500';

  return (
    <Card className="galaxy-card overflow-hidden">
      <div className="relative">
        <div 
          className="w-full h-40 bg-cover bg-center"
          style={{ backgroundImage: `url(${image})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
        {completed && (
          <div className="absolute top-3 right-3 bg-primary/90 p-1.5 rounded-full">
            <CircleCheck className="h-5 w-5" />
          </div>
        )}
      </div>

      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-heading">{title}</CardTitle>
          <div className={`text-xs font-semibold ${difficultyColor}`}>
            {difficulty.toUpperCase()}
          </div>
        </div>
        <CardDescription className="line-clamp-2 text-sm">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="flex justify-between items-center mb-2">
          <div className="text-xs text-muted-foreground">Progress</div>
          <div className="text-xs font-medium">{progress}%</div>
        </div>
        <Progress value={progress} className="h-1.5" />
        
        <div className="flex flex-wrap gap-2 mt-3">
          {rewards.xp > 0 && (
            <Badge variant="outline" className="bg-amber-950/30 border-amber-500/30 text-amber-400 flex items-center gap-1">
              <Star className="h-3 w-3" />
              <span className="text-xs font-medium">{rewards.xp} XP</span>
            </Badge>
          )}
          
          {rewards.coins && rewards.coins > 0 && (
            <Badge variant="outline" className="bg-blue-950/30 border-blue-500/30 text-blue-400 flex items-center gap-1">
              <Coins className="h-3 w-3" />
              <span className="text-xs font-medium">{rewards.coins} SUI</span>
            </Badge>
          )}
          
          {rewards.booster && (
            <Badge variant="outline" className="bg-purple-950/30 border-purple-500/30 text-purple-400">
              <span className="text-xs font-medium">Booster</span>
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter>
        {onPlay ? (
          <Button 
            className="w-full neon-button"
            onClick={onPlay}
          >
            {completed ? "Play Again" : "Start Game"}
          </Button>
        ) : (
          <Link to={`/games/${id}`} className="w-full">
            <Button className="w-full neon-button">
              {completed ? "Play Again" : "Start Game"}
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
};

export default GameCard;
