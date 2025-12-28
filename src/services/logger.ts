/**
 * Structured Logging Service
 *
 * Provides consistent, structured logging across the application
 * with appropriate log levels and conditional logging for production.
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  [key: string]: unknown;
}

class LoggerService {
  private isDevelopment = import.meta.env.DEV;
  private minProductionLevel = LogLevel.WARN;

  /**
   * Logs a debug message (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  /**
   * Logs an informational message
   */
  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log(LogLevel.INFO, message, context);
    }
  }

  /**
   * Logs a warning message
   */
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log(LogLevel.WARN, message, context);
    }
  }

  /**
   * Logs an error message
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorContext = error instanceof Error
        ? {
            ...context,
            error: {
              message: error.message,
              stack: error.stack,
              name: error.name,
            },
          }
        : { ...context, error };

      this.log(LogLevel.ERROR, message, errorContext);
    }
  }

  /**
   * Determines if a log should be output based on environment and level
   */
  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) {
      return true; // Log everything in development
    }

    // In production, only log warnings and errors
    return level === LogLevel.WARN || level === LogLevel.ERROR;
  }

  /**
   * Outputs structured log message
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };

    const prefix = `[${level.toUpperCase()}]`;
    const logMessage = this.isDevelopment
      ? `${prefix} ${message}`
      : JSON.stringify(logEntry);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, context || '');
        break;
      case LogLevel.INFO:
        console.info(logMessage, context || '');
        break;
      case LogLevel.WARN:
        console.warn(logMessage, context || '');
        break;
      case LogLevel.ERROR:
        console.error(logMessage, context || '');
        break;
    }
  }

  /**
   * Creates a scoped logger with predefined context
   */
  createScoped(scope: string, baseContext?: LogContext): ScopedLogger {
    return new ScopedLogger(this, scope, baseContext);
  }

  /**
   * Measures and logs execution time of a function
   */
  async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = performance.now();
    this.debug(`Starting: ${operation}`, context);

    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.debug(`Completed: ${operation}`, {
        ...context,
        durationMs: duration.toFixed(2),
      });
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.error(`Failed: ${operation}`, error, {
        ...context,
        durationMs: duration.toFixed(2),
      });
      throw error;
    }
  }

  /**
   * Measures and logs execution time of a synchronous function
   */
  measure<T>(operation: string, fn: () => T, context?: LogContext): T {
    const startTime = performance.now();
    this.debug(`Starting: ${operation}`, context);

    try {
      const result = fn();
      const duration = performance.now() - startTime;
      this.debug(`Completed: ${operation}`, {
        ...context,
        durationMs: duration.toFixed(2),
      });
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.error(`Failed: ${operation}`, error, {
        ...context,
        durationMs: duration.toFixed(2),
      });
      throw error;
    }
  }
}

/**
 * Scoped logger with predefined context
 */
class ScopedLogger {
  constructor(
    private logger: LoggerService,
    private scope: string,
    private baseContext?: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return {
      scope: this.scope,
      ...this.baseContext,
      ...context,
    };
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(`[${this.scope}] ${message}`, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(`[${this.scope}] ${message}`, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(`[${this.scope}] ${message}`, this.mergeContext(context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.logger.error(
      `[${this.scope}] ${message}`,
      error,
      this.mergeContext(context)
    );
  }

  async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    return this.logger.measureAsync(
      `${this.scope}.${operation}`,
      fn,
      this.mergeContext(context)
    );
  }

  measure<T>(operation: string, fn: () => T, context?: LogContext): T {
    return this.logger.measure(
      `${this.scope}.${operation}`,
      fn,
      this.mergeContext(context)
    );
  }
}

// Export singleton instance
export const logger = new LoggerService();

// Export convenience functions for common logging patterns
export const logDebug = logger.debug.bind(logger);
export const logInfo = logger.info.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logError = logger.error.bind(logger);
export const createLogger = logger.createScoped.bind(logger);
