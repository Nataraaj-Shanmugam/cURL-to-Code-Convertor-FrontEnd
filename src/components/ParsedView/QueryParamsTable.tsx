import React from 'react';
import type { ParsedItem } from '../../types';
import { ItemRow } from '../shared/ItemRow';

interface QueryParamsTableProps {
  queryParams: ParsedItem[];
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, field: keyof ParsedItem, value: string | boolean) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

export const QueryParamsTable: React.FC<QueryParamsTableProps> = ({
  queryParams,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
  onAdd
}) => {
  return (
    <div className="parsed-section">
      <div className="section-header" onClick={onToggle}>
        <h3>Query Parameters</h3>
        <span>{expanded ? '−' : '+'}</span>
      </div>
      {expanded && (
        <div className="section-content">
          {queryParams.map((param) => (
            <ItemRow
              key={param.id}
              item={param}
              onUpdate={(id, field, value) =>
                onUpdate(id, field as keyof ParsedItem, value)
              }
              onRemove={onRemove}
            />
          ))}
          <button onClick={onAdd}>Add Parameter</button>
        </div>
      )}
    </div>
  );
};
