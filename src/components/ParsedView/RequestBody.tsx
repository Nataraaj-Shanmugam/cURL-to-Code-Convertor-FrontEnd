import React from 'react';

interface RequestBodyProps {
  body?: string;
  expanded: boolean;
  onToggle: () => void;
  onBodyChange: (body: string) => void;
}

export const RequestBody: React.FC<RequestBodyProps> = ({
  body,
  expanded,
  onToggle,
  onBodyChange
}) => {
  return (
    <div className="parsed-section">
      <div className="section-header" onClick={onToggle}>
        <h3>Request Body</h3>
        <span>{expanded ? '−' : '+'}</span>
      </div>
      {expanded && (
        <div className="section-content">
          <textarea
            className="request-body-input"
            value={body || ''}
            onChange={(e) => onBodyChange(e.target.value)}
            rows={6}
          />
        </div>
      )}
    </div>
  );
};
