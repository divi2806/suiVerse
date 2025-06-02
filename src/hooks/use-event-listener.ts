import { useEffect, useRef } from 'react';

type EventMap = WindowEventMap & DocumentEventMap & HTMLElementEventMap;

/**
 * A hook for safely managing event listeners in React components.
 * Handles cleanup automatically when the component unmounts.
 * 
 * @param eventName The name of the event to listen for
 * @param handler The event handler function
 * @param element The element to attach the event listener to (defaults to window)
 * @param options Additional options for addEventListener
 */
export function useEventListener<K extends keyof EventMap>(
  eventName: K,
  handler: (event: EventMap[K]) => void,
  element: Window | Document | HTMLElement = window,
  options?: boolean | AddEventListenerOptions
) {
  // Create a ref that stores the handler
  const savedHandler = useRef(handler);
  
  // Update ref.current value if handler changes
  // This allows our effect below to always get latest handler
  // without us needing to pass it in effect deps array
  // and potentially cause effect to re-run every render
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);
  
  useEffect(() => {
    // Make sure element supports addEventListener
    const isSupported = element && element.addEventListener;
    if (!isSupported) return;
    
    // Create event listener that calls handler function stored in ref
    const eventListener = (event: Event) => savedHandler.current(event as any);
    
    // Add event listener
    element.addEventListener(eventName, eventListener, options);
    
    // Remove event listener on cleanup
    return () => {
      element.removeEventListener(eventName, eventListener, options);
    };
  }, [eventName, element, options]);
}

/**
 * A hook for managing multiple event listeners at once.
 * 
 * @param listeners Array of listener configurations
 */
export function useMultipleEventListeners(
  listeners: Array<{
    eventName: string;
    handler: EventListener;
    element?: Window | Document | HTMLElement;
    options?: boolean | AddEventListenerOptions;
  }>
) {
  useEffect(() => {
    // Attach all event listeners
    const cleanupFunctions = listeners.map(({ eventName, handler, element = window, options }) => {
      element.addEventListener(eventName, handler, options);
      return () => element.removeEventListener(eventName, handler, options);
    });
    
    // Return cleanup function that removes all listeners
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [listeners]);
}

/**
 * A hook specifically for document-level custom events
 * 
 * @param eventName The name of the custom event
 * @param handler The event handler function
 */
export function useCustomEvent<T = any>(
  eventName: string,
  handler: (event: CustomEvent<T>) => void
) {
  useEffect(() => {
    const eventListener = (event: Event) => handler(event as CustomEvent<T>);
    document.addEventListener(eventName, eventListener);
    
    return () => {
      document.removeEventListener(eventName, eventListener);
    };
  }, [eventName, handler]);
}

export default useEventListener; 