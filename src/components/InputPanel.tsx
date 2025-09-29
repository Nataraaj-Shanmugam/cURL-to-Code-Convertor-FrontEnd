// src/components/InputPanel.tsx
import React from 'react';

interface InputPanelProps {
  curlInput: string;
  onInputChange: (value: string) => void;
  onParse: () => void;
  onClear: () => void;
  parseError?: string;
}

export const InputPanel: React.FC<InputPanelProps> = ({
  curlInput,
  onInputChange,
  onParse,
  onClear,
  parseError
}) => {
  const renderError = (error: string) => {
    if (!error) return null;
    
    if (error.startsWith('success:')) {
      return <div className="success">{error.replace('success:', '')}</div>;
    }
    return <div className="error">{error}</div>;
  };

  return (
    <div className="section">
      <div className="section-header">
        📝 Curl Command Input
      </div>
      <div className="section-content">
        <textarea
          rows={8}
          value={curlInput}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={`Paste your curl command here...
Example: curl -X POST https://api.example.com/users \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer token123' \\
  -d '{"name":"John","email":"john@example.com"}'`}
          className="curl-textarea"
        />
        <div style={{ marginTop: '10px' }}>
          <button className="btn" onClick={onParse}>
            Parse Curl
          </button>
          <button className="btn btn-secondary" onClick={onClear}>
            Clear
          </button>
        </div>
        {parseError && (
          <div style={{ marginTop: '10px' }}>
            {renderError(parseError)}
          </div>
        )}
      </div>
    </div>
  );
};