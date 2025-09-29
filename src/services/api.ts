import axios from "axios";

const API_BASE = "http://localhost:8000/api";

// --- Types ---
export interface KeyValue {
  key: string;
  value: string;
}

export interface Flags {
  compressed?: boolean;
  max_time?: number | null;
  retry?: number | null;
  retry_delay?: number | null;
  http2?: boolean;
}

export interface ParsedRequest {
  method: string;
  base_url: string;
  path: string;
  headers?: KeyValue[];
  query_params?: KeyValue[];
  path_params?: KeyValue[];
  body?: string | null;
  flags?: Flags;
}

export interface ParseResponse {
  success: boolean;
  parsed?: ParsedRequest;
  error?: string | null;
}

export interface GenerateResponse {
  code: string;
  language: string;
}

export interface ExecuteResponse {
  status: number;
  headers?: Record<string, string>;
  body?: string;
  execution_time_ms?: number;
}

// --- API Calls ---
export async function parseCurl(curl: string): Promise<ParseResponse> {
  const res = await axios.post(`${API_BASE}/parse-curl`, { curl });
  return res.data;
}

export async function generateCode(
  parsed: ParsedRequest,
  language: string
): Promise<GenerateResponse> {
  const res = await axios.post(`${API_BASE}/generate-code`, {
    method: parsed.method,
    url: parsed.base_url + parsed.path,
    headers: Object.fromEntries(parsed.headers?.map(h => [h.key, h.value]) || []),
    body: parsed.body,
    language,
  });
  return res.data;
}

export async function executeRequest(parsed: ParsedRequest): Promise<ExecuteResponse> {
  const res = await axios.post(`${API_BASE}/execute`, {
    method: parsed.method,
    url: parsed.base_url + parsed.path,
    headers: Object.fromEntries(parsed.headers?.map(h => [h.key, h.value]) || []),
    body: parsed.body,
    timeout: parsed.flags?.max_time || 30,
  });
  return res.data;
}
