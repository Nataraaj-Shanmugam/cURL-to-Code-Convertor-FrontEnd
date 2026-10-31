import { useState, useCallback } from "react";
import type { ParsedCurl } from "@/types/curl";
import { isForbiddenSegment } from "@/lib/utils/fieldPath";

export const VALID_SECTIONS = {
  query_params: "Query Parameters",
  headers: "Headers",
  cookies: "Cookies",
  form_data: "Form Data",
  auth: "Authentication",
  auth_config: "Auth Configuration",
  network_config: "Network Configuration",
  ssl_config: "SSL/TLS Configuration",
  proxy_config: "Proxy Configuration",
  transfer_config: "Transfer Configuration",
  protocol_config: "Protocol Configuration",
  output_config: "Output Configuration",
  ftp_config: "FTP Configuration",
  mail_config: "Mail Configuration",
  flags: "Flags",
  misc_flags: "Misc Flags",
};

// Typed helper — centralises the "no index signature on ParsedCurl" double-cast
export const getParsedField = (parsed: ParsedCurl, key: string): unknown =>
  (parsed as unknown as Record<string, unknown>)[key];

/** Groups built by the editor from top-level fields; they are not keys of the request. */
export const SYNTHETIC_SECTIONS = ["request", "context"];

/** Header names are case-insensitive (RFC 9110); every other section's keys are exact. */
export const findExistingKey = (section: string, record: unknown, key: string): string | undefined => {
  if (!record || typeof record !== "object" || Array.isArray(record)) return undefined;
  const keys = Object.keys(record);
  if (section === "headers") return keys.find(k => k.toLowerCase() === key.toLowerCase());
  return keys.includes(key) ? key : undefined;
};

export const useSectionManager = (
  parsed: ParsedCurl,
  setParsed: (next: ParsedCurl) => void,
  hasActiveFlags: (v: unknown) => boolean,
  hasValidData: (v: unknown) => boolean,
) => {
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogSection, setAddDialogSection] = useState("");
  const [newKey, setNewKeyState] = useState("");
  const [newValue, setNewValue] = useState("");
  // Set when the key typed in Add Entry already exists: the dialog asks before replacing it.
  const [duplicateKey, setDuplicateKey] = useState<string | null>(null);
  const [addEntryError, setAddEntryError] = useState<string | null>(null);

  const setNewKey = useCallback((value: string) => {
    setNewKeyState(value);
    setDuplicateKey(null);
    setAddEntryError(null);
  }, []);
  const [showNewSectionDialog, setShowNewSectionDialog] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

  const getValidSectionsFromData = useCallback(
    (data: ParsedCurl): string[] => {
      const valid: string[] = [];
      const skipKeys = [
        "method", "url", "base_url", "endpoint", "path_template",
        "raw_data", "all_options", "meta", "user_agent", "referer", "proxy",
      ];

      const record = data as unknown as Record<string, unknown>;
      Object.keys(record).forEach(key => {
        if (skipKeys.includes(key)) return;
        const value = record[key];
        if (value === null || value === undefined) return;
        if (typeof value === "string" && value.trim() === "") return;

        if (key === "path_parameters") {
          if (Array.isArray(value) && value.length > 0) valid.push(key);
        } else if (key === "flags" || key === "misc_flags") {
          if (hasActiveFlags(value)) valid.push(key);
        } else if (key === "ssl_config") {
          if (hasValidData(value)) valid.push(key);
        } else if (key === "data") {
          if (typeof value === "object" && value !== null) {
            if (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0)
              valid.push(key);
          } else if (value) {
            valid.push(key);
          }
        } else if (hasValidData(value)) {
          valid.push(key);
        }
      });
      return valid;
    },
    [hasActiveFlags, hasValidData],
  );

  const computeOpenSections = useCallback(
    (data: ParsedCurl): string[] => {
      const sectionsToOpen = [...getValidSectionsFromData(data)];
      const fixedKeys = ["method", "url", "base_url", "endpoint", "path_template"];
      const record = data as unknown as Record<string, unknown>;

      if (fixedKeys.some(k => record[k] !== undefined && record[k] !== null && record[k] !== ""))
        sectionsToOpen.unshift("request");

      if (record.user_agent || record.referer || record.proxy)
        sectionsToOpen.push("context");

      return sectionsToOpen;
    },
    [getValidSectionsFromData],
  );

  const getMissingSections = useCallback((): [string, string][] => {
    return Object.entries(VALID_SECTIONS).filter(([key]) => {
      const sectionData = getParsedField(parsed, key);

      if (key === "flags") return !hasActiveFlags(sectionData);

      if (key === "ssl_config")
        return !(
          sectionData &&
          typeof sectionData === "object" &&
          Object.keys(sectionData as object).some(
            k => (sectionData as Record<string, unknown>)[k] === true,
          )
        );

      if (!sectionData) return true;

      if (typeof sectionData === "object" && !Array.isArray(sectionData))
        return Object.keys(sectionData).length === 0;

      if (Array.isArray(sectionData)) return sectionData.length === 0;

      return false;
    });
  }, [parsed, hasActiveFlags]);

  const deleteSection = useCallback(
    (sectionKey: string) => {
      const newParsed = { ...parsed };
      delete (newParsed as unknown as Record<string, unknown>)[sectionKey];
      setParsed(newParsed);
      setOpenSections(prev => prev.filter(s => s !== sectionKey));
    },
    [parsed, setParsed],
  );

  const handleAddEntry = useCallback((section: string) => {
    // Request Details and Client Context group top-level fields; they have no entries of their own.
    if (SYNTHETIC_SECTIONS.includes(section)) return;
    setAddDialogSection(section);
    setNewKey("");
    setNewValue("");
    setShowAddDialog(true);
  }, [setNewKey]);

  /** Adds the entry; with `overwrite`, an existing (for headers: same-name, any case) key is replaced. */
  const saveNewEntry = useCallback((options?: { overwrite?: boolean }) => {
    const key = newKey.trim();
    if (!key || SYNTHETIC_SECTIONS.includes(addDialogSection) || isForbiddenSegment(addDialogSection)) return;
    if (isForbiddenSegment(key)) {
      setAddEntryError(`"${key}" can't be used as a key.`);
      return;
    }
    const isFlag = addDialogSection === "flags" || addDialogSection === "ssl_config";
    const newParsed = structuredClone(parsed);
    const record = newParsed as unknown as Record<string, unknown>;
    const current = record[addDialogSection];

    if (Array.isArray(current)) {
      // path_parameters is a list of { name, value }.
      current.push({ name: key, value: newValue });
    } else if (current && typeof current !== "object") {
      setAddEntryError("This section holds a single value; edit it instead.");
      return;
    } else {
      const section = (current || {}) as Record<string, unknown>;
      record[addDialogSection] = section;
      if (isFlag) {
        section[key] = true;
      } else {
        const existing = findExistingKey(addDialogSection, section, key);
        if (existing !== undefined && !options?.overwrite) {
          setDuplicateKey(existing);
          return;
        }
        if (existing !== undefined && existing !== key) delete section[existing];
        section[key] = newValue;
      }
    }

    setParsed(newParsed);
    setOpenSections(prev =>
      prev.includes(addDialogSection) ? prev : [...prev, addDialogSection],
    );
    setShowAddDialog(false);
    setNewKey("");
    setNewValue("");
  }, [parsed, setParsed, addDialogSection, newKey, newValue, setNewKey]);

  const handleAddSection = useCallback(() => {
    setShowNewSectionDialog(true);
    setNewSectionName("");
  }, []);

  const saveNewSection = useCallback(() => {
    if (!newSectionName.trim()) return;
    const newParsed = structuredClone(parsed);
    const record = newParsed as unknown as Record<string, unknown>;
    if (newSectionName === "flags" || newSectionName === "ssl_config")
      record[newSectionName] = {};
    else if (newSectionName === "path_parameters")
      record[newSectionName] = [];
    else if (newSectionName === "auth")
      record[newSectionName] = "";
    else
      record[newSectionName] = {};

    setParsed(newParsed);
    setOpenSections(prev =>
      prev.includes(newSectionName) ? prev : [...prev, newSectionName],
    );
    setShowNewSectionDialog(false);
    setNewSectionName("");
  }, [parsed, setParsed, newSectionName]);

  return {
    openSections,
    setOpenSections,
    showAddDialog,
    setShowAddDialog,
    addDialogSection,
    newKey,
    setNewKey,
    newValue,
    setNewValue,
    duplicateKey,
    addEntryError,
    showNewSectionDialog,
    setShowNewSectionDialog,
    newSectionName,
    setNewSectionName,
    computeOpenSections,
    getMissingSections,
    deleteSection,
    handleAddEntry,
    saveNewEntry,
    handleAddSection,
    saveNewSection,
  };
};
