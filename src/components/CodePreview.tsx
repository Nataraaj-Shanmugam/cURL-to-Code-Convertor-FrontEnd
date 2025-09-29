import React, { useContext } from "react";
import { AppContext } from "../state/AppProvider";
import { renderHighlightedCode } from "../lib/syntaxHighlight";


export interface CodePreviewProps {
  code: string;
  onGenerate: () => void;
  onCopy: () => void;
  onDownload: () => void;
  generateError1?: string;
}


export const CodePreview: React.FC<CodePreviewProps> = ({
  code,
  onGenerate,
  onCopy,
  onDownload,
  generateError1,
}) => {
  const app = useContext(AppContext);
  if (!app) return null;

  const { state, actions } = app;
  const { generatedCode, generateError } = state;

  const isPlaceholder = generatedCode.includes(
    "Generated Rest Assured code will appear here"
  );

  const renderError = (error: string) => {
    if (!error) return null;
    if (error.startsWith("success:")) {
      return <div className="success">{error.replace("success:", "")}</div>;
    }
    return <div className="error">{error}</div>;
  };

  const handleCopy = () => {
    if (!isPlaceholder) {
      navigator.clipboard.writeText(generatedCode);
    }
  };

  const handleDownload = () => {
    if (!isPlaceholder) {
      const blob = new Blob([generatedCode], { type: "text/plain" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "GeneratedCode.java";
      link.click();
    }
  };

  return (
    <div className="section">
      <div className="section-header">💻 Generated Code</div>
      <div className="section-content">
        {/* Action buttons */}
        <div className="actions" style={{ marginBottom: "15px" }}>
          <button
            className="btn"
            onClick={() => actions.generateCodeFromParsed("java")}
            aria-label="Generate code"
          >
            Generate Code
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleCopy}
            disabled={isPlaceholder}
            aria-label="Copy generated code"
          >
            Copy Code
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleDownload}
            disabled={isPlaceholder}
            aria-label="Download generated code"
          >
            Download .java
          </button>
        </div>

        {/* Code preview */}
        <div className="code-preview">
          <pre className="syntax-code java">
            {isPlaceholder ? generatedCode : renderHighlightedCode(generatedCode)}
          </pre>
        </div>

        {/* Error or success messages */}
        {generateError && (
          <div style={{ marginTop: "10px" }}>{renderError(generateError)}</div>
        )}
      </div>
    </div>
  );
};
