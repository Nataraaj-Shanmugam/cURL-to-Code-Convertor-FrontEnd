import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Code, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { useCurlParser } from "@/lib/hooks/useCurlParser";

export default function CurlPlayground() {
  const navigate = useNavigate();
  const { parsed, error, loading, parseCurl, reset } = useCurlParser();
  const [curlInput, setCurlInput] = useState("");

  const handleParse = async () => {
    const result = await parseCurl(curlInput);
    if (result) {
      // Navigate to editor with parsed data
      navigate("/editor", {
        state: {
          parsed: result,
          originalCurl: curlInput,
        },
      });
    }
  };

  const handleReset = () => {
    setCurlInput("");
    reset();
  };

  const exampleCurl = `curl -X POST https://api.example.com/users \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer token123" \\
  -d '{"name":"John Doe","email":"john@example.com"}'`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold">
          cURL Playground
        </h1>
        <p className="text-muted-foreground text-lg">
          Paste your cURL command and transform it into REST Assured test code
        </p>
      </div>

      {/* Main Input Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Paste Your cURL Command
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={curlInput}
            onChange={(e) => setCurlInput(e.target.value)}
            placeholder={exampleCurl}
            className="font-mono text-sm min-h-[200px] resize-y"
          />

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  Parsing Error
                </p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  {error}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleParse}
              disabled={!curlInput.trim() || loading}
              className="bg-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  Parse & Edit
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!curlInput && !parsed}
            >
              Clear
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurlInput(exampleCurl)}
            >
              Load Example
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">💡 Quick Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Copy cURL commands directly from Chrome DevTools, Postman, or any API client</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>After parsing, you'll be able to edit headers, body, query parameters, and more</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Generate production-ready REST Assured test code with custom configurations</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}