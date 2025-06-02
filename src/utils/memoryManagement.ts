/**
 * Utility functions for memory management and preventing memory leaks
 */

import logger from './logger';

/**
 * Checks if a value is a DOM node or element
 */
const isDomNode = (value: any): boolean => {
  return value instanceof Node || value instanceof HTMLElement;
};

/**
 * Checks if an object contains circular references
 * This is a simple version that won't catch all circular references but can help identify issues
 */
const hasCircularReferences = (obj: any, seen = new WeakSet()): boolean => {
  // Primitive types cannot have circular references
  if (obj === null || typeof obj !== 'object') return false;
  
  // If we've seen this object before, it's a circular reference
  if (seen.has(obj)) return true;
  
  // Add the current object to our set of seen objects
  seen.add(obj);
  
  // Check all properties recursively
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Skip DOM nodes to avoid unnecessary traversal
      if (isDomNode(obj[key])) continue;
      
      if (hasCircularReferences(obj[key], seen)) {
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Clean up large objects to prevent memory leaks
 * @param target The object to clean up
 */
export const cleanupObject = (target: Record<string, any>): void => {
  if (!target) return;
  
  Object.keys(target).forEach(key => {
    target[key] = null;
  });
};

/**
 * Weak cache implementation to prevent memory leaks with large objects
 */
export class WeakCache<K extends object, V> {
  private cache = new WeakMap<K, V>();
  
  /**
   * Get a value from the cache
   */
  get(key: K): V | undefined {
    return this.cache.get(key);
  }
  
  /**
   * Set a value in the cache
   */
  set(key: K, value: V): void {
    this.cache.set(key, value);
  }
  
  /**
   * Check if the cache has a key
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }
  
  /**
   * Delete a key from the cache
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }
}

/**
 * Detects potential memory leaks in objects (like unintended closures or circular references)
 * @param obj Object to check
 * @param name Name to identify the object in logs
 */
export const detectPotentialMemoryLeaks = (obj: any, name: string = 'object'): void => {
  if (hasCircularReferences(obj)) {
    logger.warn(`Potential memory leak: circular reference detected in ${name}`);
  }
  
  // Check for large arrays that might indicate memory issues
  if (Array.isArray(obj) && obj.length > 1000) {
    logger.warn(`Potential memory issue: large array (${obj.length} items) in ${name}`);
  }
  
  // Look for DOM nodes in the object which might create references
  const hasDomNodes = (o: any): boolean => {
    if (o === null || typeof o !== 'object') return false;
    
    if (isDomNode(o)) return true;
    
    for (const key in o) {
      if (Object.prototype.hasOwnProperty.call(o, key)) {
        if (isDomNode(o[key]) || hasDomNodes(o[key])) {
          return true;
        }
      }
    }
    
    return false;
  };
  
  if (hasDomNodes(obj)) {
    logger.warn(`Potential memory leak: object ${name} contains DOM nodes`);
  }
}; 