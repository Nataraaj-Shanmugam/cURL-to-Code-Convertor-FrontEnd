// src/components/TestConfiguration.tsx
import React from 'react';
import type { TestConfig } from '../types';

interface TestConfigurationProps {
  config: TestConfig;
  onConfigChange: (updates: Partial<TestConfig>) => void;
}

export const TestConfiguration: React.FC<TestConfigurationProps> = ({
  config,
  onConfigChange
}) => {
  return (
    <div className="section">
      <div className="section-header">
        ⚙️ Test Configuration
      </div>
      <div className="section-content">
        <div className="grid">
          <div className="form-group">
            <label htmlFor="className">Class Name:</label>
            <input
              type="text"
              id="className"
              value={config.className}
              onChange={(e) => onConfigChange({ className: e.target.value })}
              placeholder="ApiTest"
            />
          </div>
          <div className="form-group">
            <label htmlFor="methodName">Method Name:</label>
            <input
              type="text"
              id="methodName"
              value={config.methodName}
              onChange={(e) => onConfigChange({ methodName: e.target.value })}
              placeholder="testApi"
            />
          </div>
        </div>
        <div className="form-group">
          <label>Test Framework:</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                name="framework"
                value="junit"
                checked={config.framework === 'junit'}
                onChange={(e) => onConfigChange({ framework: e.target.value as 'junit' })}
              />
              JUnit
            </label>
            <label>
              <input
                type="radio"
                name="framework"
                value="testng"
                checked={config.framework === 'testng'}
                onChange={(e) => onConfigChange({ framework: e.target.value as 'testng' })}
              />
              TestNG
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};