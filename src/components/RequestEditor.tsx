import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Trash2, Send } from "lucide-react";

interface Props {
  onSend: (method: string, url: string, body: string) => void;
}

export default function RequestEditor({ onSend }: Props) {
  const methodRef = useRef<HTMLSelectElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => navigator.clipboard.writeText(bodyRef.current?.innerText || "");
  const handleClear = () => { if (bodyRef.current) bodyRef.current.innerText = ""; };

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm p-4 space-y-3">
      <div className="flex gap-2 items-center">
        <select ref={methodRef} className="border rounded-md px-2 py-1 text-sm bg-background">
          <option>GET</option>
          <option>POST</option>
          <option>PUT</option>
          <option>DELETE</option>
        </select>
        <input
          ref={urlRef}
          className="flex-1 border rounded-md px-3 py-1 text-sm bg-background"
          placeholder="Enter request URL"
        />
        <Button variant="default" onClick={() =>
          onSend(methodRef.current?.value || "GET", urlRef.current?.value || "", bodyRef.current?.innerText || "")
        }>
          <Send className="w-4 h-4 mr-1" /> Send
        </Button>
      </div>

      <div
        ref={bodyRef}
        contentEditable
        data-placeholder='{"example": "payload"}'
        className="relative min-h-[25vh] w-full rounded-xl border border-input bg-background p-3 text-sm font-mono overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring before:content-[attr(data-placeholder)] before:text-muted-foreground before:absolute before:top-3 before:left-3 before:pointer-events-none empty:before:block"
      ></div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy body">
          <Copy className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleClear} title="Clear">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </section>
  );
}
