import { memo, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ParsedCurl } from "@/types/curl";
import { computeDiff } from "@/lib/utils/diffEngine";
import type { DiffEntry } from "@/types/diff";
import { RotateCcw } from "lucide-react";

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

  const additions = diffs.filter((d) => d.type === "added").length;
  const modifications = diffs.filter((d) => d.type === "modified").length;
  const deletions = diffs.filter((d) => d.type === "removed").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Changes</DialogTitle>
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
                      <tr
                        key={entry.path}
                        className={`border-b last:border-0 ${rowBg(entry.type)}`}
                      >
                        <td className="px-3 py-2 font-mono break-all align-top">
                          {entry.path}
                        </td>
                        <td className="px-3 py-2 font-mono break-all align-top max-w-[160px]">
                          <span className="whitespace-pre-wrap line-clamp-3 text-red-700 dark:text-red-400">
                            {formatValue(entry.oldValue)}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono break-all align-top max-w-[160px]">
                          <span className="whitespace-pre-wrap line-clamp-3 text-green-700 dark:text-green-400">
                            {formatValue(entry.newValue)}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">{typeBadge(entry.type)}</td>
                        <td className="px-3 py-2 align-top">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Revert this change"
                            onClick={() => onRevert(entry.path)}
                          >
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
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
                <pre className="text-xs font-mono bg-slate-950 text-slate-50 p-3 rounded-md overflow-auto max-h-[50vh] whitespace-pre-wrap break-all">
                  {JSON.stringify(originalParsed, null, 2)}
                </pre>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Current</p>
                <pre className="text-xs font-mono bg-slate-950 text-slate-50 p-3 rounded-md overflow-auto max-h-[50vh] whitespace-pre-wrap break-all">
                  {JSON.stringify(currentParsed, null, 2)}
                </pre>
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
