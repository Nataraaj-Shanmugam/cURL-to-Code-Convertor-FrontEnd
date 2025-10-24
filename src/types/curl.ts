/**
 * Type definitions for cURL parsing and handling
 */

export interface ParsedCurl {
  method: string;
  url?: string;
  base_url: string;
  endpoint: string;
  path_template?: string;
  path_parameters?: any[];
  query_params?: Record<string, any>;
  headers?: Record<string, string>;
  data?: string | object;
  raw_data?: string | null;
  form_data?: Record<string, any>;
  cookies?: Record<string, any>;
  auth?: any;
  proxy?: string | null;
  user_agent?: string | null;
  referer?: string | null;
  flags?: Record<string, any>;
  network_config?: Record<string, any>;
  ssl_config?: Record<string, any>;
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
  success: any;
  error: any;
  full_url: string | undefined;
  timeout: any;
  connect_timeout: any;
  max_time: any;
  retry: any;
  retry_delay: any;
  retry_max_time: any;
  max_redirs: any;
  cert: any;
  key: any;
  cacert: any;
  capath: any;
  ssl_version: any;
  method: string;
  url?: string;
  base_url: string;
  endpoint: string;
  path_template?: string;
  path_parameters?: any[];
  query_params?: Record<string, any>;
  headers?: Record<string, string>;
  data?: ParsedCurl | object;
  raw_data?: string | null;
  form_data?: Record<string, any>;
  cookies?: Record<string, any>;
  auth?: any;
  proxy?: string | null;
  user_agent?: string | null;
  referer?: string | null;
  flags?: Record<string, any>;
  network_config?: Record<string, any>;
  ssl_config?: Record<string, any>;
  all_options?: any[];
  meta?: Record<string, any> | null;
}

export type FilterState = Record<string, boolean>;

// API Response wrapper type
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}