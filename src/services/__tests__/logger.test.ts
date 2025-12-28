/**
 * Unit tests for Logger service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, createLogger } from '../logger';

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('debug', () => {
    it('should log debug messages in development', () => {
      logger.debug('Debug message', { key: 'value' });
      expect(console.debug).toHaveBeenCalled();
    });

    it('should include context in debug logs', () => {
      logger.debug('Debug with context', { userId: '123', action: 'test' });
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('Debug with context'),
        expect.objectContaining({ userId: '123', action: 'test' })
      );
    });
  });

  describe('info', () => {
    it('should log info messages', () => {
      logger.info('Info message');
      expect(console.info).toHaveBeenCalled();
    });

    it('should include context in info logs', () => {
      logger.info('User logged in', { userId: 'user123' });
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('User logged in'),
        expect.objectContaining({ userId: 'user123' })
      );
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      logger.warn('Warning message');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should include context in warning logs', () => {
      logger.warn('Rate limit approaching', { remaining: 10 });
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit approaching'),
        expect.objectContaining({ remaining: 10 })
      );
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      logger.error('Error message');
      expect(console.error).toHaveBeenCalled();
    });

    it('should include Error object details', () => {
      const error = new Error('Test error');
      logger.error('Operation failed', error);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Operation failed'),
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Test error',
            name: 'Error',
          }),
        })
      );
    });

    it('should include context along with error', () => {
      const error = new Error('Database error');
      logger.error('Failed to save', error, { collection: 'loads' });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save'),
        expect.objectContaining({
          collection: 'loads',
          error: expect.objectContaining({
            message: 'Database error',
          }),
        })
      );
    });
  });

  describe('createScoped', () => {
    it('should create scoped logger with prefix', () => {
      const scopedLogger = createLogger('AuthService');
      scopedLogger.info('User authenticated');

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('[AuthService] User authenticated'),
        expect.objectContaining({ scope: 'AuthService' })
      );
    });

    it('should include base context in scoped logger', () => {
      const scopedLogger = createLogger('LoadService', { tenantId: 'tenant123' });
      scopedLogger.debug('Load created', { loadId: 'load456' });

      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('[LoadService] Load created'),
        expect.objectContaining({
          scope: 'LoadService',
          tenantId: 'tenant123',
          loadId: 'load456',
        })
      );
    });

    it('should allow additional context in scoped logger calls', () => {
      const scopedLogger = createLogger('InvoiceService');
      scopedLogger.warn('Invoice overdue', { invoiceId: 'inv789', days: 30 });

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[InvoiceService] Invoice overdue'),
        expect.objectContaining({
          scope: 'InvoiceService',
          invoiceId: 'inv789',
          days: 30,
        })
      );
    });
  });

  describe('measureAsync', () => {
    it('should measure execution time of async function', async () => {
      const mockFn = vi.fn().mockResolvedValue('result');

      const result = await logger.measureAsync('test operation', mockFn, {
        testContext: 'value',
      });

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalled();
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('Starting: test operation'),
        expect.objectContaining({ testContext: 'value' })
      );
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('Completed: test operation'),
        expect.objectContaining({
          testContext: 'value',
          durationMs: expect.any(String),
        })
      );
    });

    it('should log error and rethrow on async function failure', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Async error'));

      await expect(
        logger.measureAsync('failing operation', mockFn)
      ).rejects.toThrow('Async error');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed: failing operation'),
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Async error',
          }),
          durationMs: expect.any(String),
        })
      );
    });
  });

  describe('measure', () => {
    it('should measure execution time of sync function', () => {
      const mockFn = vi.fn().mockReturnValue('sync result');

      const result = logger.measure('sync operation', mockFn, {
        context: 'test',
      });

      expect(result).toBe('sync result');
      expect(mockFn).toHaveBeenCalled();
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('Starting: sync operation'),
        expect.objectContaining({ context: 'test' })
      );
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('Completed: sync operation'),
        expect.objectContaining({
          context: 'test',
          durationMs: expect.any(String),
        })
      );
    });

    it('should log error and rethrow on sync function failure', () => {
      const mockFn = vi.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });

      expect(() => logger.measure('failing sync op', mockFn)).toThrow(
        'Sync error'
      );

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed: failing sync op'),
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Sync error',
          }),
          durationMs: expect.any(String),
        })
      );
    });
  });

  describe('scoped logger performance measurement', () => {
    it('should measure async operations with scoped logger', async () => {
      const scopedLogger = createLogger('TestService');
      const mockFn = vi.fn().mockResolvedValue('result');

      const result = await scopedLogger.measureAsync('async task', mockFn);

      expect(result).toBe('result');
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('[TestService] Starting: TestService.async task'),
        expect.objectContaining({ scope: 'TestService' })
      );
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('[TestService] Completed: TestService.async task'),
        expect.objectContaining({
          scope: 'TestService',
          durationMs: expect.any(String),
        })
      );
    });
  });
});
