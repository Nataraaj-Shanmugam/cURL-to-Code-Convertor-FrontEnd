import type { ExecuteResponse, ParsedRequest } from "../services/api";

// ------------------
// Generic parsed key-value item
// ------------------
export interface ParsedItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

// ------------------
// Specialized items (extend for clarity, optional fields for future use)
// ------------------
export interface HeaderItem extends ParsedItem { }
export interface QueryParamItem extends ParsedItem { }
export interface AuthItem extends ParsedItem {
  type?: string; // e.g., Basic, Bearer
}

// ------------------
// ParsedData
// ------------------
export interface ParsedData {
  method: string;
  url: string;
  headers: HeaderItem[];
  params: QueryParamItem[];
  auth: AuthItem[]; // always an array (not optional)
  body?: string;
}

// ------------------
// Test config
// ------------------
export interface TestConfig {
  className?: string;
  methodName?: string;
  framework?: 'junit' | 'testng';
}

// ------------------
// App state
// ------------------
export interface AppState {
  curlInput: string;
  parsedData: ParsedRequest | null; 
  showParsedSections: boolean;
  parseError: string;
  generateError: string;
  generatedCode: string;
  testConfig: {
    className: string;
    methodName: string;
    framework: string;
  };
  requestBody: string;
  executionResults: null | ExecuteResponse ;
  executionStatus?: number;
  executionError?: string;
  isExecuting: boolean;
  expandedSections: Record<string, boolean>;
}

// ------------------
// Actions
// ------------------
export type AppAction =
  | { type: 'SET_CURL_INPUT'; payload: string }
  | { type: "SET_PARSED_DATA"; payload: ParsedRequest } 
  | { type: 'SET_SHOW_PARSED_SECTIONS'; payload: boolean }
  | { type: 'SET_PARSE_ERROR'; payload: string }
  | { type: 'SET_GENERATE_ERROR'; payload: string }
  | { type: 'SET_GENERATED_CODE'; payload: string }
  | { type: 'SET_TEST_CONFIG'; payload: Partial<TestConfig> }
  | { type: 'SET_REQUEST_BODY'; payload: string }
  | { type: 'SET_IS_EXECUTING'; payload: boolean }
  | { type: 'SET_EXECUTION_RESULTS'; payload: ExecuteResponse }
  | { type: 'SET_EXECUTION_ERROR'; payload: string }   // ✅ added
  | { type: 'TOGGLE_SECTION'; payload: string }
  | { type: 'UPDATE_ITEM'; payload: { type: keyof ParsedData; id: string; field: keyof ParsedItem; value: string | boolean } }
  | { type: 'REMOVE_ITEM'; payload: { type: keyof ParsedData; id: string } }
  | { type: 'GENERATE_CODE' }
  | { type: 'PARSE_CURL' }
  | { type: 'COPY_CODE' }
  | { type: 'DOWNLOAD_CODE' }
  | { type: 'ADD_ITEM'; payload: { type: keyof ParsedData } }
  | { type: 'CLEAR_ALL' };

// ------------------
// Toast messages
// ------------------
export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
