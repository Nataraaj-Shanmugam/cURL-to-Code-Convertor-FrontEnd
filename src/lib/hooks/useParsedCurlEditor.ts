import { useState, useEffect, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

export interface EditingState {
  [key: string]: boolean;
}

export interface EditedValues {
  [key: string]: any;
}

export interface CollapsedState {
  [key: string]: boolean;
}

export interface HistoryEntry {
  parsed: any;
  timestamp: number;
}

export const VALID_SECTIONS = {
  'query_params': 'Query Parameters',
  'headers': 'Headers',
  'cookies': 'Cookies',
  'form_data': 'Form Data',
  'auth': 'Authentication',
  'network_config': 'Network Configuration',
  'ssl_config': 'SSL/TLS Configuration',
  'flags': 'Flags'
} as const;

const EXCLUDED_KEYS = [
  'method', 'url', 'base_url', 'endpoint', 'path_template',
  'raw_data', 'all_options', 'meta', 'user_agent', 'referer', 'proxy'
] as const;

const NON_BODY_METHODS = ['GET', 'DELETE', 'HEAD', 'OPTIONS'] as const;

const MAX_HISTORY = 5;

// ============================================================================
// HELPER FUNCTIONS (Pure, no side effects)
// ============================================================================

export const hasValidData = (data: any): boolean => {
  if (!data || typeof data !== 'object') return false;
  if (Array.isArray(data)) return data.length > 0;

  const entries = Object.entries(data);
  if (entries.length === 0) return false;

  return entries.some(([_, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (typeof value === 'object' && Object.keys(value).length === 0) return false;
    return true;
  });
};

export const hasActiveFlags = (flagsObj: any): boolean => {
  if (!flagsObj || typeof flagsObj !== 'object') return false;
  return Object.values(flagsObj).some((val) => val === true);
};

export const getActiveFlags = (flagsObj: any): string[] => {
  if (!flagsObj || typeof flagsObj !== 'object') return [];
  return Object.entries(flagsObj)
    .filter(([_, val]) => val === true)
    .map(([key]) => key);
};

export const shouldExcludeKey = (key: string): boolean => {
  return EXCLUDED_KEYS.includes(key as any);
};

export const isNonBodyMethod = (method: string): boolean => {
  return NON_BODY_METHODS.includes(method?.toUpperCase() as any);
};

const getValidSectionsFromData = (data: any): string[] => {
  const valid: string[] = [];

  Object.keys(data).forEach(key => {
    if (shouldExcludeKey(key)) return;

    const value = data[key];
    if (value === null || value === undefined) return;
    if (typeof value === 'string' && value.trim() === '') return;

    if (key === 'path_parameters') {
      if (Array.isArray(value) && value.length > 0) valid.push(key);
    } else if (key === 'flags') {
      if (hasActiveFlags(value)) valid.push(key);
    } else if (key === 'ssl_config') {
      if (value && typeof value === 'object' && Object.keys(value).some(k => value[k] === true)) {
        valid.push(key);
      }
    } else if (key === 'data') {
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0) {
          valid.push(key);
        }
      } else if (value) {
        valid.push(key);
      }
    } else if (hasValidData(value)) {
      valid.push(key);
    }
  });

  return valid;
};

const deepClone = (obj: any): any => JSON.parse(JSON.stringify(obj));

const updateNestedValue = (obj: any, path: string, value: any): any => {
  const keys = path.split('.');
  const result = deepClone(obj);
  let current = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (key && (!current[key] || typeof current[key] !== 'object')) {
      current[key] = {};
    }
    if (key) {
      current = current[key];
    }
  }

  const lastKey = keys[keys.length - 1];
  if (lastKey) {
    current[lastKey] = value;
  }
  return result;
};

const deleteNestedValue = (obj: any, path: string): any => {
  const keys = path.split('.');
  const result = deepClone(obj);
  let current = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (key && !current[key]) return result;
    if (key) {
      current = current[key];
    }
  }

  const lastKey = keys[keys.length - 1];
  if (lastKey) {
    delete current[lastKey];
  }
  return result;
};

// ============================================================================
// MAIN HOOK
// ============================================================================

export const useParsedCurlEditor = (initialData: any) => {
  // Core state
  const [originalParsed] = useState(initialData || {});
  const [parsed, setParsed] = useState(deepClone(initialData || {}));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // UI state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditingState>({});
  const [editedValues, setEditedValues] = useState<EditedValues>({});
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [bodyCollapsed, setBodyCollapsed] = useState<CollapsedState>({});
  const [allExpanded, setAllExpanded] = useState(false);

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogSection, setAddDialogSection] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showNewSectionDialog, setShowNewSectionDialog] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

  // Initialize history
  useEffect(() => {
    if (initialData) {
      setHistory([{ parsed: deepClone(initialData), timestamp: Date.now() }]);
      setHistoryIndex(0);
    }
  }, []);

  // Initialize open sections
  useEffect(() => {
    const defaultSections = getValidSectionsFromData(parsed);
    const sectionsToOpen = [...defaultSections];

    const hasRequestData = ['method', 'url', 'base_url', 'endpoint', 'path_template'].some(
      key => parsed[key] !== undefined && parsed[key] !== null && parsed[key] !== ''
    );

    if (hasRequestData) sectionsToOpen.unshift('request');
    if (parsed.user_agent || parsed.referer || parsed.proxy) sectionsToOpen.push('context');

    setOpenSections(sectionsToOpen);
  }, []);

  // Add to history
  const addToHistory = useCallback((newParsed: any) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ parsed: deepClone(newParsed), timestamp: Date.now() });
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const historyEntry = history[newIndex];
      if (historyEntry) {
        setHistoryIndex(newIndex);
        setParsed(deepClone(historyEntry.parsed));
      }
    }
  }, [historyIndex, history]);
  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const historyEntry = history[newIndex];
      if (historyEntry) {
        setHistoryIndex(newIndex);
        setParsed(deepClone(historyEntry.parsed));
      }
    }
  }, [historyIndex, history]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Get valid sections
  const getValidSections = useCallback((): string[] => {
    return getValidSectionsFromData(parsed);
  }, [parsed]);

  // Get missing sections
  const getMissingSections = useCallback(() => {
    return Object.entries(VALID_SECTIONS).filter(([key]) => {
      const sectionData = parsed[key];

      if (key === 'flags') return !hasActiveFlags(sectionData);
      if (key === 'ssl_config') {
        return !(sectionData && typeof sectionData === 'object' &&
          Object.keys(sectionData).some(k => sectionData[k] === true));
      }

      if (!sectionData) return true;
      if (typeof sectionData === 'object' && !Array.isArray(sectionData)) {
        return Object.keys(sectionData).length === 0;
      }
      if (Array.isArray(sectionData)) return sectionData.length === 0;
      return false;
    });
  }, [parsed]);

  // Reset
  const handleReset = useCallback(() => {
    if (window.confirm('Are you sure you want to reset all changes?')) {
      const resetParsed = deepClone(originalParsed);
      setParsed(resetParsed);

      setHistory([{ parsed: resetParsed, timestamp: Date.now() }]);
      setHistoryIndex(0);

      const defaultSections = getValidSectionsFromData(resetParsed);
      const sectionsToOpen = [...defaultSections];
      const hasRequestData = ['method', 'url', 'base_url', 'endpoint', 'path_template'].some(
        key => resetParsed[key] !== undefined && resetParsed[key] !== null && resetParsed[key] !== ''
      );
      if (hasRequestData) sectionsToOpen.unshift('request');
      if (resetParsed.user_agent || resetParsed.referer || resetParsed.proxy) {
        sectionsToOpen.push('context');
      }

      setOpenSections(sectionsToOpen);
      setSelected(new Set());
      setEditing({});
      setEditedValues({});
      setBodyCollapsed({});
    }
  }, [originalParsed]);

  // Delete section
  const deleteSection = useCallback((sectionKey: string) => {
    const sectionName = VALID_SECTIONS[sectionKey as keyof typeof VALID_SECTIONS] || sectionKey;
    if (window.confirm(`Delete the entire "${sectionName}" section?`)) {
      const newParsed = { ...parsed };
      delete newParsed[sectionKey];
      setParsed(newParsed);
      addToHistory(newParsed);
      setOpenSections(prev => prev.filter(s => s !== sectionKey));
    }
  }, [parsed, addToHistory]);

  // Toggle select
  const toggleSelect = useCallback((path: string) => {
    setSelected(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(path)) {
        newSelected.delete(path);
      } else {
        newSelected.add(path);
      }
      return newSelected;
    });
  }, []);

  // Toggle edit
  const toggleEdit = useCallback((path: string, currentValue: any) => {
    if (editing[path]) {
      let finalValue = editedValues[path] ?? currentValue;
      if (typeof finalValue === 'string') {
        try {
          finalValue = JSON.parse(finalValue);
        } catch {
          // Keep as string
        }
      }

      const newParsed = updateNestedValue(parsed, path, finalValue);
      setParsed(newParsed);
      addToHistory(newParsed);

      setEditing(prev => {
        const newEditing = { ...prev };
        delete newEditing[path];
        return newEditing;
      });
    } else {
      setEditing(prev => ({ ...prev, [path]: true }));
      setEditedValues(prev => ({ ...prev, [path]: currentValue }));
    }
  }, [editing, editedValues, parsed, addToHistory]);

  // Delete selected
  const deleteSelected = useCallback(() => {
    if (selected.size === 0) return;

    let newParsed = deepClone(parsed);
    selected.forEach(path => {
      newParsed = deleteNestedValue(newParsed, path);
    });

    setParsed(newParsed);
    addToHistory(newParsed);
    setSelected(new Set());
  }, [selected, parsed, addToHistory]);

  // Delete single
  const deleteSingle = useCallback((path: string) => {
    const newParsed = deleteNestedValue(parsed, path);
    setParsed(newParsed);
    addToHistory(newParsed);
    setSelected(prev => {
      const newSelected = new Set(prev);
      newSelected.delete(path);
      return newSelected;
    });
  }, [parsed, addToHistory]);

  // Handle edit change
  const handleEditChange = useCallback((path: string, value: any) => {
    setEditedValues(prev => ({ ...prev, [path]: value }));
  }, []);

  // Export data
  const exportData = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dataStr = JSON.stringify(parsed, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `parsed-curl-${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [parsed]);

  // Handle add entry
  const handleAddEntry = useCallback((section: string) => {
    setAddDialogSection(section);
    setNewKey("");
    setNewValue("");
    setShowAddDialog(true);
  }, []);

  // Save new entry
  const saveNewEntry = useCallback(() => {
    if (!newKey.trim()) return;

    const newParsed = deepClone(parsed);
    if (!newParsed[addDialogSection]) {
      newParsed[addDialogSection] = {};
    }

    if (addDialogSection === 'flags' || addDialogSection === 'ssl_config') {
      newParsed[addDialogSection][newKey] = true;
    } else {
      newParsed[addDialogSection][newKey] = newValue;
    }

    setParsed(newParsed);
    addToHistory(newParsed);

    if (!openSections.includes(addDialogSection)) {
      setOpenSections(prev => [...prev, addDialogSection]);
    }

    setShowAddDialog(false);
    setNewKey("");
    setNewValue("");
  }, [newKey, newValue, parsed, addDialogSection, openSections, addToHistory]);

  // Handle add section
  const handleAddSection = useCallback(() => {
    const missingSections = getMissingSections();
    if (missingSections.length === 0) {
      alert('All standard sections are already present!');
      return;
    }
    setShowNewSectionDialog(true);
    setNewSectionName("");
  }, [getMissingSections]);

  // Save new section
  const saveNewSection = useCallback(() => {
    if (!newSectionName.trim()) return;

    const newParsed = deepClone(parsed);

    if (newSectionName === 'flags' || newSectionName === 'ssl_config') {
      newParsed[newSectionName] = {};
    } else if (newSectionName === 'path_parameters') {
      newParsed[newSectionName] = [];
    } else if (newSectionName === 'auth') {
      newParsed[newSectionName] = '';
    } else {
      newParsed[newSectionName] = {};
    }

    setParsed(newParsed);
    addToHistory(newParsed);

    if (!openSections.includes(newSectionName)) {
      setOpenSections(prev => [...prev, newSectionName]);
    }

    setShowNewSectionDialog(false);
    setNewSectionName("");
  }, [newSectionName, parsed, openSections, addToHistory]);

  // Toggle body collapse
  const toggleBodyCollapse = useCallback((path: string) => {
    setBodyCollapsed(prev => ({ ...prev, [path]: !prev[path] }));
  }, []);

  // Expand/collapse all body
  const handleBodyExpandCollapseAll = useCallback(() => {
    if (allExpanded) {
      const allPaths: string[] = [];
      const collectPaths = (obj: any, currentPath: string = 'data') => {
        if (typeof obj === 'object' && obj !== null) {
          if (Array.isArray(obj)) {
            obj.forEach((item, idx) => {
              const path = `${currentPath}[${idx}]`;
              allPaths.push(path);
              collectPaths(item, path);
            });
          } else {
            Object.keys(obj).forEach(key => {
              const path = `${currentPath}.${key}`;
              allPaths.push(path);
              collectPaths(obj[key], path);
            });
          }
        }
      };
      collectPaths(parsed.data);

      const collapsed: CollapsedState = {};
      allPaths.forEach(path => { collapsed[path] = true; });
      setBodyCollapsed(collapsed);
    } else {
      setBodyCollapsed({});
    }
    setAllExpanded(!allExpanded);
  }, [allExpanded, parsed.data]);

  // Check if POJO should be disabled
  const isPojoDisabled = useCallback(() => {
    return isNonBodyMethod(parsed.method);
  }, [parsed.method]);

  return {
    // State
    parsed,
    selected,
    editing,
    editedValues,
    showAddDialog,
    addDialogSection,
    newKey,
    newValue,
    showNewSectionDialog,
    newSectionName,
    openSections,
    bodyCollapsed,
    allExpanded,
    history,
    historyIndex,
    canUndo,
    canRedo,

    // Setters
    setNewKey,
    setNewValue,
    setShowAddDialog,
    setShowNewSectionDialog,
    setNewSectionName,
    setOpenSections,
    setSelected,

    // Actions
    handleReset,
    deleteSection,
    toggleSelect,
    toggleEdit,
    deleteSelected,
    deleteSingle,
    handleEditChange,
    exportData,
    handleAddEntry,
    saveNewEntry,
    handleAddSection,
    saveNewSection,
    toggleBodyCollapse,
    handleBodyExpandCollapseAll,
    undo,
    redo,

    // Helpers
    hasValidData,
    hasActiveFlags,
    getActiveFlags,
    getMissingSections,
    getValidSections,
    isPojoDisabled,
  };
};