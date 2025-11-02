/**
 * Code Generation Module Exports
 * Optimized with React.lazy and React.memo
 */

import { lazy } from 'react';
import { memo } from 'react';

// ============================================================================
// LAZY LOADED COMPONENTS (Code Splitting)
// ============================================================================

/**
 * Main dialog - lazy loaded to reduce initial bundle size
 */
export const CodeGenerationDialog = lazy(() =>
  import('./CodeGenerationDialog').then((module) => ({
    default: module.default,
  }))
);

/**
 * Configuration step - lazy loaded
 */
export const ConfigurationStep = lazy(() =>
  import('./ConfigurationStep').then((module) => ({
    default: module.default,
  }))
);

/**
 * Result step - lazy loaded
 */
export const ResultStep = lazy(() =>
  import('./ResultStep').then((module) => ({
    default: module.default,
  }))
);

// ============================================================================
// MEMOIZED COMPONENTS (Prevent Re-renders)
// ============================================================================

/**
 * Memoized CodeTabs component
 * Only re-renders when activeTab or availableTabs change
 */
import CodeTabsBase from './CodeTabs';
export const CodeTabs = memo(CodeTabsBase);

// ============================================================================
// PRELOAD FUNCTIONS
// ============================================================================

/**
 * Preload code generation dialog
 * Call this when user hovers over "Generate Code" button
 */
export function preloadCodeGenerationDialog() {
  import('./CodeGenerationDialog ');
  import('./ConfigurationStep ');
  import('./ResultStep');
}

/**
 * Preload all code generation components
 */
export function preloadAllCodeGenerationComponents() {
  preloadCodeGenerationDialog();
  import('./CodeTabs');
}