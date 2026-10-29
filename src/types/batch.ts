import type { ParsedCurl, CodeGenConfig } from "@/types/curl";

/** A cURL command that parsed successfully, before it becomes an editable batch item. */
export interface ParsedCurlEntry {
  parsed: ParsedCurl;
  originalCurl: string;
}

/** A cURL command the parse endpoint rejected (or that never reached it). */
export interface BatchParseFailure {
  /** 0-based position among the commands that were submitted for parsing. */
  index: number;
  curl: string;
  message: string;
}

export interface BatchItem {
  id: string;
  originalCurl: string;
  parsed: ParsedCurl;
  config: CodeGenConfig;
  name: string;
}

export interface BatchEditorState {
  items: BatchItem[];
  /** Id (not index) of the selected item, so removals can never shift the selection. */
  selectedId: string | null;
}
