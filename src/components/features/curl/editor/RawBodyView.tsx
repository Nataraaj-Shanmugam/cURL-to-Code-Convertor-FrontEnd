import { memo, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Edit2, ListTree, Save } from "lucide-react";
import { MaskedString } from "./SecretValue";
import { MASK, redactFieldValue } from "@/lib/utils/redaction";
import { countBodyNodes } from "@/lib/utils/bodySize";

/** Items kept per array, and keys per object, in the read-only preview. */
const PREVIEW_ITEMS = 20;
/** Nesting kept in the preview; deeper containers are summarised. */
const PREVIEW_DEPTH = 6;

/** A small copy of `value` for the preview: long lists are cut, the cut is noted in place. */
const previewOf = (value: unknown, depth = 0): unknown => {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    if (depth >= PREVIEW_DEPTH) return `[… ${value.length} items]`;
    const head = value.slice(0, PREVIEW_ITEMS).map(v => previewOf(v, depth + 1));
    return value.length > PREVIEW_ITEMS ? [...head, `… ${(value.length - PREVIEW_ITEMS).toLocaleString()} more items`] : head;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (depth >= PREVIEW_DEPTH) return `{… ${entries.length} keys}`;
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries.slice(0, PREVIEW_ITEMS)) out[k] = previewOf(v, depth + 1);
  if (entries.length > PREVIEW_ITEMS) out["…"] = `${(entries.length - PREVIEW_ITEMS).toLocaleString()} more keys`;
  return out;
};

interface RawBodyViewProps {
  data: unknown;
  onApply: (value: unknown) => void;
  onShowTree: () => void;
}

/**
 * Raw-JSON view for very large bodies (FE-PERF-1). The tree would mount one row per node; this
 * shows a masked, shortened preview, and an editor with the full JSON text on demand.
 */
function RawBodyView({ data, onApply, onShowTree }: RawBodyViewProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nodeCount = useMemo(() => countBodyNodes(data), [data]);
  // Secret values stay masked in the preview, as in the tree (redacted on the shortened copy).
  const preview = useMemo(
    () => JSON.stringify(redactFieldValue("data", previewOf(data), { placeholder: MASK }), null, 2),
    [data],
  );

  const startEdit = () => {
    setError(null);
    setDraft(JSON.stringify(data, null, 2));
  };
  const apply = () => {
    if (draft === null) return;
    try {
      onApply(JSON.parse(draft) as unknown);
      setDraft(null);
      setError(null);
    } catch (e) {
      setError(`Not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="space-y-2 font-sans">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Large body ({nodeCount.toLocaleString()} values): shown as raw JSON. The tree view is slower at this size.
        </p>
        <div className="flex gap-1.5">
          {draft === null ? (
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={startEdit}>
              <Edit2 className="h-3 w-3" aria-hidden="true" />
              Edit raw JSON
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={apply}>
                <Save className="h-3 w-3" aria-hidden="true" />
                Apply JSON
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onShowTree}>
            <ListTree className="h-3 w-3" aria-hidden="true" />
            Show as tree
          </Button>
        </div>
      </div>
      {error && (
        <Alert variant="destructive" role="alert" className="p-2 text-xs">
          <span>{error}</span>
        </Alert>
      )}
      {draft === null ? (
        <pre
          className="text-xs font-mono whitespace-pre-wrap break-all bg-background p-3 rounded border border-border max-h-[32rem] overflow-auto"
          aria-label="Request body preview"
        >
          <MaskedString text={preview} />
        </pre>
      ) : (
        <Textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          aria-label="Raw request body JSON"
          spellCheck={false}
          className="font-mono text-xs min-h-[24rem] resize-y"
        />
      )}
    </div>
  );
}

export default memo(RawBodyView);
