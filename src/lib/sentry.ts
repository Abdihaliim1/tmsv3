/**
 * Sentry Error Monitoring Integration
 * 
 * Provides error tracking and monitoring for production.
 * Set VITE_SENTRY_DSN in your .env file to enable.
 */

import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    console.log('Sentry not initialized: VITE_SENTRY_DSN not set. This is optional for production.');
    return;
  }

  try {
    Sentry.init({
      dsn: dsn,
      environment: import.meta.env.MODE || 'development',
      integrations: [
        new Sentry.BrowserTracing({
          // Set tracing origins to track performance
          tracePropagationTargets: ["localhost", /^https:\/\/.*\.firebaseapp\.com/],
        }),
        new Sentry.Replay({
          // Session replay for debugging
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      // Performance Monitoring
      tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
      // Session Replay
      replaysSessionSampleRate: 0.1, // 10% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
      // Release tracking
      release: import.meta.env.VITE_APP_VERSION || 'unknown',
      // Filter out common non-critical errors
      beforeSend(event, hint) {
        // Filter out network errors that are expected
        if (event.exception) {
          const error = hint.originalException;
          if (error instanceof Error) {
            // Don't report Firebase permission errors (user doesn't have access)
            if (error.message.includes('permission-denied') || 
                error.message.includes('Missing or insufficient permissions')) {
              return null;
            }
            // Don't report network errors (user offline)
            if (error.message.includes('Failed to fetch') ||
                error.message.includes('NetworkError')) {
              return null;
            }
          }
        }
        return event;
      },
    });

    console.log('Sentry initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Set user context for error tracking
 */
export function setSentryUser(user: { id: string; email?: string; role?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
  });
}

/**
 * Clear user context (on logout)
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * Manually capture an exception
 */
export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message (non-error)
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level);
}


