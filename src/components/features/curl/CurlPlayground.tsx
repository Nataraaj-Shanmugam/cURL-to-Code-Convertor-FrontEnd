import { useState, useEffect, useCallback, useRef, memo } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api/apiClient";
import { ENV } from "@/lib/env";
import { EXAMPLE_CURLS } from "@/constants/curl";
import { Alert } from "@/components/ui/alert";
import { MethodBadge } from "@/components/ui/method-badge";
import { Terminal, Play, RotateCcw, ChevronRight, Loader2, Upload, Plus, X, Layers, ShieldCheck } from "lucide-react";
import ImportDialog from "@/components/features/import/ImportDialog";
import { parseCurlBatch } from "@/lib/utils/parseCurlBatch";
import type { BatchParseFailure } from "@/types/batch";

let nextId = 1;
function createEntry(value = ""): { id: number; value: string } {
  return { id: nextId++, value };
}

type Entry = { id: number; value: string };

function CurlPlayground() {
  const [entries, setEntries] = useState<Entry[]>(() => [createEntry()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Parse errors for individual commands in a batch, keyed by entry id.
  const [entryErrors, setEntryErrors] = useState<Record<number, string>>({});
  const [showImportDialog, setShowImportDialog] = useState(false);
  const navigate = useNavigate();

  // A parse can outlive this page; don't navigate on its behalf after the user has left.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const parseEndpoint = ENV.PARSE_ENDPOINT;

  const isMulti = entries.length > 1;
  const filledEntries = entries.filter((e) => e.value.trim());
  const hasAnyContent = filledEntries.length > 0;
  // Blank entries are ignored: what decides single vs. batch is how many commands were filled in.
  const isBatchParse = filledEntries.length > 1;

  // Parse one curl → editor
  const handleParseSingle = useCallback(
    async (rawCurl: string) => {
      const curl = rawCurl.trim();
      if (!curl) return;

      setLoading(true);
      setError("");
      setEntryErrors({});

      try {
        const { data: result } = await apiClient.post(parseEndpoint, { curl });

        if (!result.success) {
          const errMsg = typeof result.error === "object"
            ? result.error.message
            : result.error || "Failed to parse cURL";
          setError(errMsg);
          return;
        }

        const parsed = Array.isArray(result.data) ? result.data[0] : result.data;

        navigate("/editor", {
          state: { parsed, originalCurl: curl },
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to parse cURL command");
      } finally {
        setLoading(false);
      }
    },
    [navigate, parseEndpoint]
  );

  // Parse several curls → batch editor. Parsing happens here, before navigating, so the batch
  // editor is handed finished items instead of having to wait on (and re-seed from) an async parse.
  const parseBatch = useCallback(
    async (batch: Entry[]) => {
      // Remember each command's position in the list the user sees; blanks are skipped.
      const sources = batch
        .map((entry, position) => ({ entry, position, curl: entry.value.trim() }))
        .filter((source) => source.curl);
      if (sources.length === 0) return;
      if (sources.length === 1) {
        await handleParseSingle(sources[0]!.curl);
        return;
      }

      setLoading(true);
      setError("");
      setEntryErrors({});

      const { items, failures } = await parseCurlBatch(sources.map((s) => s.curl));
      if (!mountedRef.current) return;
      setLoading(false);

      // Report failures against the position the user sees ("Command 3"), not the filtered one.
      const located: BatchParseFailure[] = failures.map((failure) => ({
        ...failure,
        index: sources[failure.index]!.position,
      }));

      if (items.length === 0) {
        // Nothing to edit: stay here, flag every command that failed.
        const byEntry: Record<number, string> = {};
        failures.forEach((failure) => {
          byEntry[sources[failure.index]!.entry.id] = failure.message;
        });
        setEntryErrors(byEntry);
        setError(`None of the ${sources.length} cURL commands could be parsed.`);
        return;
      }

      navigate("/batch-editor", { state: { items, failures: located } });
    },
    [handleParseSingle, navigate]
  );

  // Smart parse: one filled command → editor, several → batch editor
  const handleParse = useCallback(async () => {
    if (loading) return; // the Ctrl/Cmd+Enter shortcut bypasses the disabled button
    await parseBatch(entries);
  }, [entries, loading, parseBatch]);

  const handleReset = () => {
    setEntries((prev) => [{ id: prev[0]?.id ?? nextId++, value: "" }]);
    setError("");
    setEntryErrors({});
  };

  const updateEntry = (id: number, value: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, value } : e)));
    setError("");
    setEntryErrors((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, createEntry()]);
  };

  const removeEntry = (id: number) => {
    setEntries((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((e) => e.id !== id);
    });
    setEntryErrors((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Keyboard shortcut: Cmd/Ctrl + Enter to parse
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleParse();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleParse]);

  // Visible label and accessible name of each input: "cURL command" or, with several, "cURL command 2".
  const commandLabel = (idx: number) => (isMulti ? `cURL command ${idx + 1}` : "cURL command");

  const allEmpty = entries.every((e) => !e.value.trim());
  const hasEmpty = entries.some((e) => !e.value.trim());

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6 bg-grid min-h-[calc(100vh-12rem)]">
      {/* Screen-reader live region for async status; errors are announced by their own alerts */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {loading ? "Parsing cURL command\u2026" : ""}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Terminal className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono">cURL Playground</h1>
            <p className="text-sm text-muted-foreground">
              Paste {isMulti ? "multiple cURL commands" : "a cURL command"} to parse and generate test code
            </p>
          </div>
        </div>
        {isMulti && (
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              {entries.length} command{entries.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* cURL inputs */}
      <div className="space-y-3">
        {entries.map((entry, idx) => (
          <div
            key={entry.id}
            className="rounded-lg border border-border overflow-hidden shadow-sm group/card transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/70"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/70"></span>
              </div>
              <label htmlFor={`curl-input-${entry.id}`} className="text-xs text-muted-foreground font-mono ml-2">
                {commandLabel(idx)}
              </label>
              <div className="flex-1" />
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  className="opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 transition-opacity -my-1 -mr-2 inline-flex h-7 w-7 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:opacity-100"
                  title="Remove this cURL"
                  aria-label={`Remove ${commandLabel(idx)}`}
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <textarea
              id={`curl-input-${entry.id}`}
              value={entry.value}
              onChange={(e) => updateEntry(entry.id, e.target.value)}
              placeholder={
                idx === 0
                  ? `$ curl -X POST "https://api.example.com/data" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer <token>" \\\n  -d '{"key": "value"}'`
                  : `$ curl -X GET "https://api.example.com/resource" \\\n  -H "Accept: application/json"`
              }
              className={`w-full resize-y p-4 font-mono text-sm focus:outline-none bg-card text-foreground placeholder:text-muted-foreground leading-relaxed ${
                isMulti ? "min-h-[100px] sm:min-h-[120px]" : "min-h-[160px] sm:min-h-[220px] lg:min-h-[280px]"
              }`}
              spellCheck={false}
              aria-invalid={entryErrors[entry.id] ? true : undefined}
            />
            {entryErrors[entry.id] && (
              <Alert variant="destructive" className="rounded-none border-x-0 border-b-0 px-4 py-2">
                <span>
                  {isMulti ? `${commandLabel(idx)}: ` : ""}
                  {entryErrors[entry.id]}
                </span>
              </Alert>
            )}
          </div>
        ))}

        {/* Add more button */}
        <button
          onClick={addEntry}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-border
                     hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary group/add"
        >
          <Plus className="w-4 h-4 transition-transform group-hover/add:scale-110" />
          <span className="text-sm font-medium">Add another cURL</span>
        </button>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="curl-data-notice">
          <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Your cURL is sent to the cURLCraft backend to be parsed (and later to generate code). This page doesn&apos;t
            store it beyond your browser session.
          </span>
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={handleParse}
          disabled={loading || !hasAnyContent}
          size="lg"
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isBatchParse ? (
            <Layers className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {loading
            ? "Parsing..."
            : isBatchParse
              ? `Parse All (${filledEntries.length})`
              : "Parse cURL"}
        </Button>

        <Button variant="outline" onClick={handleReset} disabled={allEmpty && entries.length === 1} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>

        <Button variant="outline" onClick={() => setShowImportDialog(true)} className="gap-2">
          <Upload className="w-4 h-4" />
          Import
        </Button>

        <span className="text-xs text-muted-foreground hidden sm:inline" aria-label="Keyboard shortcut: Control or Command plus Enter">
          <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px] border border-border">{"\u2318"}</kbd>
          {" + "}
          <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px] border border-border">{"\u21B5"}</kbd>
        </span>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <span>{error}</span>
        </Alert>
      )}

      {/* Import Dialog */}
      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportSingle={(c) => {
          setEntries([createEntry(c)]);
          setError("");
        }}
        onImportMultiple={(curls) => {
          // Show the imported commands, then parse them like Parse All would: a command that
          // fails is reported next to its own input instead of silently disappearing.
          const imported = curls.map((curl) => createEntry(curl));
          setEntries(imported);
          void parseBatch(imported);
        }}
      />

      {/* Example commands — show when all empty, or in multi-mode with any empty entry */}
      {(allEmpty || (isMulti && hasEmpty)) && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Try an example:</p>
          <div className="grid grid-cols-2 gap-3">
            {EXAMPLE_CURLS.map((example) => (
              <button
                key={example.label}
                onClick={() =>
                  setEntries((prev) => {
                    const updated = [...prev];
                    const emptyIdx = updated.findIndex((e) => !e.value.trim());
                    if (emptyIdx !== -1) {
                      updated[emptyIdx] = { ...updated[emptyIdx]!, value: example.curl };
                    }
                    return updated;
                  })
                }
                className="group flex flex-col gap-2.5 p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all text-left"
              >
                <div className="flex items-center gap-2">
                  <MethodBadge method={example.method} />
                  <span className="text-sm font-semibold text-foreground">{example.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono truncate w-full">{example.curl}</p>
                <div className="flex items-center gap-1 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-3 h-3" />
                  <span>Use this example</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(CurlPlayground);
