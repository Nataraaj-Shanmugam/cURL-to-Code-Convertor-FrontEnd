import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Maximize2, Minimize2, RotateCcw, FileText, Undo2, Redo2, MoreHorizontal,
} from "lucide-react";
import { useState, useMemo, memo, useEffect, useCallback } from "react";
import CodeGenerationDialog from "./CodeGenerationDialog";
import type { ParsedCurl } from "@/types/curl";
import { EditorContext } from "./editor/EditorContext";
import SectionRenderer from "./editor/SectionRenderer";
import BodyFieldNode from "./editor/BodyFieldNode";

interface ParsedCurlEditorProps {
  initialData: ParsedCurl;
  originalCurl?: string;
  onBack?: () => void;
  onSave?: (data: ParsedCurl) => void;
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

function ParsedCurlEditor({ initialData, originalCurl, onBack, onSave }: ParsedCurlEditorProps) {
  const {
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
    hasActiveFlags,
    getActiveFlags,
    getMissingSections,
    hasValidData,
    bodyApiError,
  } = useParsedCurlEditor(initialData);

  const [showCodeDialog, setShowCodeDialog] = useState(false);

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

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  const handleSave = () => {
    if (onSave) onSave(parsed);
  };

  const getSectionDisplayName = (key: string): string => {
    if (VALID_SECTIONS[key as keyof typeof VALID_SECTIONS])
      return VALID_SECTIONS[key as keyof typeof VALID_SECTIONS];
    return key.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const missingSections = useMemo(() => getMissingSections(), [parsed]);

  const sectionsToRender = useMemo(() => {
    const sections: Array<{ key: string; title: string; data: unknown; isFlags?: boolean }> = [];

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

  return (
    <EditorContext.Provider value={editorCtx}>
      <div className="p-4 space-y-4 max-w-6xl mx-auto bg-grid min-h-[calc(100vh-12rem)]">
        {originalCurl && (
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Original cURL Command</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-background p-3 rounded border border-border max-h-32 overflow-auto">
                {originalCurl}
              </pre>
            </CardContent>
          </Card>
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
            {/* Primary action — always visible */}
            <Button onClick={() => setShowCodeDialog(true)} size="sm" className="gap-1.5">
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
              <Button variant="outline" size="sm" onClick={exportData} className="gap-1.5">
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
                  <DropdownMenuItem onClick={exportData}>
                    <Download className="w-4 h-4 mr-2" />
                    Export JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Selection actions — contextual */}
            {selected.size > 0 && (
              <>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                  className="gap-1.5 text-muted-foreground"
                >
                  Clear ({selected.size})
                </Button>
                <Button variant="destructive" size="sm" onClick={deleteSelected} className="gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete ({selected.size})
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Code Generation Dialog */}
        <CodeGenerationDialog
          open={showCodeDialog}
          onOpenChange={setShowCodeDialog}
          parsedData={parsed}
        />

        {/* Confirmation Dialog */}
        <Dialog open={pendingConfirm !== null} onOpenChange={open => !open && setPendingConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {pendingConfirm?.type === "reset" ? "Reset all changes?" : "Delete section?"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {pendingConfirm?.type === "reset"
                ? "This will restore all fields to their original parsed values. Any edits you made will be lost."
                : `The "${
                    pendingConfirm?.type === "deleteSection"
                      ? VALID_SECTIONS[pendingConfirm.key as keyof typeof VALID_SECTIONS] ||
                        pendingConfirm.key
                      : ""
                  }" section and all its entries will be permanently removed.`}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPendingConfirm(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={executeConfirm}>
                {pendingConfirm?.type === "reset" ? "Reset" : "Delete"}
              </Button>
            </div>
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
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {addDialogSection === "flags" || addDialogSection === "ssl_config"
                    ? "Flag Name"
                    : "Key"}
                </label>
                <Input
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
                  <label className="text-sm font-medium mb-2 block">Value</label>
                  <Input
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    placeholder="Enter value"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={saveNewEntry} disabled={!newKey.trim()}>
                  {addDialogSection === "flags" || addDialogSection === "ssl_config"
                    ? "Add Flag"
                    : "Add Entry"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Section Dialog */}
        <Dialog open={showNewSectionDialog} onOpenChange={setShowNewSectionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Missing Section</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Section</label>
                <Select value={newSectionName} onValueChange={setNewSectionName}>
                  <SelectTrigger>
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewSectionDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={saveNewSection} disabled={!newSectionName}>
                  Add Section
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-primary">Edit Parsed Request</CardTitle>
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
                    <AccordionTrigger>
                      <div className="flex items-center justify-between w-full pr-2">
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          Request Body
                        </span>
                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={
                              allExpanded ? "Collapse all body nodes" : "Expand all body nodes"
                            }
                            onClick={e => {
                              e.stopPropagation();
                              handleBodyExpandCollapseAll();
                            }}
                          >
                            {allExpanded ? (
                              <>
                                <Minimize2 className="h-3 w-3 mr-1" />
                                Collapse All
                              </>
                            ) : (
                              <>
                                <Maximize2 className="h-3 w-3 mr-1" />
                                Expand All
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {bodyApiError && (
                        <div className="flex items-start gap-2 mb-2 p-2 bg-destructive/10 text-destructive rounded-md text-xs border border-destructive/30">
                          <span className="font-medium">Body API error:</span>
                          <span>{bodyApiError}</span>
                        </div>
                      )}
                      <div className="bg-muted/30 rounded-md p-3 font-mono text-sm overflow-x-auto">
                        {typeof parsed.data === "object" && parsed.data !== null ? (
                          Object.entries(parsed.data).map(([key, value]) => (
                            <BodyFieldNode
                              key={`data.${key}`}
                              fieldKey={key}
                              value={value}
                              path={`data.${key}`}
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
                                <pre className="text-xs whitespace-pre-wrap break-all flex-1">
                                  {typeof parsed.data === "string"
                                    ? parsed.data
                                    : JSON.stringify(parsed.data, null, 2)}
                                </pre>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
