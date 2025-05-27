import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiProps {
  id?: string;
  className?: string;
}

export const Confetti: React.FC<ConfettiProps> = ({ id, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiInstanceRef = useRef<confetti.CreateTypes | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      
      // Setup canvas
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Create confetti instance
      const myConfetti = confetti.create(canvas, {
        resize: true,
        useWorker: true,
      });
      
      confettiInstanceRef.current = myConfetti;
      
      // Add methods to the canvas element for external control
      if (canvas.id) {
        // @ts-ignore - adding custom methods to the element
        document.getElementById(canvas.id).start = () => {
          myConfetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#FFD700', '#8A2BE2', '#FF4500', '#00CED1', '#FF1493'],
            shapes: ['circle', 'square'],
            ticks: 200,
          });
        };
      }
      
      // Cleanup on unmount
      return () => {
        if (confettiInstanceRef.current) {
          confettiInstanceRef.current.reset();
        }
      };
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id={id}
      className={`fixed inset-0 pointer-events-none z-50 ${className || ''}`}
    />
  );
};

export default Confetti; 