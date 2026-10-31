/**
 * Type definitions for cURL parsing and handling
 */

export interface ParsedCurl {
  // Core fields — always returned by BE /api/parse
  method: string;
  url?: string;
  base_url: string;
  endpoint: string;
  path_template?: string;
  path_parameters?: unknown[];
  query_params?: Record<string, unknown>;
  headers?: Record<string, string>;
  data?: string | object;
  form_data?: Record<string, unknown>;
  cookies?: Record<string, unknown>;

  // Config sections — returned by BE as grouped objects
  auth_config?: Record<string, unknown>;
  proxy_config?: Record<string, unknown>;
  network_config?: Record<string, unknown>;
  ssl_config?: Record<string, unknown>;
  transfer_config?: Record<string, unknown>;
  protocol_config?: Record<string, unknown>;
  output_config?: Record<string, unknown>;
  ftp_config?: Record<string, unknown>;
  mail_config?: Record<string, unknown>;
  misc_flags?: Record<string, unknown>;

  // Legacy/defensive fields — not returned by current BE parser
  // but referenced in editor skip-lists for forward compatibility
  raw_data?: string | null;
  auth?: unknown;
  proxy?: string | null;
  user_agent?: string | null;
  referer?: string | null;
  flags?: Record<string, unknown>;
  all_options?: unknown[];
  meta?: Record<string, unknown> | null;
}


export interface MultipartField {
  name: string;
  value: string | File;
  filename?: string;
  contentType?: string;
}

export interface ParsedCurlResponse {
  success: boolean;
  data: ParsedCurl;
  meta?: Record<string, unknown>;
  error?: ApiError;
}

export type FilterState = Record<string, boolean>;

// API Error type matching backend v2.0.0
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// API Response wrapper type
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError | string;
  message?: string;
  meta?: Record<string, unknown>;
}

// Code generation response from backend v2.0.0. Field names are production's (origin/master):
// generated_code, pojo_code, pomXml; pojo_classes / complete_code are optional extras.
export interface CodeGenerationResponse {
  success: boolean;
  generated_code?: string;
  pojo_code?: string;
  pojo_classes?: Record<string, string>;
  complete_code?: string;
  /** Generated pom.xml (full POM or dependencies only, as requested in config.pomConfig). */
  pomXml?: string;
  warnings?: string[];
  structured_json?: unknown;
  language?: string;
  error?: ApiError | string;
  meta?: Record<string, unknown>;
}

// ---- POM / full generate contract (mirrors production's CodeGenerationConfig, origin/master) ----
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

export type DataFormat = "json" | "xml" | "both";

/** The `config` object of POST /api/generate-from-parsed, exactly the field set production sends. */
export interface CodeGenerationConfig {
  option: "full" | "method";
  /** The test class name (production calls it serviceName). */
  serviceName: string;
  methodName: string;
  assertionRequired: boolean;
  statusCode?: string;
  loggingRequired: boolean;
  needPojo: boolean;
  /** Base name of the generated POJO class; only sent when needPojo is true. */
  pojoClassName?: string;
  useFluentApi: boolean;
  includeRetry: boolean;
  testGroups?: string[];
  testPriority?: number;
  testDescription?: string;
  assertResponseTime: boolean;
  maxResponseTimeMs?: number;
  generatePom: boolean;
  dataFormat?: DataFormat;
  pomConfig?: PomGenerationConfig;
}

// Code generation config matching backend v2.0.0
export interface CodeGenConfig {
  option: string;
  className: string;
  methodName: string;
  assertionRequired: boolean;
  statusCode: string;
  loggingRequired: boolean;
  needPojo: boolean;
}
