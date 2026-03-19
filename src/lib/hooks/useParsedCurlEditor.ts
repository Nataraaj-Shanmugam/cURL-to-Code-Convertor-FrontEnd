import { useEffect, useCallback } from "react";
import type { ParsedCurl } from "@/types/curl";
import { useEditorState } from "./useEditorState";
import { useBodyApi } from "./useBodyApi";
import { useSectionManager, VALID_SECTIONS, getParsedField } from "./useSectionManager";

export { VALID_SECTIONS, getParsedField };

// ── helpers ──────────────────────────────────────────────────────────────────

const isMeaningfulValue = (value: unknown): boolean => {
  if (value === null || value === undefined || value === false || value === 0) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return false;
    return keys.some(k => isMeaningfulValue(obj[k]));
  }
  return true;
};

const hasValidData = (data: unknown): boolean => {
  if (!data) return false;
  if (typeof data !== "object") return false;
  if (Array.isArray(data)) return data.length > 0;
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) return false;
  return entries.some(([, value]) => isMeaningfulValue(value));
};

const hasActiveFlags = (flagsObj: unknown): boolean => {
  if (!flagsObj || typeof flagsObj !== "object") return false;
  return Object.values(flagsObj as Record<string, unknown>).some(val => val === true);
};

const getActiveFlags = (flagsObj: unknown): string[] => {
  if (!flagsObj || typeof flagsObj !== "object") return [];
  return Object.entries(flagsObj as Record<string, unknown>)
    .filter(([, val]) => val === true)
    .map(([key]) => key);
};

// ── hook ─────────────────────────────────────────────────────────────────────

export const useParsedCurlEditor = (initialData: ParsedCurl | undefined) => {
  const editorState = useEditorState(initialData);
  const {
    originalParsed,
    parsed,
    setParsed,
    resetParsed,
    undo,
    redo,
    canUndo,
    canRedo,
    selected,
    setSelected,
    editing,
    setEditing,
    editedValues,
    setEditedValues,
    bodyCollapsed,
    setBodyCollapsed,
    allExpanded,
    setAllExpanded,
    toggleSelect,
    handleEditChange,
    toggleBodyCollapse,
  } = editorState;

  const bodyApi = useBodyApi(() => parsed.data);
  const { bodyApiLoading, bodyApiError, editBodyNode, deleteBodyNode } = bodyApi;

  const sectionManager = useSectionManager(parsed, setParsed, hasActiveFlags, hasValidData);
  const {
    openSections,
    setOpenSections,
    showAddDialog,
    setShowAddDialog,
    addDialogSection,
    newKey,
    setNewKey,
    newValue,
    setNewValue,
    showNewSectionDialog,
    setShowNewSectionDialog,
    newSectionName,
    setNewSectionName,
    computeOpenSections,
    getMissingSections,
    deleteSection,
    handleAddEntry,
    saveNewEntry,
    handleAddSection,
    saveNewSection,
  } = sectionManager;

  // Initialize open sections on mount
  useEffect(() => {
    setOpenSections(computeOpenSections(parsed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── actions ────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    const resetState = structuredClone(originalParsed);
    resetParsed(resetState);
    setOpenSections(computeOpenSections(resetState));
    setSelected(new Set());
    setEditing({});
    setEditedValues({});
    setBodyCollapsed({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalParsed, resetParsed, computeOpenSections]);

  const toggleEdit = useCallback(
    async (path: string, currentValue: unknown) => {
      if (editing[path]) {
        let finalValue: unknown = editedValues[path] ?? currentValue;
        if (typeof finalValue === "string") {
          try {
            finalValue = JSON.parse(finalValue) as unknown;
          } catch {
            // Keep as string
          }
        }

        if (path.startsWith("data.")) {
          const success = await editBodyNode(path, finalValue);
          if (!success) return;
        }

        const keys = path.split(".");
        const newParsed = structuredClone(parsed);
        let obj: unknown = newParsed;
        for (let i = 0; i < keys.length - 1; i++) {
          const key = keys[i];
          if (key && obj && typeof obj === "object")
            obj = (obj as Record<string, unknown>)[key];
          else return;
        }
        const lastKey = keys[keys.length - 1];
        if (lastKey && obj && typeof obj === "object")
          (obj as Record<string, unknown>)[lastKey] = finalValue;

        setParsed(newParsed);
        const newEditing = { ...editing };
        delete newEditing[path];
        setEditing(newEditing);
      } else {
        setEditing({ ...editing, [path]: true });
        setEditedValues({ ...editedValues, [path]: currentValue });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, editedValues, parsed, editBodyNode, setParsed],
  );

  const deleteSelected = useCallback(() => {
    if (selected.size === 0) return;
    const newParsed = structuredClone(parsed);
    selected.forEach(path => {
      const keys = path.split(".");
      let obj: unknown = newParsed;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (key && obj && typeof obj === "object")
          obj = (obj as Record<string, unknown>)[key];
        else return;
      }
      const lastKey = keys[keys.length - 1];
      if (lastKey && obj && typeof obj === "object")
        delete (obj as Record<string, unknown>)[lastKey];
    });
    setParsed(newParsed);
    setSelected(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, parsed, setParsed]);

  const deleteSingle = useCallback(
    async (path: string) => {
      if (path.startsWith("data.")) {
        const success = await deleteBodyNode(path);
        if (!success) return;
      }
      const keys = path.split(".");
      const newParsed = structuredClone(parsed);
      let obj: unknown = newParsed;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (key && obj && typeof obj === "object")
          obj = (obj as Record<string, unknown>)[key];
        else return;
      }
      const lastKey = keys[keys.length - 1];
      if (lastKey && obj && typeof obj === "object")
        delete (obj as Record<string, unknown>)[lastKey];
      setParsed(newParsed);
      setSelected(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed, deleteBodyNode, setParsed],
  );

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "parsed-curl-edited.json";
    link.click();
    URL.revokeObjectURL(url);
  }, [parsed]);

  const handleBodyExpandCollapseAll = useCallback(() => {
    if (allExpanded) {
      const allPaths: string[] = [];
      const collectPaths = (obj: unknown, currentPath = "data") => {
        if (typeof obj === "object" && obj !== null) {
          if (Array.isArray(obj)) {
            (obj as unknown[]).forEach((item, idx) => {
              const p = `${currentPath}[${idx}]`;
              allPaths.push(p);
              collectPaths(item, p);
            });
          } else {
            Object.keys(obj as Record<string, unknown>).forEach(key => {
              const p = `${currentPath}.${key}`;
              allPaths.push(p);
              collectPaths((obj as Record<string, unknown>)[key], p);
            });
          }
        }
      };
      collectPaths(parsed.data);
      const collapsed: Record<string, boolean> = {};
      allPaths.forEach(p => (collapsed[p] = true));
      setBodyCollapsed(collapsed);
    } else {
      setBodyCollapsed({});
    }
    setAllExpanded(prev => !prev);
  }, [allExpanded, parsed.data, setBodyCollapsed, setAllExpanded]);

  // Revert a single field to its original value using dot-notation path
  const revertField = useCallback((path: string) => {
    const keys = path.split(".");
    let origValue: unknown = originalParsed;
    for (const key of keys) {
      if (origValue == null || typeof origValue !== "object") { origValue = undefined; break; }
      origValue = (origValue as Record<string, unknown>)[key];
    }
    if (keys.length === 1) {
      const topKey = keys[0] as keyof ParsedCurl;
      const update = { ...parsed, [topKey]: origValue } as ParsedCurl;
      setParsed(update);
    } else {
      // Deep path — clone and set
      const clone = structuredClone(parsed) as unknown as Record<string, unknown>;
      let obj = clone;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i]!;
        if (typeof obj[k] !== "object" || obj[k] == null) obj[k] = {};
        obj = obj[k] as Record<string, unknown>;
      }
      obj[keys[keys.length - 1]!] = origValue;
      setParsed(clone as unknown as ParsedCurl);
    }
  }, [originalParsed, parsed, setParsed]);

  return {
    // State
    originalParsed,
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
    undo,
    redo,
    revertField,
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

    // Helpers
    hasValidData,
    hasActiveFlags,
    getActiveFlags,
    getMissingSections,

    // Body API state
    bodyApiLoading,
    bodyApiError,
  };
};
