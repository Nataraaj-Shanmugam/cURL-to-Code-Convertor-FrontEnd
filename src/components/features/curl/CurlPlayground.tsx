"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function CurlPlayground() {
  const [curl, setCurl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleParse = async () => {
    if (!curl.trim()) return;
    
    setLoading(true);
    setError("");
    
    try {
      const response = await fetch("http://127.0.0.1:8000/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curl })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        setError(result.error || "Failed to parse cURL");
        setLoading(false);
        return;
      }
      
      const parsed = Array.isArray(result.data) ? result.data[0] : result.data;
      
      // Auto-navigate to editor with both curl and parsed data
      navigate('/editor', { 
        state: { 
          parsed: parsed,
          originalCurl: curl 
        } 
      });
    } catch (err: any) {
      setError(err.message || "Failed to parse cURL command");
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCurl("");
    setError("");
  };

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold">cURL Playground</h1>

      <textarea
        value={curl}
        onChange={(e) => setCurl(e.target.value)}
        placeholder='Paste your cURL command here (e.g., curl -X POST "https://api.example.com" ...)'
        className="w-full min-h-[200px] sm:min-h-[250px] lg:min-h-[300px] resize-y border rounded-md p-3 font-mono text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary shadow-sm bg-background"
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
      </div>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm border border-red-300 dark:border-red-800">
          {error}
        </div>
      )}
    </div>
  );
}