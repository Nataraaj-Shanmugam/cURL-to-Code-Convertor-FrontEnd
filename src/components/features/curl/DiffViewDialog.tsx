import { memo, useId, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ParsedCurl } from "@/types/curl";
import { computeDiff } from "@/lib/utils/diffEngine";
import type { DiffEntry } from "@/types/diff";
import { RotateCcw } from "lucide-react";
import { MASK, maskParsedCurl, redactFieldValue } from "@/lib/utils/redaction";
import { MaskedString, MaskedText, RevealToggle } from "./editor/SecretValue";

interface DiffViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalParsed: ParsedCurl;
  currentParsed: ParsedCurl;
  onRevert: (path: string) => void;
}

function formatValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function rowBg(type: DiffEntry["type"]): string {
  switch (type) {
    case "added":
      return "bg-green-50 dark:bg-green-950/20";
    case "removed":
      return "bg-red-50 dark:bg-red-950/20";
    case "modified":
      return "bg-amber-50 dark:bg-amber-950/20";
  }
}

function typeBadge(type: DiffEntry["type"]) {
  switch (type) {
    case "added":
      return (
        <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-0 text-[10px]">
          added
        </Badge>
      );
    case "removed":
      return (
        <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-0 text-[10px]">
          removed
        </Badge>
      );
    case "modified":
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0 text-[10px]">
          modified
        </Badge>
      );
  }
}

/** One changed field. Secret values (old and new) stay masked until the row's toggle is pressed. */
function DiffRow({ entry, onRevert }: { entry: DiffEntry; onRevert: (path: string) => void }) {
  const [revealed, setRevealed] = useState(false);
  const valuesId = useId();
  const oldText = formatValue(entry.oldValue);
  const newText = formatValue(entry.newValue);
  const maskedOld = entry.oldValue === undefined ? oldText : formatValue(redactFieldValue(entry.path, entry.oldValue, { placeholder: MASK }));
  const maskedNew = entry.newValue === undefined ? newText : formatValue(redactFieldValue(entry.path, entry.newValue, { placeholder: MASK }));
  const hasSecret = maskedOld !== oldText || maskedNew !== newText;
  const hidden = hasSecret && !revealed;

  return (
    <tr className={`border-b last:border-0 ${rowBg(entry.type)}`}>
      <td id={`${valuesId}-path`} className="px-3 py-2 font-mono break-all align-top">
        {entry.path}
      </td>
      <td className="px-3 py-2 font-mono break-all align-top max-w-[160px]">
        <span id={`${valuesId}-old`} className="whitespace-pre-wrap line-clamp-3 text-red-700 dark:text-red-400">
          {hidden ? <MaskedString text={maskedOld} /> : oldText}
        </span>
      </td>
      <td className="px-3 py-2 font-mono break-all align-top max-w-[160px]">
        <div className="flex items-start gap-1">
          <span id={`${valuesId}-new`} className="flex-1 min-w-0 whitespace-pre-wrap line-clamp-3 text-green-700 dark:text-green-400">
            {hidden ? <MaskedString text={maskedNew} /> : newText}
          </span>
          {hasSecret && (
            <RevealToggle
              label={entry.path}
              revealed={revealed}
              onToggle={() => setRevealed((r) => !r)}
              controls={`${valuesId}-old ${valuesId}-new`}
            />
          )}
        </div>
      </td>
      <td className="px-3 py-2 align-top">{typeBadge(entry.type)}</td>
      <td className="px-3 py-2 align-top">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="Revert this change"
          aria-label="Revert change"
          aria-describedby={`${valuesId}-path`}
          onClick={() => onRevert(entry.path)}
        >
          <RotateCcw className="w-3 h-3" aria-hidden="true" />
        </Button>
      </td>
    </tr>
  );
}

const RAW_JSON_CLASS =
  "text-xs font-mono bg-slate-950 text-slate-50 p-3 rounded-md overflow-auto max-h-[50vh] whitespace-pre-wrap break-all";

function DiffViewDialog({
  open,
  onOpenChange,
  originalParsed,
  currentParsed,
  onRevert,
}: DiffViewDialogProps) {
  const [activeTab, setActiveTab] = useState<"table" | "raw">("table");

  const diffs = useMemo(
    () => computeDiff(originalParsed as unknown, currentParsed as unknown),
    [originalParsed, currentParsed]
  );

  const originalJson = useMemo(() => JSON.stringify(originalParsed, null, 2), [originalParsed]);
  const currentJson = useMemo(() => JSON.stringify(currentParsed, null, 2), [currentParsed]);
  const maskedOriginalJson = useMemo(() => JSON.stringify(maskParsedCurl(originalParsed), null, 2), [originalParsed]);
  const maskedCurrentJson = useMemo(() => JSON.stringify(maskParsedCurl(currentParsed), null, 2), [currentParsed]);

  const additions = diffs.filter((d) => d.type === "added").length;
  const modifications = diffs.filter((d) => d.type === "modified").length;
  const deletions = diffs.filter((d) => d.type === "removed").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Changes</DialogTitle>
          <DialogDescription>Secret values are hidden; use the eye button on a row or pane to reveal them.</DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-0">
            +{additions} addition{additions !== 1 ? "s" : ""}
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0">
            ~{modifications} modification{modifications !== 1 ? "s" : ""}
          </Badge>
          <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-0">
            -{deletions} deletion{deletions !== 1 ? "s" : ""}
          </Badge>
          {diffs.length === 0 && (
            <span className="text-sm text-muted-foreground">No changes detected.</span>
          )}
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v: string) => setActiveTab(v as "table" | "raw")}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="shrink-0">
            <TabsTrigger value="table">Change Table</TabsTrigger>
            <TabsTrigger value="raw">Raw JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="table" className="flex-1 overflow-auto mt-0 pt-3">
            {diffs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No changes to display.
              </p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium w-1/4">Path</th>
                      <th className="text-left px-3 py-2 font-medium w-1/4">Original</th>
                      <th className="text-left px-3 py-2 font-medium w-1/4">Current</th>
                      <th className="text-left px-3 py-2 font-medium w-1/6">Type</th>
                      <th className="text-left px-3 py-2 font-medium w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffs.map((entry) => (
                      <DiffRow key={entry.path} entry={entry} onRevert={onRevert} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="raw" className="flex-1 overflow-auto mt-0 pt-3">
            <div className="grid grid-cols-2 gap-3 h-full">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Original</p>
                <MaskedText label="original request JSON" text={originalJson} maskedText={maskedOriginalJson} className={RAW_JSON_CLASS} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Current</p>
                <MaskedText label="current request JSON" text={currentJson} maskedText={maskedCurrentJson} className={RAW_JSON_CLASS} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(DiffViewDialog);
