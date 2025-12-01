// src/lib/hooks/useCodeGeneration.ts
import { useState, useCallback } from "react";
import { curlApi } from "@/lib/api/curl";
import type {
  ParsedCurl,
  CodeGenerationConfig,
  PomGenerationConfig,
  PomProjectInfo,
} from "@/types/curl";

type DialogStep = 'type' | 'config' | 'result';

const DEFAULT_POM_PROJECT_INFO: PomProjectInfo = {
  groupId: "com.example",
  artifactId: "rest-assured-tests",
  version: "1.0-SNAPSHOT",
  name: "REST Assured Test Project",
  description: "Automated REST API tests using REST Assured",
};

const DEFAULT_POM_CONFIG: PomGenerationConfig = {
  pomType: "full",
  projectInfo: DEFAULT_POM_PROJECT_INFO,
  includeJunit: false,
  includeAllure: false,
  includeExtent: false,
  includeExcel: false,
  includeFaker: false,
  includeLogging: true,
  includeCommonsIo: false,
  javaVersion: "11"
};

const DEFAULT_CODE_CONFIG: Partial<CodeGenerationConfig> = {
  option: undefined,
  serviceName: 'ServiceName',
  methodName: 'apiNameTest',
  assertionRequired: true,
  statusCode: '200',
  loggingRequired: true,
  needPojo: false,
  useFluentApi: false,
  includeRetry: false,
  testGroups: ['smoke'],
  testPriority: 1,
  testDescription: 'Generated REST-Assured test',
  assertResponseTime: false,
  maxResponseTimeMs: 2000,
  generatePom: false,
  pomConfig: undefined,
};

export function useCodeGeneration(parsedData: ParsedCurl) {
  // Step state
  const [currentStep, setCurrentStep] = useState<DialogStep>('type');

  // Configuration state
  const [codeConfig, setCodeConfig] = useState<Partial<CodeGenerationConfig>>(
    DEFAULT_CODE_CONFIG
  );
  const [pomConfig, setPomConfig] = useState<PomGenerationConfig>(DEFAULT_POM_CONFIG);

  // Result state
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [pojoCode, setPojoCode] = useState<string>('');
  const [pomDependencies, setPomDependencies] = useState<string>('');

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');

  // Update code config
  const updateCodeConfig = useCallback((updates: Partial<CodeGenerationConfig>) => {
    setCodeConfig(prev => ({ ...prev, ...updates }));
  }, []);

  // Update POM config
  const updatePomConfig = useCallback((updates: Partial<PomGenerationConfig>) => {
    setPomConfig(prev => ({ ...prev, ...updates }));
  }, []);

  // Update POM project info
  const updatePomProjectInfo = useCallback((updates: Partial<PomProjectInfo>) => {
    setPomConfig(prev => ({
      ...prev,
      projectInfo: {
        ...prev.projectInfo!,
        ...updates,
      },
    }));
  }, []);

  // Generate code
  const generateCode = useCallback(async (): Promise<boolean> => {
    if (!codeConfig.option) {
      setError('Please select a code generation option');
      return false;
    }

    if (!codeConfig.serviceName?.trim() || !codeConfig.methodName?.trim()) {
      setError('Class name and method name are required');
      return false;
    }

    if (codeConfig.generatePom && pomConfig.pomType === "full") {
      const projectInfo = pomConfig.projectInfo;
      if (!projectInfo?.groupId || !projectInfo?.artifactId || !projectInfo?.version) {
        setError("Group ID, Artifact ID, and Version are required for full POM generation.");
        return false;
      }
    }

    setIsGenerating(true);
    setError('');

    try {
      const finalConfig: CodeGenerationConfig = {
        option: codeConfig.option!,
        serviceName: codeConfig.serviceName!,
        methodName: codeConfig.methodName!,
        assertionRequired: codeConfig.assertionRequired!,
        statusCode: codeConfig.statusCode,
        loggingRequired: codeConfig.loggingRequired!,
        needPojo: codeConfig.needPojo!,
        useFluentApi: codeConfig.useFluentApi!,
        includeRetry: codeConfig.includeRetry!,
        testGroups: codeConfig.testGroups,
        testPriority: codeConfig.testPriority,
        testDescription: codeConfig.testDescription,
        assertResponseTime: codeConfig.assertResponseTime!,
        maxResponseTimeMs: codeConfig.maxResponseTimeMs,
        generatePom: codeConfig.generatePom!,
        pomConfig: codeConfig.generatePom ? pomConfig : undefined,
      };

      const result = await curlApi.generateFromParsed(parsedData, finalConfig);

      if (result.success) {
        setGeneratedCode(result.generated_code || '');
        setPojoCode(result.pojo_code || '');
        setPomDependencies(result.pomXml || '');
        return true;
      } else {
        setError('Failed to generate code: ' + result.error);
        return false;
      }
    } catch (err: any) {
      console.error('Error generating code:', err);
      setError(err.message || 'Failed to generate code. Please try again.');
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, [codeConfig, pomConfig, parsedData]);

  // Reset all state
  const reset = useCallback(() => {
    setCurrentStep('type');
    setCodeConfig(DEFAULT_CODE_CONFIG);
    setPomConfig(DEFAULT_POM_CONFIG);
    setGeneratedCode('');
    setPojoCode('');
    setPomDependencies('');
    setIsGenerating(false);
    setError('');
  }, []);

  // Calculate file count
  const getFileCount = useCallback(() => {
    let count = 1; // Always have test file
    if (codeConfig.needPojo) count++;
    if (codeConfig.generatePom) count++;
    return count;
  }, [codeConfig]);

  // Calculate estimated lines of code
  const getEstimatedLOC = useCallback(() => {
    let lines = 50;
    if (codeConfig.option === 'full') lines += 20;
    if (codeConfig.needPojo) lines += 30;
    if (codeConfig.includeRetry) lines += 15;
    if (codeConfig.generatePom) lines += 50;
    return lines;
  }, [codeConfig]);

  return {
    // Step state
    currentStep,
    setCurrentStep,

    // Config state
    codeConfig,
    pomConfig,
    updateCodeConfig,
    updatePomConfig,
    updatePomProjectInfo,

    // Result state
    generatedCode,
    pojoCode,
    pomDependencies,

    // UI state
    isGenerating,
    error,

    // Actions
    generateCode,
    reset,

    // Computed
    getFileCount,
    getEstimatedLOC,
  };
}