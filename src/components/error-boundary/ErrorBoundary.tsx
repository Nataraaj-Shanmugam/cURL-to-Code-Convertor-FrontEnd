/**
 * Error Boundary Components
 * Catches and handles React errors gracefully
 */

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================================================
// TYPES
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// ============================================================================
// ERROR BOUNDARY CLASS
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console
    console.error('ErrorBoundary caught error:', error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Log to error reporting service (e.g., Sentry)
    // logErrorToService(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error boundary when resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const prevResetKeys = prevProps.resetKeys || [];
      const currentResetKeys = this.props.resetKeys;

      if (
        prevResetKeys.length !== currentResetKeys.length ||
        prevResetKeys.some((key, index) => key !== currentResetKeys[index])
      ) {
        this.reset();
      }
    }
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.reset}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// DEFAULT ERROR FALLBACK
// ============================================================================

interface DefaultErrorFallbackProps {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  onReset: () => void;
}

function DefaultErrorFallback({ error, errorInfo, onReset }: DefaultErrorFallbackProps) {
  const isDevelopment = import.meta.env.DEV;

  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-6">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
        </div>

        {/* Error Title */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground">
            We're sorry for the inconvenience. An unexpected error occurred.
          </p>
        </div>

        {/* Error Message (Development only) */}
        {isDevelopment && error && (
          <div className="space-y-2">
            <details className="p-4 rounded-md bg-muted border">
              <summary className="cursor-pointer font-medium text-sm">
                Error Details (Development Mode)
              </summary>
              <div className="mt-4 space-y-2">
                <div>
                  <span className="text-xs font-medium text-destructive">Error:</span>
                  <pre className="mt-1 text-xs bg-background p-2 rounded overflow-auto">
                    {error.toString()}
                  </pre>
                </div>
                {errorInfo && (
                  <div>
                    <span className="text-xs font-medium text-destructive">Stack Trace:</span>
                    <pre className="mt-1 text-xs bg-background p-2 rounded overflow-auto max-h-48">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-3">
          <Button onClick={onReset} variant="default">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button onClick={() => window.location.href = '/'} variant="outline">
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SPECIALIZED ERROR BOUNDARIES
// ============================================================================

/**
 * Error boundary for code generation dialog
 */
interface CodeGenerationErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error) => void;
  onReset?: () => void;
}

export function CodeGenerationErrorBoundary({
  children,
  onError,
  onReset,
}: CodeGenerationErrorBoundaryProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Code Generation Error:', error, errorInfo);
        onError?.(error);
      }}
      onReset={onReset}
      fallback={
        <div className="p-8 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <div>
            <h3 className="font-semibold text-lg">Code Generation Failed</h3>
            <p className="text-sm text-muted-foreground mt-2">
              An error occurred while generating code. Please try again.
            </p>
          </div>
          <Button onClick={onReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      }
    />
  );
}

/**
 * Error boundary for individual components
 */
interface ComponentErrorBoundaryProps {
  children: ReactNode;
  componentName?: string;
  fallbackMessage?: string;
}

export function ComponentErrorBoundary({
  children,
  componentName = 'Component',
  fallbackMessage = 'This component encountered an error',
}: ComponentErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 border border-destructive/20 rounded-md bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">
                {componentName} Error
              </p>
              <p className="text-xs text-muted-foreground">{fallbackMessage}</p>
            </div>
          </div>
        </div>
      }
    />
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Higher-order component to wrap any component with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Hook to programmatically throw errors (for testing)
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return setError;
}