import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { copyToClipboard, notifySaved } from "@/lib/utils/notify";
import { usePageHeadingLevel } from "@/components/layout/PageHeading";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useParsedCurlEditor, VALID_SECTIONS } from "@/lib/hooks/useParsedCurlEditor";
import {
  Edit2, Trash2, Save, Download, Code, FolderPlus,
  Maximize2, Minimize2, RotateCcw, FileText, Copy, Undo2, Redo2, MoreHorizontal, Eye, GitCompare, ShieldAlert,
} from "lucide-react";
import { useState, useMemo, memo, useEffect, useCallback, useId, useRef } from "react";
import CodeGenerationDialog from "./CodeGenerationDialog";
import RequestPreviewDialog from "./RequestPreviewDialog";
import DiffViewDialog from "./DiffViewDialog";
import ExportJsonDialog from "./ExportJsonDialog";
import { MaskedText } from "./editor/SecretValue";
import { MASK, REDACTED_PLACEHOLDER, countRedactions, redactBodyString, redactCurlString } from "@/lib/utils/redaction";
import type { ParsedCurl } from "@/types/curl";
import { EditorContext } from "./editor/EditorContext";
import SectionRenderer from "./editor/SectionRenderer";
import BodyFieldNode from "./editor/BodyFieldNode";
import { ROW_ACTIONS_VISIBILITY } from "./editor/rowActions";
import { encodePath } from "@/lib/utils/fieldPath";
import { isBlockedByModal, isTextEntryTarget } from "@/lib/utils/shortcuts";

interface ParsedCurlEditorProps {
  initialData: ParsedCurl;
  originalCurl?: string;
  onBack?: () => void;
  onSave?: (data: ParsedCurl) => void;
  /** Called with the current parsed data every time it changes (not on first render). */
  onChange?: (data: ParsedCurl) => void;
  /**
   * Called whenever "has unsaved edits" changes (true only while the working copy differs from the
   * normalised original), and with false on unmount. The owner uses it to guard unload/navigation.
   */
  onDirtyChange?: (isDirty: boolean) => void;
  /**
   * When false, the editor ignores global keyboard shortcuts (Ctrl+Z / Ctrl+Y). The batch editor
   * keeps one editor mounted per visited request, and only the visible one should react.
   */
  isActive?: boolean;
}

// Filter out default/empty values from config sections for display
function filterMeaningfulEntries(data: Record<string, unknown>): Record<string, unknown> {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data;
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined || v === false || v === 0) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
    filtered[k] = v;
  }
  return filtered;
}

function ParsedCurlEditor({
  initialData,
  originalCurl,
  onBack,
  onSave,
  onChange,
  onDirtyChange,
  isActive = true,
}: ParsedCurlEditorProps) {
  const headingLevel = usePageHeadingLevel();
  const {
    parsed,
    originalParsed,
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
    setNewKey,
    setNewValue,
    setShowAddDialog,
    setShowNewSectionDialog,
    setNewSectionName,
    setOpenSections,
    setSelected,
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
    handleAddEntry,
    saveNewEntry,
    handleAddSection,
    saveNewSection,
    toggleBodyCollapse,
    handleBodyExpandCollapseAll,
    hasActiveFlags,
    getActiveFlags,
    getMissingSections,
    hasValidData,
    bodyApiError,
  } = useParsedCurlEditor(initialData);

  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Values redacted before this request was saved: the user must re-enter them before generating
  // code. Counted on the working copy only, so the warning goes once every field is filled in again
  // (the Original cURL card keeps its placeholders; it is labelled as such).
  const redactedCount = countRedactions(parsed);
  const originalCurlRedacted = countRedactions(originalCurl) > 0;
  const redactedNoticeId = useId();

  // Confirmation dialog state — replaces window.confirm
  type ConfirmAction = { type: "reset" } | { type: "deleteSection"; key: string };
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmAction | null>(null);

  const requestConfirm = useCallback(
    (action: ConfirmAction) => setPendingConfirm(action),
    [],
  );
  const executeConfirm = () => {
    if (!pendingConfirm) return;
    if (pendingConfirm.type === "reset") handleReset();
    else deleteSection(pendingConfirm.key);
    setPendingConfirm(null);
  };

  // Report edits to the owner as they happen, so nothing is lost if this editor is hidden or
  // unmounted before the user presses Save. Comparing against the last value seen (instead of
  // skipping "the first run") keeps this correct under StrictMode's double-invoked effects.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastReportedRef = useRef(parsed);
  useEffect(() => {
    if (parsed === lastReportedRef.current) return;
    lastReportedRef.current = parsed;
    onChangeRef.current?.(parsed);
  }, [parsed]);

  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  useEffect(() => {
    onDirtyChangeRef.current?.(isDirty);
  }, [isDirty]);
  useEffect(() => () => onDirtyChangeRef.current?.(false), []);

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo, Ctrl+G = Generate Code.
  // None of them act behind an open dialog. Undo/redo also leave text fields alone, so the
  // browser's own text undo works while typing a value.
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const isUndo = key === "z" && !e.shiftKey;
      const isRedo = key === "y" || (key === "z" && e.shiftKey);
      const isGenerate = key === "g" && !e.shiftKey;
      if (!isUndo && !isRedo && !isGenerate) return;
      if (isBlockedByModal(e)) return;
      if ((isUndo || isRedo) && isTextEntryTarget(e.target)) return;
      e.preventDefault();
      if (isUndo) undo();
      else if (isRedo) redo();
      // Same rule as the Generate button: no generating from redacted placeholders (T53).
      else if (redactedCount === 0) setShowCodeDialog(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, isActive, redactedCount]);

  const handleSave = () => {
    if (onSave) {
      onSave(parsed);
      notifySaved();
    }
  };

  const getSectionDisplayName = (key: string): string => {
    if (VALID_SECTIONS[key as keyof typeof VALID_SECTIONS])
      return VALID_SECTIONS[key as keyof typeof VALID_SECTIONS];
    return key.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  // Hooks must run on every render, so these memos sit above the empty-state early
  // return below (rules-of-hooks). Their results are unused while `parsed` is
  // empty, so they short-circuit in that case.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const missingSections = useMemo(() => (parsed ? getMissingSections() : []), [parsed]);

  const sectionsToRender = useMemo(() => {
    const sections: Array<{ key: string; title: string; data: unknown; isFlags?: boolean }> = [];
    if (!parsed) return sections;

    const fixedSections = ["method", "url", "base_url", "endpoint", "path_template"];
    const parsedRecord = parsed as unknown as Record<string, unknown>;
    const requestData: Record<string, unknown> = {};
    fixedSections.forEach(key => {
      const value = parsedRecord[key];
      if (value !== undefined && value !== null && value !== "") requestData[key] = value;
    });

    if (Object.keys(requestData).length > 0)
      sections.push({ key: "request", title: "Request Details", data: requestData });

    const flagSections = ["flags", "misc_flags"];
    const skipKeys = [...fixedSections, "data", "raw_data", "all_options", "meta", "user_agent", "referer", "proxy"];

    Object.keys(parsedRecord).forEach(key => {
      if (skipKeys.includes(key)) return;
      const value = parsedRecord[key];

      if ((value === null || value === undefined) && !openSections.includes(key)) return;

      if (flagSections.includes(key)) {
        if (hasActiveFlags(value) || openSections.includes(key))
          sections.push({ key, title: getSectionDisplayName(key), data: value || {}, isFlags: true });
        return;
      }

      if (key === "ssl_config") {
        if (hasValidData(value) || openSections.includes(key))
          sections.push({ key, title: getSectionDisplayName(key), data: value || {}, isFlags: false });
        return;
      }

      if (key === "path_parameters") {
        if ((Array.isArray(value) && value.length > 0) || openSections.includes(key))
          sections.push({ key, title: getSectionDisplayName(key), data: value || [] });
        return;
      }

      if (typeof value === "object") {
        if (hasValidData(value) || openSections.includes(key))
          sections.push({
            key,
            title: getSectionDisplayName(key),
            data: filterMeaningfulEntries(value as Record<string, unknown>),
          });
      } else if (value || openSections.includes(key)) {
        sections.push({ key, title: getSectionDisplayName(key), data: value });
      }
    });

    return sections;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, openSections]);

  // Build the context value so sub-components don't need prop drilling
  const editorCtx = useMemo(
    () => ({
      editing,
      editedValues,
      selected,
      bodyCollapsed,
      allExpanded,
      toggleSelect,
      toggleEdit,
      handleEditChange,
      deleteSingle,
      toggleBodyCollapse,
      handleAddEntry,
      handleBodyExpandCollapseAll,
      hasActiveFlags,
      getActiveFlags,
      hasValidData,
      requestConfirm,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, editedValues, selected, bodyCollapsed, allExpanded],
  );

  // What the Original cURL card shows while masked; Copy puts the redacted form on the clipboard
  // (never the secrets, whether or not the card is currently revealed).
  const maskedOriginal = originalCurl ? redactCurlString(originalCurl, { placeholder: MASK }) : "";
  const originalHasSecret = Boolean(originalCurl) && maskedOriginal !== originalCurl;

  if (!parsed || Object.keys(parsed).length === 0) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">No parsed data available</p>
        {onBack && (
          <Button onClick={onBack} variant="outline">
            Back to Playground
          </Button>
        )}
      </div>
    );
  }

  const bodyCount =
    parsed.data && typeof parsed.data === "object"
      ? Array.isArray(parsed.data)
        ? parsed.data.length
        : Object.keys(parsed.data).length
      : 1;

  return (
    <EditorContext.Provider value={editorCtx}>
      <div className="p-4 space-y-4 max-w-6xl mx-auto bg-grid min-h-[calc(100vh-12rem)]">
        {originalCurl && (
          <Card className="bg-muted/30">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm text-muted-foreground">
                Original cURL Command
                {originalCurlRedacted && (
                  <span className="ml-2 font-normal text-xs">(secrets redacted when saved)</span>
                )}
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                aria-label={originalHasSecret ? "Copy original cURL command (secrets redacted)" : "Copy original cURL command"}
                onClick={() =>
                  void copyToClipboard(
                    originalHasSecret ? maskedOriginal.replace(new RegExp(MASK, "g"), REDACTED_PLACEHOLDER) : originalCurl,
                    originalHasSecret ? "Redacted cURL command" : "cURL command",
                  )
                }
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                {originalHasSecret ? "Copy redacted" : "Copy"}
              </Button>
            </CardHeader>
            <CardContent>
              <MaskedText
                label="original cURL command"
                text={originalCurl}
                maskedText={maskedOriginal}
                className="text-xs font-mono whitespace-pre-wrap break-all bg-background p-3 rounded border border-border max-h-32 overflow-auto"
              />
            </CardContent>
          </Card>
        )}

        {redactedCount > 0 && (
          // role="alert" is kept on purpose: the user has to act (re-enter the values) before generating code.
          <Alert
            variant="warning"
            role="alert"
            id={redactedNoticeId}
            icon={<ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />}
          >
            <span>
              Secret values in this request were redacted when it was saved.{" "}
              <strong>
                Re-enter {redactedCount} redacted value{redactedCount === 1 ? "" : "s"} to generate code.
              </strong>{" "}
              They are the fields marked <strong>Redacted: re-enter value</strong>.
            </span>
          </Alert>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-lg border bg-muted/30">
          {/* Left: Navigation + Undo/Redo */}
          <div className="flex gap-2 items-center">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
                ← Back
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => requestConfirm({ type: "reset" })}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>
            <div className="w-px h-5 bg-border" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreviewDialog(true)}
              className="gap-1.5"
              title="Preview request"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDiffDialog(true)}
              disabled={!canUndo}
              className="gap-1.5"
              title="Review changes"
            >
              <GitCompare className="w-3.5 h-3.5" />
              Changes
            </Button>
            {/* Primary action — always visible */}
            <Button
              onClick={() => setShowCodeDialog(true)}
              size="sm"
              className="gap-1.5"
              disabled={redactedCount > 0}
              aria-describedby={redactedCount > 0 ? redactedNoticeId : undefined}
              title={
                redactedCount > 0
                  ? `Re-enter ${redactedCount} redacted value${redactedCount === 1 ? "" : "s"} to generate code`
                  : "Generate Code (Ctrl+G)"
              }
            >
              <Code className="w-3.5 h-3.5" />
              Generate Code
            </Button>

            {/* Secondary actions — visible on sm+, collapse to dropdown on mobile */}
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="w-px h-6 bg-border mx-0.5" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddSection}
                disabled={missingSections.length === 0}
                className="gap-1.5"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                Add Section
                {missingSections.length > 0 && (
                  <span className="text-xs text-muted-foreground">({missingSections.length})</span>
                )}
              </Button>
              {onSave && (
                <Button variant="outline" size="sm" onClick={handleSave} className="gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  Save
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)} className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Export
              </Button>
            </div>

            {/* Mobile overflow dropdown */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8" aria-label="More actions">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleAddSection}
                    disabled={missingSections.length === 0}
                  >
                    <FolderPlus className="w-4 h-4 mr-2" />
                    Add Section
                    {missingSections.length > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({missingSections.length})
                      </span>
                    )}
                  </DropdownMenuItem>
                  {onSave && (
                    <DropdownMenuItem onClick={handleSave}>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowExportDialog(true)}>
                    <Download className="w-4 h-4 mr-2" />
                    Export JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Selection actions: always present (disabled until something is selected) so ticking the
                first checkbox does not shift the buttons beside them. */}
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0}
              className="min-w-[6rem] gap-1.5 text-muted-foreground"
            >
              Clear ({selected.size})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={deleteSelected}
              disabled={selected.size === 0}
              className="min-w-[7rem] gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete ({selected.size})
            </Button>
          </div>
        </div>

        {/* Code Generation Dialog */}
        <CodeGenerationDialog
          open={showCodeDialog}
          onOpenChange={setShowCodeDialog}
          parsedData={parsed}
        />

        {/* Request Preview Dialog */}
        <RequestPreviewDialog
          open={showPreviewDialog}
          onOpenChange={setShowPreviewDialog}
          parsedData={parsed}
        />

        {/* Export JSON Dialog */}
        <ExportJsonDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          parsedData={parsed}
        />

        {/* Diff View Dialog */}
        <DiffViewDialog
          open={showDiffDialog}
          onOpenChange={setShowDiffDialog}
          originalParsed={originalParsed as import("@/types/curl").ParsedCurl}
          currentParsed={parsed}
          onRevert={revertField}
        />

        {/* Confirmation Dialog */}
        <Dialog open={pendingConfirm !== null} onOpenChange={open => !open && setPendingConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {pendingConfirm?.type === "reset" ? "Reset all changes?" : "Delete section?"}
              </DialogTitle>
              <DialogDescription>
                {pendingConfirm?.type === "reset"
                  ? "This will restore all fields to their original parsed values. Any edits you made will be lost."
                  : `The "${
                      pendingConfirm?.type === "deleteSection"
                        ? VALID_SECTIONS[pendingConfirm.key as keyof typeof VALID_SECTIONS] ||
                          pendingConfirm.key
                        : ""
                    }" section and all its entries will be permanently removed.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingConfirm(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={executeConfirm}>
                {pendingConfirm?.type === "reset" ? "Reset" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Entry Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {addDialogSection === "flags" || addDialogSection === "ssl_config"
                  ? "Add Flag"
                  : "Add New Entry"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Enter the details of the entry to add to this section.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label htmlFor="add-entry-key" className="text-sm font-medium mb-2 block">
                  {addDialogSection === "flags" || addDialogSection === "ssl_config"
                    ? "Flag Name"
                    : "Key"}
                </label>
                <Input
                  id="add-entry-key"
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                  placeholder={
                    addDialogSection === "flags" || addDialogSection === "ssl_config"
                      ? "e.g., insecure"
                      : "e.g., Authorization"
                  }
                />
              </div>
              {addDialogSection !== "flags" && addDialogSection !== "ssl_config" && (
                <div>
                  <label htmlFor="add-entry-value" className="text-sm font-medium mb-2 block">Value</label>
                  <Input
                    id="add-entry-value"
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    placeholder="Enter value"
                  />
                </div>
              )}
              {addEntryError && (
                <p role="alert" className="text-sm text-destructive">
                  {addEntryError}
                </p>
              )}
              {duplicateKey !== null && (
                <p
                  role="alert"
                  className="text-sm p-2 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                >
                  {duplicateKey === newKey.trim()
                    ? `"${duplicateKey}" already exists. Replace its value?`
                    : `"${duplicateKey}" already exists (header names ignore case). Replace it with "${newKey.trim()}"?`}
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                {duplicateKey !== null ? (
                  <Button variant="destructive" onClick={() => saveNewEntry({ overwrite: true })}>
                    Replace
                  </Button>
                ) : (
                  <Button onClick={() => saveNewEntry()} disabled={!newKey.trim()}>
                    {addDialogSection === "flags" || addDialogSection === "ssl_config"
                      ? "Add Flag"
                      : "Add Entry"}
                  </Button>
                )}
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Section Dialog */}
        <Dialog open={showNewSectionDialog} onOpenChange={setShowNewSectionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Missing Section</DialogTitle>
              <DialogDescription className="sr-only">Choose a section to add to this request.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label htmlFor="add-section-select" className="text-sm font-medium mb-2 block">Select Section</label>
                <Select value={newSectionName} onValueChange={setNewSectionName}>
                  <SelectTrigger id="add-section-select">
                    <SelectValue placeholder="Choose a section" />
                  </SelectTrigger>
                  <SelectContent>
                    {missingSections.map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewSectionDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={saveNewSection} disabled={!newSectionName}>
                  Add Section
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="shadow-md">
          <CardHeader>
            {/* The page title: an <h1> (the batch route renders its own, so there it is an <h2>). */}
            <CardTitle as={headingLevel} className="text-xl sm:text-2xl text-primary">Edit Parsed Request</CardTitle>
            <p className="text-sm text-muted-foreground">
              Edit values, manage sections, and generate code
            </p>
          </CardHeader>
          <CardContent>
            <Accordion
              type="multiple"
              value={openSections}
              onValueChange={setOpenSections}
              className="space-y-3"
            >
              {sectionsToRender.map(section => (
                <SectionRenderer
                  key={section.key}
                  title={section.title}
                  sectionKey={section.key}
                  data={section.data}
                  isTopLevel={section.key === "request"}
                  isFlagsSection={section.isFlags}
                />
              ))}

              {/* Request Body */}
              {parsed.data &&
                (typeof parsed.data === "object"
                  ? Array.isArray(parsed.data)
                    ? parsed.data.length > 0
                    : Object.keys(parsed.data).length > 0
                  : parsed.data) && (
                  <AccordionItem value="data" className="border-l-2 border-l-indigo-500 pl-2">
                    <AccordionTrigger
                      actions={
                        <button
                          type="button"
                          className="h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={allExpanded ? "Collapse all body nodes" : "Expand all body nodes"}
                          onClick={handleBodyExpandCollapseAll}
                        >
                          {allExpanded ? (
                            <>
                              <Minimize2 className="h-3 w-3 mr-1" aria-hidden="true" />
                              Collapse All
                            </>
                          ) : (
                            <>
                              <Maximize2 className="h-3 w-3 mr-1" aria-hidden="true" />
                              Expand All
                            </>
                          )}
                        </button>
                      }
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        Request Body
                        {/* Decorative count: kept out of the trigger's accessible name (QU-3). */}
          <Badge variant="secondary" aria-hidden="true" aria-label={`${bodyCount} ${bodyCount === 1 ? "entry" : "entries"}`}>
                          {bodyCount}
                        </Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {bodyApiError && (
                        <Alert variant="destructive" className="mb-2 p-2 text-xs">
                          <span>
                            <span className="font-medium">Body API error:</span> {bodyApiError}
                          </span>
                        </Alert>
                      )}
                      <div className="bg-muted/30 rounded-md p-3 font-mono text-sm overflow-x-auto">
                        {typeof parsed.data === "object" && parsed.data !== null ? (
                          Object.entries(parsed.data).map(([key, value]) => (
                            <BodyFieldNode
                              key={key}
                              fieldKey={key}
                              value={value}
                              path={encodePath(["data", key])}
                              level={0}
                            />
                          ))
                        ) : (
                          <div className="group">
                            {editing["data"] ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={String(editedValues["data"] ?? parsed.data ?? "")}
                                  onChange={e => handleEditChange("data", e.target.value)}
                                  className="font-mono text-xs min-h-[120px] resize-y"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleEdit("data", parsed.data)}
                                >
                                  <Save className="h-3 w-3 mr-1" />
                                  Save
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <MaskedText
                                    label="request body"
                                    text={typeof parsed.data === "string" ? parsed.data : JSON.stringify(parsed.data, null, 2)}
                                    maskedText={
                                      typeof parsed.data === "string"
                                        ? redactBodyString(parsed.data, { placeholder: MASK })
                                        : JSON.stringify(parsed.data, null, 2)
                                    }
                                    className="text-xs whitespace-pre-wrap break-all"
                                  />
                                </div>
                                <div className={`flex gap-1 ${ROW_ACTIONS_VISIBILITY}`}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => toggleEdit("data", parsed.data)}
                                    aria-label="Edit body"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => deleteSingle("data")}
                                    aria-label="Delete body"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

              {/* Client Context */}
              {((parsed.user_agent && parsed.user_agent.trim() !== "") ||
                (parsed.referer && parsed.referer.trim() !== "") ||
                parsed.proxy) && (
                <SectionRenderer
                  title="Client Context"
                  sectionKey="context"
                  isTopLevel
                  data={{
                    ...(parsed.user_agent &&
                      parsed.user_agent.trim() !== "" && { user_agent: parsed.user_agent }),
                    ...(parsed.referer &&
                      parsed.referer.trim() !== "" && { referer: parsed.referer }),
                    ...(parsed.proxy && { proxy: parsed.proxy }),
                  }}
                />
              )}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </EditorContext.Provider>
  );
}

export default memo(ParsedCurlEditor);
