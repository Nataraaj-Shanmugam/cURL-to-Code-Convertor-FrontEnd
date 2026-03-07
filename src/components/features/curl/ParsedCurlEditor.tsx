import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit2, Trash2, Save, Download, Code, Plus, FolderPlus, ChevronDown, ChevronRight, Maximize2, Minimize2, RotateCcw, Globe, FileText, List, Shield, Flag, Settings, Link2, Cookie } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParsedCurlEditor, VALID_SECTIONS } from "@/lib/hooks/useParsedCurlEditor";
import { useState } from "react";
import CodeGenerationDialog from "./CodeGenerationDialog";
import type { ParsedCurl } from "@/types/curl";

interface ParsedCurlEditorProps {
  initialData: ParsedCurl;
  originalCurl?: string;
  onBack?: () => void;
  onSave?: (data: ParsedCurl) => void;
}

export default function ParsedCurlEditor({ initialData, originalCurl, onBack, onSave }: ParsedCurlEditorProps) {
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
    setNewKey,
    setNewValue,
    setShowAddDialog,
    setShowNewSectionDialog,
    setNewSectionName,
    setOpenSections,
    setSelected,
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
    hasActiveFlags,
    getActiveFlags,
    getMissingSections,
    hasValidData,
  } = useParsedCurlEditor(initialData);

  // Filter out default/empty values from config sections for display
  const filterMeaningfulEntries = (data: any): any => {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data;
    const filtered: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === null || v === undefined || v === false || v === 0) continue;
      if (typeof v === 'string' && v.trim() === '') continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
      filtered[k] = v;
    }
    return filtered;
  };

  // Section styling config
  const sectionStyles: Record<string, { icon: typeof Globe; borderColor: string }> = {
    request: { icon: Globe, borderColor: "border-l-primary" },
    headers: { icon: FileText, borderColor: "border-l-blue-500" },
    query_params: { icon: List, borderColor: "border-l-amber-500" },
    cookies: { icon: Cookie, borderColor: "border-l-orange-500" },
    auth: { icon: Shield, borderColor: "border-l-emerald-500" },
    auth_config: { icon: Shield, borderColor: "border-l-emerald-500" },
    flags: { icon: Flag, borderColor: "border-l-violet-500" },
    misc_flags: { icon: Flag, borderColor: "border-l-violet-400" },
    ssl_config: { icon: Shield, borderColor: "border-l-rose-500" },
    proxy_config: { icon: Globe, borderColor: "border-l-yellow-500" },
    network_config: { icon: Settings, borderColor: "border-l-teal-500" },
    transfer_config: { icon: Settings, borderColor: "border-l-sky-500" },
    protocol_config: { icon: Settings, borderColor: "border-l-lime-500" },
    output_config: { icon: FileText, borderColor: "border-l-fuchsia-500" },
    ftp_config: { icon: Globe, borderColor: "border-l-pink-500" },
    mail_config: { icon: FileText, borderColor: "border-l-red-500" },
    path_parameters: { icon: Link2, borderColor: "border-l-cyan-500" },
    context: { icon: Settings, borderColor: "border-l-slate-500" },
    data: { icon: FileText, borderColor: "border-l-indigo-500" },
  };

  // Code generation dialog state
  const [showCodeDialog, setShowCodeDialog] = useState(false);

  const handleSave = () => {
    if (onSave) {
      onSave(parsed);
    }
  };

  const handleGenerateCode = () => {
    setShowCodeDialog(true);
  };

  // Get section display name
  const getSectionDisplayName = (key: string): string => {
    if (VALID_SECTIONS[key as keyof typeof VALID_SECTIONS]) {
      return VALID_SECTIONS[key as keyof typeof VALID_SECTIONS];
    }
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const renderBodyField = (key: string, value: any, path: string, level: number = 0): JSX.Element => {
    const isEditing = editing[path];
    const currentValue = isEditing ? editedValues[path] : value;
    const isComplex = typeof value === 'object' && value !== null;
    const isCollapsed = bodyCollapsed[path] || false;
    const indent = level * 24;

    if (isComplex) {
      const isArray = Array.isArray(value);
      const displayKey = key.startsWith('[') ? key : key;

      return (
        <div key={path} className="my-1">
          <div className="flex items-center gap-2 p-1.5 hover:bg-accent/30 rounded group transition-colors" style={{ marginLeft: `${indent}px` }}>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0"
              onClick={() => toggleBodyCollapse(path)}
            >
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>

            <span className="font-mono text-sm font-semibold text-foreground">
              {displayKey}
              <span className="text-muted-foreground ml-1">
                {isArray ? `[${value.length}]` : '{...}'}
              </span>
            </span>

            <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => toggleEdit(path, value)}
                title={isEditing ? "Save" : "Edit"}
              >
                {isEditing ? <Save className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => deleteSingle(path)}
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {!isCollapsed && (
            <div>
              {isArray ? (
                value.map((item: any, idx: number) =>
                  renderBodyField(`[${idx}]`, item, `${path}[${idx}]`, level + 1)
                )
              ) : (
                Object.entries(value).map(([childKey, childValue]) =>
                  renderBodyField(childKey, childValue, `${path}.${childKey}`, level + 1)
                )
              )}
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div key={path} className="flex items-center gap-2 p-1.5 hover:bg-accent/30 rounded group transition-colors" style={{ marginLeft: `${indent}px` }}>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-muted-foreground min-w-[120px]">{key}:</span>

            {isEditing ? (
              <Input
                value={String(currentValue ?? '')}
                onChange={(e) => handleEditChange(path, e.target.value)}
                className="font-mono text-xs h-7"
              />
            ) : (
              <span className="font-mono text-sm text-foreground">
                {typeof value === 'string' ? `"${value}"` : String(value ?? 'null')}
              </span>
            )}
          </div>

          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => toggleEdit(path, value)}
              title={isEditing ? "Save" : "Edit"}
            >
              {isEditing ? <Save className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => deleteSingle(path)}
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      );
    }
  };

  const renderEditableField = (label: string, value: any, path: string) => {
    const isEditing = editing[path];
    const currentValue = isEditing ? editedValues[path] : value;
    const isComplex = typeof value === 'object' && value !== null;
    const isNonDeletable = ['method', 'url', 'base_url', 'endpoint'].includes(label);

    return (
      <div key={path} className="flex items-start gap-3 p-2 hover:bg-accent/30 rounded-md group transition-colors">
        <Checkbox
          checked={selected.has(path)}
          onCheckedChange={() => toggleSelect(path)}
          className="mt-1"
          disabled={isNonDeletable}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-foreground">{label}</span>
            {isNonDeletable && (
              <span className="text-xs px-1.5 py-0.5 bg-accent text-accent-foreground rounded">
                Required
              </span>
            )}
          </div>

          {isEditing ? (
            isComplex ? (
              <Textarea
                value={typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue, null, 2)}
                onChange={(e) => {
                  try {
                    handleEditChange(path, JSON.parse(e.target.value));
                  } catch {
                    handleEditChange(path, e.target.value);
                  }
                }}
                className="font-mono text-xs min-h-[100px] resize-y"
              />
            ) : (
              <Input
                value={String(currentValue ?? '')}
                onChange={(e) => handleEditChange(path, e.target.value)}
                className="font-mono text-xs"
              />
            )
          ) : (
            <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-muted/50 p-2 rounded border border-border">
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? 'N/A')}
            </pre>
          )}
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => toggleEdit(path, value)}
            title={isEditing ? "Save" : "Edit"}
          >
            {isEditing ? <Save className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
          </Button>
          {!isNonDeletable && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => deleteSingle(path)}
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderSection = (title: string, data: any, basePath: string, isTopLevel = false, isFlagsSection = false) => {
    const isEmpty = !data || (Array.isArray(data)
      ? data.length === 0
      : Object.keys(data).length === 0);

    const isFlagType = isFlagsSection || basePath === 'ssl_config';
    const hasNoFlags = isFlagType && (!data || (!hasActiveFlags(data) && Object.keys(data || {}).length === 0));

    const style = sectionStyles[basePath] || { icon: FileText, borderColor: "border-l-muted-foreground" };
    const SectionIcon = style.icon;

    return (
      <AccordionItem value={basePath} key={basePath} className={`border-l-2 ${style.borderColor} pl-2`}>
        <AccordionTrigger>
          <div className="flex items-center justify-between w-full pr-2">
            <span className="flex items-center gap-2">
              <SectionIcon className="w-4 h-4 text-muted-foreground" />
              {title}
            </span>
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddEntry(basePath);
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                {isFlagType ? 'Add Flag' : 'Add Entry'}
              </button>
              {!isTopLevel && (
                <button
                  type="button"
                  className="h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSection(basePath);
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete Section
                </button>
              )}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          {isFlagType ? (
            hasNoFlags ? (
              <p className="text-sm text-muted-foreground italic">No flags set.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(isFlagsSection ? getActiveFlags(data) : Object.keys(data || {}).filter(k => data[k])).map((flag) => (
                  <div key={flag} className="flex items-center gap-2 px-3 py-1.5 bg-accent text-accent-foreground rounded-full text-sm">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <span className="font-mono">{flag}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1"
                      onClick={() => deleteSingle(`${basePath}.${flag}`)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )
          ) : isEmpty ? (
            <p className="text-sm text-muted-foreground italic">No entries yet.</p>
          ) : (
            <div className="space-y-1">
              {Array.isArray(data) ? (
                data.map((item, idx) =>
                  renderEditableField(`Item ${idx}`, item, `${basePath}.${idx}`)
                )
              ) : (
                Object.entries(data)
                  .filter(([_, value]) => value !== null && value !== undefined)
                  .map(([key, value]) => {
                    const fieldPath = isTopLevel ? key : `${basePath}.${key}`;
                    return renderEditableField(key, value, fieldPath);
                  })
              )}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    );
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

  const missingSections = getMissingSections();

  const getSectionsToRender = () => {
    const sections: Array<{ key: string; title: string; data: any; isFlags?: boolean }> = [];

    const fixedSections = ['method', 'url', 'base_url', 'endpoint', 'path_template'];
    const requestData: any = {};
    fixedSections.forEach(key => {
      const value = parsed[key];
      if (value !== undefined && value !== null && value !== '') {
        requestData[key] = value;
      }
    });

    if (Object.keys(requestData).length > 0) {
      sections.push({ key: 'request', title: 'Request Details', data: requestData });
    }

    // Sections that are flag-like (show only true values as chips)
    const flagSections = ['flags', 'misc_flags'];
    // Sections skipped from top-level iteration
    const skipKeys = [...fixedSections, 'data', 'raw_data', 'all_options', 'meta', 'user_agent', 'referer', 'proxy'];

    Object.keys(parsed).forEach(key => {
      if (skipKeys.includes(key)) return;

      const value = parsed[key];

      if ((value === null || value === undefined) && !openSections.includes(key)) {
        return;
      }

      // Flag-like sections (flags, misc_flags)
      if (flagSections.includes(key)) {
        if (hasActiveFlags(value) || openSections.includes(key)) {
          sections.push({
            key,
            title: getSectionDisplayName(key),
            data: value || {},
            isFlags: true
          });
        }
        return;
      }

      // SSL config (flag-like display)
      if (key === 'ssl_config') {
        if (hasValidData(value) || openSections.includes(key)) {
          sections.push({
            key,
            title: getSectionDisplayName(key),
            data: value || {},
            isFlags: false
          });
        }
        return;
      }

      if (key === 'path_parameters') {
        if ((Array.isArray(value) && value.length > 0) || openSections.includes(key)) {
          sections.push({ key, title: getSectionDisplayName(key), data: value || [] });
        }
        return;
      }

      // For all other object sections, use hasValidData to filter out sections
      // where all values are defaults (null, false, 0, empty string)
      if (typeof value === 'object') {
        if (hasValidData(value) || openSections.includes(key)) {
          // Only include entries with meaningful values for display
          const filteredData = filterMeaningfulEntries(value);
          sections.push({ key, title: getSectionDisplayName(key), data: filteredData });
        }
      } else if (value || openSections.includes(key)) {
        sections.push({ key, title: getSectionDisplayName(key), data: value });
      }
    });

    return sections;
  };

  const sectionsToRender = getSectionsToRender();

  return (
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
        {/* Left: Navigation */}
        <div className="flex gap-2 items-center">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
              ← Back
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-muted-foreground hover:text-foreground">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
        </div>

        {/* Right: Actions grouped */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Primary action */}
          <Button onClick={handleGenerateCode} size="sm" className="gap-1.5">
            <Code className="w-3.5 h-3.5" />
            Generate Code
          </Button>

          <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

          {/* Edit actions */}
          <Button variant="outline" size="sm" onClick={handleAddSection} disabled={missingSections.length === 0} className="gap-1.5">
            <FolderPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Section</span>
            {missingSections.length > 0 && <span className="text-xs text-muted-foreground">({missingSections.length})</span>}
          </Button>
          {onSave && (
            <Button variant="outline" size="sm" onClick={handleSave} className="gap-1.5">
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportData} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          {/* Selection actions - only show when items selected */}
          {selected.size > 0 && (
            <>
              <div className="w-px h-6 bg-border mx-1" />
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} className="gap-1.5 text-muted-foreground">
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

      {/* Add Entry Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {addDialogSection === 'flags' || addDialogSection === 'ssl_config' ? 'Add Flag' : 'Add New Entry'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                {addDialogSection === 'flags' || addDialogSection === 'ssl_config' ? 'Flag Name' : 'Key'}
              </label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder={addDialogSection === 'flags' || addDialogSection === 'ssl_config' ? 'e.g., insecure' : 'e.g., Authorization'}
              />
            </div>
            {addDialogSection !== 'flags' && addDialogSection !== 'ssl_config' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Value</label>
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Enter value"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={saveNewEntry} disabled={!newKey.trim()}>
                {addDialogSection === 'flags' || addDialogSection === 'ssl_config' ? 'Add Flag' : 'Add Entry'}
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
            {/* Render all dynamic sections */}
            {sectionsToRender.map(section => {
              if (section.isFlags || section.key === 'ssl_config') {
                return renderSection(section.title, section.data, section.key, false, section.isFlags);
              }
              return renderSection(section.title, section.data, section.key, section.key === 'request');
            })}

            {/* Render Request Body separately if exists */}
            {parsed.data && (
              typeof parsed.data === 'object'
                ? (Array.isArray(parsed.data) ? parsed.data.length > 0 : Object.keys(parsed.data).length > 0)
                : parsed.data
            ) && (
                <AccordionItem value="data" key="data" className="border-l-2 border-l-indigo-500 pl-2">
                  <AccordionTrigger>
                    <div className="flex items-center justify-between w-full pr-2">
                      <span className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        Request Body
                      </span>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <span
                          className="h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer"
                          onClick={(e) => {
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
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="bg-muted/30 rounded-md p-3 font-mono text-sm">
                      {typeof parsed.data === 'object' && parsed.data !== null ? (
                        Object.entries(parsed.data).map(([key, value]) =>
                          renderBodyField(key, value, `data.${key}`, 0)
                        )
                      ) : (
                        <div className="group">
                          {editing['data'] ? (
                            <div className="space-y-2">
                              <Textarea
                                value={String(editedValues['data'] ?? parsed.data ?? '')}
                                onChange={(e) => handleEditChange('data', e.target.value)}
                                className="font-mono text-xs min-h-[120px] resize-y"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleEdit('data', parsed.data)}
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <pre className="text-xs whitespace-pre-wrap break-all flex-1">
                                {typeof parsed.data === 'string' ? parsed.data : JSON.stringify(parsed.data, null, 2)}
                              </pre>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => toggleEdit('data', parsed.data)}
                                  title="Edit"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => deleteSingle('data')}
                                  title="Delete body"
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

            {/* Client Context section */}
            {(
              (parsed.user_agent && parsed.user_agent.trim() !== '') ||
              (parsed.referer && parsed.referer.trim() !== '') ||
              parsed.proxy
            ) && renderSection("Client Context", {
              ...(parsed.user_agent && parsed.user_agent.trim() !== '' && { user_agent: parsed.user_agent }),
              ...(parsed.referer && parsed.referer.trim() !== '' && { referer: parsed.referer }),
              ...(parsed.proxy && { proxy: parsed.proxy })
            }, "context")}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}