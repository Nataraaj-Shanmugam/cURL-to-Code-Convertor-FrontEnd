/**
 * Code Generation Constants & Types
 * Centralized configuration for code generation feature
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum GenerationType {
  FULL = 'full',
  METHOD = 'method',
}

export enum CodeTab {
  TEST = 'test',
  POJO = 'pojo',
  POM = 'pom',
}

export enum GenerationStep {
  CONFIG = 'config',
  RESULT = 'result',
}

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface CodeConfig {
  option: GenerationType | '';
  className: string;
  methodName: string;
  assertionRequired: boolean;
  statusCode: string;
  loggingRequired: boolean;
  needPojo: boolean;
  pojoClassName: string;
}

export interface GeneratedCodeResponse {
  success: boolean;
  generated_code?: string;
  pojo_code?: string;
  error?: string;
}

export interface ParsedCurlData {
  url: string;
  method: string;
  headers?: Record<string, string>;
  data?: any;
  params?: Record<string, string>;
}

export interface CodeGenerationRequest {
  parsed_data: ParsedCurlData;
  config: CodeConfig;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_CODE_CONFIG: CodeConfig = {
  option: '',
  className: 'ApiTest',
  methodName: 'testApiRequest',
  assertionRequired: true,
  statusCode: '200',
  loggingRequired: true,
  needPojo: false,
  pojoClassName: 'RequestBody',
};

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

export const VALIDATION = {
  STATUS_CODE: {
    MIN: 100,
    MAX: 599,
  },
  CLASS_NAME: {
    MIN_LENGTH: 1,
    PATTERN: /^[A-Z][a-zA-Z0-9]*$/,
  },
  METHOD_NAME: {
    MIN_LENGTH: 1,
    PATTERN: /^[a-z][a-zA-Z0-9]*$/,
  },
} as const;

// ============================================================================
// UI CONSTANTS
// ============================================================================

export const GENERATION_TYPE_OPTIONS = [
  {
    value: GenerationType.FULL,
    label: 'Full Test Class',
    description: 'Complete Java class with imports, @BeforeClass setup, and @Test method',
  },
  {
    value: GenerationType.METHOD,
    label: 'Test Method Only',
    description: 'Just the @Test method with required imports',
  },
] as const;

export const CODE_TAB_CONFIG = {
  [CodeTab.TEST]: {
    label: 'Test Code',
    fileExtension: '.java',
    canDownload: (config: CodeConfig) => config.option === GenerationType.FULL,
  },
  [CodeTab.POJO]: {
    label: 'POJO Classes',
    fileExtension: '.java',
    canDownload: () => true,
  },
  [CodeTab.POM]: {
    label: 'Dependencies (pom.xml)',
    fileExtension: '.xml',
    canDownload: () => true,
  },
} as const;

// ============================================================================
// MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  NO_OPTION_SELECTED: 'Please select a code generation option',
  NO_POJO_CLASS_NAME: 'Please provide a POJO class name',
  GENERATION_FAILED: 'Failed to generate code. Please try again.',
  COPY_FAILED: 'Failed to copy code to clipboard',
  INVALID_CLASS_NAME: 'Class name must start with uppercase letter',
  INVALID_METHOD_NAME: 'Method name must start with lowercase letter',
} as const;

export const SUCCESS_MESSAGES = {
  CODE_COPIED: 'Code copied to clipboard',
  CODE_DOWNLOADED: 'Code downloaded successfully',
} as const;

// ============================================================================
// TIMEOUTS
// ============================================================================

export const TIMEOUTS = {
  COPY_FEEDBACK: 2000, // Duration to show "Copied" feedback
  TOAST_DURATION: 3000,
} as const;