
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Trophy } from "lucide-react";

interface PlayerData {
  rank: number;
  username: string;
  avatarUrl?: string;
  level: number;
  experience: number;
  streak: number;
  completedGames: number;
  isCurrentUser: boolean;
}

interface LeaderboardTableProps {
  players: PlayerData[];
}

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ players }) => {
  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center justify-center bg-yellow-500/20 text-yellow-400 w-8 h-8 rounded-full">
          <Trophy className="h-4 w-4" />
        </span>
      );
    } else if (rank === 2) {
      return (
        <span className="inline-flex items-center justify-center bg-gray-300/20 text-gray-300 w-8 h-8 rounded-full">
          <Trophy className="h-4 w-4" />
        </span>
      );
    } else if (rank === 3) {
      return (
        <span className="inline-flex items-center justify-center bg-amber-600/20 text-amber-500 w-8 h-8 rounded-full">
          <Trophy className="h-4 w-4" />
        </span>
      );
    }
    return <span className="inline-block text-center w-8 h-8 font-mono">{rank}</span>;
  };

  return (
    <div className="galaxy-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-muted/5">
            <TableHead className="w-16 text-center">Rank</TableHead>
            <TableHead>Explorer</TableHead>
            <TableHead className="text-center">Level</TableHead>
            <TableHead className="text-center">XP</TableHead>
            <TableHead className="text-center hidden md:table-cell">Days</TableHead>
            <TableHead className="text-center hidden md:table-cell">Games</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow 
              key={player.username} 
              className={`${
                player.isCurrentUser 
                  ? "bg-primary/10 border-l-2 border-primary" 
                  : "hover:bg-muted/10"
              }`}
            >
              <TableCell className="text-center font-medium">
                {getRankBadge(player.rank)}
              </TableCell>
              <TableCell>
                <div className="flex items-center">
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarImage src={player.avatarUrl} />
                    <AvatarFallback className="bg-muted">
                      {player.username.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className={player.isCurrentUser ? "font-medium" : ""}>
                    {player.username}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="inline-flex items-center justify-center bg-muted/30 px-2 py-1 rounded">
                  {player.level}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-accent" />
                  {player.experience.toLocaleString()}
                </div>
              </TableCell>
              <TableCell className="text-center hidden md:table-cell">
                {player.streak}
              </TableCell>
              <TableCell className="text-center hidden md:table-cell">
                {player.completedGames}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default LeaderboardTable;
