import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, CheckCircle2 } from "lucide-react";

interface EditorHeaderProps {
  originalCurl?: string;
}

export function EditorHeader({ originalCurl }: EditorHeaderProps) {
  if (!originalCurl) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(originalCurl);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-2 shadow-lg animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Code className="w-4 h-4" />
            Original cURL Command
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 gap-2 hover:bg-primary hover:text-primary-foreground"
          >
            <CheckCircle2 className="w-3 h-3" />
            Copy
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-slate-950 text-slate-50 p-4 rounded-lg border-2 border-slate-700 max-h-32 overflow-auto shadow-inner">
          {originalCurl}
        </pre>
      </CardContent>
    </Card>
  );
}