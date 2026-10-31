import { useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import { Terminal, ArrowRight, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnsavedChangesGuard } from "@/lib/hooks/useUnsavedChangesGuard";
import UnsavedChangesDialog from "@/components/features/curl/UnsavedChangesDialog";
import {
  EDITOR_STATE_TTL_MS,
  clearEditorRestore,
  redactHistoryState,
  rememberEditorRequest,
  resolveEditorRestore,
  saveEditorState,
  touchEditorRestore,
} from "@/lib/utils/editorStorage";

/** Activity (keys, pointer, edits) restarts the saved copy's TTL at most this often. */
const ACTIVITY_THROTTLE_MS = 60 * 1000;

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

  // The router's fresh payload, else a redacted copy (history.state, then sessionStorage), upgraded to
  // the live values when they are still in memory. See resolveEditorRestore.
  const restore = useMemo(() => resolveEditorRestore(location.state), [location.state]);
  const parsed = restore.snapshot?.parsed;
  const originalCurl = restore.snapshot?.originalCurl;

  useEffect(() => {
    document.title = "Editor — cURLCraft Assured";
  }, []);

  useEffect(() => {
    // Once the user has cleared the saved copy, keep it cleared for the rest of this visit.
    if (parsed && savedCopy !== "cleared") {
      setSavedCopy(saveEditorState(parsed, originalCurl) ? "saved" : "none");
      // The live values stay in memory only, so in-app Back/Forward can restore them.
      rememberEditorRequest({ parsed, originalCurl });
      // The router's copy in history.state outlives a reload too: keep only the redacted one there.
      redactHistoryState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, originalCurl]);

  // The TTL counts from the last activity, not from parse time.
  const savedCopyRef = useRef(savedCopy);
  savedCopyRef.current = savedCopy;
  const lastTouchRef = useRef(0);
  const noteActivity = useCallback(() => {
    if (savedCopyRef.current === "cleared") return;
    const now = Date.now();
    if (now - lastTouchRef.current < ACTIVITY_THROTTLE_MS) return;
    lastTouchRef.current = now;
    touchEditorRestore(now);
  }, []);
  useEffect(() => {
    if (!parsed) return;
    window.addEventListener("keydown", noteActivity);
    window.addEventListener("pointerdown", noteActivity);
    return () => {
      window.removeEventListener("keydown", noteActivity);
      window.removeEventListener("pointerdown", noteActivity);
    };
  }, [parsed, noteActivity]);

  // Unsaved edits: native prompt on unload and a confirm dialog on in-app navigation, both only
  // while the editor reports real changes against its normalised original.
  const [isDirty, setIsDirty] = useState(false);
  const { isBlocked, stay, leave } = useUnsavedChangesGuard(isDirty);

  const handleClearSaved = () => {
    clearEditorRestore();
    setSavedCopy("cleared");
  };

  // Back clears the persisted editor state, but only once the user has actually left.
  const clearOnLeaveRef = useRef(false);
  const handleBack = () => {
    if (isDirty) clearOnLeaveRef.current = true;
    else clearEditorRestore();
    navigate('/playground');
  };
  const handleStay = useCallback(() => {
    clearOnLeaveRef.current = false;
    stay();
  }, [stay]);
  const handleLeave = useCallback(() => {
    if (clearOnLeaveRef.current) clearEditorRestore();
    leave();
  }, [leave]);

  if (!parsed && restore.source === "expired") {
    const hours = Math.round(EDITOR_STATE_TTL_MS / (60 * 60 * 1000));
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center gap-6">
        <div className="rounded-full bg-muted p-5">
          <Clock className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="text-lg font-semibold">Your saved request has expired</h2>
          <p className="text-sm text-muted-foreground">
            A request is kept for {hours} hours after your last activity in this tab, then deleted. Paste the cURL
            command in the Playground again to continue.
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
                ? "A copy of this request, with secrets redacted, is kept for this browser session so a reload can restore it (you will need to re-enter the secrets)."
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
          onChange={noteActivity}
          onDirtyChange={setIsDirty}
        />
      </Suspense>
      <UnsavedChangesDialog open={isBlocked} onStay={handleStay} onLeave={handleLeave} />
    </>
  );
}
