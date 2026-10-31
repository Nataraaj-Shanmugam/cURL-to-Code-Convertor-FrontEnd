import { useState, useEffect, useId } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Layers, ArrowLeft, AlertCircle } from "lucide-react";
import { useBatchEditor } from "@/lib/hooks/useBatchEditor";
import ParsedCurlEditor from "@/components/features/curl/ParsedCurlEditor";
import BatchCodeGenerationDialog from "@/components/features/curl/BatchCodeGenerationDialog";
import type { BatchParseFailure } from "@/types/batch";
import { MASK, countRedactions, redactCurlString } from "@/lib/utils/redaction";
import { redactBatchHistoryState, rememberBatchRequest, resolveBatchRestore } from "@/lib/utils/batchStorage";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  POST: "bg-green-500/15 text-green-600 dark:text-green-400",
  PUT: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  PATCH: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400",
  HEAD: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  OPTIONS: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
};

const SNIPPET_LENGTH = 90;
const snippet = (curl: string) => {
  const oneLine = curl.replace(/\s+/g, " ").trim();
  return oneLine.length > SNIPPET_LENGTH ? `${oneLine.slice(0, SNIPPET_LENGTH)}…` : oneLine;
};

function ParseFailureBanner({
  failures,
  onDismiss,
}: {
  failures: BatchParseFailure[];
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm border border-destructive/30"
    >
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-medium">
          {failures.length} {failures.length === 1 ? "command" : "commands"} could not be parsed and{" "}
          {failures.length === 1 ? "was" : "were"} left out of this batch
        </p>
        <ul className="space-y-1">
          {failures.map((failure) => (
            <li key={failure.index} data-testid="parse-failure">
              <span className="font-semibold">Command {failure.index + 1}:</span> {failure.message}
              {failure.curl && (
                <code className="block font-mono text-xs opacity-80 truncate">
                  {snippet(redactCurlString(failure.curl, { placeholder: MASK }))}
                </code>
              )}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss parse errors"
        className="p-0.5 rounded hover:bg-destructive/10 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function BatchEditorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // Route state written by the Playground (parsing happens there, before navigation, so the items
  // are finished). On a reload or Back/Forward it comes back from history.state, redacted; the live
  // values are taken from memory when they are still there. Read once: the editor is seeded once.
  const [restore] = useState(() => resolveBatchRestore(location.state));

  // history.state outlives a reload and can be written to disk: keep only a redacted copy there,
  // and the live values in memory for in-app Back/Forward.
  useEffect(() => {
    if (restore.source === "none") return;
    if (restore.source === "live") rememberBatchRequest({ items: restore.items, failures: restore.failures });
    redactBatchHistoryState();
  }, [restore]);

  const [failures, setFailures] = useState<BatchParseFailure[]>(restore.failures);
  const [showGenDialog, setShowGenDialog] = useState(false);

  const { items, selectedId, selectedItem, selectItem, updateParsed, removeItem } =
    useBatchEditor(restore.items);

  // Requests restored with redacted secrets would generate code with the placeholder in it.
  const redactedCount = items.reduce((n, item) => n + countRedactions(item.parsed), 0);
  const redactedNoteId = useId();

  // Editors are expensive and hold the user's edits (and undo history) in their own state. Mount
  // one the first time its request is selected and keep it mounted — hidden — afterwards, so
  // switching between requests never discards unsaved edits. Each editor is keyed by item id, so
  // removing an item unmounts exactly that item's editor.
  const [visitedIds, setVisitedIds] = useState<ReadonlySet<string>>(() =>
    selectedId ? new Set([selectedId]) : new Set()
  );
  useEffect(() => {
    if (selectedId && !visitedIds.has(selectedId)) {
      setVisitedIds((prev) => new Set(prev).add(selectedId));
    }
  }, [selectedId, visitedIds]);

  const failureBanner =
    failures.length > 0 ? (
      <ParseFailureBanner failures={failures} onDismiss={() => setFailures([])} />
    ) : null;

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        {failureBanner && <div className="w-full max-w-2xl">{failureBanner}</div>}
        <Layers className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">No Requests</h2>
        <p className="text-muted-foreground text-sm">
          Import multiple cURL commands to use the Batch Editor.
        </p>
        <Button onClick={() => navigate("/playground")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Go to Playground
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {failureBanner && <div className="p-2 border-b shrink-0">{failureBanner}</div>}
      <div className="flex flex-1 min-h-0 overflow-hidden gap-0">
        {/* Left sidebar */}
        <div className="w-72 shrink-0 border-r flex flex-col overflow-hidden bg-muted/20">
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-3 py-3 border-b bg-background">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Batch Editor</span>
              <Badge variant="secondary" className="text-xs">
                {items.length}
              </Badge>
            </div>
            <Button
              size="sm"
              onClick={() => setShowGenDialog(true)}
              disabled={items.length === 0 || redactedCount > 0}
              aria-describedby={redactedCount > 0 ? redactedNoteId : undefined}
              className="text-xs h-7 px-2 gap-1"
            >
              Generate All
            </Button>
          </div>
          {redactedCount > 0 && (
            <p
              id={redactedNoteId}
              role="status"
              className="px-3 py-2 border-b text-xs text-amber-900 dark:text-amber-200 bg-amber-500/10"
            >
              Re-enter {redactedCount} redacted value{redactedCount === 1 ? "" : "s"} to generate code.
            </p>
          )}

          {/* Back button */}
          <div className="px-2 py-2 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/playground")}
              className="gap-2 w-full justify-start text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Playground
            </Button>
          </div>

          {/* Request list */}
          <ul className="flex-1 overflow-y-auto py-1" aria-label="Requests">
            {items.map((item) => {
              const selected = item.id === selectedId;
              return (
                <li
                  key={item.id}
                  className={`flex items-center gap-1 pr-1 rounded-md mx-1 my-0.5 group ${
                    selected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectItem(item.id)}
                    aria-current={selected ? "true" : undefined}
                    aria-label={item.name}
                    className="flex flex-1 min-w-0 items-center gap-2 px-2 py-2 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono shrink-0 ${
                        METHOD_COLORS[item.parsed.method?.toUpperCase() || "GET"] ??
                        "bg-gray-500/15 text-gray-600"
                      }`}
                    >
                      {(item.parsed.method || "GET").toUpperCase()}
                    </span>
                    <span className="text-xs truncate flex-1">{item.name}</span>
                  </button>
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 hover:text-destructive shrink-0"
                    onClick={() => removeItem(item.id)}
                    title="Remove"
                    aria-label={`Remove ${item.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right panel: one editor per visited request, only the selected one visible */}
        <div className="flex-1 overflow-y-auto">
          {items.map((item) =>
            visitedIds.has(item.id) || item.id === selectedId ? (
              <div key={item.id} hidden={item.id !== selectedId}>
                <ParsedCurlEditor
                  initialData={item.parsed}
                  originalCurl={item.originalCurl}
                  isActive={item.id === selectedId}
                  onChange={(data) => updateParsed(item.id, data)}
                  onSave={(data) => updateParsed(item.id, data)}
                />
              </div>
            ) : null
          )}
          {!selectedItem && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a request from the list
            </div>
          )}
        </div>
      </div>

      {/* Batch Code Generation Dialog */}
      {showGenDialog && (
        <BatchCodeGenerationDialog
          open={showGenDialog}
          onOpenChange={setShowGenDialog}
          items={items}
        />
      )}
    </div>
  );
}
