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
  path_parameters?: any[];
  query_params?: Record<string, any>;
  headers?: Record<string, string>;
  data?: string | object;
  form_data?: Record<string, any>;
  cookies?: Record<string, any>;

  // Config sections — returned by BE as grouped objects
  auth_config?: Record<string, any>;
  proxy_config?: Record<string, any>;
  network_config?: Record<string, any>;
  ssl_config?: Record<string, any>;
  transfer_config?: Record<string, any>;
  protocol_config?: Record<string, any>;
  output_config?: Record<string, any>;
  ftp_config?: Record<string, any>;
  mail_config?: Record<string, any>;
  misc_flags?: Record<string, any>;

  // Legacy/defensive fields — not returned by current BE parser
  // but referenced in editor skip-lists for forward compatibility
  raw_data?: string | null;
  auth?: any;
  proxy?: string | null;
  user_agent?: string | null;
  referer?: string | null;
  flags?: Record<string, any>;
  all_options?: any[];
  meta?: Record<string, any> | null;
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
  meta?: Record<string, any>;
  error?: ApiError;
}

export type FilterState = Record<string, boolean>;

// API Error type matching backend v2.0.0
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// API Response wrapper type
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError | string;
  message?: string;
  meta?: Record<string, any>;
}

// Code generation response from backend v2.0.0
export interface CodeGenerationResponse {
  success: boolean;
  generated_code: string;
  pojo_code?: string;
  complete_code?: string;
  warnings?: string[];
  structured_json?: any;
  language?: string;
  error?: string;
  meta?: Record<string, any>;
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
