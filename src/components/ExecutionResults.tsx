import React, { useContext } from "react";
import { AppContext } from "../state/AppProvider";
import { ExecuteResponse } from "../services/api";

export interface ExecutionResultsProps {
  results: ExecuteResponse | null;
  status?: number;
  error?: string;
  expanded1: boolean;
  onToggle: () => void;
}

export const ExecutionResults: React.FC<ExecutionResultsProps> = ({
  results,
  status,
  error,
  expanded1,
  onToggle,
}) => {
  const app = useContext(AppContext);
  if (!app) return null;

  const { state, actions } = app;
  const { executionResults, executionError, executionStatus, expandedSections, isExecuting } = state;

  const expanded = expandedSections.results || false;

  return (
    <div className="section">
      <div
        className="section-header"
        onClick={() => actions.executeParsedRequest()} // or keep toggle separate if you want
      >
        📊 Execution Results
        <span className={`expand-icon ${expanded ? "rotated" : ""}`}>▼</span>
      </div>

      <div className={`expandable ${expanded ? "open" : ""}`}>
        {executionStatus !== undefined && executionStatus !== null && (
          <div className={`response-status status-${executionStatus}`}>
            Status: {executionStatus}
          </div>
        )}

        {executionError && <div className="error">{executionError}</div>}

        {isExecuting && <div className="loading">Running request...</div>}

        <div className="execution-results">
          <div className="response-panel">
            {executionResults && <pre>{JSON.stringify(executionResults, null, 2)}</pre>}
          </div>
        </div>

        <button
          className={`btn mt-2 ${isExecuting ? "loading" : ""}`}
          onClick={actions.executeParsedRequest}
          disabled={isExecuting}
        >
          {isExecuting ? "Executing..." : "Run Request"}
        </button>
      </div>
    </div>
  );
};
