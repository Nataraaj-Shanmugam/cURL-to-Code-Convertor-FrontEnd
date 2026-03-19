import { useState, useEffect, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api/apiClient";
import { ENV } from "@/lib/env";
import { EXAMPLE_CURLS, METHOD_COLORS } from "@/constants/curl";
import { Terminal, Play, RotateCcw, AlertCircle, ChevronRight, Loader2, Upload, Plus, X, Layers } from "lucide-react";
import ImportDialog from "@/components/features/import/ImportDialog";

let nextId = 1;
function createEntry(value = ""): { id: number; value: string } {
  return { id: nextId++, value };
}

function CurlPlayground() {
  const [entries, setEntries] = useState<{ id: number; value: string }[]>(() => [createEntry()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const navigate = useNavigate();

  const parseEndpoint = ENV.PARSE_ENDPOINT;

  const isMulti = entries.length > 1;
  const filledEntries = entries.filter((e) => e.value.trim());
  const hasAnyContent = filledEntries.length > 0;

  // Parse single curl → editor
  const handleParseSingle = useCallback(async () => {
    const curl = entries[0]?.value.trim();
    if (!curl) return;

    setLoading(true);
    setError("");

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
  }, [entries, navigate, parseEndpoint]);

  // Parse all curls → batch editor
  const handleParseAll = useCallback(() => {
    const curls = entries.map((e) => e.value.trim()).filter(Boolean);
    if (curls.length === 0) return;
    if (curls.length === 1) {
      // Treat single filled entry as single parse
      setEntries([createEntry(curls[0])]);
      // Will be handled by handleParseSingle logic on next render, so do it directly
    }
    navigate("/batch-editor", { state: { curls } });
  }, [entries, navigate]);

  // Smart parse: single → editor, multi → batch
  const handleParse = useCallback(async () => {
    if (!isMulti) {
      await handleParseSingle();
    } else {
      handleParseAll();
    }
  }, [isMulti, handleParseSingle, handleParseAll]);

  const handleReset = () => {
    setEntries((prev) => [{ id: prev[0]?.id ?? nextId++, value: "" }]);
    setError("");
  };

  const updateEntry = (id: number, value: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, value } : e)));
    setError("");
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, createEntry()]);
  };

  const removeEntry = (id: number) => {
    setEntries((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((e) => e.id !== id);
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

  const allEmpty = entries.every((e) => !e.value.trim());
  const hasEmpty = entries.some((e) => !e.value.trim());

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6 bg-grid min-h-[calc(100vh-12rem)]">
      {/* Screen-reader live region for async status */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {loading ? "Parsing cURL command\u2026" : error ? `Error: ${error}` : ""}
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
            className="rounded-lg border border-border overflow-hidden shadow-sm group/card transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/70"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/70"></span>
              </div>
              <span className="text-xs text-muted-foreground font-mono ml-2">
                {isMulti ? `curl-input-${idx + 1}` : "curl-input"}
              </span>
              <div className="flex-1" />
              {entries.length > 1 && (
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="opacity-0 group-hover/card:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                  title="Remove this cURL"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <textarea
              value={entry.value}
              onChange={(e) => updateEntry(entry.id, e.target.value)}
              placeholder={
                idx === 0
                  ? `$ curl -X POST "https://api.example.com/data" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer <token>" \\\n  -d '{"key": "value"}'`
                  : `$ curl -X GET "https://api.example.com/resource" \\\n  -H "Accept: application/json"`
              }
              className={`w-full resize-y p-4 font-mono text-sm focus:outline-none bg-card text-foreground placeholder:text-muted-foreground/50 leading-relaxed ${
                isMulti ? "min-h-[100px] sm:min-h-[120px]" : "min-h-[160px] sm:min-h-[220px] lg:min-h-[280px]"
              }`}
              spellCheck={false}
            />
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
          ) : isMulti ? (
            <Layers className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {loading
            ? "Parsing..."
            : isMulti
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
        <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm border border-destructive/30">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Import Dialog */}
      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportSingle={(c) => {
          setEntries([createEntry(c)]);
          setError("");
        }}
        onImportMultiple={(curls) => navigate("/batch-editor", { state: { curls } })}
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
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${METHOD_COLORS[example.method] || ""}`}
                  >
                    {example.method}
                  </span>
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
