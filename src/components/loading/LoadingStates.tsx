/**
 * Loading States & Skeleton Components
 * Provides consistent loading UI across the application
 */

import { Loader2 } from 'lucide-react';

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-muted rounded ${className}`}
      aria-label="Loading..."
    />
  );
}

// ============================================================================
// CODE GENERATION LOADING STATES
// ============================================================================

/**
 * Loading state for code generation process
 */
export function CodeGenerationLoading() {
  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
      <div className="text-center space-y-2">
        <p className="font-medium">Generating Code...</p>
        <p className="text-sm text-muted-foreground">
          This may take a few moments
        </p>
      </div>
    </div>
  );
}

/**
 * Skeleton for configuration step
 */
export function ConfigurationStepSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Generation Type */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>

      {/* Configuration */}
      <div className="space-y-4 p-4 border rounded-lg">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3 p-3 border rounded-md">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

/**
 * Skeleton for result step
 */
export function ResultStepSkeleton() {
  return (
    <div className="flex flex-col flex-1 space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-t-md">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Code Display */}
      <div className="flex-1 flex flex-col border rounded-md overflow-hidden">
        <div className="flex justify-end gap-2 p-2 border-b bg-muted/30">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="flex-1 p-6 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[95%]" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[85%]" />
          <Skeleton className="h-4 w-[92%]" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[88%]" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between gap-2 pt-4 border-t">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}

// ============================================================================
// INLINE LOADING STATES
// ============================================================================

interface InlineLoadingProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function InlineLoading({ text = 'Loading...', size = 'md' }: InlineLoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className={`animate-spin ${sizeClasses[size]}`} />
      <span className="text-sm">{text}</span>
    </div>
  );
}

// ============================================================================
// BUTTON LOADING STATES
// ============================================================================

interface ButtonLoadingProps {
  text?: string;
}

export function ButtonLoading({ text = 'Loading...' }: ButtonLoadingProps) {
  return (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      {text}
    </>
  );
}

// ============================================================================
// FULL PAGE LOADING
// ============================================================================

interface FullPageLoadingProps {
  message?: string;
  submessage?: string;
}

export function FullPageLoading({
  message = 'Loading...',
  submessage,
}: FullPageLoadingProps) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center space-y-4">
        <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
        <div className="space-y-2">
          <p className="text-lg font-medium">{message}</p>
          {submessage && (
            <p className="text-sm text-muted-foreground">{submessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PROGRESS LOADING
// ============================================================================

interface ProgressLoadingProps {
  progress: number; // 0-100
  message?: string;
}

export function ProgressLoading({ progress, message = 'Processing...' }: ProgressLoadingProps) {
  return (
    <div className="space-y-3 p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{message}</span>
        <span className="text-sm text-muted-foreground">{progress}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// SPINNER VARIANTS
// ============================================================================

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <Loader2
      className={`animate-spin ${sizeClasses[size]} ${className}`}
      aria-label="Loading"
    />
  );
}

// ============================================================================
// SKELETON PATTERNS
// ============================================================================

/**
 * Card skeleton for list items
 */
export function CardSkeleton() {
  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}

/**
 * Table row skeleton
 */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Form field skeleton
 */
export function FormFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

// ============================================================================
// LOADING WRAPPER HOC
// ============================================================================

interface LoadingWrapperProps {
  isLoading: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function LoadingWrapper({ isLoading, children, fallback }: LoadingWrapperProps) {
  if (isLoading) {
    return fallback || <InlineLoading />;
  }

  return <>{children}</>;
}

// ============================================================================
// SUSPENSE FALLBACKS
// ============================================================================

/**
 * Fallback for React.Suspense boundaries
 */
export function SuspenseFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <InlineLoading text="Loading component..." />
    </div>
  );
}

/**
 * Dialog content fallback
 */
export function DialogSuspenseFallback() {
  return (
    <div className="p-8 space-y-4">
      <Skeleton className="h-6 w-48" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  );
}