import React from 'react';
import type { ParsedItem } from '../../types';

interface ItemRowProps {
  item: ParsedItem;
  onUpdate: (
    id: string,
    field: keyof ParsedItem,
    value: string | boolean
  ) => void;
  onRemove: (id: string) => void;
}

export const ItemRow: React.FC<ItemRowProps> = ({ item, onUpdate, onRemove }) => {
  return (
    <div className="item-row">
      {/* Enabled checkbox */}
      <input
        type="checkbox"
        checked={item.enabled}
        onChange={(e) => onUpdate(item.id, 'enabled', e.target.checked)}
      />

      {/* Key field */}
      <input
        type="text"
        value={item.key}
        placeholder="Key"
        onChange={(e) => onUpdate(item.id, 'key', e.target.value)}
      />

      {/* Value field */}
      <input
        type="text"
        value={item.value}
        placeholder="Value"
        onChange={(e) => onUpdate(item.id, 'value', e.target.value)}
      />

      {/* Remove button */}
      <button
        className="remove-btn"
        onClick={() => onRemove(item.id)}
        aria-label="Remove item"
      >
        ✖
      </button>
    </div>
  );
};
