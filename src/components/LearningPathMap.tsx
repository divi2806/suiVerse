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
        "absolute galaxy-node transform -translate-x-1/2 -translate-y-1/2",
        !galaxy.unlocked ? "opacity-50 cursor-not-allowed" : "opacity-100 hover:scale-110 transition-transform duration-300",
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
                {galaxy.modules.filter(m => m.completed).length}/{galaxy.modules.length} Completed
              </div>
            </div>
            
            <div className="galaxy-interior-visual relative w-16 h-16 rounded-full overflow-hidden">
              <div className="galaxy-stars absolute inset-0"></div>
              <div className="galaxy-core absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold">{galaxy.id}</span>
              </div>
            </div>
          </div>
        </div>
      );
    });
  };
  
  // Render modules for all galaxies
  const renderModules = () => {
    // Create an array to hold all modules from all galaxies
    const allModules: React.ReactNode[] = [];
    
    // Iterate through each galaxy and add its modules
    galaxies.forEach(galaxy => {
      // Calculate base vertical offset to prevent overlapping
      const galaxyModulesCount = galaxy.modules.length;
      
      galaxy.modules.forEach((module, moduleIndex) => {
        const isCurrent = module.id === currentModuleId;
        
        // Select appropriate icon based on module type
        let ModuleIcon = Circle;
        let moduleSize = 24;
        
        if (module.type === 'earth') {
          ModuleIcon = Circle; // Using Circle for now, but we'll style it to look like Earth
          moduleSize = 32; // Make Earth slightly larger
        }
        
        // Calculate absolute position (galaxy position + module position)
        const absX = galaxy.position.x + module.position.x;
        let absY = galaxy.position.y + module.position.y;
        
        // For galaxies with multiple modules, spread them vertically to avoid label overlap
        // Each module will be positioned with more vertical spacing
        if (galaxyModulesCount > 1) {
          // Apply vertical offset, more spacing for more modules
          // For two modules, use current positions
          // For more than two, distribute them with more space
          if (galaxyModulesCount > 2) {
            // Offset factor increases with module index
            const offsetFactor = moduleIndex - (galaxyModulesCount - 1) / 2;
            absY += offsetFactor * 100; // Increase vertical spacing
          }
        }

        // Styles based on module state
        const containerClasses = cn(
          "absolute module-node transform -translate-x-1/2 -translate-y-1/2",
          module.locked ? "opacity-50" : "opacity-100",
          isCurrent ? "z-10" : ""
        );

        // Special styling for Earth
        const moduleClasses = cn(
          module.type === 'earth' 
            ? "w-20 h-20 rounded-full flex items-center justify-center earth-module" 
            : "w-16 h-16 rounded-full flex items-center justify-center",
          module.locked ? "cursor-not-allowed" : "cursor-pointer hover:scale-110 transition-transform",
          // Use the helper function for appropriate colors
          module.type === 'earth' 
            ? "bg-blue-500/70" 
            : getModuleColorClass(module.color, module.completed),
          isCurrent ? "ring-4 ring-primary animate-pulse" : ""
        );

        allModules.push(
          <div 
            key={`${galaxy.id}-${module.id}`} 
            className={containerClasses}
            style={{ 
              left: absX, 
              top: absY,
              animation: isCurrent ? 'float 6s ease-in-out infinite' : 'none',
            }}
          >
            <Link
              to={module.locked ? "#" : `/learning/${module.id}`}
              className={moduleClasses}
              aria-disabled={module.locked}
              onClick={(e) => module.locked && e.preventDefault()}
            >
              <div className={module.type === 'earth' 
                ? "earth-icon w-16 h-16 flex items-center justify-center" 
                : `${getModuleTextColorClass(module.color)} w-10 h-10 flex items-center justify-center`}>
                <ModuleIcon size={moduleSize} />
              </div>
            </Link>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-32 text-center">
              <p className="text-xs font-medium text-foreground/90 bg-background/50 rounded px-2 py-1 backdrop-blur-sm">{module.title}</p>
              {module.completed && <Star className="h-3 w-3 text-yellow-500 mx-auto mt-1" />}
            </div>
          </div>
        );
      });
    });
    
    return allModules;
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
