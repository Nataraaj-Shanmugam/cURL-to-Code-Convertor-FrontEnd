import React from 'react';
import { RequestOverview } from './RequestOverview';
import { HeadersTable } from './HeadersTable';
import { QueryParamsTable } from './QueryParamsTable';
import { RequestBody } from './RequestBody';
import { AuthSection } from './AuthSection';
import type { ParsedItem } from '../../types';
import { ParsedRequest, KeyValue } from '../../services/api';

type ParsedKeys = 'headers' | 'params' | 'auth' | 'body';

interface ParsedViewContainerProps {
  parsedData: ParsedRequest;
  requestBody?: string;
  expandedSections: Record<ParsedKeys, boolean>;
  onToggleSection: (section: ParsedKeys) => void;
  onUpdateItem: (
    type: Exclude<ParsedKeys, 'body'>,
    id: string,
    field: keyof ParsedItem,
    value: string | boolean
  ) => void;
  onRemoveItem: (type: Exclude<ParsedKeys, 'body'>, id: string) => void;
  onAddItem: (type: Exclude<ParsedKeys, 'body'>) => void;
  onBodyChange: (body: string) => void;
}

// helper: normalize KeyValue[] → ParsedItem[]
const toParsedItems = (items: KeyValue[] | undefined, prefix: string): ParsedItem[] =>
  (items ?? []).map((item, idx) => ({
    id: `${prefix}-${idx}`, // generate a unique id
    key: item.key,
    value: item.value,
    enabled: true,          // default since API doesn’t provide it
  }));

export const ParsedViewContainer: React.FC<ParsedViewContainerProps> = ({
  parsedData,
  requestBody,
  expandedSections,
  onToggleSection,
  onUpdateItem,
  onRemoveItem,
  onAddItem,
  onBodyChange
}) => {
  return (
    <div className="parsed-sections">
      {/* Overview */}
      <RequestOverview method={parsedData.method} url={parsedData.base_url} />

      {/* Headers */}
      <HeadersTable
        headers={toParsedItems(parsedData.headers, 'header')}
        expanded={expandedSections.headers}
        onToggle={() => onToggleSection('headers')}
        onUpdate={(id, field, value) =>
          onUpdateItem('headers', id, field as keyof ParsedItem, value)
        }
        onRemove={(id) => onRemoveItem('headers', id)}
        onAdd={() => onAddItem('headers')}
      />

      {/* Query Parameters */}
      <QueryParamsTable
        queryParams={toParsedItems(parsedData.query_params, 'param')}
        expanded={expandedSections.params}
        onToggle={() => onToggleSection('params')}
        onUpdate={(id, field, value) =>
          onUpdateItem('params', id, field as keyof ParsedItem, value)
        }
        onRemove={(id) => onRemoveItem('params', id)}
        onAdd={() => onAddItem('params')}
      />

      {/* Auth
      <AuthSection
        auth={toParsedItems(parsedData.auth, 'auth')}
        expanded={expandedSections.auth}
        onToggle={() => onToggleSection('auth')}
        onUpdate={(id, field, value) =>
          onUpdateItem('auth', id, field as keyof ParsedItem, value)
        }
        onRemove={(id) => onRemoveItem('auth', id)}
        onAdd={() => onAddItem('auth')}
      /> */}

      {/* Body */}
      <RequestBody
        body={requestBody}
        expanded={expandedSections.body}
        onToggle={() => onToggleSection('body')}
        onBodyChange={onBodyChange}
      />
    </div>
  );
};
