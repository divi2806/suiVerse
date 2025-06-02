import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { X, Award, Rocket } from 'lucide-react';
import confetti from 'canvas-confetti';

interface GraduationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

const GraduationPopup: React.FC<GraduationPopupProps> = ({
  isOpen,
  onClose,
  username
}) => {
  const [showStars, setShowStars] = useState(false);

  // Trigger confetti and stars when popup opens
  useEffect(() => {
    if (isOpen) {
      // Trigger confetti
      const duration = 3000;
      const end = Date.now() + duration;
      
      const launchConfetti = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.8 },
          colors: ['#FFD700', '#FFC0CB', '#00FFFF'],
          zIndex: 9999
        });
        
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.8 },
          colors: ['#FFD700', '#FFC0CB', '#00FFFF'],
          zIndex: 9999
        });
        
        if (Date.now() < end) {
          requestAnimationFrame(launchConfetti);
        }
      };
      
      launchConfetti();
      
      // Show stars with delay
      setTimeout(() => {
        setShowStars(true);
      }, 500);
    } else {
      setShowStars(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div 
          className="relative max-w-lg w-full bg-gradient-to-b from-indigo-900/90 to-black/90 p-8 rounded-xl border border-indigo-500/30 shadow-2xl mx-4 overflow-hidden"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.4 }}
        >
          {/* Close button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/10 transition-colors z-10"
          >
            <X className="h-5 w-5 text-white/80" />
          </button>
          
          {/* Background stars */}
          {showStars && (
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-white rounded-full"
                  initial={{ 
                    x: Math.random() * 100 + "%", 
                    y: Math.random() * 100 + "%",
                    opacity: 0 
                  }}
                  animate={{ 
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0]
                  }}
                  transition={{ 
                    duration: 2 + Math.random() * 3,
                    repeat: Infinity,
                    delay: Math.random() * 2
                  }}
                />
              ))}
            </div>
          )}
          
          <div className="text-center relative z-10">
            {/* Award badge */}
            <motion.div 
              className="mx-auto w-24 h-24 rounded-full bg-indigo-600/30 flex items-center justify-center mb-6 border-2 border-indigo-400/50"
              initial={{ scale: 0 }}
              animate={{ scale: 1, rotate: [0, 10, 0, -10, 0] }}
              transition={{ 
                scale: { delay: 0.2, duration: 0.5 },
                rotate: { delay: 0.7, duration: 1.5 }
              }}
            >
              <Award className="h-12 w-12 text-yellow-300" />
            </motion.div>
            
            {/* Astronaut SVG */}
            <div className="relative h-48 mb-6">
              <motion.div
                className="absolute left-1/2 top-0 -translate-x-1/2"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 1 }}
              >
                <svg width="120" height="120" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="100" cy="100" r="50" fill="#E0E0E0" />
                  <circle cx="100" cy="100" r="40" fill="#AFAFAF" />
                  <path d="M100 60C77.9086 60 60 77.9086 60 100C60 122.091 77.9086 140 100 140C122.091 140 140 122.091 140 100C140 77.9086 122.091 60 100 60Z" fill="#3A3A3A" />
                  <path d="M100 70C83.4315 70 70 83.4315 70 100C70 116.569 83.4315 130 100 130C116.569 130 130 116.569 130 100C130 83.4315 116.569 70 100 70Z" fill="#7DD3FC" />
                  <circle cx="100" cy="100" r="25" fill="#0369A1" />
                  <path d="M140 90H160C165.523 90 170 94.4772 170 100V100C170 105.523 165.523 110 160 110H140V90Z" fill="#E0E0E0" />
                  <path d="M60 90H40C34.4772 90 30 94.4772 30 100V100C30 105.523 34.4772 110 40 110H60V90Z" fill="#E0E0E0" />
                  <path d="M90 140V160C90 165.523 94.4772 170 100 170V170C105.523 170 110 165.523 110 160V140H90Z" fill="#E0E0E0" />
                  <circle cx="85" cy="95" r="5" fill="white" />
                </svg>
              </motion.div>
              
              <motion.div
                className="absolute bottom-0 left-0 right-0 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
              >
                <p className="text-cyan-300 italic">"Thanks for helping me reach home!"</p>
              </motion.div>
            </div>
            
            {/* Congratulatory text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <h2 className="text-3xl font-bold mb-2 text-gradient bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                Mission Accomplished!
              </h2>
              <h3 className="text-xl font-semibold mb-4 text-white">
                Congratulations, {username || 'Explorer'}!
              </h3>
              <p className="text-white/80 mb-6">
                You've completed the entire SuiVerse learning journey and mastered the Sui blockchain. 
                Your cosmic quest for knowledge has reached its pinnacle!
              </p>
            </motion.div>
            
            {/* Rocket ship flying across */}
            <motion.div
              className="absolute"
              initial={{ x: -100, y: 50, opacity: 0 }}
              animate={{ x: 400, y: 30, opacity: [0, 1, 1, 0] }}
              transition={{ 
                duration: 4,
                delay: 1.5,
                ease: "easeInOut"
              }}
            >
              <Rocket className="h-8 w-8 text-white" />
            </motion.div>
            
            {/* Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
            >
              <Button 
                onClick={onClose}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium px-8 py-2 rounded-full"
              >
                Continue Your Journey
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default GraduationPopup; 