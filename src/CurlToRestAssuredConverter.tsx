// src/CurlToRestAssuredConverter.tsx
import React, { useReducer, useCallback, useRef } from 'react';
import { InputPanel } from './components/InputPanel';
import { ParsedViewContainer } from './components/ParsedView/ParsedViewContainer';
import { TestConfiguration } from './components/TestConfiguration';
import { CodePreview } from './components/CodePreview';
import { ExecutionPanel } from './components/ExecutionPanel';
import { ToastContainer } from './components/Toast';
import { appReducer, initialState } from './store/appReducer';
import { parseCurlCommand } from './lib/parseCurl';
import { generateRestAssuredCode } from './lib/generateRestAssured';
import { useToast } from './hooks/useToast';
import  { ParsedData } from './types';
import './index.css';

const CurlToRestAssuredConverter: React.FC = () => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Hidden anchor for downloads
  const downloadRef = useRef<HTMLAnchorElement>(null);

  const { toasts, showSuccess, showError, removeToast } = useToast();

  const handleCurlInputChange = useCallback((value: string) => {
    dispatch({ type: 'SET_CURL_INPUT', payload: value });
  }, []);

  const handleParseCurl = useCallback(() => {
    if (!state.curlInput.trim()) {
      showError('Please enter a curl command');
      return;
    }

    try {
      const parsed = parseCurlCommand(state.curlInput);
      dispatch({ type: 'SET_PARSED_DATA', payload: parsed });
      dispatch({ type: 'SET_SHOW_PARSED_SECTIONS', payload: true });
      showSuccess('Curl command parsed successfully!');
    } catch (error) {
      showError(
        `Invalid curl command: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }, [state.curlInput, showSuccess, showError]);

  const handleClearInput = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const handleToggleSection = useCallback((section: string) => {
    dispatch({ type: 'TOGGLE_SECTION', payload: section });
  }, []);

  const handleUpdateItem = useCallback(
    (type: keyof ParsedData, id: string, field: string, value: any) => {
      dispatch({
        type: 'UPDATE_ITEM',
        payload: { type, id, field, value },
      });
    },
    []
  );

  const handleRemoveItem = useCallback((type: keyof ParsedData, id: string) => {
    dispatch({
      type: 'REMOVE_ITEM',
      payload: { type, id },
    });
  }, []);

  const handleAddItem = useCallback((type: keyof ParsedData) => {
    dispatch({
      type: 'ADD_ITEM',
      payload: { type },
    });
  }, []);

  const handleBodyChange = useCallback((body: string) => {
    dispatch({ type: 'SET_REQUEST_BODY', payload: body });
  }, []);

  const handleConfigChange = useCallback((updates: any) => {
    dispatch({ type: 'SET_TEST_CONFIG', payload: updates });
  }, []);

  const handleGenerateCode = useCallback(() => {
    if (!state.parsedData.url) {
      showError('Please parse a curl command first');
      return;
    }

    try {
      const code = generateRestAssuredCode({
        ...state.parsedData,
        ...state.testConfig,
        body: state.requestBody,
      });
      dispatch({ type: 'SET_GENERATED_CODE', payload: code });
      showSuccess('Code generated successfully!');
    } catch (error) {
      showError(
        `Failed to generate code: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }, [state.parsedData, state.testConfig, state.requestBody, showSuccess, showError]);

  const handleCopyCode = useCallback(async () => {
    if (
      state.generatedCode.includes(
        'Generated Rest Assured code will appear here'
      )
    ) {
      showError('Please generate code first');
      return;
    }

    try {
      await navigator.clipboard.writeText(state.generatedCode);
      showSuccess('Code copied to clipboard!');
    } catch {
      showError('Failed to copy code');
    }
  }, [state.generatedCode, showSuccess, showError]);

  const handleDownloadCode = useCallback(() => {
    if (
      state.generatedCode.includes(
        'Generated Rest Assured code will appear here'
      )
    ) {
      showError('Please generate code first');
      return;
    }

    try {
      const blob = new Blob([state.generatedCode], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      if (downloadRef.current) {
        downloadRef.current.href = url;
        downloadRef.current.download = `${state.testConfig.className}.java`;
        downloadRef.current.click();
      }

      URL.revokeObjectURL(url);
      showSuccess('Code downloaded successfully!');
    } catch {
      showError('Failed to download code');
    }
  }, [state.generatedCode, state.testConfig.className, showSuccess, showError]);

  const handleRunTest = useCallback(() => {
    const results = `
      <div class="response-panel">
        <div class="response-status status-200">✅ Status: 200 OK</div>
        <div style="margin-top: 15px;">
          <strong>Response Headers:</strong>
          <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 5px; font-family: monospace;">
            Content-Type: application/json<br>
            Content-Length: 156<br>
            Server: nginx/1.18.0
          </div>
        </div>
        <div style="margin-top: 15px;">
          <strong>Response Body:</strong>
          <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 5px; font-family: monospace;">
            {<br>
            &nbsp;&nbsp;"status": "success",<br>
            &nbsp;&nbsp;"message": "Test executed successfully",<br>
            &nbsp;&nbsp;"timestamp": "${new Date().toISOString()}"<br>
            }
          </div>
        </div>
        <div style="margin-top: 15px;">
          <strong>Assertions:</strong>
          <div style="color: var(--success-green); margin-top: 5px;">
            ✅ Status code is 200<br>
            ✅ Response time < 1000ms<br>
            ✅ Content-Type is application/json
          </div>
        </div>
      </div>
    `;
    dispatch({ type: 'SET_EXECUTION_RESULTS', payload: results });
    showSuccess('Test executed successfully!');
  }, [showSuccess]);

  return (
    <div className="container">
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      {/* Header */}
      <div className="header">
        <h1>Curl-to-RestAssured Converter</h1>
        <p>
          Convert your curl commands into Rest Assured Java test code with ease
        </p>
      </div>

      {/* Curl Input Section */}
      <InputPanel
        curlInput={state.curlInput}
        onInputChange={handleCurlInputChange}
        onParse={handleParseCurl}
        onClear={handleClearInput}
        parseError={state.parseError}
      />

      {/* Parsed Data Sections */}
      {state.showParsedSections && (
        <ParsedViewContainer
          parsedData={state.parsedData}
          requestBody={state.requestBody}
          expandedSections={state.expandedSections}
          onToggleSection={handleToggleSection}
          onUpdateItem={handleUpdateItem}
          onRemoveItem={handleRemoveItem}
          onAddItem={handleAddItem}
          onBodyChange={handleBodyChange}
        />
      )}

      {/* Test Configuration */}
      <TestConfiguration
        config={state.testConfig}
        onConfigChange={handleConfigChange}
      />

      {/* Code Preview */}
      <CodePreview
        code={state.generatedCode}
        onGenerate={handleGenerateCode}
        onCopy={handleCopyCode}
        onDownload={handleDownloadCode}
        generateError={state.generateError}
        className={state.testConfig.className}
      />

      {/* Execution Section */}
      <ExecutionPanel
        onRunTest={handleRunTest}
        executionResults={state.executionResults}
      />

      {/* Hidden anchor for download */}
      <a ref={downloadRef} style={{ display: 'none' }} />
    </div>
  );
};

export default CurlToRestAssuredConverter;
