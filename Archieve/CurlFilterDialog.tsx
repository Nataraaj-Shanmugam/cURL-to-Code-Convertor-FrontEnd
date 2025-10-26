"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy } from "lucide-react";
import { filterParsed } from "@/lib/utils/curl";
import type { ParsedCurl, FilterState } from "@/types/curl";

interface Props {
  parsed: ParsedCurl;
  selectedKeys: FilterState;
  setSelectedKeys: (keys: FilterState) => void;
}

export function CurlFilterDialog({ parsed, selectedKeys }: Props) {
  const [filtered, setFiltered] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);

  const handleGenerateCode = () => {
    const f = filterParsed(parsed, selectedKeys);
    setFiltered(f);
    setShowDialog(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(filtered, null, 2));
    } catch {
      alert("Copy failed");
    }
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button
          onClick={handleGenerateCode}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          Generate Code (Filtered)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filtered Parsed Output</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2"
            onClick={handleCopy}
            title="Copy JSON"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <pre className="text-xs font-mono bg-muted rounded-md p-3 overflow-auto whitespace-pre-wrap max-h-[60vh]">
            {JSON.stringify(filtered, null, 2)}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}