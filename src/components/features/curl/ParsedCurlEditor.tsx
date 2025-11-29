import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Edit2,
  Trash2,
  Save,
  Download,
  Code,
  Plus,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Shield,
  Globe,
  Lock,
  FileJson,
  AlertCircle,
  CheckCircle2,
  Info,
  Search,
  X,
  Layers,
  Database,
  Key,
  Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useParsedCurlEditor, VALID_SECTIONS } from "@/lib/hooks/useParsedCurlEditor";
import { useState } from "react";
import CodeGenerationDialog from "./CodeGenerationDialog";

interface ParsedCurlEditorProps {
  initialData: any;
  originalCurl?: string;
  onBack?: () => void;
  onSave?: (data: any) => void;
}

export default function ParsedCurlEditor({
  initialData,
  originalCurl,
  onBack,
  onSave,
}: ParsedCurlEditorProps) {
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
  } = useParsedCurlEditor(initialData);

  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showQuickNav, setShowQuickNav] = useState(true);

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
    return key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Get section icon
  const getSectionIcon = (key: string) => {
    const iconMap: Record<string, any> = {
      request: Globe,
      headers: Layers,
      query_parameters: Search,
      auth: Shield,
      data: Database,
      cookies: Key,
      flags: Settings,
      ssl_config: Lock,
      path_parameters: FileJson,
    };
    return iconMap[key] || Info;
  };

  // Get section color
  const getSectionColor = (key: string) => {
    const colorMap: Record<string, string> = {
      request: "from-blue-500 to-blue-600",
      headers: "from-purple-500 to-purple-600",
      query_parameters: "from-cyan-500 to-cyan-600",
      auth: "from-green-500 to-green-600",
      data: "from-orange-500 to-orange-600",
      cookies: "from-yellow-500 to-yellow-600",
      flags: "from-gray-500 to-gray-600",
      ssl_config: "from-red-500 to-red-600",
    };
    return colorMap[key] || "from-slate-500 to-slate-600";
  };

  // Get method badge color
  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      POST: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      PUT: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      PATCH: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    };
    return (
      colors[method?.toUpperCase()] ||
      "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
    );
  };

  // Count items in section
  const getSectionCount = (data: any): number => {
    if (!data) return 0;
    if (Array.isArray(data)) return data.length;
    if (typeof data === "object")
      return Object.keys(data).filter(
        (k) => data[k] !== null && data[k] !== undefined,
      ).length;
    return 1;
  };

  const renderBodyField = (
    key: string,
    value: any,
    path: string,
    level: number = 0,
  ): JSX.Element => {
    const isEditing = editing[path];
    const currentValue = isEditing ? editedValues[path] : value;
    const isComplex = typeof value === "object" && value !== null;
    const isCollapsed = bodyCollapsed[path] || false;
    const indent = level * 20;

    if (isComplex) {
      const isArray = Array.isArray(value);
      const displayKey = key;
      const itemCount = isArray ? value.length : Object.keys(value).length;

      return (
        <div key={path} className="my-1 animate-fade-in">
          <div
            className="flex items-center gap-2 p-2 hover:bg-accent/50 rounded-lg group transition-all duration-200 cursor-pointer"
            style={{ marginLeft: `${indent}px` }}
            onClick={() => toggleBodyCollapse(path)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 hover:bg-primary/10"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>

            <div className="flex items-center gap-2 flex-1">
              <span className="font-mono text-sm font-semibold text-foreground">
                {displayKey}
              </span>
              <Badge variant="secondary" className="text-xs px-2 py-0">
                {isArray ? `Array[${itemCount}]` : `Object{${itemCount}}`}
              </Badge>
            </div>

            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-primary hover:text-primary-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleEdit(path, value);
                }}
                title={isEditing ? "Save" : "Edit"}
              >
                {isEditing ? (
                  <Save className="h-3 w-3" />
                ) : (
                  <Edit2 className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-red-500 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSingle(path);
                }}
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {!isCollapsed && (
            <div
              className="border-l-2 border-primary/20 ml-3"
              style={{ marginLeft: `${indent + 12}px` }}
            >
              {isArray
                ? value.map((item: any, idx: number) =>
                    renderBodyField(
                      `[${idx}]`,
                      item,
                      `${path}[${idx}]`,
                      level + 1,
                    ),
                  )
                : Object.entries(value).map(([childKey, childValue]) =>
                    renderBodyField(
                      childKey,
                      childValue,
                      `${path}.${childKey}`,
                      level + 1,
                    ),
                  )}
            </div>
          )}
        </div>
      );
    } else {
      const valueType = typeof value;
      const typeColor =
        valueType === "string"
          ? "text-green-600 dark:text-green-400"
          : valueType === "number"
          ? "text-blue-600 dark:text-blue-400"
          : "text-purple-600 dark:text-purple-400";

      return (
        <div
          key={path}
          className="flex items-center gap-2 p-2 hover:bg-accent/50 rounded-lg group transition-all duration-200"
          style={{ marginLeft: `${indent}px` }}
        >
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <span className="font-mono text-sm font-medium text-muted-foreground min-w-[120px] truncate">
              {key}:
            </span>

            {isEditing ? (
              <Input
                value={String(currentValue ?? "")}
                onChange={(e) => handleEditChange(path, e.target.value)}
                className="font-mono text-xs h-8 border-2 focus:border-primary"
              />
            ) : (
              <span className={`font-mono text-sm ${typeColor} truncate`}>
                {typeof value === "string"
                  ? `"${value}"`
                  : String(value ?? "null")}
              </span>
            )}
          </div>

          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-primary hover:text-primary-foreground"
              onClick={() => toggleEdit(path, value)}
              title={isEditing ? "Save" : "Edit"}
            >
              {isEditing ? (
                <Save className="h-3 w-3" />
              ) : (
                <Edit2 className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-red-500 hover:text-white"
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
    const isComplex = typeof value === "object" && value !== null;
    const isNonDeletable = ["method", "url", "base_url", "endpoint"].includes(
      label,
    );

    return (
      <div
        key={path}
        className="flex items-start gap-3 p-3 hover:bg-accent/50 rounded-xl group transition-all duration-200 border-2 border-transparent hover:border-primary/20"
      >
        <Checkbox
          checked={selected.has(path)}
          onCheckedChange={() => toggleSelect(path)}
          className="mt-1.5"
          disabled={isNonDeletable}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-sm text-foreground">
              {label}
            </span>
            {isNonDeletable && (
              <Badge
                variant="outline"
                className="text-xs px-2 py-0 border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400"
              >
                Required
              </Badge>
            )}
          </div>

          {isEditing ? (
            isComplex ? (
              <Textarea
                value={
                  typeof currentValue === "string"
                    ? currentValue
                    : JSON.stringify(currentValue, null, 2)
                }
                onChange={(e) => {
                  try {
                    handleEditChange(path, JSON.parse(e.target.value));
                  } catch {
                    handleEditChange(path, e.target.value);
                  }
                }}
                className="font-mono text-xs min-h-[120px] resize-y border-2 focus:border-primary rounded-lg"
              />
            ) : (
              <Input
                value={String(currentValue ?? "")}
                onChange={(e) => handleEditChange(path, e.target.value)}
                className="font-mono text-xs border-2 focus:border-primary"
              />
            )
          ) : (
            <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-muted/50 p-3 rounded-lg border-2 border-border shadow-sm">
              {typeof value === "object"
                ? JSON.stringify(value, null, 2)
                : String(value ?? "N/A")}
            </pre>
          )}
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 hover:bg-primary hover:text-primary-foreground"
            onClick={() => toggleEdit(path, value)}
            title={isEditing ? "Save" : "Edit"}
          >
            {isEditing ? (
              <Save className="h-4 w-4" />
            ) : (
              <Edit2 className="h-4 w-4" />
            )}
          </Button>
          {!isNonDeletable && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-red-500 hover:text-white"
              onClick={() => deleteSingle(path)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderSection = (
    title: string,
    data: any,
    basePath: string,
    isTopLevel = false,
    isFlagsSection = false,
  ) => {
    const isEmpty =
      !data ||
      (Array.isArray(data)
        ? data.length === 0
        : Object.keys(data).length === 0);

    const isFlagType = isFlagsSection || basePath === "ssl_config";
    const hasNoFlags =
      isFlagType &&
      (!data || (!hasActiveFlags(data) && Object.keys(data || {}).length === 0));
    const SectionIcon = getSectionIcon(basePath);
    const sectionColor = getSectionColor(basePath);
    const count = getSectionCount(data);

    return (
      <AccordionItem
        value={basePath}
        key={basePath}
        className="border-2 rounded-xl mb-3 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
      >
        <AccordionTrigger className="hover:no-underline px-4 py-3 hover:bg-accent/30">
          <div className="flex items-center justify-between w-full pr-2">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionColor} flex items-center justify-center shadow-md`}
              >
                <SectionIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base">{title}</span>
                {count > 0 && (
                  <Badge variant="secondary" className="px-2 py-0 text-xs">
                    {count}
                  </Badge>
                )}
                {basePath === "request" && parsed.method && (
                  <Badge
                    className={`${getMethodColor(
                      parsed.method,
                    )} px-3 py-0.5 text-xs font-bold`}
                  >
                    {parsed.method.toUpperCase()}
                  </Badge>
                )}
              </div>
            </div>
            <div
              className="flex gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddEntry(basePath);
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                {isFlagType ? "Add Flag" : "Add Entry"}
              </Button>
              {!isTopLevel && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs hover:bg-red-500 hover:text-white transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSection(basePath);
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          {isFlagType ? (
            hasNoFlags ? (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/30 border-2 border-dashed">
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground italic">
                  No flags set. Click &quot;Add Flag&quot; to add one.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(isFlagsSection
                  ? getActiveFlags(data)
                  : Object.keys(data || {}).filter((k) => data[k])
                ).map((flag: string) => (
                  <div
                    key={flag}
                    className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-shadow group"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-mono">{flag}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                      onClick={() => deleteSingle(`${basePath}.${flag}`)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )
          ) : isEmpty ? (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/30 border-2 border-dashed">
              <Info className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground italic">
                No entries yet. Click &quot;Add Entry&quot; to add one.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {Array.isArray(data)
                ? data.map((item, idx) =>
                    renderEditableField(`Item ${idx}`, item, `${basePath}.${idx}`),
                  )
                : Object.entries(data)
                    .filter(
                      ([, value]) =>
                        value !== null && value !== undefined,
                    )
                    .map(([key, value]) => {
                      const fieldPath = isTopLevel ? key : `${basePath}.${key}`;
                      return renderEditableField(key, value, fieldPath);
                    })}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  };

  if (!parsed || Object.keys(parsed).length === 0) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <p className="text-muted-foreground text-lg">
          No parsed data available
        </p>
        {onBack && (
          <Button onClick={onBack} variant="outline" className="gap-2">
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Playground
          </Button>
        )}
      </div>
    );
  }

  const missingSections = getMissingSections();

  const getSectionsToRender = () => {
    const sections: Array<{
      key: string;
      title: string;
      data: any;
      isFlags?: boolean;
    }> = [];

    const fixedSections = [
      "method",
      "url",
      "base_url",
      "endpoint"
    ];
    const requestData: any = {};
    fixedSections.forEach((key) => {
      const value = parsed[key];
      if (value !== undefined && value !== null && value !== "") {
        requestData[key] = value;
      }
    });

    if (Object.keys(requestData).length > 0) {
      sections.push({
        key: "request",
        title: "Request Details",
        data: requestData,
      });
    }

    Object.keys(parsed).forEach((key) => {
      if (
        fixedSections.includes(key) ||
        key === "data" ||
        key === "raw_data" ||
        key === "all_options" ||
        key === "meta"||
        key === "path_template"
      ) {
        return;
      }

      const value = parsed[key];

      if ((value === null || value === undefined) && !openSections.includes(key)) {
        return;
      }

      if (["user_agent", "referer", "proxy"].includes(key)) {
        return;
      }

      if (key === "flags") {
        if (hasActiveFlags(value) || openSections.includes(key)) {
          sections.push({
            key,
            title: getSectionDisplayName(key),
            data: value || {},
            isFlags: true,
          });
        }
        return;
      }

      if (key === "ssl_config") {
        const hasConfig =
          value &&
          typeof value === "object" &&
          Object.keys(value).some((k) => value[k] === true);
        if (hasConfig || openSections.includes(key)) {
          sections.push({
            key,
            title: getSectionDisplayName(key),
            data: value || {},
            isFlags: false,
          });
        }
        return;
      }

      if (key === "path_parameters") {
        if (
          (Array.isArray(value) && value.length > 0) ||
          openSections.includes(key)
        ) {
          sections.push({
            key,
            title: getSectionDisplayName(key),
            data: value || [],
          });
        }
        return;
      }

      if (typeof value === "object") {
        const isEmpty = Array.isArray(value)
          ? value.length === 0
          : Object.keys(value || {}).length === 0;

        if (!isEmpty || openSections.includes(key)) {
          sections.push({
            key,
            title: getSectionDisplayName(key),
            data: value || {},
          });
        }
      } else if (value || openSections.includes(key)) {
        sections.push({
          key,
          title: getSectionDisplayName(key),
          data: value,
        });
      }
    });

    return sections;
  };

  const sectionsToRender = getSectionsToRender();

  // Calculate stats
  const stats = {
    headers: getSectionCount(parsed.headers),
    params: getSectionCount(parsed.query_parameters),
    hasAuth: !!(
      parsed.auth ||
      parsed.headers?.Authorization ||
      parsed.headers?.authorization
    ),
    hasBody: !!(parsed.data && getSectionCount(parsed.data) > 0),
  };

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Enhanced Header with Stats */}
      <div className="mb-8 space-y-6">
        {/* Original cURL Command */}
        {originalCurl && (
          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-2 shadow-lg animate-fade-in">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  Original cURL Command
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(originalCurl);
                  }}
                  className="h-7 gap-2 hover:bg-primary hover:text-primary-foreground"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Copy
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-slate-950 text-slate-50 p-4 rounded-lg border-2 border-slate-700 max-h-32 overflow-auto shadow-inner">
                {originalCurl}
              </pre>
            </CardContent>
          </Card>
        )}
        
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex gap-2 flex-wrap">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleReset}
            className="text-orange-600 hover:text-orange-700 gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            Reset
          </Button>
          {!showQuickNav && (
            <Button
              variant="outline"
              onClick={() => setShowQuickNav(true)}
              className="gap-2"
            >
              <Search className="w-4 h-4" />
              Show Navigation
            </Button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {onSave && (
            <Button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          )}
          <Button
            onClick={handleAddSection}
            disabled={missingSections.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400 gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            Add Section{" "}
            {missingSections.length > 0 &&
              `(${missingSections.length})`}
          </Button>
          <Button
            onClick={handleGenerateCode}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
          >
            <Code className="w-4 h-4" />
            Generate Code
          </Button>
          <Button variant="outline" onClick={exportData} className="gap-2">
            <Download className="w-4 h-4" />
            Export JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelected(new Set())}
            disabled={selected.size === 0}
          >
            Clear ({selected.size})
          </Button>
          <Button
            variant="destructive"
            onClick={deleteSelected}
            disabled={selected.size === 0}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
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

      {/* Add Entry Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {addDialogSection === "flags" ||
              addDialogSection === "ssl_config"
                ? "Add Flag"
                : "Add New Entry"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                {addDialogSection === "flags" ||
                addDialogSection === "ssl_config"
                  ? "Flag Name"
                  : "Key"}
              </label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder={
                  addDialogSection === "flags" ||
                  addDialogSection === "ssl_config"
                    ? "e.g., insecure"
                    : "e.g., Authorization"
                }
              />
            </div>
            {addDialogSection !== "flags" &&
              addDialogSection !== "ssl_config" && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Value
                  </label>
                  <Input
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="Enter value"
                  />
                </div>
              )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={saveNewEntry} disabled={!newKey.trim()}>
                {addDialogSection === "flags" ||
                addDialogSection === "ssl_config"
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
              <label className="text-sm font-medium mb-2 block">
                Select Section
              </label>
              <Select
                value={newSectionName}
                onValueChange={setNewSectionName}
              >
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
              <Button
                variant="outline"
                onClick={() => setShowNewSectionDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={saveNewSection} disabled={!newSectionName}>
                Add Section
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Editor Card */}
      <Card className="shadow-lg border-2 animate-fade-in">
        <CardHeader className="border-b-2 bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl text-primary flex items-center gap-2">
                <Settings className="w-6 h-6" />
                Edit Parsed Request
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Edit values, manage sections, and generate code
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="space-y-4"
          >
            {/* Render all dynamic sections */}
            {sectionsToRender.map((section) => (
              <div key={section.key} id={`section-${section.key}`}>
                {section.isFlags || section.key === "ssl_config"
                  ? renderSection(
                      section.title,
                      section.data,
                      section.key,
                      false,
                      section.isFlags,
                    )
                  : renderSection(
                      section.title,
                      section.data,
                      section.key,
                      section.key === "request",
                    )}
              </div>
            ))}

            {/* Render Request Body separately if exists */}
            {stats.hasBody && (
              <AccordionItem
                value="data"
                key="data"
                id="section-data"
                className="border-2 rounded-xl mb-3 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <AccordionTrigger className="hover:no-underline px-4 py-3 hover:bg-accent/30">
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getSectionColor(
                          "data",
                        )} flex items-center justify-center shadow-md`}
                      >
                        <Database className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">
                          Request Body
                        </span>
                        <Badge
                          variant="secondary"
                          className="px-2 py-0 text-xs"
                        >
                          {getSectionCount(parsed.data)}
                        </Badge>
                      </div>
                    </div>
                    <div
                      className="flex gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
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
                      </Button>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="bg-muted/30 rounded-lg p-4 font-mono text-sm border-2 border-border">
                    {typeof parsed.data === "object" && parsed.data !== null ? (
                      Object.entries(parsed.data).map(([key, value]) =>
                        renderBodyField(key, value, `data.${key}`, 0),
                      )
                    ) : (
                      <pre className="text-xs whitespace-pre-wrap break-all">
                        {typeof parsed.data === "string"
                          ? parsed.data
                          : JSON.stringify(parsed.data, null, 2)}
                      </pre>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Client Context section */}
            {(parsed.user_agent?.trim() ||
              parsed.referer?.trim() ||
              parsed.proxy) && (
              <div id="section-context">
                {renderSection(
                  "Client Context",
                  {
                    ...(parsed.user_agent?.trim() && {
                      user_agent: parsed.user_agent,
                    }),
                    ...(parsed.referer?.trim() && {
                      referer: parsed.referer,
                    }),
                    ...(parsed.proxy && { proxy: parsed.proxy }),
                  },
                  "context",
                )}
              </div>
            )}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
