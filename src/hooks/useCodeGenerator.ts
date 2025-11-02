/**
 * useCodeGenerator Hook
 * Manages state and logic for code generation feature
 */

import { useReducer, useCallback, useMemo } from 'react';
import {
  CodeConfig,
  ParsedCurlData,
  GenerationType,
  CodeTab,
  GenerationStep,
  DEFAULT_CODE_CONFIG,
} from '@/constants/code-generation';
import { CodeGenerationService, getErrorMessage, logError } from '@/services/api/code-generation-service';
import { PomGenerator } from '@/services/codegen/pom-generator';

// ============================================================================
// TYPES
// ============================================================================

interface CodeGeneratorState {
  // Step management
  currentStep: GenerationStep;
  activeTab: CodeTab;

  // Configuration
  config: CodeConfig;

  // Generated code
  generatedCode: string;
  pojoCode: string;
  pomDependencies: string;

  // UI state
  isGenerating: boolean;
  error: string | null;
  
  // Copy state
  copied: boolean;
}

type CodeGeneratorAction =
  | { type: 'UPDATE_CONFIG'; payload: Partial<CodeConfig> }
  | { type: 'SET_GENERATION_TYPE'; payload: GenerationType }
  | { type: 'TOGGLE_POJO'; payload: boolean }
  | { type: 'SET_ACTIVE_TAB'; payload: CodeTab }
  | { type: 'GENERATE_START' }
  | { type: 'GENERATE_SUCCESS'; payload: { code: string; pojo: string; pom: string } }
  | { type: 'GENERATE_ERROR'; payload: string }
  | { type: 'GO_TO_CONFIG' }
  | { type: 'GO_TO_RESULT' }
  | { type: 'SET_COPIED'; payload: boolean }
  | { type: 'RESET' };

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: CodeGeneratorState = {
  currentStep: GenerationStep.CONFIG,
  activeTab: CodeTab.TEST,
  config: DEFAULT_CODE_CONFIG,
  generatedCode: '',
  pojoCode: '',
  pomDependencies: '',
  isGenerating: false,
  error: null,
  copied: false,
};

// ============================================================================
// REDUCER
// ============================================================================

function codeGeneratorReducer(
  state: CodeGeneratorState,
  action: CodeGeneratorAction
): CodeGeneratorState {
  switch (action.type) {
    case 'UPDATE_CONFIG':
      return {
        ...state,
        config: { ...state.config, ...action.payload },
        error: null,
      };

    case 'SET_GENERATION_TYPE':
      return {
        ...state,
        config: { ...state.config, option: action.payload },
        error: null,
      };

    case 'TOGGLE_POJO':
      return {
        ...state,
        config: { ...state.config, needPojo: action.payload },
        error: null,
      };

    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTab: action.payload,
        copied: false,
      };

    case 'GENERATE_START':
      return {
        ...state,
        isGenerating: true,
        error: null,
      };

    case 'GENERATE_SUCCESS':
      return {
        ...state,
        isGenerating: false,
        generatedCode: action.payload.code,
        pojoCode: action.payload.pojo,
        pomDependencies: action.payload.pom,
        currentStep: GenerationStep.RESULT,
        activeTab: CodeTab.TEST,
        error: null,
      };

    case 'GENERATE_ERROR':
      return {
        ...state,
        isGenerating: false,
        error: action.payload,
      };

    case 'GO_TO_CONFIG':
      return {
        ...state,
        currentStep: GenerationStep.CONFIG,
        error: null,
        copied: false,
      };

    case 'GO_TO_RESULT':
      return {
        ...state,
        currentStep: GenerationStep.RESULT,
      };

    case 'SET_COPIED':
      return {
        ...state,
        copied: action.payload,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// HOOK
// ============================================================================

export interface UseCodeGeneratorOptions {
  onSuccess?: (result: { code: string; pojo: string; pom: string }) => void;
  onError?: (error: string) => void;
}

export function useCodeGenerator(options?: UseCodeGeneratorOptions) {
  const [state, dispatch] = useReducer(codeGeneratorReducer, initialState);

  // ============================================================================
  // CONFIG ACTIONS
  // ============================================================================

  const updateConfig = useCallback((config: Partial<CodeConfig>) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: config });
  }, []);

  const setGenerationType = useCallback((type: GenerationType) => {
    dispatch({ type: 'SET_GENERATION_TYPE', payload: type });
  }, []);

  const setClassName = useCallback((className: string) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: { className } });
  }, []);

  const setMethodName = useCallback((methodName: string) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: { methodName } });
  }, []);

  const setPojoClassName = useCallback((pojoClassName: string) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: { pojoClassName } });
  }, []);

  const togglePojo = useCallback((enabled: boolean) => {
    dispatch({ type: 'TOGGLE_POJO', payload: enabled });
  }, []);

  const toggleAssertion = useCallback((enabled: boolean) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: { assertionRequired: enabled } });
  }, []);

  const setStatusCode = useCallback((statusCode: string) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: { statusCode } });
  }, []);

  const toggleLogging = useCallback((enabled: boolean) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: { loggingRequired: enabled } });
  }, []);

  // ============================================================================
  // NAVIGATION ACTIONS
  // ============================================================================

  const goToConfig = useCallback(() => {
    dispatch({ type: 'GO_TO_CONFIG' });
  }, []);

  const goToResult = useCallback(() => {
    dispatch({ type: 'GO_TO_RESULT' });
  }, []);

  const setActiveTab = useCallback((tab: CodeTab) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // ============================================================================
  // GENERATION ACTION
  // ============================================================================

  const generateCode = useCallback(
    async (parsedData: ParsedCurlData) => {
      dispatch({ type: 'GENERATE_START' });

      try {
        // Call API service
        const result = await CodeGenerationService.generateCode({
          parsedData,
          config: state.config,
        });

        // Generate POM dependencies
        const pomXml = PomGenerator.generate(state.config, parsedData);

        const payload = {
          code: result.generated_code || '',
          pojo: result.pojo_code || '',
          pom: pomXml,
        };

        dispatch({ type: 'GENERATE_SUCCESS', payload });

        // Call success callback
        options?.onSuccess?.(payload);
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        dispatch({ type: 'GENERATE_ERROR', payload: errorMessage });

        // Log error for debugging
        logError(error, 'useCodeGenerator');

        // Call error callback
        options?.onError?.(errorMessage);
      }
    },
    [state.config, options]
  );

  // ============================================================================
  // COPY ACTION
  // ============================================================================

  const setCopied = useCallback((copied: boolean) => {
    dispatch({ type: 'SET_COPIED', payload: copied });
  }, []);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isConfigValid = useMemo(() => {
    const { option, className, methodName, needPojo, pojoClassName } = state.config;

    if (!option) return false;
    if (!methodName.trim()) return false;
    if (option === GenerationType.FULL && !className.trim()) return false;
    if (needPojo && !pojoClassName.trim()) return false;

    return true;
  }, [state.config]);

  const canDownloadCurrentTab = useMemo(() => {
    const { activeTab, config } = state;

    if (activeTab === CodeTab.POJO) return true;
    if (activeTab === CodeTab.POM) return true;
    if (activeTab === CodeTab.TEST && config.option === GenerationType.FULL) return true;

    return false;
  }, [state.activeTab, state.config.option]);

  const currentCode = useMemo(() => {
    const { activeTab, generatedCode, pojoCode, pomDependencies } = state;

    switch (activeTab) {
      case CodeTab.TEST:
        return generatedCode;
      case CodeTab.POJO:
        return pojoCode;
      case CodeTab.POM:
        return pomDependencies;
      default:
        return '';
    }
  }, [state.activeTab, state.generatedCode, state.pojoCode, state.pomDependencies]);

  const currentFilename = useMemo(() => {
    const { activeTab, config } = state;

    switch (activeTab) {
      case CodeTab.TEST:
        return `${config.className}.java`;
      case CodeTab.POJO:
        return `${config.pojoClassName}.java`;
      case CodeTab.POM:
        return 'pom.xml';
      default:
        return 'code.txt';
    }
  }, [state.activeTab, state.config.className, state.config.pojoClassName]);

  const availableTabs = useMemo(() => {
    const tabs = [CodeTab.TEST];

    if (state.config.needPojo && state.pojoCode) {
      tabs.push(CodeTab.POJO);
    }

    tabs.push(CodeTab.POM);

    return tabs;
  }, [state.config.needPojo, state.pojoCode]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    currentStep: state.currentStep,
    activeTab: state.activeTab,
    config: state.config,
    generatedCode: state.generatedCode,
    pojoCode: state.pojoCode,
    pomDependencies: state.pomDependencies,
    isGenerating: state.isGenerating,
    error: state.error,
    copied: state.copied,

    // Config actions
    updateConfig,
    setGenerationType,
    setClassName,
    setMethodName,
    setPojoClassName,
    togglePojo,
    toggleAssertion,
    setStatusCode,
    toggleLogging,

    // Navigation actions
    goToConfig,
    goToResult,
    setActiveTab,
    reset,

    // Generation action
    generateCode,

    // Copy action
    setCopied,

    // Computed values
    isConfigValid,
    canDownloadCurrentTab,
    currentCode,
    currentFilename,
    availableTabs,
  };
}

// ============================================================================
// HOOK TYPE EXPORT
// ============================================================================

export type UseCodeGeneratorReturn = ReturnType<typeof useCodeGenerator>;