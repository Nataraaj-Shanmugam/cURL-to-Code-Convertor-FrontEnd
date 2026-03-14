import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Trash2, Save, ChevronDown, ChevronRight } from "lucide-react";
import { useEditorContext } from "./EditorContext";

interface BodyFieldNodeProps {
  fieldKey: string;
  value: unknown;
  path: string;
  level?: number;
}

function BodyFieldNode({ fieldKey, value, path, level = 0 }: BodyFieldNodeProps) {
  const { editing, editedValues, bodyCollapsed, toggleBodyCollapse, toggleEdit, handleEditChange, deleteSingle } =
    useEditorContext();

  const isEditing = editing[path];
  const currentValue = isEditing ? editedValues[path] : value;
  const isComplex = typeof value === "object" && value !== null;
  const isCollapsed = bodyCollapsed[path] || false;
  const indent = Math.min(level * 24, 120); // cap at 5 levels to prevent mobile overflow

  if (isComplex) {
    const isArray = Array.isArray(value);
    const complexValue = value as Record<string, unknown> | unknown[];

    return (
      <div className="my-1">
        <div
          className="flex items-center gap-2 p-1.5 hover:bg-accent/30 rounded group transition-colors"
          style={{ marginLeft: `${indent}px` }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0"
            onClick={() => toggleBodyCollapse(path)}
            aria-label={isCollapsed ? `Expand ${fieldKey}` : `Collapse ${fieldKey}`}
          >
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>

          <span className="font-mono text-sm font-semibold text-foreground">
            {fieldKey}
            <span className="text-muted-foreground ml-1">
              {isArray ? `[${(complexValue as unknown[]).length}]` : "{...}"}
            </span>
          </span>

          <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => toggleEdit(path, value)}
              aria-label={isEditing ? `Save ${fieldKey}` : `Edit ${fieldKey}`}
            >
              {isEditing ? <Save className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => deleteSingle(path)}
              aria-label={`Delete ${fieldKey}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {!isCollapsed && (
          <div>
            {isArray
              ? (complexValue as unknown[]).map((item, idx) => (
                  <BodyFieldNode
                    key={`${path}[${idx}]`}
                    fieldKey={`[${idx}]`}
                    value={item}
                    path={`${path}[${idx}]`}
                    level={level + 1}
                  />
                ))
              : Object.entries(complexValue as Record<string, unknown>).map(([childKey, childValue]) => (
                  <BodyFieldNode
                    key={`${path}.${childKey}`}
                    fieldKey={childKey}
                    value={childValue}
                    path={`${path}.${childKey}`}
                    level={level + 1}
                  />
                ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 p-1.5 hover:bg-accent/30 rounded group transition-colors"
      style={{ marginLeft: `${indent}px` }}
    >
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="font-mono text-sm font-medium text-muted-foreground min-w-[120px]">
          {fieldKey}:
        </span>
        {isEditing ? (
          <Input
            value={String(currentValue ?? "")}
            onChange={e => handleEditChange(path, e.target.value)}
            className="font-mono text-xs h-7"
          />
        ) : (
          <span className="font-mono text-sm text-foreground">
            {typeof value === "string" ? `"${value}"` : String(value ?? "null")}
          </span>
        )}
      </div>

      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => toggleEdit(path, value)}
          aria-label={isEditing ? `Save ${fieldKey}` : `Edit ${fieldKey}`}
        >
          {isEditing ? <Save className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => deleteSingle(path)}
          aria-label={`Delete ${fieldKey}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export default memo(BodyFieldNode);
