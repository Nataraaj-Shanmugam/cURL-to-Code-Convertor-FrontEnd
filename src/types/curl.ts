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
  // Core request (normalized shape used by the UI)
  method: string;
  url: string;
  base_url: string;
  endpoint: string;
  path_template?: string;
  path_parameters?: any[];
  query_params?: Record<string, any>;

  // Payload
  headers?: Record<string, string>;
  data?: string | object;
  raw_data?: string | null;
  form_data?: Record<string, any>;
  files?: Record<string, any>;

  // Cookies & auth
  cookies?: Record<string, any>;
  auth?: any;
  proxy?: any;
  user_agent?: string | null;
  referer?: string | null;

  // Flags / options
  flags?: Record<string, any>;
  all_options?: any[];

  // Config blocks (keep them loose to avoid tight coupling with BE)
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

// ---- Raw parsed cURL payload from backend ----
export interface ParsedCurlResponse {
  url?: string;
  full_url?: string;
  base_url?: string;
  endpoint?: string;
  path_template?: string;
  method?: string;
  path_parameters?: any[];
  query_params?: Record<string, any>;

  // Payload
  headers?: Record<string, string>;
  data?: any;
  raw_data?: string | null;
  form_data?: Record<string, any>;
  cookies?: Record<string, any>;

  // Auth / proxy / UA
  auth?: any;
  proxy?: any;
  user_agent?: string | null;
  referer?: string | null;
  flags?: Record<string, any>;

  // Network options (flat or grouped)
  timeout?: number | null;
  connect_timeout?: number | null;
  max_time?: number | null;
  retry?: number | null;
  retry_delay?: number | null;
  retry_max_time?: number | null;
  max_redirs?: number | null;

  network_config?: {
    timeout?: number | null;
    connect_timeout?: number | null;
    max_time?: number | null;
    retry?: number | null;
    retry_delay?: number | null;
    retry_max_time?: number | null;
    max_redirs?: number | null;
  };

  // SSL options
  cert?: string | null;
  key?: string | null;
  cacert?: string | null;
  capath?: string | null;
  ssl_version?: string | null;

  ssl_config?: {
    cert?: string | null;
    key?: string | null;
    cacert?: string | null;
    capath?: string | null;
    ssl_version?: string | null;
  };

  // Raw / meta / extras
  all_options?: any[];
  meta?: any;
}


// ---- Parse cURL response ----
// ---- Parse cURL response ----
export interface ParseCurlResponse {
  success: boolean;
  data?: ParsedCurlResponse;   // <-- use the raw payload type
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