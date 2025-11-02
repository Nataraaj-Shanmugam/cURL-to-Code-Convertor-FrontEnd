/**
 * Zod Validation Schemas
 * Runtime type validation for code generation feature
 */

import { z } from 'zod';
import { GenerationType } from '@/constants/code-generation';

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

const CLASS_NAME_REGEX = /^[A-Z][a-zA-Z0-9]*$/;
const METHOD_NAME_REGEX = /^[a-z][a-zA-Z0-9]*$/;
const STATUS_CODE_MIN = 100;
const STATUS_CODE_MAX = 599;

// ============================================================================
// PARSED CURL DATA SCHEMA
// ============================================================================

export const parsedCurlDataSchema = z.object({
  url: z.string().url('Invalid URL format'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'], {
    errorMap: () => ({ message: 'Invalid HTTP method' }),
  }),
  headers: z.record(z.string()).optional(),
  data: z.any().optional(),
  params: z.record(z.string()).optional(),
});

export type ParsedCurlData = z.infer<typeof parsedCurlDataSchema>;

// ============================================================================
// CODE CONFIG SCHEMA
// ============================================================================

export const codeConfigSchema = z
  .object({
    option: z.nativeEnum(GenerationType, {
      errorMap: () => ({ message: 'Please select a generation type' }),
    }).or(z.literal('')),
    
    className: z
      .string()
      .min(1, 'Class name is required')
      .regex(CLASS_NAME_REGEX, 'Class name must start with uppercase letter and contain only alphanumeric characters')
      .max(100, 'Class name is too long'),
    
    methodName: z
      .string()
      .min(1, 'Method name is required')
      .regex(METHOD_NAME_REGEX, 'Method name must start with lowercase letter and contain only alphanumeric characters')
      .max(100, 'Method name is too long'),
    
    assertionRequired: z.boolean(),
    
    statusCode: z
      .string()
      .regex(/^\d+$/, 'Status code must be a number')
      .refine(
        (val) => {
          const num = parseInt(val, 10);
          return num >= STATUS_CODE_MIN && num <= STATUS_CODE_MAX;
        },
        {
          message: `Status code must be between ${STATUS_CODE_MIN} and ${STATUS_CODE_MAX}`,
        }
      ),
    
    loggingRequired: z.boolean(),
    
    needPojo: z.boolean(),
    
    pojoClassName: z
      .string()
      .max(100, 'POJO class name is too long')
      .regex(CLASS_NAME_REGEX, 'POJO class name must start with uppercase letter')
      .optional()
      .or(z.literal('')),
  })
  .refine(
    (data) => {
      // If full mode, className is required
      if (data.option === GenerationType.FULL) {
        return data.className.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Class name is required for full test generation',
      path: ['className'],
    }
  )
  .refine(
    (data) => {
      // If POJO enabled, pojoClassName is required
      if (data.needPojo) {
        return data.pojoClassName && data.pojoClassName.trim().length > 0;
      }
      return true;
    },
    {
      message: 'POJO class name is required when generating POJOs',
      path: ['pojoClassName'],
    }
  )
  .refine(
    (data) => {
      // Method name is always required
      return data.methodName.trim().length > 0;
    },
    {
      message: 'Method name is required',
      path: ['methodName'],
    }
  );

export type CodeConfig = z.infer<typeof codeConfigSchema>;

// ============================================================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================================================

export const codeGenerationRequestSchema = z.object({
  parsed_data: parsedCurlDataSchema,
  config: codeConfigSchema,
});

export type CodeGenerationRequest = z.infer<typeof codeGenerationRequestSchema>;

export const generatedCodeResponseSchema = z.object({
  success: z.boolean(),
  generated_code: z.string().optional(),
  pojo_code: z.string().optional(),
  error: z.string().optional(),
});

export type GeneratedCodeResponse = z.infer<typeof generatedCodeResponseSchema>;

// ============================================================================
// PARTIAL SCHEMAS (for updates)
// ============================================================================

export const partialCodeConfigSchema = codeConfigSchema.partial();

export type PartialCodeConfig = z.infer<typeof partialCodeConfigSchema>;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates parsed curl data
 * @throws ZodError if validation fails
 */
export function validateParsedCurlData(data: unknown): ParsedCurlData {
  return parsedCurlDataSchema.parse(data);
}

/**
 * Safely validates parsed curl data (returns result object)
 */
export function safeParseCurlData(data: unknown) {
  return parsedCurlDataSchema.safeParse(data);
}

/**
 * Validates code configuration
 * @throws ZodError if validation fails
 */
export function validateCodeConfig(config: unknown): CodeConfig {
  return codeConfigSchema.parse(config);
}

/**
 * Safely validates code configuration (returns result object)
 */
export function safeParseCodeConfig(config: unknown) {
  return codeConfigSchema.safeParse(config);
}

/**
 * Validates API request payload
 * @throws ZodError if validation fails
 */
export function validateCodeGenerationRequest(request: unknown): CodeGenerationRequest {
  return codeGenerationRequestSchema.parse(request);
}

/**
 * Validates API response
 * @throws ZodError if validation fails
 */
export function validateGeneratedCodeResponse(response: unknown): GeneratedCodeResponse {
  return generatedCodeResponseSchema.parse(response);
}

/**
 * Safely validates API response (returns result object)
 */
export function safeParseGeneratedCodeResponse(response: unknown) {
  return generatedCodeResponseSchema.safeParse(response);
}

// ============================================================================
// FIELD-LEVEL VALIDATORS
// ============================================================================

/**
 * Validates class name format
 */
export function validateClassName(className: string): boolean {
  return CLASS_NAME_REGEX.test(className) && className.length > 0 && className.length <= 100;
}

/**
 * Validates method name format
 */
export function validateMethodName(methodName: string): boolean {
  return METHOD_NAME_REGEX.test(methodName) && methodName.length > 0 && methodName.length <= 100;
}

/**
 * Validates status code
 */
export function validateStatusCode(statusCode: string): boolean {
  const num = parseInt(statusCode, 10);
  return !isNaN(num) && num >= STATUS_CODE_MIN && num <= STATUS_CODE_MAX;
}

/**
 * Validates URL format
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// ERROR HELPERS
// ============================================================================

/**
 * Extracts user-friendly error messages from Zod errors
 */
export function getValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  
  return errors;
}

/**
 * Gets first error message from Zod error
 */
export function getFirstValidationError(error: z.ZodError): string {
  return error.errors[0]?.message || 'Validation failed';
}

/**
 * Formats validation errors for display
 */
export function formatValidationErrors(error: z.ZodError): string {
  return error.errors
    .map((err) => {
      const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
      return `${path}${err.message}`;
    })
    .join('\n');
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Checks if error is a Zod validation error
 */
export function isZodError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError;
}

/**
 * Checks if value is valid ParsedCurlData
 */
export function isParsedCurlData(value: unknown): value is ParsedCurlData {
  return parsedCurlDataSchema.safeParse(value).success;
}

/**
 * Checks if value is valid CodeConfig
 */
export function isCodeConfig(value: unknown): value is CodeConfig {
  return codeConfigSchema.safeParse(value).success;
}

// ============================================================================
// VALIDATION PRESETS
// ============================================================================

/**
 * Validates minimum required config for generation
 */
export const minimalConfigSchema = z.object({
  option: z.nativeEnum(GenerationType),
  methodName: z.string().min(1),
});

export function validateMinimalConfig(config: unknown) {
  return minimalConfigSchema.safeParse(config);
}

/**
 * Validates config for full class generation
 */
export const fullClassConfigSchema = codeConfigSchema.extend({
  option: z.literal(GenerationType.FULL),
  className: z.string().min(1).regex(CLASS_NAME_REGEX),
});

export function validateFullClassConfig(config: unknown) {
  return fullClassConfigSchema.safeParse(config);
}

/**
 * Validates config for POJO generation
 */
export const pojoConfigSchema = codeConfigSchema.extend({
  needPojo: z.literal(true),
  pojoClassName: z.string().min(1).regex(CLASS_NAME_REGEX),
});

export function validatePojoConfig(config: unknown) {
  return pojoConfigSchema.safeParse(config);
}

// ============================================================================
// SANITIZERS
// ============================================================================

/**
 * Sanitizes and validates code config
 * Trims whitespace and applies defaults
 */
export function sanitizeCodeConfig(config: Partial<CodeConfig>): Partial<CodeConfig> {
  return {
    ...config,
    className: config.className?.trim(),
    methodName: config.methodName?.trim(),
    pojoClassName: config.pojoClassName?.trim(),
    statusCode: config.statusCode?.trim(),
  };
}

/**
 * Sanitizes parsed curl data
 */
export function sanitizeParsedCurlData(data: Partial<ParsedCurlData>): Partial<ParsedCurlData> {
  return {
    ...data,
    url: data.url?.trim(),
    method: data.method,
    headers: data.headers,
    data: data.data,
    params: data.params,
  };
}