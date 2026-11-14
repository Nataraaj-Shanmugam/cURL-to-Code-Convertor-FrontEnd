import type { PrismTheme } from "prism-react-renderer";

/**
 * Syntax colours for every highlighted code pane. They sit on the `code` surface token
 * (--code-bg in index.css) and every one clears 4.5:1 on it (src/__tests__/design/contrast.test.ts).
 * The stock vsDark theme paints the XML prolog and doctype navy, which vanishes on a dark surface.
 */
export const CODE_COLORS = {
  plain: "#f1f5f9",
  comment: "#94a3b8",
  punctuation: "#cbd5e1",
  /** `<?xml ... ?>`, `<!DOCTYPE>`, CDATA: the colour vsDark got wrong. */
  prolog: "#c4b5fd",
  tag: "#fda4af",
  attrName: "#fde68a",
  string: "#86efac",
  number: "#fdba74",
  keyword: "#7dd3fc",
  fn: "#93c5fd",
  className: "#5eead4",
  annotation: "#fcd34d",
} as const;

export const codeTheme: PrismTheme = {
  plain: { color: CODE_COLORS.plain, backgroundColor: "transparent" },
  styles: [
    { types: ["comment", "block-comment"], style: { color: CODE_COLORS.comment, fontStyle: "italic" } },
    { types: ["prolog", "doctype", "cdata", "instruction"], style: { color: CODE_COLORS.prolog } },
    { types: ["punctuation", "operator", "entity"], style: { color: CODE_COLORS.punctuation } },
    { types: ["tag", "deleted", "constant", "symbol"], style: { color: CODE_COLORS.tag } },
    { types: ["attr-name", "property", "variable"], style: { color: CODE_COLORS.attrName } },
    { types: ["string", "attr-value", "char", "inserted"], style: { color: CODE_COLORS.string } },
    { types: ["number", "boolean"], style: { color: CODE_COLORS.number } },
    { types: ["keyword", "selector", "important", "atrule"], style: { color: CODE_COLORS.keyword } },
    { types: ["function"], style: { color: CODE_COLORS.fn } },
    { types: ["class-name", "builtin", "namespace"], style: { color: CODE_COLORS.className } },
    { types: ["annotation", "decorator"], style: { color: CODE_COLORS.annotation } },
  ],
};
