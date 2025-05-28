/**
 * Production-ready logger utility
 * 
 * This utility provides standardized logging functions that can be toggled
 * on/off based on environment, making it easy to remove all debug logs
 * in production while keeping error logging.
 */

// Whether to enable debug logs
const DEBUG_ENABLED = process.env.NODE_ENV !== 'production';

// Whether to enable all logs (emergency toggle)
const LOGGING_ENABLED = true;

// Log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Centralized logger function
 */
function logMessage(level: LogLevel, message: string, ...args: any[]): void {
  if (!LOGGING_ENABLED) return;
  
  // In production, only show warnings and errors
  if (level === LogLevel.DEBUG && !DEBUG_ENABLED) return;
  if (level === LogLevel.INFO && !DEBUG_ENABLED) return;
  
  // Format the message with a timestamp and level
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  // Log to the appropriate console method
  switch (level) {
    case LogLevel.DEBUG:
    case LogLevel.INFO:
      
      break;
    case LogLevel.WARN:
      
      break;
    case LogLevel.ERROR:
      
      break;
  }
  
  // Here you could also add integration with external logging services
  // like Sentry, LogRocket, etc. for production environments
}

/**
 * Public logging API
 */
export const logger = {
  /**
   * Debug logs - only shown in development
   */
  debug: (message: string, ...args: any[]): void => {
    logMessage(LogLevel.DEBUG, message, ...args);
  },
  
  /**
   * Info logs - only shown in development
   */
  info: (message: string, ...args: any[]): void => {
    logMessage(LogLevel.INFO, message, ...args);
  },
  
  /**
   * Warning logs - shown in all environments
   */
  warn: (message: string, ...args: any[]): void => {
    logMessage(LogLevel.WARN, message, ...args);
  },
  
  /**
   * Error logs - shown in all environments
   */
  error: (message: string, error?: Error, ...args: any[]): void => {
    // If an Error object is provided, extract its message and stack
    if (error instanceof Error) {
      logMessage(
        LogLevel.ERROR,
        `${message}: ${error.message}`,
        { stack: error.stack },
        ...args
      );
    } else if (error !== undefined) {
      // If it's some other object passed as the second argument
      logMessage(LogLevel.ERROR, message, error, ...args);
    } else {
      // Just the message
      logMessage(LogLevel.ERROR, message, ...args);
    }
  }
};

export default logger; 