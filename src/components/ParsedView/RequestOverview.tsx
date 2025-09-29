import React from 'react';

interface RequestOverviewProps {
  method: string;
  url: string;
}

export const RequestOverview: React.FC<RequestOverviewProps> = ({ method, url }) => {
  return (
    <div className="section">
      <div className="section-header">
        🔍 Request Overview
      </div>
      <div className="section-content">
        <div className="grid">
          <div className="field">
            <label htmlFor="request-method">Method:</label>
            <input
              id="request-method"
              type="text"
              value={method}
              readOnly
              className="readonly-input"
            />
          </div>
          <div className="field">
            <label htmlFor="request-url">URL:</label>
            <input
              id="request-url"
              type="text"
              value={url}
              readOnly
              className="readonly-input"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
