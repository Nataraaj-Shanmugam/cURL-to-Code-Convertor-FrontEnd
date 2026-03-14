import { memo } from "react";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, FileText, Globe, List, Shield, Flag, Settings, Link2, Cookie } from "lucide-react";
import { useEditorContext } from "./EditorContext";
import EditableField from "./EditableField";

// Section styling config — static, never changes
const sectionStyles: Record<string, { icon: typeof Globe; borderColor: string }> = {
  request: { icon: Globe, borderColor: "border-l-primary" },
  headers: { icon: FileText, borderColor: "border-l-blue-500" },
  query_params: { icon: List, borderColor: "border-l-amber-500" },
  cookies: { icon: Cookie, borderColor: "border-l-orange-500" },
  auth: { icon: Shield, borderColor: "border-l-emerald-500" },
  auth_config: { icon: Shield, borderColor: "border-l-emerald-500" },
  flags: { icon: Flag, borderColor: "border-l-violet-500" },
  misc_flags: { icon: Flag, borderColor: "border-l-violet-400" },
  ssl_config: { icon: Shield, borderColor: "border-l-rose-500" },
  proxy_config: { icon: Globe, borderColor: "border-l-yellow-500" },
  network_config: { icon: Settings, borderColor: "border-l-teal-500" },
  transfer_config: { icon: Settings, borderColor: "border-l-sky-500" },
  protocol_config: { icon: Settings, borderColor: "border-l-lime-500" },
  output_config: { icon: FileText, borderColor: "border-l-fuchsia-500" },
  ftp_config: { icon: Globe, borderColor: "border-l-pink-500" },
  mail_config: { icon: FileText, borderColor: "border-l-red-500" },
  path_parameters: { icon: Link2, borderColor: "border-l-cyan-500" },
  context: { icon: Settings, borderColor: "border-l-slate-500" },
  data: { icon: FileText, borderColor: "border-l-indigo-500" },
};

interface SectionRendererProps {
  title: string;
  sectionKey: string;
  data: unknown;
  isTopLevel?: boolean;
  isFlagsSection?: boolean;
}

function SectionRenderer({ title, sectionKey, data, isTopLevel = false, isFlagsSection = false }: SectionRendererProps) {
  const { hasActiveFlags, getActiveFlags, handleAddEntry, requestConfirm, deleteSingle } =
    useEditorContext();

  const isEmpty = !data || (Array.isArray(data) ? data.length === 0 : Object.keys(data as object).length === 0);
  const isFlagType = isFlagsSection || sectionKey === "ssl_config";
  const hasNoFlags = isFlagType && (!data || (!hasActiveFlags(data) && Object.keys((data as object) || {}).length === 0));

  const style = sectionStyles[sectionKey] || { icon: FileText, borderColor: "border-l-muted-foreground" };
  const SectionIcon = style.icon;

  return (
    <AccordionItem value={sectionKey} className={`border-l-2 ${style.borderColor} pl-2`}>
      <AccordionTrigger>
        <div className="flex items-center justify-between w-full pr-2">
          <span className="flex items-center gap-2">
            <SectionIcon className="w-4 h-4 text-muted-foreground" />
            {title}
          </span>
          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={e => {
                e.stopPropagation();
                handleAddEntry(sectionKey);
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              {isFlagType ? "Add Flag" : "Add Entry"}
            </button>
            {!isTopLevel && (
              <button
                type="button"
                className="h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={e => {
                  e.stopPropagation();
                  requestConfirm({ type: "deleteSection", key: sectionKey });
                }}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete Section
              </button>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {isFlagType ? (
          hasNoFlags ? (
            <p className="text-sm text-muted-foreground italic">No flags set.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(isFlagsSection
                ? getActiveFlags(data)
                : Object.keys((data as Record<string, unknown>) || {}).filter(
                    k => (data as Record<string, unknown>)[k],
                  )
              ).map(flag => (
                <div
                  key={flag}
                  className="flex items-center gap-2 px-3 py-1.5 bg-accent text-accent-foreground rounded-full text-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
                  <span className="font-mono">{flag}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1"
                    onClick={() => deleteSingle(`${sectionKey}.${flag}`)}
                    aria-label={`Delete flag ${flag}`}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )
        ) : isEmpty ? (
          <p className="text-sm text-muted-foreground italic">No entries yet.</p>
        ) : (
          <div className="space-y-1">
            {Array.isArray(data)
              ? (data as unknown[]).map((item, idx) => (
                  <EditableField
                    key={`${sectionKey}.${idx}`}
                    label={`Item ${idx}`}
                    value={item}
                    path={`${sectionKey}.${idx}`}
                  />
                ))
              : Object.entries(data as Record<string, unknown>)
                  .filter(([, value]) => value !== null && value !== undefined)
                  .map(([key, value]) => {
                    const fieldPath = isTopLevel ? key : `${sectionKey}.${key}`;
                    return (
                      <EditableField
                        key={fieldPath}
                        label={key}
                        value={value}
                        path={fieldPath}
                      />
                    );
                  })}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

export default memo(SectionRenderer);

// Re-export sectionStyles so ParsedCurlEditor can use it if needed
export { sectionStyles };
