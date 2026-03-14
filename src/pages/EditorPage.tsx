import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, Suspense, lazy } from "react";
import { Terminal, ArrowRight } from "lucide-react";

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

const STORAGE_KEY = "curlcraft_editor_state";

function loadEditorState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveEditorState(parsed: unknown, originalCurl?: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ parsed, originalCurl }));
  } catch {
    // Silently fail if storage is full
  }
}

export function clearEditorState() {
  localStorage.removeItem(STORAGE_KEY);
}

export default function EditorPage() {
  const location = useLocation();
  const navigate = useNavigate();

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
    if (parsed) {
      saveEditorState(parsed, originalCurl);
    }
  }, [parsed, originalCurl]);

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
    <Suspense fallback={<EditorSkeleton />}>
      <ParsedCurlEditor
        initialData={parsed}
        originalCurl={originalCurl}
        onBack={handleBack}
      />
    </Suspense>
  );
}
