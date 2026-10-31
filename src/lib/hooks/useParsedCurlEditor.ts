import { useEffect, useCallback, useMemo } from "react";
import type { ParsedCurl } from "@/types/curl";
import { useEditorState } from "./useEditorState";
import { useBodyApi } from "./useBodyApi";
import { useSectionManager, VALID_SECTIONS, getParsedField } from "./useSectionManager";
import { deepEqual } from "@/lib/utils/deepEqual";
import {
  type FieldPath,
  compareForDeletion,
  decodePath,
  deleteAtPath,
  encodePath,
  getAtPath,
  hasPath,
  isSafePath,
  setAtPath,
  toBracketPath,
  toPathId,
  toSegments,
} from "@/lib/utils/fieldPath";

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

// The body API addresses nodes as `data.items[0].sku`.
const bodyApiPath = (parsed: ParsedCurl, segments: string[]): string =>
  `data.${toBracketPath(parsed.data, segments.slice(1))}`;

// ── hook ─────────────────────────────────────────────────────────────────────

export const useParsedCurlEditor = (initialData: ParsedCurl | undefined) => {
  const editorState = useEditorState(initialData);
  const {
    originalParsed,
    parsed,
    isDirty: hasCommittedChanges,
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

  // A value typed into an open field editor but not saved yet also counts as an unsaved change,
  // so the leave/unload guard does not drop it silently (QF-22).
  const hasPendingEdits = useMemo(
    () =>
      Object.keys(editing).some(
        id => editing[id] && id in editedValues && !deepEqual(editedValues[id], getAtPath(parsed, decodePath(id))),
      ),
    [editing, editedValues, parsed],
  );
  const isDirty = hasCommittedChanges || hasPendingEdits;

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
    duplicateKey,
    addEntryError,
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
    async (path: FieldPath, currentValue: unknown) => {
      const segments = toSegments(path);
      const id = encodePath(segments);
      if (!editing[id]) {
        setEditing({ ...editing, [id]: true });
        setEditedValues({ ...editedValues, [id]: currentValue });
        return;
      }

      const closeEditor = () => {
        const newEditing = { ...editing };
        delete newEditing[id];
        setEditing(newEditing);
      };

      if (!hasPath(parsed, segments)) {
        closeEditor();
        return;
      }
      const stored = getAtPath(parsed, segments);
      let finalValue: unknown = id in editedValues ? editedValues[id] : currentValue;
      // The input always yields text. Only a field that held a JSON value (number, boolean, null,
      // object, array) is parsed back; a string stays a string, so "123", "true" or a 20-digit id
      // keep their type and precision.
      if (typeof finalValue === "string" && typeof stored !== "string") {
        try {
          finalValue = JSON.parse(finalValue) as unknown;
        } catch {
          // Keep as string
        }
      }

      if (deepEqual(finalValue, stored)) {
        closeEditor();
        return;
      }
      const newParsed = structuredClone(parsed);
      if (!setAtPath(newParsed, segments, finalValue)) {
        closeEditor();
        return;
      }

      // The edit is local and final. The backend call (flag-gated) is advisory, so it starts
      // after the state update and its failure only surfaces as a notice.
      if (segments[0] === "data" && segments.length > 1) void editBodyNode(bodyApiPath(parsed, segments), finalValue);

      setParsed(newParsed);
      closeEditor();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, editedValues, parsed, editBodyNode, setParsed],
  );

  const deleteSelected = useCallback(() => {
    if (selected.size === 0) return;
    const newParsed = structuredClone(parsed);
    let changed = false;
    [...selected]
      .map(decodePath)
      .sort(compareForDeletion)
      .forEach(segments => {
        if (deleteAtPath(newParsed, segments)) changed = true;
      });
    if (changed) setParsed(newParsed);
    setSelected(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, parsed, setParsed]);

  const deleteSingle = useCallback(
    (path: FieldPath) => {
      const segments = toSegments(path);
      const id = encodePath(segments);
      const newParsed = structuredClone(parsed);
      if (deleteAtPath(newParsed, segments)) {
        // Local delete is final; the backend call (flag-gated) is advisory and sent with the
        // pre-delete body, as before.
        if (segments[0] === "data" && segments.length > 1) void deleteBodyNode(bodyApiPath(parsed, segments));
        setParsed(newParsed);
      }
      // Splicing an array item shifts its siblings' ids, so open editors and selections under that
      // array are dropped too; otherwise only those at or under the deleted path.
      const parentSegments = segments.slice(0, -1);
      const scope =
        parentSegments.length > 0 && Array.isArray(getAtPath(parsed, parentSegments))
          ? encodePath(parentSegments)
          : id;
      const inScope = (key: string) => key === scope || key.startsWith(`${scope}.`);
      setSelected(prev => new Set([...prev].filter(key => !inScope(toPathId(key)))));
      setEditing(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (inScope(key)) delete next[key];
        });
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
      const collectPaths = (obj: unknown, currentPath: string[] = ["data"]) => {
        if (typeof obj === "object" && obj !== null) {
          Object.keys(obj as Record<string, unknown>).forEach(key => {
            const p = [...currentPath, key];
            allPaths.push(encodePath(p));
            collectPaths((obj as Record<string, unknown>)[key], p);
          });
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

  // Revert a single field to its original value. `path` is an escaped path (as produced by the
  // diff engine) or its segments.
  const revertField = useCallback((path: FieldPath) => {
    const segments = toSegments(path);
    if (!isSafePath(segments)) return;
    const clone = structuredClone(parsed);
    const ok = hasPath(originalParsed, segments)
      ? setAtPath(clone, segments, structuredClone(getAtPath(originalParsed, segments)), originalParsed)
      : deleteAtPath(clone, segments);
    if (ok && !deepEqual(clone, parsed)) setParsed(clone);
  }, [originalParsed, parsed, setParsed]);

  return {
    // State
    originalParsed,
    parsed,
    isDirty,
    selected,
    editing,
    editedValues,
    showAddDialog,
    addDialogSection,
    newKey,
    newValue,
    duplicateKey,
    addEntryError,
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
