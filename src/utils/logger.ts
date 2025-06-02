/**
 * Logger utility that wraps console methods and only outputs in development mode.
 * In production, logs are suppressed unless they are errors.
 */

const isProduction = process.env.NODE_ENV === 'production';

const logger = {
  log: (...args: any[]): void => {
    if (!isProduction) {
      console.log(...args);
    }
  },
  
  warn: (...args: any[]): void => {
    if (!isProduction) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]): void => {
    // Always log errors, even in production
    console.error(...args);
  },
  
  // For debugging only - never appears in production
  debug: (...args: any[]): void => {
    if (!isProduction) {
      console.log('[DEBUG]', ...args);
    }
  }
};

export default logger; 