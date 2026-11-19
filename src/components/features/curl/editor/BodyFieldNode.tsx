import { memo, useState } from "react";
import { BODY_CHILD_PAGE } from "@/lib/utils/bodySize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Save, ChevronDown, ChevronRight } from "lucide-react";
import { useEditorContext, useFieldState } from "./EditorContext";
import { ROW_ACTIONS_VISIBILITY } from "./rowActions";
import { RevealToggle, MaskedString } from "./SecretValue";
import { MASK, countRedactions, isSecretField, redactFieldValue } from "@/lib/utils/redaction";
import { decodePath, encodePath, toDisplayPath } from "@/lib/utils/fieldPath";

interface BodyFieldNodeProps {
  fieldKey: string;
  value: unknown;
  /** Escaped path id (see fieldPath.ts), e.g. `data.items.0.sku`. */
  path: string;
  level?: number;
}

interface BodyChildListProps {
  value: Record<string, unknown> | unknown[];
  /** Path id of the container (`data` for the body root). */
  path: string;
  level: number;
  /** Label array items `[0]` (nested) or `0` (the body root, as before). */
  bracketIndices?: boolean;
}

/**
 * The children of a body object/array, a page at a time: a container with thousands of entries
 * (a bulk payload) shows the first BODY_CHILD_PAGE and a "Show more" button instead of mounting
 * every row (FE-PERF-1).
 */
function BodyChildListImpl({ value, path, level, bracketIndices = true }: BodyChildListProps) {
  const [limit, setLimit] = useState(BODY_CHILD_PAGE);
  const isArray = Array.isArray(value);
  const entries: Array<[string, unknown]> = isArray
    ? (value as unknown[]).slice(0, limit).map((item, idx) => [String(idx), item])
    : Object.entries(value as Record<string, unknown>).slice(0, limit);
  const total = isArray ? (value as unknown[]).length : Object.keys(value).length;
  const remaining = total - entries.length;
  return (
    <div>
      {entries.map(([key, child]) => (
        <MemoBodyFieldNode
          key={key}
          fieldKey={isArray && bracketIndices ? `[${key}]` : key}
          value={child}
          path={`${path}.${encodePath([key])}`}
          level={level}
        />
      ))}
      {remaining > 0 && (
        <div style={{ marginLeft: `${Math.min(level * 24, 120)}px` }} className="p-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => setLimit(l => l + BODY_CHILD_PAGE)}
          >
            Show {Math.min(BODY_CHILD_PAGE, remaining)} more ({remaining.toLocaleString()} not shown)
          </Button>
        </div>
      )}
    </div>
  );
}

export const BodyChildList = memo(BodyChildListImpl);

function BodyFieldNode({ fieldKey, value, path, level = 0 }: BodyFieldNodeProps) {
  const { toggleBodyCollapse, toggleEdit, handleEditChange, deleteSingle } = useEditorContext();
  const { isEditing, editedValue, isCollapsed } = useFieldState(path);

  const currentValue = isEditing ? editedValue : value;
  const isComplex = typeof value === "object" && value !== null;
  const indent = Math.min(level * 24, 120); // cap at 5 levels to prevent mobile overflow

  // Leaf values under a secret-named key (password, token, ...) are masked until revealed.
  const [revealed, setRevealed] = useState(false);
  const keyPath = toDisplayPath(decodePath(path));
  const isSecret = !isComplex && isSecretField(keyPath, value);
  const needsReentry = !isComplex && countRedactions(value) > 0;
  const hidden = isSecret && !revealed;

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
            className="h-6 w-6 p-0"
            onClick={() => toggleBodyCollapse(path)}
            aria-label={isCollapsed ? `Expand ${fieldKey}` : `Collapse ${fieldKey}`}
          >
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>

          <span className="font-mono text-sm font-semibold text-foreground">
            {fieldKey}
            <Badge variant="secondary" className="ml-2 font-mono text-[11px]">
              {isArray
                ? `Array[${(complexValue as unknown[]).length}]`
                : `Object{${Object.keys(complexValue as Record<string, unknown>).length}}`}
            </Badge>
          </span>

          <div className={`ml-auto flex gap-0.5 ${ROW_ACTIONS_VISIBILITY}`}>
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

        {/* Children mount only while expanded. */}
        {!isCollapsed && <BodyChildList value={complexValue} path={path} level={level + 1} />}
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
            type={hidden ? "password" : "text"}
            autoComplete="off"
            onFocus={needsReentry ? e => e.target.select() : undefined}
            aria-label={`Value of ${fieldKey}`}
            className="font-mono text-xs h-7"
          />
        ) : (
          <span className="font-mono text-sm text-foreground">
            {hidden
              ? <MaskedString text={`"${String(redactFieldValue(keyPath, value, { placeholder: MASK }))}"`} />
              : typeof value === "string"
                ? `"${value}"`
                : String(value ?? "null")}
          </span>
        )}
        {needsReentry && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/40">
            Redacted: re-enter value
          </span>
        )}
        {isSecret && <RevealToggle label={fieldKey} revealed={revealed} onToggle={() => setRevealed(r => !r)} />}
      </div>

      <div className={`flex gap-0.5 ${ROW_ACTIONS_VISIBILITY}`}>
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

const MemoBodyFieldNode = memo(BodyFieldNode);
export default MemoBodyFieldNode;
