import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import type { FieldPath } from "@/lib/utils/fieldPath";

// Shared callbacks injected by ParsedCurlEditor and consumed by sub-components.
// Using context avoids threading 10+ props through multiple levels.
//
// The context value itself never changes while the editor is mounted: the callbacks are stable
// and the per-field state (editing, edited values, selection, collapsed nodes) is read through
// `useEditorSelector`, which re-renders only the rows whose selected slice changed. Putting that
// state in the context value re-rendered every field on each keystroke (FE-PERF-2).

export interface EditorRowState {
  editing: Record<string, boolean>;
  editedValues: Record<string, unknown>;
  selected: Set<string>;
  bodyCollapsed: Record<string, boolean>;
  /** Collapsed state of a body node that has no entry in `bodyCollapsed`. */
  bodyCollapsedDefault: boolean;
}

export interface EditorStore {
  getState: () => EditorRowState;
  subscribe: (listener: () => void) => () => void;
}

/**
 * A tiny external store: ParsedCurlEditor replaces its state while rendering (silently, so rows
 * rendered in the same pass read fresh values) and notifies subscribers from a layout effect.
 */
export const createEditorStore = (
  initial: EditorRowState,
): EditorStore & { replace: (next: EditorRowState) => void; notify: () => void } => {
  let state = initial;
  let notified = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    replace: next => {
      state = next;
    },
    notify: () => {
      if (notified === state) return;
      notified = state;
      listeners.forEach(l => l());
    },
  };
};

export interface EditorCallbacks {
  store: EditorStore;
  // Paths are escaped path ids or segment arrays (see fieldPath.ts); state records are keyed by id.
  toggleSelect: (path: FieldPath) => void;
  toggleEdit: (path: FieldPath, value: unknown) => void;
  handleEditChange: (path: FieldPath, value: unknown) => void;
  deleteSingle: (path: FieldPath) => void;
  toggleBodyCollapse: (path: FieldPath) => void;
  handleAddEntry: (section: string) => void;
  handleBodyExpandCollapseAll: () => void;
  hasActiveFlags: (v: unknown) => boolean;
  getActiveFlags: (v: unknown) => string[];
  hasValidData: (v: unknown) => boolean;
  requestConfirm: (action: { type: "reset" } | { type: "deleteSection"; key: string }) => void;
}

export const EditorContext = createContext<EditorCallbacks | null>(null);

export const useEditorContext = (): EditorCallbacks => {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditorContext must be used within EditorContext.Provider");
  return ctx;
};

/**
 * Reads one slice of the row state. The selector must return a primitive or a reference taken
 * from the state as is (e.g. `s.editedValues[path]`), so unchanged slices compare equal.
 */
export function useEditorSelector<T>(selector: (state: EditorRowState) => T): T {
  const { store } = useEditorContext();
  const getSnapshot = useCallback(() => selector(store.getState()), [store, selector]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/** The per-field state one row needs, keyed by its path id. */
export function useFieldState(path: string) {
  const isEditing = useEditorSelector(useCallback(s => Boolean(s.editing[path]), [path]));
  const editedValue = useEditorSelector(useCallback(s => s.editedValues[path], [path]));
  const isSelected = useEditorSelector(useCallback(s => s.selected.has(path), [path]));
  const isCollapsed = useEditorSelector(
    useCallback(s => s.bodyCollapsed[path] ?? s.bodyCollapsedDefault, [path]),
  );
  return { isEditing, editedValue, isSelected, isCollapsed };
}
