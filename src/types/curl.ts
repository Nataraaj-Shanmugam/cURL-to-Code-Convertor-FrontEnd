/**
 * Type definitions for cURL parsing, generation and API responses
 */

// ---- POM Generation Types ----
export interface PomProjectInfo {
  groupId: string;
  artifactId: string;
  version: string;
  name: string;
  description: string;
}

export interface PomGenerationConfig {
  pomType: "full" | "dependencies_only";
  projectInfo?: PomProjectInfo;
  includeJunit: boolean;
  includeAllure: boolean;
  includeExtent: boolean;
  includeExcel: boolean;
  includeFaker: boolean;
  includeLogging: boolean;
  includeCommonsIo: boolean;
  javaVersion: "8" | "11" | "17" | "21";
}

// ---- Core parsed cURL shape ----
export interface ParsedCurl {
  // Core request
  method: string;
  url: string;
  base_url: string;
  endpoint: string;
  path_parameters?: any[];
  query_params?: Record<string, any>;

  // Payload
  headers?: Record<string, string>;
  data?: string | object;
  raw_data?: string | null;
  form_data?: Record<string, any>;
  files?: Record<string, any>;

  // Auth / network / misc – keep them loose to avoid tight coupling
  auth_config?: Record<string, any>;
  ssl_config?: Record<string, any>;
  proxy_config?: Record<string, any>;
  network_config?: Record<string, any>;
  transfer_config?: Record<string, any>;
  protocol_config?: Record<string, any>;
  output_config?: Record<string, any>;
  ftp_config?: Record<string, any>;
  mail_config?: Record<string, any>;
  misc_flags?: Record<string, any>;

  // Raw / meta
  raw?: any;
  meta?: Record<string, any> | null;
}

export type FilterState = Record<string, boolean>;

// ---- Generic backend meta/error ----
export interface BackendMeta {
  timestamp: string;
  request_id: string;
}

export interface BackendStructuredError {
  code: string;
  message: string;
  details?: string[];
}

// ---- Parse cURL response ----
export interface ParseCurlResponse {
  success: boolean;
  data?: ParsedCurl;
  error?: BackendStructuredError;
  meta: BackendMeta;
}

// ---- Code generation config (should mirror BE CodeGenerationConfig) ----
export interface CodeGenerationConfig {
  option: "full" | "method";

  serviceName: string;
  methodName: string;

  assertionRequired: boolean;
  statusCode?: string;

  loggingRequired: boolean;
  needPojo: boolean;

  useFluentApi: boolean;
  includeRetry: boolean;

  testGroups?: string[];
  testPriority?: number;
  testDescription?: string;

  assertResponseTime: boolean;
  maxResponseTimeMs?: number;

  // POM Generation fields
  generatePom: boolean;
  pomConfig?: PomGenerationConfig;
}

// ---- Code generation response ----
export interface CodeGenerationResponse {
  success: boolean;

  generated_code?: string;          // REST-Assured + TestNG
  pojo_code?: string;               // All POJOs together (optional)
  pojo_classes?: Record<string, string>;
  complete_code?: string;           // Aggregate code if BE returns it
  pomXml?: string;                 // Generated POM.xml (NEW)
  structured_json?: ParsedCurl;
  language?: string;                // e.g. "java-restassured"

  error?: string;
  meta?: BackendMeta;
}

// For any legacy uses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}