import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useParsedCurlEditor, VALID_SECTIONS } from '@/lib/hooks/useParsedCurlEditor';

// Mock window.confirm for deletion tests
vi.stubGlobal('confirm', vi.fn(() => true));

const sampleParsedData = {
  method: 'POST',
  url: 'https://api.example.com/users',
  base_url: 'https://api.example.com',
  endpoint: '/users',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer token123',
  },
  query_params: {
    page: '1',
    limit: '10',
  },
  data: {
    name: 'John',
    email: 'john@example.com',
    address: {
      city: 'New York',
      zip: '10001',
    },
  },
  cookies: {
    session_id: 'abc',
  },
  flags: {
    verbose: true,
    silent: false,
    insecure: true,
  },
};

describe('useParsedCurlEditor', () => {
  describe('initialization', () => {
    it('should initialize with parsed data', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      expect(result.current.parsed.method).toBe('POST');
      expect(result.current.parsed.base_url).toBe('https://api.example.com');
      expect(result.current.parsed.endpoint).toBe('/users');
    });

    it('should parse JSON string body data into object', () => {
      const dataWithStringBody = {
        ...sampleParsedData,
        data: '{"name": "John", "age": 30}',
      };

      const { result } = renderHook(() => useParsedCurlEditor(dataWithStringBody));

      expect(typeof result.current.parsed.data).toBe('object');
      expect(result.current.parsed.data.name).toBe('John');
      expect(result.current.parsed.data.age).toBe(30);
    });

    it('should keep non-JSON string body as string', () => {
      const dataWithFormBody = {
        ...sampleParsedData,
        data: 'name=John&email=john@example.com',
      };

      const { result } = renderHook(() => useParsedCurlEditor(dataWithFormBody));

      expect(typeof result.current.parsed.data).toBe('string');
    });

    it('should handle null/undefined initialData', () => {
      const { result } = renderHook(() => useParsedCurlEditor(null));

      expect(result.current.parsed).toBeDefined();
    });

    it('should auto-open sections with valid data', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      expect(result.current.openSections).toContain('request');
      expect(result.current.openSections).toContain('headers');
      expect(result.current.openSections).toContain('query_params');
    });
  });

  describe('hasValidData', () => {
    it('should return true for objects with meaningful values', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      expect(result.current.hasValidData({ key: 'value' })).toBe(true);
    });

    it('should return false for empty objects', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      expect(result.current.hasValidData({})).toBe(false);
    });

    it('should return false for null/undefined', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      expect(result.current.hasValidData(null)).toBe(false);
      expect(result.current.hasValidData(undefined)).toBe(false);
    });

    it('should return false for objects with all empty/null values', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      expect(result.current.hasValidData({ a: null, b: '', c: false })).toBe(false);
    });

    it('should return true for non-empty arrays', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      expect(result.current.hasValidData(['item'])).toBe(true);
    });

    it('should return false for empty arrays', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      expect(result.current.hasValidData([])).toBe(false);
    });
  });

  describe('hasActiveFlags / getActiveFlags', () => {
    it('should detect active flags', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      expect(result.current.hasActiveFlags({ verbose: true, silent: false })).toBe(true);
    });

    it('should return false when no flags are active', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      expect(result.current.hasActiveFlags({ verbose: false, silent: false })).toBe(false);
    });

    it('should return false for null/undefined', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      expect(result.current.hasActiveFlags(null)).toBe(false);
      expect(result.current.hasActiveFlags(undefined)).toBe(false);
    });

    it('should return only active flag names', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      const flags = result.current.getActiveFlags({ verbose: true, silent: false, insecure: true });
      expect(flags).toContain('verbose');
      expect(flags).toContain('insecure');
      expect(flags).not.toContain('silent');
    });
  });

  describe('selection management', () => {
    it('should toggle item selection', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      act(() => {
        result.current.toggleSelect('headers.Content-Type');
      });

      expect(result.current.selected.has('headers.Content-Type')).toBe(true);

      act(() => {
        result.current.toggleSelect('headers.Content-Type');
      });

      expect(result.current.selected.has('headers.Content-Type')).toBe(false);
    });

    it('should select multiple items', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      act(() => {
        result.current.toggleSelect('headers.Content-Type');
      });

      act(() => {
        result.current.toggleSelect('headers.Authorization');
      });

      expect(result.current.selected.size).toBe(2);
    });
  });

  describe('editing', () => {
    it('should enter edit mode for a field', async () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      await act(async () => {
        await result.current.toggleEdit('headers.Content-Type', 'application/json');
      });

      expect(result.current.editing['headers.Content-Type']).toBe(true);
      expect(result.current.editedValues['headers.Content-Type']).toBe('application/json');
    });

    it('should save edit and exit edit mode', async () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      // Enter edit mode
      await act(async () => {
        await result.current.toggleEdit('headers.Content-Type', 'application/json');
      });

      // Change value
      act(() => {
        result.current.handleEditChange('headers.Content-Type', 'text/plain');
      });

      // Save (toggle again)
      await act(async () => {
        await result.current.toggleEdit('headers.Content-Type', 'application/json');
      });

      expect(result.current.editing['headers.Content-Type']).toBeUndefined();
      expect(result.current.parsed.headers['Content-Type']).toBe('text/plain');
    });
  });

  describe('deletion', () => {
    it('should delete selected items', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      act(() => {
        result.current.toggleSelect('query_params.page');
      });

      act(() => {
        result.current.deleteSelected();
      });

      expect(result.current.parsed.query_params.page).toBeUndefined();
      expect(result.current.selected.size).toBe(0);
    });

    it('should delete a single item', async () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      await act(async () => {
        await result.current.deleteSingle('query_params.limit');
      });

      expect(result.current.parsed.query_params.limit).toBeUndefined();
    });

    it('should delete an entire section', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      act(() => {
        result.current.deleteSection('cookies');
      });

      expect(result.current.parsed.cookies).toBeUndefined();
    });

    it('should not delete when no items selected', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));
      const beforeParsed = JSON.stringify(result.current.parsed);

      act(() => {
        result.current.deleteSelected();
      });

      expect(JSON.stringify(result.current.parsed)).toBe(beforeParsed);
    });
  });

  describe('adding entries', () => {
    it('should open add entry dialog for a section', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      act(() => {
        result.current.handleAddEntry('headers');
      });

      expect(result.current.showAddDialog).toBe(true);
      expect(result.current.addDialogSection).toBe('headers');
    });

    it('should save new entry to a section', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      act(() => {
        result.current.handleAddEntry('headers');
      });

      act(() => {
        result.current.setNewKey('X-Custom-Header');
        result.current.setNewValue('custom-value');
      });

      act(() => {
        result.current.saveNewEntry();
      });

      expect(result.current.parsed.headers['X-Custom-Header']).toBe('custom-value');
      expect(result.current.showAddDialog).toBe(false);
    });

    it('should set boolean true for flags section entries', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      act(() => {
        result.current.handleAddEntry('flags');
      });

      act(() => {
        result.current.setNewKey('compressed');
        result.current.setNewValue('');
      });

      act(() => {
        result.current.saveNewEntry();
      });

      expect(result.current.parsed.flags.compressed).toBe(true);
    });

    it('should not save entry without key', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      act(() => {
        result.current.handleAddEntry('headers');
      });

      act(() => {
        result.current.setNewKey('');
        result.current.setNewValue('value');
      });

      act(() => {
        result.current.saveNewEntry();
      });

      // Dialog should still be open since save was skipped
      expect(result.current.showAddDialog).toBe(true);
    });
  });

  describe('section management', () => {
    it('should detect missing sections', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      const missing = result.current.getMissingSections();
      const missingKeys = missing.map(([key]) => key);

      // These sections should be missing since they're not in sampleParsedData
      expect(missingKeys).toContain('form_data');
      expect(missingKeys).toContain('auth_config');
      expect(missingKeys).toContain('network_config');
    });

    it('should add a new section', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      act(() => {
        result.current.handleAddSection();
      });

      expect(result.current.showNewSectionDialog).toBe(true);

      act(() => {
        result.current.setNewSectionName('form_data');
      });

      act(() => {
        result.current.saveNewSection();
      });

      expect(result.current.parsed.form_data).toBeDefined();
      expect(result.current.openSections).toContain('form_data');
    });

    it('should initialize flags section as empty object', () => {
      const minData = { method: 'GET', base_url: 'https://a.com', endpoint: '/a' };
      const { result } = renderHook(() => useParsedCurlEditor(minData));

      act(() => result.current.handleAddSection());
      act(() => result.current.setNewSectionName('flags'));
      act(() => result.current.saveNewSection());

      expect(result.current.parsed.flags).toEqual({});
    });

    it('should initialize path_parameters as empty array', () => {
      const minData = { method: 'GET', base_url: 'https://a.com', endpoint: '/a' };
      const { result } = renderHook(() => useParsedCurlEditor(minData));

      act(() => result.current.handleAddSection());
      act(() => result.current.setNewSectionName('path_parameters'));
      act(() => result.current.saveNewSection());

      expect(Array.isArray(result.current.parsed.path_parameters)).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset to original data', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      // Make changes
      act(() => {
        result.current.toggleSelect('headers.Content-Type');
      });

      act(() => {
        result.current.deleteSelected();
      });

      expect(result.current.parsed.headers['Content-Type']).toBeUndefined();

      // Reset
      act(() => {
        result.current.handleReset();
      });

      expect(result.current.parsed.headers['Content-Type']).toBe('application/json');
      expect(result.current.selected.size).toBe(0);
    });
  });

  describe('body collapse/expand', () => {
    it('should toggle body node collapse', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      act(() => {
        result.current.toggleBodyCollapse('data.address');
      });

      expect(result.current.bodyCollapsed['data.address']).toBe(true);

      act(() => {
        result.current.toggleBodyCollapse('data.address');
      });

      expect(result.current.bodyCollapsed['data.address']).toBe(false);
    });

    it('should expand/collapse all body nodes', () => {
      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      // Collapse all
      act(() => {
        result.current.handleBodyExpandCollapseAll();
      });

      expect(result.current.allExpanded).toBe(true);

      // Expand all
      act(() => {
        result.current.handleBodyExpandCollapseAll();
      });

      expect(result.current.allExpanded).toBe(false);
    });
  });

  // Note: local generateRestAssuredCode / handleGenerateCode / copyCode were dead code
  // and have been removed. Code generation is handled by CodeGenerationDialog via the backend.

  describe('export', () => {
    it('should export data as JSON', () => {
      const mockClick = vi.fn();
      const mockCreateObjectURL = vi.fn(() => 'blob:url');
      const mockRevokeObjectURL = vi.fn();

      URL.createObjectURL = mockCreateObjectURL;
      URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock createElement only for 'a' tags to capture download link
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          return { href: '', download: '', click: mockClick } as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tag);
      });

      const { result } = renderHook(() => useParsedCurlEditor(sampleParsedData));

      act(() => {
        result.current.exportData();
      });

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  describe('VALID_SECTIONS constant', () => {
    it('should contain all expected sections', () => {
      const expectedKeys = [
        'query_params', 'headers', 'cookies', 'form_data', 'auth',
        'auth_config', 'network_config', 'ssl_config', 'proxy_config',
        'transfer_config', 'protocol_config', 'output_config',
        'ftp_config', 'mail_config', 'flags', 'misc_flags',
      ];

      expectedKeys.forEach(key => {
        expect(VALID_SECTIONS).toHaveProperty(key);
      });
    });

    it('should have human-readable labels for all sections', () => {
      Object.values(VALID_SECTIONS).forEach(label => {
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      });
    });
  });
});
