// src/state/initialState.ts
import type { AppState } from '../types';

export const initialState: AppState = {
  curlInput: '',
  parsedData: {
    method: 'GET',
    url: '',
    headers: [],
    params: [],
    auth: [],
    body: ''
  },
  showParsedSections: false,
  parseError: '',
  generateError: '',
  generatedCode: '// Generated Rest Assured code will appear here...\n// Click "Generate Code" to create your test code',
  testConfig: {
    className: 'ApiTest',
    methodName: 'testApi',
    framework: 'junit'
  },
  requestBody: '',
  executionResults: '',
  expandedSections: {},
  executionStatus: null,
  executionError: null,
  isExecuting: false
};
