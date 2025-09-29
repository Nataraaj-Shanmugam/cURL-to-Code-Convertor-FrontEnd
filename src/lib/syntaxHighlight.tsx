// src/lib/syntaxHighlight.ts

import type { JSX } from "react";

export interface HighlightToken {
  type: "keyword" | "string" | "comment" | "normal";
  value: string;
}

export const tokenizeJavaCode = (code: string): HighlightToken[] => {
  const tokens: HighlightToken[] = [];
  const lines = code.split("\n");

  for (const line of lines) {
    // Handle comments first
    const commentIndex = line.indexOf("//");
    if (commentIndex !== -1) {
      // Process text before comment
      const beforeComment = line.substring(0, commentIndex);
      if (beforeComment) {
        tokens.push(...tokenizeLine(beforeComment));
      }
      // Add comment
      tokens.push({ type: "comment", value: line.substring(commentIndex) });
    } else {
      tokens.push(...tokenizeLine(line));
    }
    tokens.push({ type: "normal", value: "\n" });
  }

  return tokens;
};

const tokenizeLine = (line: string): HighlightToken[] => {
  const tokens: HighlightToken[] = [];
  const keywords = new Set([
    "import",
    "public",
    "class",
    "void",
    "static",
    "Response",
    "String",
    "@Test",
    "new",
  ]);

  // Simple tokenization - can be enhanced with proper lexing
  const regex = /("(?:[^"\\]|\\.)*")|(\b\w+\b)|(\s+|[^\w"\s]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    const [fullMatch, stringLiteral, word] = match;

    if (stringLiteral) {
      tokens.push({ type: "string", value: stringLiteral });
    } else if (word && keywords.has(word)) {
      tokens.push({ type: "keyword", value: word });
    } else {
      tokens.push({ type: "normal", value: fullMatch });
    }
  }

  return tokens;
};

// ✅ Safe renderer — no dangerouslySetInnerHTML
export const renderHighlightedCode = (code: string): JSX.Element => {
  const tokens = tokenizeJavaCode(code);

  return (
    <pre className="syntax-code">
      {tokens.map((token, index) => {
        const className = `syntax-${token.type}`;
        return (
          <span key={index} className={className}>
            {token.value}
          </span>
        );
      })}
    </pre>
  );
};
