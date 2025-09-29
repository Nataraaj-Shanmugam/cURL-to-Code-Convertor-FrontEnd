import { ExecuteResponse, ParsedRequest } from "../services/api";
import type { AppState, AppAction } from "../types";

// --- Initial State ---
export const initialState: AppState = {
  curlInput: "",
  parsedData: null,
  showParsedSections: false,
  parseError: "",
  generateError: "",
  generatedCode: "",
  testConfig: {
    className: "ApiTest",
    methodName: "testApi",
    framework: "junit",
  },
  requestBody: "",
  executionResults: null,
  executionStatus: undefined,
  executionError: undefined,
  isExecuting: false,
  expandedSections: {},
};

// --- Reducer ---
export const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "SET_CURL_INPUT":
      return { ...state, curlInput: action.payload };

    case "SET_PARSED_DATA":
      return {
        ...state,
        parsedData: action.payload as unknown as ParsedRequest, // ✅
        requestBody: action.payload?.body ?? "",
        parseError: "",
        showParsedSections: true,
      };


    case "SET_PARSE_ERROR":
      return { ...state, parseError: action.payload };

    case "SET_GENERATED_CODE":
      return { ...state, generatedCode: action.payload, generateError: "" };

    case "SET_GENERATE_ERROR":
      return { ...state, generateError: action.payload };

    case "SET_EXECUTION_RESULTS":
      return {
        ...state,
        executionResults: action.payload,
        executionError: undefined,
        isExecuting: false,
      };
      
    case "SET_EXECUTION_ERROR":
      return { ...state, executionError: action.payload, isExecuting: false };

    case "SET_IS_EXECUTING":
      return { ...state, isExecuting: action.payload };

    case "CLEAR_ALL":
      return initialState;

    default:
      return state;
  }
};
