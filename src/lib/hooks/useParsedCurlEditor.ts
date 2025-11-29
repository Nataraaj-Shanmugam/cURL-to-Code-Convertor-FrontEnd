import { useState, useEffect } from "react";

interface EditingState {
  [key: string]: boolean;
}

interface EditedValues {
  [key: string]: any;
}

interface CollapsedState {
  [key: string]: boolean;
}

export const VALID_SECTIONS = {
  'query_params': 'Query Parameters',
  'headers': 'Headers',
  'cookies': 'Cookies',
  'form_data': 'Form Data',
  'auth': 'Authentication',
  'network_config': 'Network Configuration',
  'ssl_config': 'SSL/TLS Configuration',
  'flags': 'Flags'
};

export const useParsedCurlEditor = (initialData: any) => {
  const [originalParsed] = useState(initialData || {});
  const [parsed, setParsed] = useState(JSON.parse(JSON.stringify(initialData || {})));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditingState>({});
  const [editedValues, setEditedValues] = useState<EditedValues>({});
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogSection, setAddDialogSection] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showNewSectionDialog, setShowNewSectionDialog] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [bodyCollapsed, setBodyCollapsed] = useState<CollapsedState>({});
  const [allExpanded, setAllExpanded] = useState(false);

  // Helper functions
  const hasValidData = (data: any): boolean => {
    if (!data) return false;
    if (typeof data !== 'object') return false;
    if (Array.isArray(data)) return data.length > 0;

    const entries = Object.entries(data);
    if (entries.length === 0) return false;

    return entries.some(([_, value]) => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string' && value.trim() === '') return false;
      if (typeof value === 'object' && Object.keys(value).length === 0) return false;
      return true;
    });
  };

  const hasActiveFlags = (flagsObj: any): boolean => {
    if (!flagsObj || typeof flagsObj !== 'object') return false;
    return Object.values(flagsObj).some((val) => val === true);
  };

  const getActiveFlags = (flagsObj: any): string[] => {
    if (!flagsObj || typeof flagsObj !== 'object') return [];
    return Object.entries(flagsObj)
      .filter(([_, val]) => val === true)
      .map(([key]) => key);
  };

  const getValidSections = () => {
    const valid: string[] = [];

    Object.keys(parsed).forEach(key => {
      if (['method', 'url', 'base_url', 'endpoint', 'path_template', 'raw_data', 'all_options', 'meta', 'user_agent', 'referer', 'proxy'].includes(key)) {
        return;
      }

      const value = parsed[key];

      if ((value === null || value === undefined) && !openSections.includes(key)) {
        return;
      }

      if (typeof value === 'string' && value.trim() === '') return;

      if (key === 'path_parameters') {
        if (Array.isArray(value) && value.length > 0) {
          valid.push(key);
        }
      } else if (key === 'flags') {
        if (hasActiveFlags(value) || openSections.includes(key)) {
          valid.push(key);
        }
      } else if (key === 'ssl_config') {
        if (value && typeof value === 'object' && Object.keys(value).some(k => value[k] === true)) {
          valid.push(key);
        }
      } else if (key === 'data') {
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0) {
            valid.push(key);
          }
        } else if (value) {
          valid.push(key);
        }
      } else if (hasValidData(value)) {
        valid.push(key);
      }
    });

    return valid;
  };

  const getMissingSections = () => {
    const missing = Object.entries(VALID_SECTIONS).filter(([key]) => {
      const sectionData = parsed[key];

      if (key === 'flags') {
        return !hasActiveFlags(sectionData);
      }

      if (key === 'ssl_config') {
        return !(sectionData && typeof sectionData === 'object' && Object.keys(sectionData).some(k => sectionData[k] === true));
      }

      if (!sectionData) {
        return true;
      }

      if (typeof sectionData === 'object' && !Array.isArray(sectionData)) {
        return Object.keys(sectionData).length === 0;
      }

      if (Array.isArray(sectionData)) {
        return sectionData.length === 0;
      }
      return false;
    });
    return missing;
  };

  useEffect(() => {
    const defaultSections = getValidSections();
    const sectionsToOpen = [...defaultSections];

    const fixedSections = ['method', 'url', 'base_url', 'endpoint', 'path_template'];
    const hasRequestData = fixedSections.some(key =>
      parsed[key] !== undefined && parsed[key] !== null && parsed[key] !== ''
    );

    if (hasRequestData) {
      sectionsToOpen.unshift('request');
    }

    if (parsed.user_agent || parsed.referer || parsed.proxy) {
      sectionsToOpen.push('context');
    }

    setOpenSections(sectionsToOpen);
  }, []);

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all changes?')) {
      const resetParsed = JSON.parse(JSON.stringify(originalParsed));
      setParsed(resetParsed);

      const defaultSections = getValidSectionsFromData(resetParsed);
      const sectionsToOpen = [...defaultSections];

      const fixedSections = ['method', 'url', 'base_url', 'endpoint', 'path_template'];
      const hasRequestData = fixedSections.some(key =>
        resetParsed[key] !== undefined && resetParsed[key] !== null && resetParsed[key] !== ''
      );

      if (hasRequestData) {
        sectionsToOpen.unshift('request');
      }

      if (resetParsed.user_agent || resetParsed.referer || resetParsed.proxy) {
        sectionsToOpen.push('context');
      }

      setOpenSections(sectionsToOpen);

      setSelected(new Set());
      setEditing({});
      setEditedValues({});
      setBodyCollapsed({});
    }
  };

  const getValidSectionsFromData = (data: any): string[] => {
    const valid: string[] = [];

    Object.keys(data).forEach(key => {
      if (['method', 'url', 'base_url', 'endpoint', 'path_template', 'raw_data', 'all_options', 'meta', 'user_agent', 'referer', 'proxy'].includes(key)) {
        return;
      }

      const value = data[key];

      if (value === null || value === undefined) return;
      if (typeof value === 'string' && value.trim() === '') return;

      if (key === 'path_parameters') {
        if (Array.isArray(value) && value.length > 0) {
          valid.push(key);
        }
      } else if (key === 'flags') {
        if (hasActiveFlags(value)) {
          valid.push(key);
        }
      } else if (key === 'ssl_config') {
        if (value && typeof value === 'object' && Object.keys(value).some(k => value[k] === true)) {
          valid.push(key);
        }
      } else if (key === 'data') {
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0) {
            valid.push(key);
          }
        } else if (value) {
          valid.push(key);
        }
      } else if (hasValidData(value)) {
        valid.push(key);
      }
    });

    return valid;
  };

  const deleteSection = (sectionKey: string) => {
    if (window.confirm(`Delete the entire "${VALID_SECTIONS[sectionKey as keyof typeof VALID_SECTIONS] || sectionKey}" section?`)) {
      const newParsed = { ...parsed };
      delete newParsed[sectionKey];
      setParsed(newParsed);
      setOpenSections(prev => prev.filter(s => s !== sectionKey));
    }
  };

  const toggleSelect = (path: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelected(newSelected);
  };

  const toggleEdit = (path: string, currentValue: any) => {
    if (editing[path]) {
      const keys = path.split('.');
      let obj: any = parsed;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (key && obj && typeof obj === 'object') {
          obj = obj[key];
        } else {
          return;
        }
      }
      const lastKey = keys[keys.length - 1];
      if (lastKey && obj && typeof obj === 'object') {
        let finalValue = editedValues[path] ?? currentValue;
        if (typeof finalValue === 'string') {
          try {
            finalValue = JSON.parse(finalValue);
          } catch {
            // Keep as string
          }
        }
        obj[lastKey] = finalValue;
      }
      setParsed({ ...parsed });

      const newEditing = { ...editing };
      delete newEditing[path];
      setEditing(newEditing);
    } else {
      setEditing({ ...editing, [path]: true });
      setEditedValues({ ...editedValues, [path]: currentValue });
    }
  };

  const deleteSelected = () => {
    if (selected.size === 0) return;

    const newParsed = JSON.parse(JSON.stringify(parsed));
    selected.forEach(path => {
      const keys = path.split('.');
      let obj: any = newParsed;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (key && obj && typeof obj === 'object') {
          obj = obj[key];
        } else {
          return;
        }
      }
      const lastKey = keys[keys.length - 1];
      if (lastKey && obj && typeof obj === 'object') {
        delete obj[lastKey];
      }
    });

    setParsed(newParsed);
    setSelected(new Set());
  };

  const deleteSingle = (path: string) => {
    const keys = path.split('.');
    const newParsed = JSON.parse(JSON.stringify(parsed));
    let obj: any = newParsed;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (key && obj && typeof obj === 'object') {
        obj = obj[key];
      } else {
        return;
      }
    }
    const lastKey = keys[keys.length - 1];
    if (lastKey && obj && typeof obj === 'object') {
      delete obj[lastKey];
    }
    setParsed(newParsed);

    const newSelected = new Set(selected);
    newSelected.delete(path);
    setSelected(newSelected);
  };

  const handleEditChange = (path: string, value: any) => {
    setEditedValues({ ...editedValues, [path]: value });
  };

  const exportData = () => {
    const dataStr = JSON.stringify(parsed, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'parsed-curl-edited.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const generateRestAssuredCode = (data: any): string => {
    const method = (data.method || 'GET').toUpperCase();
    const baseUrl = data.base_url || '';
    const endpoint = data.endpoint || '';

    let code = `import io.restassured.RestAssured;
import io.restassured.response.Response;
import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;

public class GeneratedTest {
    
    public void testRequest() {
        RestAssured.baseURI = "${baseUrl}";
        
        Response response = given()`;

    if (data.headers && Object.keys(data.headers).length > 0) {
      code += '\n            .headers(';
      const headerEntries = Object.entries(data.headers).map(([k, v]) =>
        `"${k}", "${v}"`
      );
      code += '\n                    ' + headerEntries.join(',\n                    ');
      code += '\n            )';
    }

    if (data.query_params && Object.keys(data.query_params).length > 0) {
      Object.entries(data.query_params).forEach(([key, value]) => {
        code += `\n            .queryParam("${key}", "${value}")`;
      });
    }

    if (data.cookies && Object.keys(data.cookies).length > 0) {
      Object.entries(data.cookies).forEach(([key, value]) => {
        code += `\n            .cookie("${key}", "${value}")`;
      });
    }

    if (data.auth) {
      if (typeof data.auth === 'string' && data.auth.includes(':')) {
        const [user, pass] = data.auth.split(':');
        code += `\n            .auth().basic("${user}", "${pass}")`;
      }
    }

    const contentType = data.headers?.['Content-Type'] || data.headers?.['content-type'];
    if (contentType) {
      code += `\n            .contentType("${contentType}")`;
    }

    if (data.data) {
      const bodyStr = typeof data.data === 'string' ? data.data : JSON.stringify(data.data, null, 2);
      code += `\n            .body(${JSON.stringify(bodyStr)})`;
    }

    code += `\n        .when()
            .${method.toLowerCase()}("${endpoint}")
        .then()
            .statusCode(200)
            .log().all();
            
        System.out.println("Response: " + response.asString());
    }
}`;

    return code;
  };

  const handleGenerateCode = () => {
    const code = generateRestAssuredCode(parsed);
    setGeneratedCode(code);
    setShowCodeDialog(true);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      alert('Code copied to clipboard!');
    } catch {
      alert('Copy failed');
    }
  };

  const handleAddEntry = (section: string) => {
    setAddDialogSection(section);
    setNewKey("");
    setNewValue("");
    setShowAddDialog(true);
  };

  const saveNewEntry = () => {
    if (!newKey.trim()) return;

    const newParsed = JSON.parse(JSON.stringify(parsed));

    if (!newParsed[addDialogSection]) {
      newParsed[addDialogSection] = {};
    }

    if (addDialogSection === 'flags' || addDialogSection === 'ssl_config') {
      newParsed[addDialogSection][newKey] = true;
    } else {
      newParsed[addDialogSection][newKey] = newValue;
    }

    setParsed(newParsed);

    if (!openSections.includes(addDialogSection)) {
      setOpenSections([...openSections, addDialogSection]);
    }

    setShowAddDialog(false);
    setNewKey("");
    setNewValue("");
  };

  const handleAddSection = () => {
    const missingSections = getMissingSections();
    if (missingSections.length === 0) {
      alert('All standard sections are already present!');
      return;
    }
    setShowNewSectionDialog(true);
    setNewSectionName("");
  };

  const saveNewSection = () => {
    if (!newSectionName.trim()) {
      return;
    }

    const newParsed = JSON.parse(JSON.stringify(parsed));

    if (newSectionName === 'flags' || newSectionName === 'ssl_config') {
      newParsed[newSectionName] = {};
    } else if (newSectionName === 'path_parameters') {
      newParsed[newSectionName] = [];
    } else if (newSectionName === 'auth') {
      newParsed[newSectionName] = '';
    } else {
      newParsed[newSectionName] = {};
    }
    setParsed(newParsed);

    const updatedOpenSections = openSections.includes(newSectionName)
      ? openSections
      : [...openSections, newSectionName];

    setOpenSections(updatedOpenSections);

    setShowNewSectionDialog(false);
    setNewSectionName("");
  };

  const toggleBodyCollapse = (path: string) => {
    setBodyCollapsed(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const handleBodyExpandCollapseAll = () => {
    if (allExpanded) {
      const allPaths: string[] = [];
      const collectPaths = (obj: any, currentPath: string = 'data') => {
        if (typeof obj === 'object' && obj !== null) {
          if (Array.isArray(obj)) {
            obj.forEach((item, idx) => {
              const path = `${currentPath}[${idx}]`;
              allPaths.push(path);
              collectPaths(item, path);
            });
          } else {
            Object.keys(obj).forEach(key => {
              const path = `${currentPath}.${key}`;
              allPaths.push(path);
              collectPaths(obj[key], path);
            });
          }
        }
      };
      collectPaths(parsed.data);

      const collapsed: CollapsedState = {};
      allPaths.forEach(path => {
        collapsed[path] = true;
      });
      setBodyCollapsed(collapsed);
    } else {
      setBodyCollapsed({});
    }
    setAllExpanded(!allExpanded);
  };

  return {
    // State
    parsed,
    selected,
    editing,
    editedValues,
    showCodeDialog,
    generatedCode,
    showAddDialog,
    addDialogSection,
    newKey,
    newValue,
    showNewSectionDialog,
    newSectionName,
    openSections,
    bodyCollapsed,
    allExpanded,

    // Setters
    setShowCodeDialog,
    setNewKey,
    setNewValue,
    setShowAddDialog,
    setShowNewSectionDialog,
    setNewSectionName,
    setOpenSections,
    setSelected,

    // Actions
    handleReset,
    deleteSection,
    toggleSelect,
    toggleEdit,
    deleteSelected,
    deleteSingle,
    handleEditChange,
    exportData,
    handleGenerateCode,
    copyCode,
    handleAddEntry,
    saveNewEntry,
    handleAddSection,
    saveNewSection,
    toggleBodyCollapse,
    handleBodyExpandCollapseAll,

    // Helpers
    hasValidData,
    hasActiveFlags,
    getActiveFlags,
    getMissingSections,
    setGeneratedCode
  };
};