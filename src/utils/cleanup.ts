/**
 * Utility functions for proper cleanup of timers and event listeners
 * to prevent memory leaks and improve performance.
 */

/**
 * Creates a timeout that will automatically be cleared when the component unmounts
 * @param callback Function to execute after the timeout
 * @param delay Delay in milliseconds
 * @returns An object with clear method to manually clear the timeout
 */
export const createSafeTimeout = (callback: () => void, delay: number): { clear: () => void } => {
  const timeoutId = setTimeout(callback, delay);
  
  return {
    clear: () => clearTimeout(timeoutId)
  };
};

/**
 * Creates an interval that will automatically be cleared when the component unmounts
 * @param callback Function to execute on each interval
 * @param delay Delay in milliseconds between each execution
 * @returns An object with clear method to manually clear the interval
 */
export const createSafeInterval = (callback: () => void, delay: number): { clear: () => void } => {
  const intervalId = setInterval(callback, delay);
  
  return {
    clear: () => clearInterval(intervalId)
  };
};

/**
 * Safely adds an event listener that can be easily cleaned up
 * @param element The target element to attach the listener to
 * @param eventType The event type to listen for
 * @param handler The event handler function
 * @returns A cleanup function to remove the event listener
 */
export const addSafeEventListener = <K extends keyof WindowEventMap>(
  element: Window | Document | HTMLElement,
  eventType: K,
  handler: (event: WindowEventMap[K]) => void
): () => void => {
  element.addEventListener(eventType, handler as EventListener);
  
  return () => {
    element.removeEventListener(eventType, handler as EventListener);
  };
};

/**
 * Adds multiple event listeners at once and returns a single cleanup function
 * @param listeners Array of listener configurations
 * @returns A single cleanup function that will remove all listeners
 */
export const addMultipleEventListeners = (
  listeners: Array<{
    element: Window | Document | HTMLElement;
    eventType: string;
    handler: EventListener;
  }>
): () => void => {
  listeners.forEach(({ element, eventType, handler }) => {
    element.addEventListener(eventType, handler);
  });
  
  return () => {
    listeners.forEach(({ element, eventType, handler }) => {
      element.removeEventListener(eventType, handler);
    });
  };
}; 