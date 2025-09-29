import React, { useReducer, createContext, ReactNode } from "react";
import { appReducer, initialState } from "./reducer";
import {
  parseCurl,
  generateCode,
  executeRequest,
  ParsedRequest,
} from "../services/api";
import { AppAction, AppState } from "../types";

export interface AppContextType {
  state: AppState;
  actions: {
    parseCurlInput: () => Promise<void>;
    generateCodeFromParsed: (lang: string) => Promise<void>;
    executeParsedRequest: () => Promise<void>;
  };
  dispatch: React.Dispatch<AppAction>;
}


export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const parseCurlInput = async () => {
    try {
      const result = await parseCurl(state.curlInput);
      if (result.success && result.parsed) {
        dispatch({ type: "SET_PARSED_DATA", payload: result.parsed });
      } else {
        dispatch({ type: "SET_PARSE_ERROR", payload: result.error || "Parse failed" });
      }
    } catch (err: any) {
      dispatch({ type: "SET_PARSE_ERROR", payload: err.message });
    }
  };

  const generateCodeFromParsed = async (language: string) => {
    if (!state.parsedData) return;
    try {
      const result = await generateCode(state.parsedData as ParsedRequest, language);
      dispatch({ type: "SET_GENERATED_CODE", payload: result.code });
    } catch (err: any) {
      dispatch({ type: "SET_GENERATE_ERROR", payload: err.message });
    }
  };

  const executeParsedRequest = async () => {
    if (!state.parsedData) return;
    dispatch({ type: "SET_IS_EXECUTING", payload: true });
    try {
      const result = await executeRequest(state.parsedData as ParsedRequest);
      dispatch({ type: "SET_EXECUTION_RESULTS", payload: result });
    } catch (err: any) {
      dispatch({ type: "SET_EXECUTION_ERROR", payload: err.message });
    }
  };

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        actions: { parseCurlInput, generateCodeFromParsed, executeParsedRequest },
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
