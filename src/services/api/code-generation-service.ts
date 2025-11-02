/**
 * Code Generation API Service
 * Handles all API interactions for code generation feature
 */

import {
  CodeConfig,
  ParsedCurlData,
  GeneratedCodeResponse,
  CodeGenerationRequest,
} from '@/constants/code-generation';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_CURL_CRAFT_API_URL || '',
  ENDPOINTS: {
    GENERATE: import.meta.env.VITE_CURL_CRAFT_API_GENERATE_ENDPOINT || '/generate',
  },
  TIMEOUT: 30000, // 30 seconds
} as const;

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string = 'Request timeout') {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface ApiRequestConfig {
  timeout?: number;
  signal?: AbortSignal;
}

export interface GenerateCodeOptions extends ApiRequestConfig {
  parsedData: ParsedCurlData;
  config: CodeConfig;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates code generation request before sending
 */
function validateGenerationRequest(
  parsedData: ParsedCurlData,
  config: CodeConfig
): void {
  if (!parsedData) {
    throw new ValidationError('Parsed data is required');
  }

  if (!parsedData.url) {
    throw new ValidationError('URL is required in parsed data', 'url');
  }

  if (!config.option) {
    throw new ValidationError('Generation type must be selected', 'option');
  }

  if (!config.methodName.trim()) {
    throw new ValidationError('Method name is required', 'methodName');
  }

  if (config.option === 'full' && !config.className.trim()) {
    throw new ValidationError('Class name is required for full generation', 'className');
  }

  if (config.needPojo && !config.pojoClassName.trim()) {
    throw new ValidationError('POJO class name is required when generating POJOs', 'pojoClassName');
  }
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

/**
 * Enhanced fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = API_CONFIG.TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`Request timed out after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Handles API response and errors
 */
async function handleApiResponse<T>(response: Response): Promise<T> {
  // Handle non-OK responses
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorData: any;

    try {
      errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // If response is not JSON, use status text
    }

    throw new ApiError(errorMessage, response.status, errorData);
  }

  // Parse JSON response
  try {
    const data = await response.json();
    return data as T;
  } catch (error) {
    throw new ApiError('Invalid JSON response from server', response.status);
  }
}

// ============================================================================
// CODE GENERATION SERVICE
// ============================================================================

export class CodeGenerationService {
  /**
   * Generates code based on parsed curl data and configuration
   */
  static async generateCode(
    options: GenerateCodeOptions
  ): Promise<GeneratedCodeResponse> {
    const { parsedData, config, timeout, signal } = options;

    // Validate request
    try {
      validateGenerationRequest(parsedData, config);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Invalid request data');
    }

    // Prepare request payload
    const payload: CodeGenerationRequest = {
      parsed_data: parsedData,
      config: {
        ...config,
        // Override className if needPojo is true
        className: config.needPojo ? config.pojoClassName : config.className,
      },
    };

    // Build request URL
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GENERATE}`;

    try {
      // Make API request
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal,
        },
        timeout
      );

      // Handle response
      const result = await handleApiResponse<GeneratedCodeResponse>(response);

      // Validate response structure
      if (!result.success && !result.error) {
        throw new ApiError('Invalid response structure from server');
      }

      if (!result.success) {
        throw new ApiError(result.error || 'Code generation failed');
      }

      return result;
    } catch (error) {
      // Re-throw known errors
      if (
        error instanceof ApiError ||
        error instanceof TimeoutError ||
        error instanceof ValidationError
      ) {
        throw error;
      }

      // Handle network errors
      if (error instanceof TypeError) {
        throw new NetworkError('Network request failed. Please check your connection.', error);
      }

      // Handle abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('Request was cancelled', error);
      }

      // Unknown error
      throw new ApiError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  /**
   * Creates an abort controller for cancelling requests
   */
  static createAbortController(): AbortController {
    return new AbortController();
  }

  /**
   * Checks if API is available
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(
        API_CONFIG.BASE_URL,
        { method: 'GET' },
        5000 // 5 second timeout for health check
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Gets API configuration (for debugging)
   */
  static getConfig() {
    return {
      baseUrl: API_CONFIG.BASE_URL,
      endpoints: API_CONFIG.ENDPOINTS,
      timeout: API_CONFIG.TIMEOUT,
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Checks if error is a validation error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Checks if error is a network error
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Checks if error is an API error
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Checks if error is a timeout error
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Gets user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (isValidationError(error)) {
    return error.message;
  }

  if (isNetworkError(error)) {
    return 'Network error. Please check your connection and try again.';
  }

  if (isTimeoutError(error)) {
    return 'Request timed out. Please try again.';
  }

  if (isApiError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Logs error for debugging (can be extended with proper logging service)
 */
export function logError(error: unknown, context?: string): void {
  const prefix = context ? `[${context}]` : '[CodeGenerationService]';
  
  if (isValidationError(error)) {
    console.warn(`${prefix} Validation error:`, error.message, error.field);
  } else if (isNetworkError(error)) {
    console.error(`${prefix} Network error:`, error.message, error.originalError);
  } else if (isApiError(error)) {
    console.error(`${prefix} API error:`, error.message, error.statusCode, error.response);
  } else if (isTimeoutError(error)) {
    console.error(`${prefix} Timeout error:`, error.message);
  } else {
    console.error(`${prefix} Unknown error:`, error);
  }
}