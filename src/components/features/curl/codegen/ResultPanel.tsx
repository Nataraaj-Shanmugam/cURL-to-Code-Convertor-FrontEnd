import { useEffect, useMemo, useRef, useState } from "react";
import { Highlight, themes } from "prism-react-renderer";
import { CheckCircle2, Copy, Download, DownloadCloud, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MASK, redactText } from "@/lib/utils/redaction";
import {
  downloadAllFiles,
  downloadTextFile,
  resultFiles,
  type GeneratedResult,
  type ResultTab,
} from "@/lib/utils/codeGeneration";
import { RevealToggle } from "../editor/SecretValue";

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <Highlight code={code} language={language} theme={themes.vsDark}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre className={`${className} text-xs font-mono p-6 overflow-auto`} style={style}>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}

const TAB_CLASS = (active: boolean) =>
  `px-4 py-2 text-sm font-medium rounded-md transition-all ${
    active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
  }`;

interface ResultPanelProps {
  result: GeneratedResult;
  /** Exact secret values of the request, for scrubbing generated code (collectSecretValues). */
  secretValues: readonly string[];
}

export default function ResultPanel({ result, secretValues }: ResultPanelProps) {
  const files = useMemo(() => resultFiles(result), [result]);
  const [activeTab, setActiveTab] = useState<ResultTab>("test");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<"redacted" | "raw" | null>(null);
  const [redactDownload, setRedactDownload] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const redact = (text: string, placeholder?: string) =>
    redactText(text, { knownSecrets: secretValues, ...(placeholder ? { placeholder } : {}) });

  const tabs: { id: ResultTab; label: string }[] = [{ id: "test", label: "Test Code" }];
  if (result.pojoCode) tabs.push({ id: "pojo", label: "POJO Classes" });
  if (result.pomXml) tabs.push({ id: "pom", label: result.pomIsFull ? "pom.xml" : "Dependencies (pom.xml)" });
  if (result.testngXml) tabs.push({ id: "testng", label: "testng.xml" });

  const file = files.find((f) => f.tab === activeTab);
  const raw = file?.content ?? "";
  const masked = useMemo(() => redactText(raw, { knownSecrets: secretValues, placeholder: MASK }), [raw, secretValues]);
  const hasSecrets = masked !== raw;
  const anySecrets = useMemo(
    () => files.some((f) => redactText(f.content, { knownSecrets: secretValues }) !== f.content),
    [files, secretValues],
  );

  const copy = async (mode: "redacted" | "raw") => {
    try {
      await navigator.clipboard.writeText(mode === "redacted" ? redact(raw) : raw);
      setCopied(mode);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(null), 3000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  const forDownload = (content: string) => (redactDownload ? redact(content) : content);
  const downloadOne = () => file && downloadTextFile(file.name, forDownload(file.content));
  const downloadAll = () => {
    downloadAllFiles(result).forEach((f, i) => {
      // Browsers drop a burst of programmatic downloads, so space them out.
      setTimeout(() => downloadTextFile(f.name, forDownload(f.content)), i * 200);
    });
  };

  const language = activeTab === "pom" || activeTab === "testng" ? "xml" : "java";
  const shown = hasSecrets && !revealed ? masked : raw;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {result.warnings.length > 0 && (
        <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-sm">
          <p className="font-medium text-yellow-700 dark:text-yellow-400 mb-1">Warnings:</p>
          <ul className="list-disc list-inside text-yellow-600 dark:text-yellow-300 text-xs space-y-0.5">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div role="tablist" aria-label="Generated output tabs" className="flex gap-1 mb-4 border-b bg-muted/50 rounded-t-md p-1 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={activeTab === t.id}
            aria-controls={`tabpanel-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            className={TAB_CLASS(activeTab === t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-md border">
        <div className="flex flex-wrap items-center gap-2 p-2 border-b bg-muted/30">
          {hasSecrets ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-auto">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{revealed ? "Secrets are visible on screen." : "Secrets are masked on screen."}</span>
              <RevealToggle label="generated code" revealed={revealed} onToggle={() => setRevealed((r) => !r)} />
            </div>
          ) : (
            <span className="mr-auto text-xs text-muted-foreground font-mono">{file?.name}</span>
          )}
          <Button variant="outline" size="sm" onClick={() => copy("redacted")} className={copied === "redacted" ? "text-primary" : ""}>
            {copied === "redacted" ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                {hasSecrets ? "Copy redacted" : "Copy"}
              </>
            )}
          </Button>
          {hasSecrets && (
            <Button variant="outline" size="sm" onClick={() => copy("raw")} className={copied === "raw" ? "text-primary" : ""}>
              {copied === "raw" ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Copied
                </>
              ) : (
                "Copy with secrets"
              )}
            </Button>
          )}
          {file && (
            <Button variant="outline" size="sm" onClick={downloadOne}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}
          {downloadAllFiles(result).length > 1 && (
            <Button variant="outline" size="sm" onClick={downloadAll}>
              <DownloadCloud className="w-4 h-4 mr-2" />
              Download All
            </Button>
          )}
        </div>
        {anySecrets && (
          <label className="flex items-center gap-2 px-3 py-2 text-sm border-b bg-muted/20">
            <Checkbox
              checked={redactDownload}
              onCheckedChange={(c) => setRedactDownload(c === true)}
              aria-label="Redact secrets in downloaded files"
            />
            Redact secrets in downloaded files
            <span className="text-xs text-muted-foreground">(off: files contain the real values so the tests can run)</span>
          </label>
        )}
        {activeTab === "testng" && <p className="px-3 py-2 text-xs text-muted-foreground border-b">{result.testngHint}</p>}
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="flex-1 min-h-0 overflow-auto bg-muted/30"
        >
          {/* SECURITY: Rendered via prism-react-renderer which uses React children
              (no dangerouslySetInnerHTML), so XSS is not a concern. */}
          <CodeBlock code={shown} language={language} />
        </div>
      </div>
    </div>
  );
}
