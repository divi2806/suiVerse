import React, { useState, useEffect } from 'react';
import { Circle, Star, Rocket } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import './learning-path-map.css';

interface Module {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  locked: boolean;
  position: { x: number; y: number };
  type: 'planet' | 'moon' | 'asteroid' | 'station' | 'earth';
  color: string;
}

interface Galaxy {
  id: number;
  name: string;
  modules: Module[];
  unlocked: boolean;
  completed: boolean;
  current: boolean;
  position: { x: number; y: number };
}

interface LearningPathMapProps {
  galaxies: Galaxy[];
  currentGalaxy: number;
  currentModuleId: string;
  rocketPosition: { x: number; y: number };
}

const LearningPathMap: React.FC<LearningPathMapProps> = ({ 
  galaxies, 
  currentGalaxy, 
  currentModuleId,
  rocketPosition
}) => {
  const [rocketPos, setRocketPos] = useState(rocketPosition);
  const [rocketTarget, setRocketTarget] = useState<null | { x: number; y: number }>(null);
  const [rocketMoving, setRocketMoving] = useState(false);
  
  // Helper function to get appropriate color classes based on the color string and completion state
  const getModuleColorClass = (color: string, completed: boolean): string => {
    // Background color classes
    const colorMap: Record<string, string> = {
      'blue': completed ? 'bg-blue-500/50' : 'bg-blue-500/20',
      'purple': completed ? 'bg-purple-500/50' : 'bg-purple-500/20',
      'green': completed ? 'bg-green-500/50' : 'bg-green-500/20',
      'orange': completed ? 'bg-orange-500/50' : 'bg-orange-500/20',
      'red': completed ? 'bg-red-500/50' : 'bg-red-500/20',
      'yellow': completed ? 'bg-yellow-500/50' : 'bg-yellow-500/20',
      'earth': 'bg-blue-500/70'
    };
    
    return colorMap[color] || (completed ? 'bg-slate-500/50' : 'bg-slate-500/20');
  };
  
  // Helper function to get appropriate text color classes
  const getModuleTextColorClass = (color: string): string => {
    const textColorMap: Record<string, string> = {
      'blue': 'text-blue-500',
      'purple': 'text-purple-500',
      'green': 'text-green-500',
      'orange': 'text-orange-500',
      'red': 'text-red-500',
      'yellow': 'text-yellow-500',
      'earth': 'text-blue-500'
    };
    
    return textColorMap[color] || 'text-slate-500';
  };
  
  // Update rocket position when target module changes
  useEffect(() => {
    if (currentModuleId) {
      for (const galaxy of galaxies) {
        const module = galaxy.modules.find(m => m.id === currentModuleId);
        if (module) {
          setRocketTarget({
            x: galaxy.position.x + module.position.x,
            y: galaxy.position.y + module.position.y
          });
          break;
        }
      }
    }
  }, [currentModuleId, galaxies]);
  
  // Animate rocket movement when target changes
  useEffect(() => {
    if (rocketTarget) {
      setRocketMoving(true);
      
      // Gradually move the rocket to the target position
      const movementInterval = setInterval(() => {
        setRocketPos(current => {
          // Calculate the next step toward the target
          const dx = rocketTarget.x - current.x;
          const dy = rocketTarget.y - current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // If we're close enough, stop
          if (distance < 5) {
            clearInterval(movementInterval);
            setRocketMoving(false);
            return rocketTarget;
          }
          
          // Otherwise move a step toward the target
          const step = 10;
          const ratio = step / distance;
          return {
            x: current.x + dx * ratio,
            y: current.y + dy * ratio
          };
        });
      }, 50);
      
      return () => clearInterval(movementInterval);
    }
  }, [rocketTarget]);
  
  // Find connections between galaxies for the path
  const renderGalaxyPaths = () => {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        {galaxies.map((galaxy, index) => {
          if (index === 0 || index >= galaxies.length - 1) return null;
          
          const prevGalaxy = galaxies[index - 1];
          const nextGalaxy = galaxies[index + 1];
          
          const startX = galaxy.position.x;
          const startY = galaxy.position.y;
          const prevX = prevGalaxy.position.x;
          const prevY = prevGalaxy.position.y;
          const nextX = nextGalaxy.position.x;
          const nextY = nextGalaxy.position.y;
          
          const isCompletedToPrev = prevGalaxy.completed;
          const isCompletedToNext = galaxy.completed;
          
          const strokeToPrevClass = isCompletedToPrev 
            ? "stroke-primary animate-pulse" 
            : "stroke-muted";
            
          const strokeToNextClass = isCompletedToNext 
            ? "stroke-primary animate-pulse" 
            : "stroke-muted";
          
          return (
            <g key={`path-galaxy-${galaxy.id}`}>
              <line
                x1={prevX}
                y1={prevY}
                x2={startX}
                y2={startY}
                className={`${strokeToPrevClass} stroke-[6] z-0`}
                strokeDasharray={isCompletedToPrev ? "none" : "15,15"}
              />
              
              <line
                x1={startX}
                y1={startY}
                x2={nextX}
                y2={nextY}
                className={`${strokeToNextClass} stroke-[6] z-0`}
                strokeDasharray={isCompletedToNext ? "none" : "15,15"}
              />
              
              {/* Stars along completed paths */}
              {isCompletedToPrev && [0.25, 0.5, 0.75].map((fraction, i) => {
                const starX = prevX + (startX - prevX) * fraction;
                const starY = prevY + (startY - prevY) * fraction;
                return (
                  <Star
                    key={`star-prev-${i}`}
                    cx={starX}
                    cy={starY}
                    r={5}
                    className="fill-primary text-primary"
                    style={{
                      transform: `translate(${starX - 8}px, ${starY - 8}px)`,
                      animation: `twinkle 1.5s ease-in-out infinite`,
                      animationDelay: `${i * 0.3}s`
                    }}
                    width={16}
                    height={16}
                  />
                );
              })}
              
              {isCompletedToNext && [0.25, 0.5, 0.75].map((fraction, i) => {
                const starX = startX + (nextX - startX) * fraction;
                const starY = startY + (nextY - startY) * fraction;
                return (
                  <Star
                    key={`star-next-${i}`}
                    cx={starX}
                    cy={starY}
                    r={5}
                    className="fill-primary text-primary"
                    style={{
                      transform: `translate(${starX - 8}px, ${starY - 8}px)`,
                      animation: `twinkle 1.5s ease-in-out infinite`,
                      animationDelay: `${i * 0.3}s`
                    }}
                    width={16}
                    height={16}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    );
  };

  // Render the galaxies
  const renderGalaxies = () => {
    return galaxies.map((galaxy) => {
      const isCurrent = galaxy.current;
      
      // Galaxy appearance based on state
      const galaxyClasses = cn(
        "absolute galaxy-node transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300",
        !galaxy.unlocked ? "opacity-40 hover:opacity-60" : "opacity-100 hover:scale-110 transition-transform",
        galaxy.completed ? "completed-galaxy" : "",
        isCurrent ? "current-galaxy" : ""
      );
      
      return (
        <div 
          key={`galaxy-${galaxy.id}`} 
          className={galaxyClasses}
          style={{ 
            left: galaxy.position.x,
            top: galaxy.position.y,
          }}
        >
          <div className={`
            w-24 h-24 rounded-full flex items-center justify-center
            ${galaxy.unlocked ? 'galaxy-glow' : 'galaxy-locked'}
            ${galaxy.completed ? 'galaxy-completed' : ''}
            ${isCurrent ? 'current-pulse' : ''}
          `}>
            <div className="galaxy-label absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-32 text-center">
              <p className="text-sm font-medium text-foreground bg-background/50 backdrop-blur-sm rounded-md px-2 py-1">{galaxy.name}</p>
              <div className="text-xs text-foreground/70 bg-background/30 backdrop-blur-sm rounded-md px-2 py-0.5 mt-1">
                {galaxy.modules.filter(m => m.completed).length}/{galaxy.modules.length} Modules
                {!galaxy.unlocked && <span className="block text-amber-400 mt-0.5">Locked</span>}
              </div>
            </div>
            
            <div className="galaxy-interior-visual relative w-16 h-16 rounded-full overflow-hidden">
              <div className="galaxy-stars absolute inset-0"></div>
              <div className="galaxy-core absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold">{galaxy.id}</span>
                {!galaxy.unlocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    });
  };
  
  // Render modules for all galaxies
  const renderModules = () => {
    // Check for completed galaxies and ensure next ones are unlocked
    for (let i = 0; i < galaxies.length - 1; i++) {
      const currentGalaxy = galaxies[i];
      const nextGalaxy = galaxies[i + 1];
      
      if (currentGalaxy && nextGalaxy && currentGalaxy.completed && !nextGalaxy.unlocked) {
        console.log(`[LearningPathMap] Galaxy ${currentGalaxy.id} completed but Galaxy ${nextGalaxy.id} still locked - forcing unlock`);
        // This is a failsafe - the next galaxy should be unlocked if previous is completed
        nextGalaxy.unlocked = true;
        if (nextGalaxy.modules.length > 0) {
          nextGalaxy.modules[0].locked = false;
        }
      }
    }
    
    return galaxies.map(galaxy => {
      return galaxy.modules.map(module => {
        const isCurrent = module.id === currentModuleId;
        const moduleX = galaxy.position.x + module.position.x;
        const moduleY = galaxy.position.y + module.position.y;
        
        // Determine size based on type
        const sizeMap = {
          'planet': 28,
          'moon': 20,
          'asteroid': 16,
          'station': 24,
          'earth': 32
        };
        
        const size = sizeMap[module.type] || 24;
        
        // Special case: If this is "move-language" module and Genesis Galaxy is completed,
        // make it clickable regardless of the locked status
        const isGenesisCompleted = galaxies.find(g => g.id === 1)?.completed;
        const isMoveLanguageModule = module.id === 'move-language';
        const forceClickable = isGenesisCompleted && isMoveLanguageModule;
        
        // Only allow clicking if the module's galaxy is unlocked and the module is either completed or not locked
        // If a module is completed, we should always allow clicking it regardless of locked status
        // Also allow clicking if we're forcing it clickable (special case for move-language)
        const isClickable = (galaxy.unlocked && (module.completed || !module.locked)) || forceClickable;
        
        return (
          <div
            key={`module-${module.id}`}
            className={cn(
              "absolute module-node transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 group",
              isCurrent ? "z-20" : "z-10",
              isClickable ? "cursor-pointer hover:scale-110" : "cursor-not-allowed opacity-50"
            )}
            style={{
              left: moduleX,
              top: moduleY
            }}
          >
            {/* Module dot */}
            <div 
              className={cn(
                "rounded-full flex items-center justify-center transition-all",
                getModuleColorClass(module.color, module.completed),
                isCurrent ? "ring-4 ring-primary/50 animate-pulse" : ""
              )}
              style={{
                width: `${size}px`,
                height: `${size}px`
              }}
            >
              {module.type === 'planet' && <Circle className={`h-${Math.floor(size/2)}px w-${Math.floor(size/2)}px ${getModuleTextColorClass(module.color)}`} />}
              {module.type === 'moon' && <Circle className={`h-${Math.floor(size/2)}px w-${Math.floor(size/2)}px ${getModuleTextColorClass(module.color)}`} />}
              {module.type === 'asteroid' && <Circle className={`h-${Math.floor(size/2)}px w-${Math.floor(size/2)}px ${getModuleTextColorClass(module.color)}`} />}
              {module.type === 'station' && <Circle className={`h-${Math.floor(size/2)}px w-${Math.floor(size/2)}px ${getModuleTextColorClass(module.color)}`} />}
              {module.type === 'earth' && <Circle className={`h-${Math.floor(size/2)}px w-${Math.floor(size/2)}px ${getModuleTextColorClass(module.color)}`} />}
            </div>
            
            {/* Module tooltip/label that appears on hover */}
            <div className="absolute left-1/2 -bottom-10 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-30">
              <div className="bg-card/90 backdrop-blur-sm rounded-md px-3 py-1.5 text-center whitespace-nowrap shadow-lg border border-border/50">
                <p className="text-sm font-medium">{module.title}</p>
                <p className="text-xs text-muted-foreground">
                  {forceClickable ? "Available" : module.locked && !module.completed ? "Locked" : module.completed ? "Completed" : "Available"}
                </p>
              </div>
            </div>
            
            {/* Status indicator - Only show ONE indicator based on priority: Completed > Current > Locked */}
            {module.completed ? (
              <div className="absolute -top-1 -right-1 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center z-20">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            ) : module.locked && !module.completed && !forceClickable ? (
              <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full w-4 h-4 flex items-center justify-center z-20">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
            ) : isCurrent ? (
              <div className="absolute -top-1 -right-1 bg-primary rounded-full w-4 h-4 flex items-center justify-center z-20 animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            ) : null}
            
            {/* Add clickable link if the module is not locked or is completed */}
            {(isClickable || forceClickable) && (
              <Link 
                to={`/learning/${module.id}`}
                className="absolute inset-0 z-10"
                aria-label={`Start learning ${module.title}`}
              />
            )}
          </div>
        );
      });
    });
  };
  
  // Render rocket ship
  const renderRocket = () => {
    return (
      <motion.div
        className="absolute z-20 rocket-ship"
        style={{
          left: rocketPos.x,
          top: rocketPos.y,
          transform: 'translate(-50%, -50%)'
        }}
        animate={{
          rotate: rocketMoving ? [0, -5, 5, -5, 0] : 0
        }}
        transition={{
          duration: 1,
          repeat: rocketMoving ? Infinity : 0
        }}
      >
        <Rocket size={32} className="text-accent" />
        <div className={`rocket-flames ${rocketMoving ? 'active' : ''}`}></div>
      </motion.div>
    );
  };

  return (
    <div className="learning-map relative w-full h-full overflow-hidden">
      {renderGalaxyPaths()}
      {renderGalaxies()}
      {renderModules()}
      {renderRocket()}
    </div>
  );
};

export default LearningPathMap;
