import { useState, useEffect, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api/apiClient";
import { ENV } from "@/lib/env";
import { EXAMPLE_CURLS, METHOD_COLORS } from "@/constants/curl";
import { Terminal, Play, RotateCcw, AlertCircle, ChevronRight, Loader2 } from "lucide-react";

function CurlPlayground() {
  const [curl, setCurl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const parseEndpoint = ENV.PARSE_ENDPOINT;

  const handleParse = useCallback(async () => {
    if (!curl.trim()) return;

    setLoading(true);
    setError("");

    try {
      const { data: result } = await apiClient.post(parseEndpoint, { curl });

      if (!result.success) {
        const errMsg = typeof result.error === 'object'
          ? result.error.message
          : result.error || "Failed to parse cURL";
        setError(errMsg);
        return;
      }

      const parsed = Array.isArray(result.data) ? result.data[0] : result.data;

      navigate('/editor', {
        state: {
          parsed: parsed,
          originalCurl: curl
        }
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to parse cURL command");
    } finally {
      setLoading(false);
    }
  }, [curl, navigate, parseEndpoint]);

  const handleReset = () => {
    setCurl("");
    setError("");
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

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6 bg-grid min-h-[calc(100vh-12rem)]">
      {/* Screen-reader live region for async status */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {loading ? 'Parsing cURL command…' : error ? `Error: ${error}` : ''}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Terminal className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-mono">cURL Playground</h1>
          <p className="text-sm text-muted-foreground">Paste a cURL command to parse and generate test code</p>
        </div>
      </div>

      {/* Terminal-style textarea */}
      <div className="rounded-lg border border-border overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-400/70"></span>
            <span className="w-3 h-3 rounded-full bg-yellow-400/70"></span>
            <span className="w-3 h-3 rounded-full bg-green-400/70"></span>
          </div>
          <span className="text-xs text-muted-foreground font-mono ml-2">curl-input</span>
        </div>
        <textarea
          value={curl}
          onChange={(e) => { setCurl(e.target.value); setError(""); }}
          placeholder={`$ curl -X POST "https://api.example.com/data" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer <token>" \\\n  -d '{"key": "value"}'`}
          className="w-full min-h-[160px] sm:min-h-[220px] lg:min-h-[280px] resize-y p-4 font-mono text-sm
                     focus:outline-none bg-card text-foreground placeholder:text-muted-foreground/50
                     leading-relaxed"
          spellCheck={false}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={handleParse}
          disabled={loading || !curl.trim()}
          size="lg"
          className="gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? "Parsing..." : "Parse cURL"}
        </Button>

        <Button variant="outline" onClick={handleReset} disabled={!curl} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>

        <span className="text-xs text-muted-foreground hidden sm:inline" aria-label="Keyboard shortcut: Control or Command plus Enter">
          <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px] border border-border">⌘</kbd>
          {" + "}
          <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px] border border-border">↵</kbd>
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm border border-destructive/30">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Example commands */}
      {!curl && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Try an example:</p>
          <div className="grid grid-cols-2 gap-3">
            {EXAMPLE_CURLS.map((example) => (
              <button
                key={example.label}
                onClick={() => setCurl(example.curl)}
                className="group flex flex-col gap-2.5 p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all text-left"
              >
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${METHOD_COLORS[example.method] || ""}`}>
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
