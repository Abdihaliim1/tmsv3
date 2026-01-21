/**
 * Error Logging Service
 * Centralized error logging with localStorage persistence
 */

import { generateErrorId, generateWarningId } from '../utils/idGenerator';

interface ErrorLog {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  userId?: string;
  componentStack?: string;
  errorBoundary?: boolean;
  metadata?: Record<string, any>;
}

const ERROR_LOG_STORAGE_KEY = 'tms_error_logs';
const MAX_ERROR_LOGS = 100; // Keep last 100 errors

/**
 * Get error logs from localStorage
 */
function getErrorLogs(): ErrorLog[] {
  try {
    const stored = localStorage.getItem(ERROR_LOG_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading error logs from localStorage:', error);
  }
  return [];
}

/**
 * Save error logs to localStorage
 */
function saveErrorLogs(logs: ErrorLog[]): void {
  try {
    // Keep only the most recent logs
    const recentLogs = logs.slice(-MAX_ERROR_LOGS);
    localStorage.setItem(ERROR_LOG_STORAGE_KEY, JSON.stringify(recentLogs));
  } catch (error) {
    console.error('Error saving error logs to localStorage:', error);
  }
}

/**
 * Log an error
 */
export function logError(
  error: Error,
  metadata?: {
    componentStack?: string;
    errorBoundary?: boolean;
    userId?: string;
    [key: string]: any;
  }
): void {
  const errorLog: ErrorLog = {
    id: generateErrorId(),
    timestamp: new Date().toISOString(),
    message: error.message || 'Unknown error',
    stack: error.stack,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    userId: metadata?.userId,
    componentStack: metadata?.componentStack,
    errorBoundary: metadata?.errorBoundary || false,
    metadata: metadata ? { ...metadata, userId: undefined, componentStack: undefined, errorBoundary: undefined } : undefined,
  };

  const logs = getErrorLogs();
  logs.push(errorLog);
  saveErrorLogs(logs);

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error logged:', errorLog);
  }
}

/**
 * Log a warning
 */
export function logWarning(
  message: string,
  metadata?: Record<string, any>
): void {
  const errorLog: ErrorLog = {
    id: generateWarningId(),
    timestamp: new Date().toISOString(),
    message: `WARNING: ${message}`,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    metadata,
  };

  const logs = getErrorLogs();
  logs.push(errorLog);
  saveErrorLogs(logs);

  if (process.env.NODE_ENV === 'development') {
    console.warn('Warning logged:', errorLog);
  }
}

/**
 * Get recent error logs
 */
export function getRecentErrorLogs(limit: number = 10): ErrorLog[] {
  const logs = getErrorLogs();
  return logs.slice(-limit).reverse(); // Most recent first
}

/**
 * Clear all error logs
 */
export function clearErrorLogs(): void {
  try {
    localStorage.removeItem(ERROR_LOG_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing error logs:', error);
  }
}

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers(): void {
  // Unhandled JavaScript errors
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      logError(new Error(event.message || 'Unhandled error'), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason || 'Unhandled promise rejection'));
      logError(error, {
        unhandledRejection: true,
      });
    });

    // Expose logError globally for error boundary and other components
    (window as any).logError = logError;
  }
}


