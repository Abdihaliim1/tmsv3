/**
 * Error Boundary Component
 *
 * Enhanced error boundary with:
 * - Retry counting with max attempts
 * - Automatic recovery for transient errors
 * - Error categorization
 * - Detailed error reporting
 * - Custom fallback support
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle, Home, Bug, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  resetKeys?: unknown[]; // Reset error state when these keys change
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  errorId: string | null;
  copied: boolean;
}

type ErrorCategory = 'network' | 'chunk' | 'render' | 'unknown';

// Max retries before showing permanent error
const DEFAULT_MAX_RETRIES = 3;

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorId: null,
      copied: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId: `ERR-${Date.now().toString(36).toUpperCase()}`
    };
  }

  // Reset error state when resetKeys change
  componentDidUpdate(prevProps: Props): void {
    if (this.state.hasError && this.props.resetKeys) {
      const hasKeyChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasKeyChanged) {
        this.handleReset();
      }
    }
  }

  /**
   * Categorize error for appropriate handling
   */
  categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network errors
    if (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('load failed') ||
      name.includes('networkerror')
    ) {
      return 'network';
    }

    // Chunk loading errors (code splitting)
    if (
      message.includes('loading chunk') ||
      message.includes('loading css chunk') ||
      message.includes('dynamically imported module')
    ) {
      return 'chunk';
    }

    // React render errors
    if (
      message.includes('render') ||
      message.includes('unmounted') ||
      message.includes('maximum update depth')
    ) {
      return 'render';
    }

    return 'unknown';
  }

  /**
   * Get user-friendly error message based on category
   */
  getErrorMessage(category: ErrorCategory): { title: string; description: string } {
    switch (category) {
      case 'network':
        return {
          title: 'Connection Problem',
          description: 'Unable to connect to the server. Please check your internet connection and try again.'
        };
      case 'chunk':
        return {
          title: 'Update Available',
          description: 'A new version of the application is available. Please refresh the page to continue.'
        };
      case 'render':
        return {
          title: 'Display Error',
          description: 'There was a problem displaying this content. Try refreshing or navigating to a different page.'
        };
      default:
        return {
          title: 'Something Went Wrong',
          description: 'An unexpected error occurred. Our team has been notified.'
        };
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const category = this.categorizeError(error);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error to console in development
    if (import.meta.env.DEV) {
      console.group('ErrorBoundary caught an error');
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.error('Category:', category);
      console.groupEnd();
    }

    // Log error to error logging service
    try {
      const win = window as unknown as { logError?: (error: Error, context: Record<string, unknown>) => void };
      if (typeof window !== 'undefined' && win.logError) {
        win.logError(error, {
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
          category,
          errorId: this.state.errorId,
          retryCount: this.state.retryCount
        });
      }
    } catch (logError) {
      if (import.meta.env.DEV) {
        console.error('Failed to log error:', logError);
      }
    }

    this.setState({
      error,
      errorInfo
    });

    // Auto-retry for transient errors (network, chunk loading)
    if ((category === 'network' || category === 'chunk') && this.state.retryCount < (this.props.maxRetries || DEFAULT_MAX_RETRIES)) {
      setTimeout(() => {
        this.handleRetry();
      }, 2000 * (this.state.retryCount + 1)); // Exponential backoff
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorId: null,
      copied: false
    });
  };

  handleRetry = (): void => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
      copied: false
    }));
  };

  handleGoHome = (): void => {
    // Reset and navigate to dashboard
    this.handleReset();
    window.location.href = '/';
  };

  handleCopyError = async (): Promise<void> => {
    const { error, errorInfo, errorId } = this.state;
    const errorDetails = [
      `Error ID: ${errorId}`,
      `Error: ${error?.toString()}`,
      `Component Stack: ${errorInfo?.componentStack || 'N/A'}`,
      `User Agent: ${navigator.userAgent}`,
      `URL: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`
    ].join('\n\n');

    try {
      await navigator.clipboard.writeText(errorDetails);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Fallback for older browsers
      if (import.meta.env.DEV) {
        console.log('Error details:', errorDetails);
      }
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, errorId, retryCount, copied } = this.state;
      const maxRetries = this.props.maxRetries || DEFAULT_MAX_RETRIES;
      const category = error ? this.categorizeError(error) : 'unknown';
      const { title, description } = this.getErrorMessage(category);
      const canRetry = retryCount < maxRetries;

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
            {/* Error Icon */}
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-full mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>

            {/* Error Title & Description */}
            <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">
              {title}
            </h1>
            <p className="text-slate-600 text-center mb-2">
              {description}
            </p>

            {/* Error ID for support */}
            {errorId && (
              <p className="text-xs text-slate-400 text-center mb-6">
                Error ID: {errorId}
              </p>
            )}

            {/* Retry indicator */}
            {retryCount > 0 && canRetry && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-700 text-center">
                  Attempting automatic recovery... ({retryCount}/{maxRetries})
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleRetry}
                disabled={!canRetry}
                className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                {canRetry ? 'Try Again' : 'Max Retries Reached'}
              </button>

              <div className="flex gap-3">
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-4 py-3 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-4 py-3 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reload
                </button>
              </div>
            </div>

            {/* Error Details (Development + Copy for support) */}
            {error && (
              <details className="mt-6">
                <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 flex items-center gap-2">
                  <Bug className="w-4 h-4" />
                  Technical Details
                </summary>
                <div className="mt-2 relative">
                  <pre className="text-xs bg-slate-100 p-4 rounded-lg overflow-auto max-h-48 text-slate-700">
                    {error.toString()}
                    {errorInfo?.componentStack}
                  </pre>
                  <button
                    onClick={this.handleCopyError}
                    className="absolute top-2 right-2 p-1.5 bg-white rounded shadow-sm hover:bg-slate-50 transition-colors"
                    title="Copy error details"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                </div>
              </details>
            )}

            {/* Support Contact */}
            <p className="text-xs text-slate-400 text-center mt-6">
              Need help? Contact{' '}
              <a
                href="mailto:support@somtms.com"
                className="text-blue-600 hover:underline"
              >
                support@somtms.com
              </a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Inline error boundary for smaller components
 * Shows a compact error message instead of full-page error
 */
export function InlineErrorBoundary({
  children,
  fallback
}: {
  children: ReactNode;
  fallback?: ReactNode;
}): JSX.Element {
  return (
    <ErrorBoundary
      fallback={
        fallback || (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Failed to load this section</span>
            </div>
          </div>
        )
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Suspense-style error boundary with loading state
 */
export function AsyncBoundary({
  children,
  loadingFallback,
  errorFallback
}: {
  children: ReactNode;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode;
}): JSX.Element {
  return (
    <ErrorBoundary fallback={errorFallback}>
      <React.Suspense fallback={loadingFallback || <DefaultLoadingFallback />}>
        {children}
      </React.Suspense>
    </ErrorBoundary>
  );
}

function DefaultLoadingFallback(): JSX.Element {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

