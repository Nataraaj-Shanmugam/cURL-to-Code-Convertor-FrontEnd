// src/components/features/curl/editor/SectionRenderer.tsx
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditableField } from "./EditableField";
import { BodyField } from "./BodyField";
import { VALID_SECTIONS } from "@/lib/hooks/useParsedCurlEditor";

import { X, AlertCircle, Info, Plus, Trash2, Globe, Layers, Search, Shield, Database, Key, Settings, Lock, FileJson } from "lucide-react";


interface SectionRendererProps {
    parsed: any;
    selected: Set<string>;
    editing: { [key: string]: boolean };
    editedValues: { [key: string]: any };
    openSections: string[];
    bodyCollapsed: { [key: string]: boolean };
    allExpanded: boolean;
    stats: {
        headers: number;
        params: number;
        hasAuth: boolean;
        hasBody: boolean;
    };
    onToggleSelect: (path: string) => void;
    onToggleEdit: (path: string, value: any) => void;
    onDeleteSingle: (path: string) => void;
    onEditChange: (path: string, value: any) => void;
    onDeleteSection: (key: string) => void;
    onAddEntry: (key: string) => void;
    onBodyExpandCollapseAll: () => void;
    onToggleBodyCollapse: (path: string) => void;
    hasActiveFlags: (flags: any) => boolean;
    getActiveFlags: (flags: any) => string[];
}


const getSectionIcon = (key: string) => {
    const iconMap: Record<string, any> = {
        request: Globe,
        headers: Layers,
        query_parameters: Search,
        auth: Shield,
        data: Database,
        cookies: Key,
        flags: Settings,
        ssl_config: Lock,
        path_parameters: FileJson,
    };
    return iconMap[key] || Info;
};

const getSectionColor = (key: string) => {
    const colorMap: Record<string, string> = {
        request: "from-blue-500 to-blue-600",
        headers: "from-purple-500 to-purple-600",
        query_parameters: "from-cyan-500 to-cyan-600",
        auth: "from-green-500 to-green-600",
        data: "from-orange-500 to-orange-600",
        cookies: "from-yellow-500 to-yellow-600",
        flags: "from-gray-500 to-gray-600",
        ssl_config: "from-red-500 to-red-600",
    };
    return colorMap[key] || "from-slate-500 to-slate-600";
};

const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
        GET: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        POST: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        PUT: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        PATCH: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    };
    return colors[method?.toUpperCase()] || "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
};

const getSectionCount = (data: any): number => {
    if (!data) return 0;
    if (Array.isArray(data)) return data.length;
    if (typeof data === "object")
        return Object.keys(data).filter((k) => data[k] !== null && data[k] !== undefined).length;
    return 1;
};

const getSectionDisplayName = (key: string): string => {
    if (VALID_SECTIONS[key as keyof typeof VALID_SECTIONS]) {
        return VALID_SECTIONS[key as keyof typeof VALID_SECTIONS];
    }
    return key.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

export function SectionRenderer(props: SectionRendererProps) {
    const {
        parsed,
        selected,
        editing,
        editedValues,
        stats,
        onToggleSelect,
        onToggleEdit,
        onDeleteSingle,
        onEditChange,
        onDeleteSection,
        onAddEntry,
        hasActiveFlags,
        getActiveFlags,
    } = props;

    const renderEditableField = (label: string, value: any, path: string) => {
        const isEditing = editing[path] ?? false;
        const currentValue = isEditing ? editedValues[path] : value;
        const isNonDeletable = ["method", "url", "base_url", "endpoint"].includes(label);
        return (
            <EditableField
                key={path}
                label={label}
                value={value}
                path={path}
                isEditing={isEditing}
                currentValue={currentValue}
                isSelected={selected.has(path)}
                isNonDeletable={isNonDeletable}
                onToggleSelect={onToggleSelect}
                onToggleEdit={onToggleEdit}
                onEditChange={onEditChange}
                onDelete={onDeleteSingle}
            />
        );
    };

    const renderSection = (
        title: string,
        data: any,
        basePath: string,
        isTopLevel = false,
        isFlagsSection = false
    ) => {
        const isEmpty =
            !data ||
            (Array.isArray(data) ? data.length === 0 : Object.keys(data).length === 0);

        const isFlagType = isFlagsSection || basePath === "ssl_config";
        const hasNoFlags =
            isFlagType &&
            (!data || (!hasActiveFlags(data) && Object.keys(data || {}).length === 0));
        const SectionIcon = getSectionIcon(basePath);
        const sectionColor = getSectionColor(basePath);
        const count = getSectionCount(data);

        return (
            <AccordionItem
                value={basePath}
                key={basePath}
                className="border-2 rounded-xl mb-3 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
            >
                <AccordionTrigger className="hover:no-underline px-4 py-3 hover:bg-accent/30">
                    <div className="flex items-center justify-between w-full pr-2">
                        <div className="flex items-center gap-3">
                            <div
                                className={`w-10 h-10 rounded-lg bg-gradient-to-br ${sectionColor} flex items-center justify-center shadow-md`}
                            >
                                <SectionIcon className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-base">{title}</span>
                                {count > 0 && (
                                    <Badge variant="secondary" className="px-2 py-0 text-xs">
                                        {count}
                                    </Badge>
                                )}
                                {basePath === "request" && parsed.method && (
                                    <Badge
                                        className={`${getMethodColor(parsed.method)} px-3 py-0.5 text-xs font-bold`}
                                    >
                                        {parsed.method.toUpperCase()}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAddEntry(basePath);
                                }}
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                {isFlagType ? "Add Flag" : "Add Entry"}
                            </Button>
                            {!isTopLevel && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-3 text-xs hover:bg-red-500 hover:text-white transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteSection(basePath);
                                    }}
                                >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete Section
                                </Button>
                            )}
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                    {isFlagType ? (
                        hasNoFlags ? (
                            <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/30 border-2 border-dashed">
                                <AlertCircle className="w-4 h-4 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground italic">
                                    No flags set. Click "Add Flag" to add one.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {(isFlagsSection
                                    ? getActiveFlags(data)
                                    : Object.keys(data || {}).filter((k) => data[k])
                                ).map((flag: string) => (
                                    <div
                                        key={flag}
                                        className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-shadow group"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="font-mono">{flag}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                                            onClick={() => onDeleteSingle(`${basePath}.${flag}`)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : isEmpty ? (
                        <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/30 border-2 border-dashed">
                            <Info className="w-4 h-4 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground italic">
                                No entries yet. Click "Add Entry" to add one.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {Array.isArray(data)
                                ? data.map((item, idx) =>
                                    renderEditableField(`Item ${idx}`, item, `${basePath}.${idx}`)
                                )
                                : Object.entries(data)
                                    .filter(([, value]) => value !== null && value !== undefined)
                                    .map(([key, value]) => {
                                        const fieldPath = isTopLevel ? key : `${basePath}.${key}`;
                                        return renderEditableField(key, value, fieldPath);
                                    })}
                        </div>
                    )}
                </AccordionContent>
            </AccordionItem>
        );
    };

    // Get sections to render
    const sectionsToRender = getSectionsToRender(parsed, props.openSections);

    return (
        <>
            {sectionsToRender.map((section) => (
                <div key={section.key} id={`section-${section.key}`}>
                    {renderSection(
                        section.title,
                        section.data,
                        section.key,
                        section.key === "request",
                        section.isFlags
                    )}
                </div>
            ))}

            {/* Render Request Body separately if exists */}
            {stats.hasBody && (
                <BodyField
                    data={parsed.data}
                    bodyCollapsed={props.bodyCollapsed}
                    allExpanded={props.allExpanded}
                    selected={selected}
                    editing={editing}
                    editedValues={editedValues}
                    onToggleBodyCollapse={props.onToggleBodyCollapse}
                    onToggleEdit={onToggleEdit}
                    onDeleteSingle={onDeleteSingle}
                    onEditChange={onEditChange}
                    onExpandCollapseAll={props.onBodyExpandCollapseAll}
                />
            )}

            {/* Client Context section */}
            {(parsed.user_agent?.trim() || parsed.referer?.trim() || parsed.proxy) && (
                <div id="section-context">
                    {renderSection(
                        "Client Context",
                        {
                            ...(parsed.user_agent?.trim() && { user_agent: parsed.user_agent }),
                            ...(parsed.referer?.trim() && { referer: parsed.referer }),
                            ...(parsed.proxy && { proxy: parsed.proxy }),
                        },
                        "context"
                    )}
                </div>
            )}
        </>
    );
}

function getSectionsToRender(parsed: any, openSections: string[]) {
    const sections: Array<{
        key: string;
        title: string;
        data: any;
        isFlags?: boolean;
    }> = [];

    const fixedSections = ["method", "url", "base_url", "endpoint"];
    const requestData: any = {};
    fixedSections.forEach((key) => {
        const value = parsed[key];
        if (value !== undefined && value !== null && value !== "") {
            requestData[key] = value;
        }
    });

    if (Object.keys(requestData).length > 0) {
        sections.push({
            key: "request",
            title: "Request Details",
            data: requestData,
        });
    }

    Object.keys(parsed).forEach((key) => {
        if (
            fixedSections.includes(key) ||
            key === "data" ||
            key === "raw_data" ||
            key === "all_options" ||
            key === "meta" ||
            key === "path_template"
        ) {
            return;
        }

        const value = parsed[key];

        if ((value === null || value === undefined) && !openSections.includes(key)) {
            return;
        }

        if (["user_agent", "referer", "proxy"].includes(key)) {
            return;
        }

        if (key === "flags") {
            sections.push({
                key,
                title: getSectionDisplayName(key),
                data: value || {},
                isFlags: true,
            });
            return;
        }

        if (key === "ssl_config") {
            sections.push({
                key,
                title: getSectionDisplayName(key),
                data: value || {},
                isFlags: false,
            });
            return;
        }

        if (key === "path_parameters") {
            if ((Array.isArray(value) && value.length > 0) || openSections.includes(key)) {
                sections.push({
                    key,
                    title: getSectionDisplayName(key),
                    data: value || [],
                });
            }
            return;
        }

        if (typeof value === "object") {
            const isEmpty = Array.isArray(value)
                ? value.length === 0
                : Object.keys(value || {}).length === 0;

            if (!isEmpty || openSections.includes(key)) {
                sections.push({
                    key,
                    title: getSectionDisplayName(key),
                    data: value || {},
                });
            }
        } else if (value || openSections.includes(key)) {
            sections.push({
                key,
                title: getSectionDisplayName(key),
                data: value,
            });
        }
    });

    return sections;
}