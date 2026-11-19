import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Highlight } from "prism-react-renderer";
import { codeTheme } from "@/lib/codeTheme";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/utils/notify";

export interface CodeBlockProps {
  /** What is shown. */
  code: string;
  /** Accessible name of the scroll region, e.g. "Generated code". Required: a region needs a name. */
  label: string;
  /** What is rendered in place of `code` (e.g. masks with an accessible label); `code` is still what is copied. */
  display?: React.ReactNode;
  /** What the Copy button puts on the clipboard; defaults to `code`. */
  copyText?: string;
  /** Hide the Copy button (e.g. for content that must not leave the page). */
  copyable?: boolean;
  /** Syntax-highlight as this Prism language (e.g. "java", "xml"); `code` is still what is copied. */
  language?: string;
  /** Wrap long lines instead of scrolling sideways. */
  wrap?: boolean;
  className?: string;
  preClassName?: string;
}

/** Tokens as children (no dangerouslySetInnerHTML), so highlighted code cannot inject markup. */
function HighlightedLines({ code, language }: { code: string; language: string }) {
  return (
    <Highlight code={code} language={language} theme={codeTheme}>
      {({ tokens, getLineProps, getTokenProps }) => (
        <>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </>
      )}
    </Highlight>
  );
}

/**
 * Scrollable code/JSON pane. The <pre> is a focusable, named region so keyboard users can scroll it
 * in every browser, and Copy confirms with a toast (announced by the toaster's live region).
 */
function CodeBlock({ code, display, label, copyText, copyable = true, language, wrap = false, className, preClassName }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>();
  React.useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = async () => {
    if (await copyToClipboard(copyText ?? code)) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <pre
        tabIndex={0}
        role="region"
        aria-label={label}
        className={cn(
          "max-h-80 overflow-auto rounded-md border border-code-border bg-code p-4 font-mono text-xs text-code-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          copyable && "pr-20",
          wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre",
          preClassName,
        )}
      >
        {language ? <HighlightedLines code={code} language={language} /> : (display ?? code)}
      </pre>
      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="absolute right-2 top-2 inline-flex h-7 items-center gap-1 rounded bg-slate-800 px-2 text-xs font-medium text-slate-50 hover:bg-slate-700 pointer-coarse:h-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}

export { CodeBlock };
