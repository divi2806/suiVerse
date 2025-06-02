import { useCallback, useEffect, useRef } from 'react';

/**
 * A hook for safely managing timeouts in React components.
 * Automatically cleans up the timeout when the component unmounts.
 * 
 * @returns An object with functions to set, clear, and reset timeouts
 */
export const useSafeTimeout = () => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clear any existing timeout
  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  // Set a new timeout
  const set = useCallback((callback: () => void, delay: number) => {
    clear();
    timeoutRef.current = setTimeout(callback, delay);
  }, [clear]);
  
  // Reset the timeout with the same callback and delay
  const reset = useCallback((callback: () => void, delay: number) => {
    clear();
    set(callback, delay);
  }, [clear, set]);
  
  // Automatically clear the timeout when the component unmounts
  useEffect(() => {
    return () => clear();
  }, [clear]);
  
  return { set, clear, reset };
};

/**
 * A hook for safely managing intervals in React components.
 * Automatically cleans up the interval when the component unmounts.
 * 
 * @returns An object with functions to set, clear, and reset intervals
 */
export const useSafeInterval = () => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clear any existing interval
  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);
  
  // Set a new interval
  const set = useCallback((callback: () => void, delay: number) => {
    clear();
    intervalRef.current = setInterval(callback, delay);
  }, [clear]);
  
  // Reset the interval with the same callback and delay
  const reset = useCallback((callback: () => void, delay: number) => {
    clear();
    set(callback, delay);
  }, [clear, set]);
  
  // Automatically clear the interval when the component unmounts
  useEffect(() => {
    return () => clear();
  }, [clear]);
  
  return { set, clear, reset };
};

/**
 * A hook that combines both safe timeout and interval hooks
 * @returns Both timeout and interval management functions
 */
export const useSafeTimers = () => {
  const timeout = useSafeTimeout();
  const interval = useSafeInterval();
  
  return { 
    timeout,
    interval
  };
};

export default useSafeTimers; 