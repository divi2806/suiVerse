import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { motion } from 'framer-motion';
import { 
  Rocket, 
  Trophy, 
  Star, 
  Award, 
  Medal,
  Brain,
  Code, 
  Zap,
  BookOpen,
  Flame,
  Sparkles,
  Package,
  ShoppingBag,
  GemIcon,
  Crown,
  CalendarCheck,
  Calendar,
  CheckCircle,
  Moon,
  Globe,
  Orbit,
  Lightbulb,
  Bug
} from 'lucide-react';
import { 
  Achievement, 
  getUserAchievements,
  AchievementCategory 
} from '@/services/achievementsService';
import AchievementNotification from './AchievementNotification';
import './achievements.css';

interface UserAchievementsProps {
  walletAddress: string;
}

const UserAchievements: React.FC<UserAchievementsProps> = ({ walletAddress }) => {
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([]);
  const [lockedAchievements, setLockedAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  
  useEffect(() => {
    const fetchAchievements = async () => {
      if (!walletAddress) return;
      
      try {
        setLoading(true);
        
        const { unlocked, locked } = await getUserAchievements(walletAddress);
        
        setUnlockedAchievements(unlocked);
        setLockedAchievements(locked);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching achievements:', err);
        setError('Failed to load achievements');
        setLoading(false);
      }
    };
    
    fetchAchievements();
  }, [walletAddress]);
  
  // Get icon component by name
  const getIconComponent = (iconName: string, iconColor: string = 'text-primary') => {
    const props = { className: `h-5 w-5 ${iconColor}` };
    
    switch (iconName) {
      case 'Rocket': return <Rocket {...props} />;
      case 'Trophy': return <Trophy {...props} />;
      case 'Star': return <Star {...props} />;
      case 'Award': return <Award {...props} />;
      case 'Medal': return <Medal {...props} />;
      case 'Brain': return <Brain {...props} />;
      case 'Code': return <Code {...props} />;
      case 'Zap': return <Zap {...props} />;
      case 'BookOpen': return <BookOpen {...props} />;
      case 'Flame': return <Flame {...props} />;
      case 'Sparkles': return <Sparkles {...props} />;
      case 'Package': return <Package {...props} />;
      case 'ShoppingBag': return <ShoppingBag {...props} />;
      case 'GemIcon': return <GemIcon {...props} />;
      case 'Crown': return <Crown {...props} />;
      case 'CalendarCheck': return <CalendarCheck {...props} />;
      case 'Calendar': return <Calendar {...props} />;
      case 'CheckCircle': return <CheckCircle {...props} />;
      case 'Alien': return <Bug {...props} />;
      case 'Moon': return <Moon {...props} />;
      case 'Globe': return <Globe {...props} />;
      case 'Orbit': return <Orbit {...props} />;
      case 'Lightbulb': return <Lightbulb {...props} />;
      default: return <Award {...props} />;
    }
  };
  
  const renderAchievementCard = (achievement: Achievement, index: number, unlocked: boolean) => {
    // Helper function to safely format dates if achievement has unlockedAt
    const formatDate = (date: Date | undefined): string => {
      return date instanceof Date ? date.toLocaleDateString() : 'Unknown';
    };

    // Handle the unlockedAt property safely
    const unlockedAt = unlocked && 'unlockedAt' in achievement ? 
      (achievement.unlockedAt instanceof Date ? achievement.unlockedAt : undefined) : 
      undefined;
    
    return (
      <motion.div
        key={achievement.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className={`achievement-card p-4 rounded-lg border ${
          unlocked 
            ? 'border-primary/50 bg-primary/10' 
            : 'border-foreground/10 bg-background/50 opacity-60'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            unlocked ? 'bg-primary/20' : 'bg-foreground/10'
          }`}>
            {getIconComponent(achievement.icon, unlocked ? achievement.iconColor : 'text-foreground/50')}
          </div>
          
          <div>
            <h3 className="font-semibold mb-1 flex items-center">
              {achievement.title}
              {unlocked && (
                <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  Unlocked
                </span>
              )}
            </h3>
            <p className="text-sm text-foreground/80 mb-1">{achievement.description}</p>
            <div className="flex items-center gap-2 text-xs text-foreground/60">
              <span className="text-yellow-500">+{achievement.xpReward} XP</span>
              {achievement.suiReward > 0 && (
                <span className="text-blue-500">+{achievement.suiReward} SUI</span>
              )}
              {unlockedAt && (
                <span>• {formatDate(unlockedAt)}</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };
  
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="loading-spinner mx-auto"></div>
        <p className="mt-2 text-foreground/70">Loading achievements...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>{error}</p>
      </div>
    );
  }
  
  const unlockedCount = unlockedAchievements.length;
  const totalAchievements = unlockedAchievements.length + lockedAchievements.length;
  const progressPercent = Math.floor((unlockedCount / totalAchievements) * 100);
  
  // Group achievements by category
  const groupedAchievements: Record<AchievementCategory, { unlocked: Achievement[], locked: Achievement[] }> = {
    learning: { unlocked: [], locked: [] },
    module_completion: { unlocked: [], locked: [] },
    galaxy_completion: { unlocked: [], locked: [] },
    mystery_box: { unlocked: [], locked: [] },
    streak: { unlocked: [], locked: [] },
    mastery: { unlocked: [], locked: [] },
    social: { unlocked: [], locked: [] }
  };
  
  // Populate groups
  unlockedAchievements.forEach(achievement => {
    groupedAchievements[achievement.category].unlocked.push(achievement);
  });
  
  lockedAchievements.forEach(achievement => {
    groupedAchievements[achievement.category].locked.push(achievement);
  });
  
  // Get nice category names
  const getCategoryName = (category: AchievementCategory): string => {
    switch (category) {
      case 'learning': return 'Learning';
      case 'module_completion': return 'Module Completion';
      case 'galaxy_completion': return 'Galaxy Exploration';
      case 'mystery_box': return 'Mystery Boxes';
      case 'streak': return 'Daily Streaks';
      case 'mastery': return 'Mastery';
      case 'social': return 'Social';
    }
  };
  
  return (
    <div className="user-achievements-container">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">Your Achievements</h2>
        <div className="flex items-center gap-4">
          <div className="progress-container flex-1 h-2 bg-foreground/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <div className="text-sm font-medium">
            {unlockedCount}/{totalAchievements}
          </div>
        </div>
      </div>
      
      {/* Show achievements by category */}
      {Object.entries(groupedAchievements).map(([category, achievements]) => {
        const hasAchievements = achievements.unlocked.length > 0 || achievements.locked.length > 0;
        if (!hasAchievements) return null;
        
        return (
          <div key={category} className="mb-8">
            <h3 className="text-lg font-semibold mb-3">{getCategoryName(category as AchievementCategory)}</h3>
            
            {/* Unlocked achievements */}
            {achievements.unlocked.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-primary mb-2">Unlocked</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {achievements.unlocked.map((achievement, index) => 
                    renderAchievementCard(achievement, index, true)
                  )}
                </div>
              </div>
            )}
            
            {/* Locked achievements */}
            {achievements.locked.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-foreground/70 mb-2">Locked</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {achievements.locked.map((achievement, index) => 
                    renderAchievementCard(achievement, index, false)
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      
      {/* Achievement notification popup */}
      {newAchievement && (
        <AchievementNotification 
          achievement={newAchievement} 
          onClose={() => setNewAchievement(null)} 
        />
      )}
    </div>
  );
};

export default UserAchievements; 