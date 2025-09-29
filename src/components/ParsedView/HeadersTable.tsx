import React from 'react';
import type { HeaderItem, ParsedItem } from '../../types';
import { ItemRow } from '../shared/ItemRow';

interface HeadersTableProps {
  headers: HeaderItem[];
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, field: keyof ParsedItem, value: string | boolean) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

export const HeadersTable: React.FC<HeadersTableProps> = ({
  headers,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
  onAdd
}) => {
  if (!headers || headers.length === 0) {
    return <p>No headers</p>;
  }
  return (
    <div className="parsed-section">
      <div className="section-header" onClick={onToggle}>
        <h3>Headers</h3>
        <span>{expanded ? '−' : '+'}</span>
      </div>
      {expanded && (
        <div className="section-content">
          {headers.map((header) => (
            <ItemRow
              key={header.id}
              item={header}
              onUpdate={(id, field, value) =>
                onUpdate(id, field as keyof ParsedItem, value)
              }
              onRemove={onRemove}
            />
          ))}
          <button onClick={onAdd}>Add Header</button>
        </div>
      )}
    </div>
  );
};
