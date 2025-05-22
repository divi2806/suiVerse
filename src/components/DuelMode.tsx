import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Gamepad, Trophy, Star, Wallet, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DuelGame {
  id: string;
  title: string;
  description: string;
  type: 'quiz' | 'code' | 'puzzle';
  difficulty: 'easy' | 'medium' | 'hard';
  rewards: {
    xp: number;
    suiTokens: number;
  };
  minStake: number;
  maxStake: number;
  duration: string;
  image?: string;
}

interface DuelRequest {
  id: string;
  from: {
    id: string;
    username: string;
    avatarSrc: string;
    level: number;
  };
  game: DuelGame;
  stake: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  sentAt: string;
}

interface DuelModeProps {
  userSuiTokens: number;
  onCreateDuel: (gameId: string, stake: number, opponentId?: string) => void;
  onAcceptDuel: (requestId: string) => void;
  onRejectDuel: (requestId: string) => void;
}

const DuelMode: React.FC<DuelModeProps> = ({ 
  userSuiTokens,
  onCreateDuel,
  onAcceptDuel,
  onRejectDuel
}) => {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState<number>(0.25);

  const duelGames: DuelGame[] = [
    {
      id: 'move-quiz',
      title: 'Move Language Quiz',
      description: 'Test your knowledge of Sui Move language concepts against an opponent',
      type: 'quiz',
      difficulty: 'medium',
      rewards: {
        xp: 300,
        suiTokens: 0.5,
      },
      minStake: 0.25,
      maxStake: 2.5,
      duration: '10 min',
      image: 'https://images.unsplash.com/photo-1470813740244-df37b8c1edcb'
    },
    {
      id: 'code-race',
      title: 'Code Race Challenge',
      description: 'Race to complete Move code snippets faster than your opponent',
      type: 'code',
      difficulty: 'hard',
      rewards: {
        xp: 500,
        suiTokens: 1,
      },
      minStake: 0.5,
      maxStake: 5,
      duration: '15 min',
      image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5'
    },
    {
      id: 'smart-puzzle',
      title: 'Smart Contract Puzzle',
      description: 'Solve smart contract puzzles before your opponent',
      type: 'puzzle',
      difficulty: 'medium',
      rewards: {
        xp: 250,
        suiTokens: 0.5,
      },
      minStake: 0.25,
      maxStake: 2.5,
      duration: '12 min',
      image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e'
    }
  ];

  const duelRequests: DuelRequest[] = [
    {
      id: 'req-1',
      from: {
        id: 'user-2',
        username: 'CryptoExplorer',
        avatarSrc: 'https://api.dicebear.com/7.x/bottts/svg?seed=explorer',
        level: 8
      },
      game: duelGames[0],
      stake: 1,
      status: 'pending',
      sentAt: '10 minutes ago'
    },
    {
      id: 'req-2',
      from: {
        id: 'user-3',
        username: 'BlockchainWhiz',
        avatarSrc: 'https://api.dicebear.com/7.x/bottts/svg?seed=whiz',
        level: 12
      },
      game: duelGames[1],
      stake: 2.5,
      status: 'pending',
      sentAt: '2 hours ago'
    }
  ];

  const onlineFriends = [
    {
      id: 'friend-1',
      username: 'SpaceDev',
      avatarSrc: 'https://api.dicebear.com/7.x/bottts/svg?seed=space',
      level: 5,
      status: 'online'
    },
    {
      id: 'friend-2',
      username: 'CryptoQueen',
      avatarSrc: 'https://api.dicebear.com/7.x/bottts/svg?seed=queen',
      level: 9,
      status: 'online'
    },
    {
      id: 'friend-3',
      username: 'SuiMaster',
      avatarSrc: 'https://api.dicebear.com/7.x/bottts/svg?seed=master',
      level: 15,
      status: 'in-game'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-heading font-bold flex items-center">
          <Gamepad className="mr-2 h-5 w-5 text-primary" />
          Duel Arena
        </h2>
        <div className="flex items-center bg-primary/10 px-3 py-2 rounded-lg">
          <Wallet className="h-5 w-5 text-yellow-500 mr-2" />
          <span className="font-medium">{userSuiTokens} SUI</span>
        </div>
      </div>

      <Tabs defaultValue="create-duel" className="w-full">
        <TabsList className="w-full grid grid-cols-3 mb-6">
          <TabsTrigger value="create-duel">Create Duel</TabsTrigger>
          <TabsTrigger value="requests">Requests ({duelRequests.length})</TabsTrigger>
          <TabsTrigger value="friends">Friends ({onlineFriends.filter(f => f.status === 'online').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="create-duel" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {duelGames.map((game) => (
              <motion.div
                key={game.id}
                className={`galaxy-card border overflow-hidden cursor-pointer ${
                  selectedGame === game.id ? 'border-primary animate-pulse' : 'border-primary/20'
                }`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedGame(game.id)}
              >
                <div 
                  className="h-32 bg-cover bg-center relative"
                  style={{ backgroundImage: `url(${game.image})` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
                  <div className={`absolute top-3 left-3 px-2 py-1 rounded text-xs font-medium ${
                    game.difficulty === 'easy' ? 'bg-green-500/50 text-green-100' :
                    game.difficulty === 'medium' ? 'bg-yellow-500/50 text-yellow-100' :
                    'bg-red-500/50 text-red-100'
                  }`}>
                    {game.difficulty.toUpperCase()}
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-medium text-base mb-1">{game.title}</h3>
                  <p className="text-xs text-foreground/70 mb-3 line-clamp-2">{game.description}</p>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <div className="bg-secondary/10 px-2 py-1 rounded-full text-xs flex items-center">
                      <Trophy className="h-3 w-3 mr-1 text-secondary" />
                      {game.rewards.xp} XP
                    </div>
                    <div className="bg-accent/10 px-2 py-1 rounded-full text-xs flex items-center">
                      <Wallet className="h-3 w-3 mr-1 text-accent" />
                      {game.rewards.suiTokens} SUI
                    </div>
                    <div className="bg-primary/10 px-2 py-1 rounded-full text-xs flex items-center">
                      {game.duration}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-foreground/70">
                    <span>Min stake: {game.minStake}</span>
                    <span>Max stake: {game.maxStake}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {selectedGame && (
            <motion.div
              className="galaxy-card p-6 border border-primary/30"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-lg font-medium mb-4">Set Your Stake</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Stake Amount: {stakeAmount} SUI</span>
                    <span className="text-sm text-foreground/70">Balance: {userSuiTokens} SUI</span>
                  </div>
                  <input 
                    type="range" 
                    min={selectedGame ? duelGames.find(g => g.id === selectedGame)?.minStake || 0.25 : 0.25} 
                    max={Math.min(
                      selectedGame ? duelGames.find(g => g.id === selectedGame)?.maxStake || 2.5 : 2.5,
                      userSuiTokens
                    )} 
                    step={0.05}
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(parseFloat(e.target.value))}
                    className="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="bg-primary/10 p-3 rounded-lg">
                  <div className="text-sm mb-2">Duel Summary:</div>
                  <ul className="text-xs space-y-1 text-foreground/70">
                    <li>• You'll stake {stakeAmount} SUI</li>
                    <li>• Winner takes 95% of the total stake</li>
                    <li>• 5% platform fee applies</li>
                    <li>• Additional rewards: {duelGames.find(g => g.id === selectedGame)?.rewards.xp} XP and {duelGames.find(g => g.id === selectedGame)?.rewards.suiTokens} SUI</li>
                  </ul>
                </div>

                <div className="flex justify-center pt-2">
                  <Button 
                    className="neon-button"
                    onClick={() => onCreateDuel(selectedGame, stakeAmount)}
                    disabled={stakeAmount > userSuiTokens}
                  >
                    Find Opponent
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          {duelRequests.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-foreground/70">No duel requests at the moment</p>
            </div>
          ) : (
            duelRequests.map((request) => (
              <motion.div
                key={request.id}
                className="galaxy-card p-4 border border-primary/20"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <Avatar className="h-10 w-10 mr-3">
                      <AvatarImage src={request.from.avatarSrc} />
                      <AvatarFallback>{request.from.username.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{request.from.username}</div>
                      <div className="text-xs text-foreground/70">Level {request.from.level} • {request.sentAt}</div>
                    </div>
                  </div>
                  <div className="flex items-center bg-primary/10 px-2 py-1 rounded">
                    <Wallet className="h-4 w-4 text-yellow-500 mr-1" />
                    <span className="text-sm font-medium">{request.stake} SUI</span>
                  </div>
                </div>

                <div className="bg-muted/30 p-3 rounded-lg mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-medium text-sm">{request.game.title}</div>
                    <div className={`text-xs px-2 py-1 rounded ${
                      request.game.difficulty === 'easy' ? 'bg-green-500/20 text-green-500' :
                      request.game.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-red-500/20 text-red-500'
                    }`}>
                      {request.game.difficulty}
                    </div>
                  </div>
                  <p className="text-xs text-foreground/80 mb-2">{request.game.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <div className="bg-secondary/10 px-2 py-1 rounded-full text-xs flex items-center">
                      <Trophy className="h-3 w-3 mr-1 text-secondary" />
                      {request.game.rewards.xp} XP
                    </div>
                    <div className="bg-accent/10 px-2 py-1 rounded-full text-xs flex items-center">
                      <Wallet className="h-3 w-3 mr-1 text-accent" />
                      {request.game.rewards.suiTokens} SUI
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button 
                    className="flex-1 neon-button"
                    size="sm"
                    onClick={() => onAcceptDuel(request.id)}
                    disabled={request.stake > userSuiTokens}
                  >
                    Accept Challenge
                  </Button>
                  <Button 
                    className="flex-1" 
                    size="sm"
                    variant="outline"
                    onClick={() => onRejectDuel(request.id)}
                  >
                    Decline
                  </Button>
                </div>
                
                {request.stake > userSuiTokens && (
                  <p className="text-xs text-destructive mt-2 text-center">
                    You need {request.stake - userSuiTokens} more SUI to accept this duel
                  </p>
                )}
              </motion.div>
            ))
          )}
        </TabsContent>

        <TabsContent value="friends" className="space-y-4">
          <div className="galaxy-card p-4 border border-primary/20">
            <div className="flex items-center mb-4">
              <Users className="h-5 w-5 text-primary mr-2" />
              <h3 className="font-medium">Friends Online</h3>
            </div>

            <div className="space-y-3">
              {onlineFriends.map((friend) => (
                <div key={friend.id} className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="relative">
                      <Avatar className="h-8 w-8 mr-2">
                        <AvatarImage src={friend.avatarSrc} />
                        <AvatarFallback>{friend.username.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card ${
                        friend.status === 'online' ? 'bg-green-500' : 
                        friend.status === 'in-game' ? 'bg-yellow-500' : 'bg-gray-500'
                      }`}></div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">{friend.username}</div>
                      <div className="text-xs text-foreground/70">Level {friend.level}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 text-xs"
                      disabled={friend.status === 'in-game'}
                    >
                      Challenge
                    </Button>
                  </div>
                </div>
              ))}

              <Button className="w-full mt-2" variant="outline" size="sm">
                Find More Friends
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DuelMode;
