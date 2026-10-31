import { useState, useEffect, useRef, useId } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { X, Layers, ArrowLeft, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { deriveItemPath, isItemEdited, useBatchEditor } from "@/lib/hooks/useBatchEditor";
import { useUnsavedChangesGuard } from "@/lib/hooks/useUnsavedChangesGuard";
import { parseCurlBatch } from "@/lib/utils/parseCurlBatch";
import ParsedCurlEditor from "@/components/features/curl/ParsedCurlEditor";
import BatchCodeGenerationDialog from "@/components/features/curl/BatchCodeGenerationDialog";
import UnsavedChangesDialog from "@/components/features/curl/UnsavedChangesDialog";
import type { BatchParseFailure, ParsedCurlEntry } from "@/types/batch";
import { MASK, countRedactions, redactCurlString } from "@/lib/utils/redaction";
import { MaskedString } from "@/components/features/curl/editor/SecretValue";
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

/**
 * One command that did not parse: shown with its error, editable, and retryable in place. The raw
 * command can carry secrets, so it stays a masked one-line snippet until the user chooses to edit
 * it; only then is the textarea (with the real command, from memory) shown.
 */
function FailedCommandRow({
  failure,
  onParsed,
}: {
  failure: BatchParseFailure;
  onParsed: (failure: BatchParseFailure, entry: ParsedCurlEntry) => void;
}) {
  const [curl, setCurl] = useState(failure.curl);
  const [message, setMessage] = useState(failure.message);
  const [retrying, setRetrying] = useState(false);
  const [editing, setEditing] = useState(false);
  const number = failure.index + 1;

  const retry = async () => {
    if (!curl.trim()) {
      setMessage("Enter a cURL command to parse");
      return;
    }
    setRetrying(true);
    const { items, failures } = await parseCurlBatch([curl]);
    setRetrying(false);
    const entry = items[0];
    if (entry) onParsed(failure, entry);
    else setMessage(failures[0]?.message ?? "Failed to parse cURL");
  };

  return (
    <li data-testid="parse-failure" className="space-y-1">
      <p>
        <span className="font-semibold">Command {number}:</span> {message}
      </p>
      {editing ? (
        <>
          <Textarea
            value={curl}
            onChange={(e) => setCurl(e.target.value)}
            aria-label={`cURL for command ${number}`}
            rows={2}
            spellCheck={false}
            className="font-mono text-xs bg-background text-foreground min-h-0"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={retry}
            disabled={retrying}
            aria-label={`Retry command ${number}`}
            className="h-7 gap-1.5 text-xs bg-background text-foreground"
          >
            {retrying && <Loader2 className="w-3 h-3 animate-spin" />}
            Retry
          </Button>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <code
            data-testid="parse-failure-snippet"
            className="flex-1 min-w-0 truncate font-mono text-xs bg-background text-foreground rounded px-2 py-1"
          >
            <MaskedString text={redactCurlString(curl, { placeholder: MASK }).replace(/\s*\n\s*/g, " ")} />
          </code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            aria-label={`Edit and retry command ${number}`}
            className="h-7 text-xs shrink-0 bg-background text-foreground"
          >
            Edit and retry
          </Button>
        </div>
      )}
    </li>
  );
}

function ParseFailureBanner({
  failures,
  onDismiss,
  onParsed,
}: {
  failures: BatchParseFailure[];
  onDismiss: () => void;
  onParsed: (failure: BatchParseFailure, entry: ParsedCurlEntry) => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm border border-destructive/30"
    >
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <p className="font-medium">
          {failures.length} {failures.length === 1 ? "command" : "commands"} could not be parsed and{" "}
          {failures.length === 1 ? "was" : "were"} left out of this batch. Fix{" "}
          {failures.length === 1 ? "it" : "them"} and retry.
        </p>
        <ul className="space-y-3 max-h-48 overflow-y-auto pr-1">
          {failures.map((failure) => (
            <FailedCommandRow key={failure.index} failure={failure} onParsed={onParsed} />
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

  const {
    items,
    selectedId,
    selectedItem,
    selectItem,
    updateParsed,
    addItem,
    restoreItem,
    removeItem,
  } = useBatchEditor(restore.items);

  // Edits are mirrored into the items as they are made, so "unsaved" means: an item's request
  // differs from what it was loaded with. Leaving the page (or reloading) would lose them.
  const hasEdits = items.some(isItemEdited);
  const { isBlocked, stay, leave } = useUnsavedChangesGuard(hasEdits);

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

  // Keep the latest items reachable from the toast's Undo without re-creating handlers.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const handleRemove = (id: string) => {
    const index = itemsRef.current.findIndex((item) => item.id === id);
    const item = itemsRef.current[index];
    if (!item) return;
    removeItem(id);
    toast(`Removed ${item.name}`, {
      duration: 8000,
      action: { label: "Undo", onClick: () => restoreItem(item, index) },
    });
  };

  const handleFailureParsed = (failure: BatchParseFailure, entry: ParsedCurlEntry) => {
    addItem(entry);
    setFailures((prev) => prev.filter((f) => f.index !== failure.index));
    toast.success(`Command ${failure.index + 1} parsed and added to the batch`);
  };

  const failureBanner =
    failures.length > 0 ? (
      <ParseFailureBanner
        failures={failures}
        onDismiss={() => setFailures([])}
        onParsed={handleFailureParsed}
      />
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
    <div className="flex flex-col md:h-[calc(100vh-8rem)] md:overflow-hidden">
      {failureBanner && <div className="p-2 border-b shrink-0">{failureBanner}</div>}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 md:overflow-hidden gap-0">
        {/* Request list: a sidebar from md up, a compact top bar with a selector below it */}
        <div className="w-full md:w-72 shrink-0 md:border-r border-b md:border-b-0 flex flex-col md:overflow-hidden bg-muted/20">
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

          {/* Small screens: pick the request from a native select (a drawer would need a lot of
              chrome for a list this short) and remove it with a button that is always visible. */}
          <div className="md:hidden flex items-center gap-2 px-3 py-2">
            <label htmlFor="batch-request-select" className="sr-only">
              Request
            </label>
            <select
              id="batch-request-select"
              value={selectedId ?? ""}
              onChange={(e) => selectItem(e.target.value)}
              className="flex-1 min-w-0 h-10 rounded-md border border-input bg-background px-2 text-sm"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {isItemEdited(item) ? "• " : ""}
                  {item.name}
                </option>
              ))}
            </select>
            {selectedItem && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => handleRemove(selectedItem.id)}
                aria-label="Remove selected request"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Request list */}
          <ul className="hidden md:block flex-1 overflow-y-auto py-1" aria-label="Requests">
            {items.map((item, index) => {
              const selected = item.id === selectedId;
              const edited = isItemEdited(item);
              const method = (item.parsed.method || "GET").toUpperCase();
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
                    aria-describedby={edited ? `${item.id}-edited` : undefined}
                    className="flex flex-1 min-w-0 items-center gap-2 px-2 py-2 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono shrink-0 ${
                        METHOD_COLORS[method] ?? "bg-gray-500/15 text-gray-600"
                      }`}
                    >
                      {method}
                    </span>{" "}
                    <span className="text-xs truncate flex-1">{deriveItemPath(item.parsed, index)}</span>
                    {edited && (
                      <span
                        aria-hidden="true"
                        title="Edited"
                        data-testid="edited-dot"
                        className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                      />
                    )}
                  </button>
                  {edited && (
                    <span id={`${item.id}-edited`} className="sr-only">
                      Edited
                    </span>
                  )}
                  <button
                    type="button"
                    className="h-6 w-6 inline-flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity rounded hover:bg-destructive/10 hover:text-destructive shrink-0"
                    onClick={() => handleRemove(item.id)}
                    title="Remove"
                    aria-label={`Remove ${item.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right panel: one editor per visited request, only the selected one visible */}
        <div data-testid="batch-editor-panel" className="flex-1 min-w-0 md:overflow-y-auto">
          {items.map((item) =>
            visitedIds.has(item.id) || item.id === selectedId ? (
              <div key={item.id} hidden={item.id !== selectedId}>
                <ParsedCurlEditor
                  initialData={item.parsed}
                  originalCurl={item.originalCurl}
                  isActive={item.id === selectedId}
                  onChange={(data) => updateParsed(item.id, data)}
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

      <UnsavedChangesDialog open={isBlocked} onStay={stay} onLeave={leave} />
    </div>
  );
}
