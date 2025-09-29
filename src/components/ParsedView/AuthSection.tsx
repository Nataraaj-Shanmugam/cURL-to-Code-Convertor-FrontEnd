import React from 'react';
import type { AuthItem, ParsedItem } from '../../types';
import { ItemRow } from '../shared/ItemRow';

interface AuthSectionProps {
  auth: AuthItem[];
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, field: keyof ParsedItem, value: string | boolean) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

export const AuthSection: React.FC<AuthSectionProps> = ({
  auth,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
  onAdd
}) => {
  return (
    <div className="parsed-section">
      <div className="section-header" onClick={onToggle}>
        <h3>Authentication</h3>
        <span>{expanded ? '−' : '+'}</span>
      </div>
      {expanded && (
        <div className="section-content">
          {auth.map((authItem) => (
            <ItemRow
              key={authItem.id}
              item={authItem}
              onUpdate={(id, field, value) =>
                onUpdate(id, field as keyof ParsedItem, value)
              }
              onRemove={onRemove}
            />
          ))}
          <button onClick={onAdd}>Add Auth Item</button>
        </div>
      )}
    </div>
  );
};
