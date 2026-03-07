import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import ParsedCurlEditor from "@/components/features/curl/ParsedCurlEditor";

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
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">No parsed data available. Please parse a cURL command first.</p>
        <button
          onClick={() => navigate('/playground')}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4"
        >
          Go to Playground
        </button>
      </div>
    );
  }

  return (
    <ParsedCurlEditor
      initialData={parsed}
      originalCurl={originalCurl}
      onBack={handleBack}
    />
  );
}
