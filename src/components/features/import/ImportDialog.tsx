import { memo, useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Upload, FileText, CheckSquare, Square } from "lucide-react";
import type { ImportFormat, ImportedRequest } from "@/types/import";
import { parseInput } from "@/lib/parsers/importUtils";
import { parsePostmanCollection } from "@/lib/parsers/postmanParser";
import { parseOpenApiSpec } from "@/lib/parsers/openApiParser";
import type { PostmanCollection, OpenApiSpec } from "@/types/import";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSingle: (curl: string) => void;
  onImportMultiple: (curls: string[]) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  POST: "bg-green-500/15 text-green-600 dark:text-green-400",
  PUT: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  PATCH: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400",
  HEAD: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  OPTIONS: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
};

const hasPostmanVariables = (curl: string) => /\{\{[^}]+\}\}/.test(curl);

function formatBadge(format: ImportFormat | null) {
  if (!format || format === "unknown") {
    return (
      <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-0">
        Unknown Format
      </Badge>
    );
  }
  if (format === "postman") {
    return (
      <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-0">
        Postman Collection
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-0">
      OpenAPI Spec
    </Badge>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  onImportSingle,
  onImportMultiple,
}: ImportDialogProps) {
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [pasteText, setPasteText] = useState("");
  const [detectedFormat, setDetectedFormat] = useState<ImportFormat | null>(null);
  const [requests, setRequests] = useState<ImportedRequest[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setDetectedFormat(null);
    setRequests([]);
    setSelected(new Set());
    setError(null);
  };

  const processText = useCallback(async (text: string) => {
    if (!text.trim()) {
      resetState();
      return;
    }
    setIsParsing(true);
    setError(null);
    try {
      const result = await parseInput(text);
      if (result.error || !result.data) {
        setError(result.error || "Unknown error");
        setDetectedFormat(result.format);
        setRequests([]);
        setSelected(new Set());
        setIsParsing(false);
        return;
      }
      setDetectedFormat(result.format);
      let parsed: ImportedRequest[] = [];
      if (result.format === "postman") {
        parsed = parsePostmanCollection(result.data as PostmanCollection);
      } else if (result.format === "openapi") {
        parsed = parseOpenApiSpec(result.data as OpenApiSpec);
      }
      setRequests(parsed);
      setSelected(new Set(parsed.map((r) => r.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse");
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handlePasteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPasteText(e.target.value);
      processText(e.target.value);
    },
    [processText]
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > MAX_FILE_SIZE) {
        setError("File is too large (max 5 MB).");
        return;
      }
      const text = await file.text();
      setPasteText(text);
      processText(text);
    },
    [processText]
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selected.size === requests.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(requests.map((r) => r.id)));
    }
  };

  const handleImport = () => {
    const selectedRequests = requests.filter((r) => selected.has(r.id));
    if (selectedRequests.length === 0) return;
    const curls = selectedRequests.map((r) => r.curlCommand);
    if (curls.length === 1 && curls[0] !== undefined) {
      onImportSingle(curls[0]);
    } else {
      onImportMultiple(curls);
    }
    onOpenChange(false);
    resetState();
    setPasteText("");
  };

  const handleClose = () => {
    onOpenChange(false);
    resetState();
    setPasteText("");
  };

  // Group requests by folder for display
  const grouped = requests.reduce(
    (acc, req) => {
      const folder: string = req.folder ?? "";
      if (!acc[folder]) acc[folder] = [];
      acc[folder]!.push(req);
      return acc;
    },
    {} as Record<string, ImportedRequest[]>
  );

  const selectedCount = selected.size;
  const allSelected = requests.length > 0 && selected.size === requests.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import from Postman / OpenAPI
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v: string) => setTab(v as "paste" | "upload")}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="shrink-0">
            <TabsTrigger value="paste">
              <FileText className="w-4 h-4 mr-2" />
              Paste
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="w-4 h-4 mr-2" />
              Upload File
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="flex-1 overflow-hidden flex flex-col mt-3 space-y-3">
            <textarea
              value={pasteText}
              onChange={handlePasteChange}
              placeholder="Paste your Postman Collection JSON or OpenAPI YAML/JSON here..."
              className="font-mono text-xs min-h-[140px] resize-y w-full rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
              spellCheck={false}
            />
          </TabsContent>

          <TabsContent value="upload" className="flex-1 overflow-hidden flex flex-col mt-3 space-y-3">
            <div
              className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                Click to upload a <strong>.json</strong> or <strong>.yaml</strong> / <strong>.yml</strong> file
                <br />
                <span className="text-xs">Max 5 MB</span>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.yaml,.yml"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Format detection badge */}
        {(detectedFormat || isParsing) && (
          <div className="flex items-center gap-2 py-1">
            {isParsing ? (
              <span className="text-xs text-muted-foreground">Detecting format...</span>
            ) : (
              <>
                <span className="text-xs text-muted-foreground">Detected:</span>
                {formatBadge(detectedFormat)}
              </>
            )}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm border border-destructive/30 shrink-0">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Request list */}
        {requests.length > 0 && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-2 min-h-0">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-sm font-medium">
                {requests.length} request{requests.length !== 1 ? "s" : ""} found
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="gap-2 text-xs"
              >
                {allSelected ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    Select All
                  </>
                )}
              </Button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-1 border rounded-md p-2">
              {Object.entries(grouped).map(([folder, items]) => (
                <div key={folder || "__root__"}>
                  {folder && (
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 py-1 mt-1">
                      {folder}
                    </p>
                  )}
                  {items.map((req) => (
                    <label
                      key={req.id}
                      className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selected.has(req.id)}
                        onCheckedChange={() => toggleSelect(req.id)}
                      />
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono shrink-0 ${
                          METHOD_COLORS[req.method] ??
                          "bg-gray-500/15 text-gray-600"
                        }`}
                      >
                        {req.method}
                      </span>
                      <span className="text-sm truncate flex-1">{req.name}</span>
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">
                        {req.url}
                      </span>
                      {hasPostmanVariables(req.curlCommand) && (
                        <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-0 text-[9px] shrink-0">
                          vars
                        </Badge>
                      )}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t shrink-0">
          <span className="text-xs text-muted-foreground">
            {selectedCount > 0
              ? `${selectedCount} selected`
              : "No requests selected"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={selectedCount === 0}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Import Selected ({selectedCount})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(ImportDialog);
