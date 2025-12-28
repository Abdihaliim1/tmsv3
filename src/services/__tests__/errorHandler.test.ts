/**
 * Unit tests for ErrorHandler service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { errorHandler, ErrorSeverity, createError } from '../errorHandler';
import { notifications } from '../notifications';

// Mock notifications
vi.mock('../notifications', () => ({
  notifications: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handle', () => {
    it('should handle Error instances', () => {
      const error = new Error('Test error');
      const context = { operation: 'test operation', tenantId: 'tenant123' };

      errorHandler.handle(error, context, { notifyUser: false });

      expect(console.error).toHaveBeenCalled();
    });

    it('should handle string errors', () => {
      const error = 'String error message';
      const context = { operation: 'test operation' };

      errorHandler.handle(error, context, { notifyUser: false });

      expect(console.error).toHaveBeenCalled();
    });

    it('should handle unknown error types', () => {
      const error = { message: 'Custom error object' };
      const context = { operation: 'test operation' };

      errorHandler.handle(error, context, { notifyUser: false });

      expect(console.error).toHaveBeenCalled();
    });

    it('should notify user with error message for HIGH severity', () => {
      const error = new Error('Critical failure');
      const context = { operation: 'save data' };

      errorHandler.handle(error, context, {
        notifyUser: true,
        severity: ErrorSeverity.HIGH,
      });

      expect(notifications.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save data')
      );
    });

    it('should notify user with warning for MEDIUM severity', () => {
      const error = new Error('Warning issue');
      const context = { operation: 'fetch data' };

      errorHandler.handle(error, context, {
        notifyUser: true,
        severity: ErrorSeverity.MEDIUM,
      });

      expect(notifications.warning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch data')
      );
    });

    it('should notify user with info for LOW severity', () => {
      const error = new Error('Minor issue');
      const context = { operation: 'update cache' };

      errorHandler.handle(error, context, {
        notifyUser: true,
        severity: ErrorSeverity.LOW,
      });

      expect(notifications.info).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update cache')
      );
    });

    it('should not notify user when notifyUser is false', () => {
      const error = new Error('Test error');
      const context = { operation: 'test' };

      errorHandler.handle(error, context, { notifyUser: false });

      expect(notifications.error).not.toHaveBeenCalled();
      expect(notifications.warning).not.toHaveBeenCalled();
      expect(notifications.info).not.toHaveBeenCalled();
    });

    it('should rethrow error when rethrow option is true', () => {
      const error = new Error('Test error');
      const context = { operation: 'test' };

      expect(() => {
        errorHandler.handle(error, context, {
          notifyUser: false,
          rethrow: true,
        });
      }).toThrow();
    });

    it('should not throw when rethrow is false', () => {
      const error = new Error('Test error');
      const context = { operation: 'test' };

      expect(() => {
        errorHandler.handle(error, context, {
          notifyUser: false,
          rethrow: false,
        });
      }).not.toThrow();
    });
  });

  describe('Firebase Auth error messages', () => {
    it('should provide user-friendly message for auth/user-not-found', () => {
      const error = { code: 'auth/user-not-found', message: 'User not found' };
      const context = { operation: 'login' };

      errorHandler.handle(error, context, {
        notifyUser: true,
        severity: ErrorSeverity.MEDIUM,
      });

      expect(notifications.warning).toHaveBeenCalledWith(
        'No account found with this email address.'
      );
    });

    it('should provide user-friendly message for auth/wrong-password', () => {
      const error = { code: 'auth/wrong-password', message: 'Wrong password' };
      const context = { operation: 'login' };

      errorHandler.handle(error, context, {
        notifyUser: true,
        severity: ErrorSeverity.MEDIUM,
      });

      expect(notifications.warning).toHaveBeenCalledWith('Incorrect password.');
    });

    it('should provide user-friendly message for auth/email-already-in-use', () => {
      const error = {
        code: 'auth/email-already-in-use',
        message: 'Email in use',
      };
      const context = { operation: 'signup' };

      errorHandler.handle(error, context, {
        notifyUser: true,
        severity: ErrorSeverity.MEDIUM,
      });

      expect(notifications.warning).toHaveBeenCalledWith(
        'An account with this email already exists.'
      );
    });
  });

  describe('Firestore error messages', () => {
    it('should provide user-friendly message for permission-denied', () => {
      const error = new Error('Permission denied');
      (error as Error & { code: string }).code = 'permission-denied';
      const context = { operation: 'access data' };

      errorHandler.handle(error, context, {
        notifyUser: true,
        severity: ErrorSeverity.MEDIUM,
      });

      expect(notifications.warning).toHaveBeenCalledWith(
        'You do not have permission to perform this action.'
      );
    });
  });

  describe('createError', () => {
    it('should create a typed error with all properties', () => {
      const error = createError(
        'Test error message',
        'TEST_CODE',
        { operation: 'test', tenantId: 'tenant123' },
        ErrorSeverity.HIGH
      );

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.context?.operation).toBe('test');
      expect(error.context?.tenantId).toBe('tenant123');
    });
  });

  describe('wrapAsync', () => {
    it('should execute async function successfully', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const context = { operation: 'test' };

      const wrapped = errorHandler.wrapAsync(mockFn, context);
      const result = await wrapped('arg1', 'arg2');

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should handle errors from async function', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Async error'));
      const context = { operation: 'test' };

      const wrapped = errorHandler.wrapAsync(mockFn, context, {
        notifyUser: false,
      });

      await expect(wrapped()).rejects.toThrow('Async error');
      expect(console.error).toHaveBeenCalled();
    });
  });
});
