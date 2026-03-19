import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Layers, ArrowLeft } from "lucide-react";
import { apiClient } from "@/lib/api/apiClient";
import { ENV } from "@/lib/env";
import { useBatchEditor } from "@/lib/hooks/useBatchEditor";
import ParsedCurlEditor from "@/components/features/curl/ParsedCurlEditor";
import BatchCodeGenerationDialog from "@/components/features/curl/BatchCodeGenerationDialog";
import type { ParsedCurl } from "@/types/curl";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  POST: "bg-green-500/15 text-green-600 dark:text-green-400",
  PUT: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  PATCH: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400",
  HEAD: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  OPTIONS: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
};

interface LocationState {
  items?: { parsed: ParsedCurl; originalCurl: string }[];
  curls?: string[];
}

export default function BatchEditorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state || {}) as LocationState;

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialItems, setInitialItems] = useState<
    { parsed: ParsedCurl; originalCurl: string }[]
  >(state.items || []);
  const [showGenDialog, setShowGenDialog] = useState(false);

  // If curls provided, parse them all
  useEffect(() => {
    if (state.curls && state.curls.length > 0) {
      setIsLoading(true);
      setLoadError(null);

      Promise.allSettled(
        state.curls.map((curl) => apiClient.post(ENV.PARSE_ENDPOINT, { curl }))
      ).then((results) => {
        const parsedItems: { parsed: ParsedCurl; originalCurl: string }[] = [];
        for (let i = 0; i < results.length; i++) {
          const result = results[i]!;
          const curl = state.curls![i] ?? "";
          if (result.status === "fulfilled") {
            const resp = result.value.data;
            if (resp?.success && resp.data) {
              const parsed = Array.isArray(resp.data) ? resp.data[0] : resp.data;
              parsedItems.push({ parsed: parsed as ParsedCurl, originalCurl: curl });
            }
          }
          // silently skip failed ones
        }
        setInitialItems(parsedItems);
        setIsLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { items, selectedIndex, setSelectedIndex, updateItem, removeItem } =
    useBatchEditor(initialItems);

  // Empty state
  if (!isLoading && items.length === 0 && !loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
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

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Parsing cURL commands...</p>
      </div>
    );
  }

  const selectedItem = items[selectedIndex];

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden gap-0">
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
            disabled={items.length === 0}
            className="text-xs h-7 px-2 gap-1"
          >
            Generate All
          </Button>
        </div>

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
        <div className="flex-1 overflow-y-auto py-1">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 px-2 py-2 cursor-pointer rounded-md mx-1 my-0.5 group ${
                idx === selectedIndex
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted/60"
              }`}
              onClick={() => setSelectedIndex(idx)}
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
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 hover:text-destructive shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(idx);
                }}
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel: ParsedCurlEditor */}
      <div className="flex-1 overflow-y-auto">
        {selectedItem ? (
          <ParsedCurlEditor
            key={selectedIndex}
            initialData={selectedItem.parsed}
            originalCurl={selectedItem.originalCurl}
            onSave={(data) => updateItem(selectedIndex, { parsed: data })}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a request from the list
          </div>
        )}
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
