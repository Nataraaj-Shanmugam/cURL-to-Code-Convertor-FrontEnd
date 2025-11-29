import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Code, Loader2, AlertCircle, ArrowRight, Sparkles, Copy, RotateCcw, BookOpen, CheckCircle2, Clock } from "lucide-react";
import { useCurlParser } from "@/lib/hooks/useCurlParser";


const CURL_TEMPLATES = [
  {
    name: "GET with Headers",
    description: "Simple GET request with authorization",
    icon: "🔍",
    curl: `curl -X GET https://api.example.com/users/123 \\
  -H "Authorization: Bearer your_token_here" \\
  -H "Accept: application/json"`
  },
  {
    name: "POST with JSON",
    description: "Create resource with JSON body",
    icon: "📝",
    curl: `curl -X POST https://api.example.com/users \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer token123" \\
  -d '{"name":"John Doe","email":"john@example.com","age":30}'`
  },
  {
    name: "PUT Update",
    description: "Update existing resource",
    icon: "✏️",
    curl: `curl -X PUT https://api.example.com/users/123 \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer token123" \\
  -d '{"name":"Jane Doe","email":"jane@example.com"}'`
  },
  {
    name: "DELETE Request",
    description: "Remove a resource",
    icon: "🗑️",
    curl: `curl -X DELETE https://api.example.com/users/123 \\
  -H "Authorization: Bearer token123"`
  },
  {
    name: "Form Data Upload",
    description: "Multipart form with file",
    icon: "📤",
    curl: `curl -X POST https://api.example.com/upload \\
  -H "Authorization: Bearer token123" \\
  -F "file=@document.pdf" \\
  -F "category=documents"`
  },
  {
    name: "Query Parameters",
    description: "GET with multiple params",
    icon: "🔗",
    curl: `curl -X GET "https://api.example.com/search?q=test&page=1&limit=10" \\
  -H "Authorization: Bearer token123" \\
  -H "Accept: application/json"`
  }
];

export default function CurlPlayground() {
  const [curl, setCurl] = useState("");
  const [setLoading] = useState(false);
  const [setError] = useState("");
  const navigate = useNavigate();
  const { parsed, error, loading, parseCurl, reset } = useCurlParser();
  const [curlInput, setCurlInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleParse = async () => {
    const result = await parseCurl(curlInput);
    if (result) {
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
    setSelectedTemplate(null);
    reset();
  };

  const handleTemplateSelect = (template: typeof CURL_TEMPLATES[0]) => {
    setCurlInput(template.curl);
    setSelectedTemplate(template.name);
    setShowTemplates(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(curlInput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const lineCount = curlInput.split('\n').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header with animated background */}
      <div className="text-center space-y-4 relative py-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        </div>
        
        <div className="relative z-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 animate-slide-in-bottom">
            cURL Command Parser
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto animate-slide-in-bottom" style={{ animationDelay: '0.1s' }}>
            Paste your cURL command below and transform it into editable components, then generate production-ready REST Assured test code
          </p>
        </div>
      </div>

      {/* Main Input Card */}
      <Card className="shadow-xl border-2 animate-slide-in-bottom" style={{ animationDelay: '0.2s' }}>
        <CardHeader className="border-b-2 bg-gradient-to-r from-primary/5 via-purple-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                <Code className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Paste Your cURL Command</CardTitle>
                <CardDescription className="mt-1">
                  {selectedTemplate ? `Using template: ${selectedTemplate}` : "Enter or paste your cURL command below"}
                </CardDescription>
              </div>
            </div>
            {curlInput && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {/* Code Editor Area */}
          <div className="relative">
            <Textarea
              value={curlInput}
              onChange={(e) => setCurlInput(e.target.value)}
              placeholder="curl -X POST https://api.example.com/endpoint &#10;  -H &quot;Content-Type: application/json&quot; &#10;  -d '{&quot;key&quot;:&quot;value&quot;}'"
              className="font-mono text-sm min-h-[280px] resize-y bg-slate-950 text-slate-50 border-2 focus:border-primary placeholder:text-slate-500 rounded-xl p-4"
            />
            {curlInput && (
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <div className="px-2 py-1 rounded-md bg-slate-900/90 backdrop-blur-sm text-xs text-slate-300 font-mono">
                  {lineCount} lines
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 animate-scale-in">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                  Parsing Error
                </p>
                <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={handleParse}
              disabled={!curlInput.trim() || loading}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 flex-1 sm:flex-none h-12 px-8 text-base font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  Parse & Edit
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!curlInput && !parsed}
              className="gap-2 border-2 hover:border-primary h-12 px-6"
            >
              <RotateCcw className="w-4 h-4" />
              Clear
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowTemplates(!showTemplates)}
              className="gap-2 border-2 hover:border-primary h-12 px-6"
            >
              <Sparkles className="w-4 h-4" />
              {showTemplates ? 'Hide Templates' : 'Show Templates'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Templates Section */}
      {showTemplates && (
        <div className="space-y-4 animate-slide-in-bottom" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-md">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Quick Start Templates</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CURL_TEMPLATES.map((template, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-2 group ${
                  selectedTemplate === template.name
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => handleTemplateSelect(template)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">{template.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-bold text-base mb-1 group-hover:text-primary transition-colors">
                        {template.name}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {template.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>Click to use template</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Tips */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2 border-primary/20 shadow-lg animate-slide-in-bottom" style={{ animationDelay: '0.4s' }}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-xl">💡 Pro Tips</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {[
              "Copy cURL commands directly from Chrome DevTools (Network tab → Right-click → Copy as cURL (bash))",
              "Postman and Insomnia can export requests as cURL commands",
              "After parsing, you'll get a visual editor to modify every aspect of your request",
              "The code generator supports multiple output formats: Full class, Method only, or with POJOs",
              "Use templates above to get started quickly with common API patterns"
            ].map((tip, index) => (
              <li key={index} className="flex items-start gap-3 text-sm leading-relaxed">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">{index + 1}</span>
                </div>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}