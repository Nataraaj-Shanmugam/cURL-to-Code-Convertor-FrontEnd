import type { ParsedCurl, CodeGenConfig } from "@/types/curl";

export interface BatchItem {
  id: string;
  originalCurl: string;
  parsed: ParsedCurl;
  config: CodeGenConfig;
  name: string;
}

export interface BatchEditorState {
  items: BatchItem[];
  selectedIndex: number;
}
