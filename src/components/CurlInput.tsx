import React, { useContext } from "react";
import { AppContext } from "../state/AppProvider";

interface CurlInputProps {
  value: string;
  onChange: (value: string) => void;
  onParsed?: () => void; 
  parseError?: string;
  className?: string;
}

export const CurlInput: React.FC<CurlInputProps> = ({
  value,
  onChange,
  parseError,
  className = ""
}) => {
  const app = useContext(AppContext);
  if (!app) return null;

  const { actions, state } = app;

  return (
    <div className={`section ${className}`}>
      <div className="section-header">📥 cURL Input</div>
      <div className="section-content">
        {/* Input Area */}
        <textarea
          className="curl-input"
          placeholder="Paste your cURL command here..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          spellCheck={false}
        />

        {/* Parse button */}
        <div style={{ marginTop: "10px" }}>
          <button
            className={`btn ${state.isExecuting ? "loading" : ""}`}
            onClick={actions.parseCurlInput}
            disabled={state.isExecuting}
            aria-label="Parse cURL command"
          >
            {state.isExecuting ? "Parsing..." : "Parse cURL"}
          </button>
        </div>

        {/* Error message */}
        {parseError && (
          <div className="error" style={{ marginTop: "10px" }}>
            {parseError}
          </div>
        )}
      </div>
    </div>
  );
};
