/**
 * Centralized Error Handling Service
 *
 * Provides consistent error handling, logging, and user notification
 * across the application.
 */

import { notifications } from './notifications';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorContext {
  operation: string;
  userId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

export interface AppError extends Error {
  code?: string;
  severity?: ErrorSeverity;
  context?: ErrorContext;
  originalError?: unknown;
}

class ErrorHandlerService {
  /**
   * Handles an error with proper logging and user notification
   *
   * @param error - The error to handle
   * @param context - Additional context about where the error occurred
   * @param options - Options for error handling behavior
   */
  handle(
    error: unknown,
    context: ErrorContext,
    options: {
      notifyUser?: boolean;
      rethrow?: boolean;
      severity?: ErrorSeverity;
    } = {}
  ): void {
    const {
      notifyUser = true,
      rethrow = false,
      severity = ErrorSeverity.MEDIUM,
    } = options;

    const appError = this.normalizeError(error, context, severity);

    // Log the error
    this.log(appError);

    // Notify user if requested
    if (notifyUser) {
      this.notifyUser(appError);
    }

    // Report to external service in production
    if (import.meta.env.PROD && severity === ErrorSeverity.CRITICAL) {
      this.reportToExternalService(appError);
    }

    // Rethrow if requested
    if (rethrow) {
      throw appError;
    }
  }

  /**
   * Normalizes any error type into a standardized AppError
   */
  private normalizeError(
    error: unknown,
    context: ErrorContext,
    severity: ErrorSeverity
  ): AppError {
    let message = 'An unknown error occurred';
    let code = 'UNKNOWN_ERROR';

    if (error instanceof Error) {
      message = error.message;
      code = this.extractErrorCode(error);
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>;
      message = String(err.message || err.error || 'Unknown error');
      code = String(err.code || 'UNKNOWN_ERROR');
    }

    const appError = new Error(message) as AppError;
    appError.code = code;
    appError.severity = severity;
    appError.context = context;
    appError.originalError = error;

    return appError;
  }

  /**
   * Extracts error code from Firebase errors and other known error types
   */
  private extractErrorCode(error: Error): string {
    // Firebase errors
    if ('code' in error) {
      return String((error as { code: string }).code);
    }

    // HTTP errors
    if ('status' in error) {
      return `HTTP_${(error as { status: number }).status}`;
    }

    return error.name || 'UNKNOWN_ERROR';
  }

  /**
   * Logs error with appropriate level based on severity
   */
  private log(error: AppError): void {
    const logData = {
      message: error.message,
      code: error.code,
      severity: error.severity,
      context: error.context,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };

    if (import.meta.env.DEV) {
      // In development, always log to console
      console.error('[ErrorHandler]', logData);
    } else {
      // In production, only log warnings and above
      if (
        error.severity === ErrorSeverity.HIGH ||
        error.severity === ErrorSeverity.CRITICAL
      ) {
        console.error('[ErrorHandler]', logData);
      }
    }
  }

  /**
   * Notifies user of error with user-friendly message
   */
  private notifyUser(error: AppError): void {
    const userMessage = this.getUserFriendlyMessage(error);

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        notifications.error(userMessage);
        break;
      case ErrorSeverity.MEDIUM:
        notifications.warning(userMessage);
        break;
      case ErrorSeverity.LOW:
        notifications.info(userMessage);
        break;
    }
  }

  /**
   * Converts technical error to user-friendly message
   */
  private getUserFriendlyMessage(error: AppError): string {
    // Firebase auth errors
    if (error.code?.startsWith('auth/')) {
      return this.getFirebaseAuthMessage(error.code);
    }

    // Firebase firestore errors
    if (error.code?.startsWith('firestore/')) {
      return this.getFirestoreMessage(error.code);
    }

    // Permission errors
    if (error.code === 'PERMISSION_DENIED' || error.code === 'permission-denied') {
      return 'You do not have permission to perform this action.';
    }

    // Network errors
    if (error.code === 'NETWORK_ERROR' || error.message.includes('network')) {
      return 'Network error. Please check your connection and try again.';
    }

    // Default to context-aware message
    if (error.context?.operation) {
      return `Failed to ${error.context.operation}. Please try again.`;
    }

    return 'An unexpected error occurred. Please try again.';
  }

  /**
   * Maps Firebase Auth error codes to user-friendly messages
   */
  private getFirebaseAuthMessage(code: string): string {
    const messages: Record<string, string> = {
      'auth/user-not-found': 'No account found with this email address.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
    };

    return messages[code] || 'Authentication error. Please try again.';
  }

  /**
   * Maps Firestore error codes to user-friendly messages
   */
  private getFirestoreMessage(code: string): string {
    const messages: Record<string, string> = {
      'firestore/permission-denied': 'You do not have permission to access this data.',
      'firestore/not-found': 'The requested data was not found.',
      'firestore/already-exists': 'This record already exists.',
      'firestore/failed-precondition': 'Operation failed. Please check your data and try again.',
      'firestore/unavailable': 'Service temporarily unavailable. Please try again.',
    };

    return messages[code] || 'Database error. Please try again.';
  }

  /**
   * Reports critical errors to external monitoring service
   * TODO: Integrate with Sentry, LogRocket, or similar service
   */
  private reportToExternalService(error: AppError): void {
    // Placeholder for external error reporting
    // In production, integrate with Sentry:
    // Sentry.captureException(error, {
    //   contexts: {
    //     operation: error.context,
    //   },
    //   level: error.severity,
    // });

    if (import.meta.env.DEV) {
      console.warn('[ErrorHandler] Would report to external service:', error);
    }
  }

  /**
   * Creates a typed error for common scenarios
   */
  createError(
    message: string,
    code: string,
    context?: ErrorContext,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): AppError {
    const error = new Error(message) as AppError;
    error.code = code;
    error.severity = severity;
    error.context = context;
    return error;
  }

  /**
   * Wraps an async function with error handling
   */
  wrapAsync<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    context: ErrorContext,
    options?: { notifyUser?: boolean; severity?: ErrorSeverity }
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error, context, {
          ...options,
          rethrow: true,
        });
        throw error; // TypeScript doesn't know handle throws
      }
    };
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandlerService();

// Export convenience functions
export const handleError = errorHandler.handle.bind(errorHandler);
export const createError = errorHandler.createError.bind(errorHandler);
export const wrapAsync = errorHandler.wrapAsync.bind(errorHandler);
