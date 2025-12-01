// src/components/features/curl/editor/BodyField.tsx
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  ChevronDown,
  ChevronRight,
  Edit2,
  Save,
  Trash2,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface BodyFieldProps {
  data: any;
  bodyCollapsed: { [key: string]: boolean };
  allExpanded: boolean;
  selected: Set<string>;
  editing: { [key: string]: boolean };
  editedValues: { [key: string]: any };
  onToggleBodyCollapse: (path: string) => void;
  onToggleEdit: (path: string, value: any) => void;
  onDeleteSingle: (path: string) => void;
  onEditChange: (path: string, value: any) => void;
  onExpandCollapseAll: () => void;
}

export function BodyField({
  data,
  bodyCollapsed,
  allExpanded,
  editing,
  editedValues,
  onToggleBodyCollapse,
  onToggleEdit,
  onDeleteSingle,
  onEditChange,
  onExpandCollapseAll,
}: BodyFieldProps) {
  const renderBodyField = (
    key: string,
    value: any,
    path: string,
    level: number = 0
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
            onClick={() => onToggleBodyCollapse(path)}
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
                  onToggleEdit(path, value);
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
                  onDeleteSingle(path);
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
                    renderBodyField(`[${idx}]`, item, `${path}[${idx}]`, level + 1)
                  )
                : Object.entries(value).map(([childKey, childValue]) =>
                    renderBodyField(
                      childKey,
                      childValue,
                      `${path}.${childKey}`,
                      level + 1
                    )
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
                onChange={(e) => onEditChange(path, e.target.value)}
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
              onClick={() => onToggleEdit(path, value)}
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
              onClick={() => onDeleteSingle(path)}
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      );
    }
  };

  const getSectionCount = (data: any): number => {
    if (!data) return 0;
    if (Array.isArray(data)) return data.length;
    if (typeof data === "object")
      return Object.keys(data).filter((k) => data[k] !== null && data[k] !== undefined)
        .length;
    return 1;
  };

  return (
    <AccordionItem
      value="data"
      key="data"
      id="section-data"
      className="border-2 rounded-xl mb-3 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      <AccordionTrigger className="hover:no-underline px-4 py-3 hover:bg-accent/30">
        <div className="flex items-center justify-between w-full pr-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base">Request Body</span>
              <Badge variant="secondary" className="px-2 py-0 text-xs">
                {getSectionCount(data)}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onExpandCollapseAll();
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
          {typeof data === "object" && data !== null ? (
            Object.entries(data).map(([key, value]) =>
              renderBodyField(key, value, `data.${key}`, 0)
            )
          ) : (
            <pre className="text-xs whitespace-pre-wrap break-all">
              {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}