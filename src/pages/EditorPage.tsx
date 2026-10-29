import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { Terminal, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearEditorState, loadEditorState, redactHistoryState, saveEditorState } from "@/lib/utils/editorStorage";

const ParsedCurlEditor = lazy(() => import("@/components/features/curl/ParsedCurlEditor"));

function EditorSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse" aria-busy="true" aria-label="Loading editor…">
      <div className="flex items-center gap-3">
        <div className="h-8 w-40 rounded-md bg-muted" />
        <div className="h-8 w-24 rounded-md bg-muted" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}

export default function EditorPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Persistence: a redacted copy lives in sessionStorage so a reload can restore the request.
  const [savedCopy, setSavedCopy] = useState<"none" | "saved" | "cleared">("none");

  const { parsed, originalCurl } = useMemo(() => {
    const fromRoute = location.state?.parsed;
    if (fromRoute) {
      return { parsed: fromRoute, originalCurl: location.state?.originalCurl };
    }
    const stored = loadEditorState();
    return { parsed: stored?.parsed, originalCurl: stored?.originalCurl };
  }, [location.state]);

  useEffect(() => {
    document.title = "Editor — cURLCraft Assured";
  }, []);

  useEffect(() => {
    // Once the user has cleared the saved copy, keep it cleared for the rest of this visit.
    if (parsed && savedCopy !== "cleared") {
      setSavedCopy(saveEditorState(parsed, originalCurl) ? "saved" : "none");
    }
    // The router's copy in history.state outlives a reload too: keep only the redacted one there.
    if (parsed) redactHistoryState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, originalCurl]);

  const handleClearSaved = () => {
    clearEditorState();
    setSavedCopy("cleared");
  };

  // Warn before closing/refreshing with data loaded
  useEffect(() => {
    if (!parsed) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [parsed]);

  const handleBack = () => {
    clearEditorState();
    navigate('/playground');
  };

  if (!parsed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center gap-6">
        <div className="rounded-full bg-muted p-5">
          <Terminal className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="text-lg font-semibold">No cURL command parsed yet</h2>
          <p className="text-sm text-muted-foreground">
            Paste a cURL command in the Playground and hit <strong>Parse</strong> to open it here for editing.
          </p>
        </div>
        <button
          onClick={() => navigate('/playground')}
          className="inline-flex items-center gap-2 justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-5"
        >
          Go to Playground
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      {savedCopy !== "none" && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <div
            role="status"
            className="flex items-center justify-between gap-3 flex-wrap rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
          >
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {savedCopy === "saved"
                ? "A copy of this request, with secrets redacted, is kept for this browser session so a reload can restore it."
                : "Saved copy cleared. Reloading this page will not restore this request."}
            </span>
            {savedCopy === "saved" && (
              <Button variant="outline" size="sm" onClick={handleClearSaved}>
                Clear saved request
              </Button>
            )}
          </div>
        </div>
      )}
      <Suspense fallback={<EditorSkeleton />}>
        <ParsedCurlEditor
          initialData={parsed}
          originalCurl={originalCurl}
          onBack={handleBack}
        />
      </Suspense>
    </>
  );
}
