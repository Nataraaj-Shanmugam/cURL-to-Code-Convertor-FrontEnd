"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ParsedResultCard } from "./ParsedResultCard";
import { CurlFilterDialog } from "./CurlFilterDialog";
import { useCurlParser } from "@/lib/hooks/useCurlParser";

export default function CurlPlayground() {
  const [curl, setCurl] = useState("");
  const { parsed, error, loading, selectedKeys, setSelectedKeys, parseCurl, reset } = useCurlParser();

  const handleParse = () => parseCurl(curl);

  const handleReset = () => {
    setCurl("");
    reset();
  };

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold">cURL Playground</h1>

      <textarea
        value={curl}
        onChange={(e) => setCurl(e.target.value)}
        placeholder='Paste your cURL command here (e.g., curl -X POST "https://api.example.com" ...)'
        className="w-full min-h-[200px] sm:min-h-[250px] lg:min-h-[300px] resize-y border rounded-md p-3 font-mono text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
      />

      <div className="flex gap-3 flex-wrap">
        <Button
          onClick={handleParse}
          disabled={loading || !curl.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {loading ? "Parsing..." : "Parse cURL"}
        </Button>

        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>

        {parsed && (
          <CurlFilterDialog
            parsed={parsed}
            selectedKeys={selectedKeys}
            setSelectedKeys={setSelectedKeys}
          />
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-600 rounded-md text-sm border border-red-300">
          {error}
        </div>
      )}

      {parsed && (
        <div className="mt-6">
          <ParsedResultCard parsed={parsed} />
        </div>
      )}
    </div>
  );
}