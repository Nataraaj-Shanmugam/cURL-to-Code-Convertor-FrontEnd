/**
 * ResultStep Component
 * Displays generated code with copy and download functionality
 */

import { Button } from '@/components/ui/button';
import { Copy, CheckCircle2, Download } from 'lucide-react';
import { CodeTab } from '@/constants/code-generation';
import CodeTabs from './CodeTabs';

// ============================================================================
// TYPES
// ============================================================================

interface ResultStepProps {
  activeTab: CodeTab;
  availableTabs: CodeTab[];
  currentCode: string;
  currentFilename: string;
  canDownload: boolean;
  copied: boolean;
  onTabChange: (tab: CodeTab) => void;
  onCopy: () => void;
  onDownload: () => void;
  onBack: () => void;
  onClose: () => void;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface CodeActionsProps {
  copied: boolean;
  canDownload: boolean;
  onCopy: () => void;
  onDownload: () => void;
}

function CodeActions({ copied, canDownload, onCopy, onDownload }: CodeActionsProps) {
  return (
    <div className="flex justify-end gap-2 p-2 border-b bg-muted/30">
      <Button variant="outline" size="sm" onClick={onCopy}>
        {copied ? (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-4 h-4 mr-2" />
            Copy
          </>
        )}
      </Button>
      {canDownload && (
        <Button variant="outline" size="sm" onClick={onDownload}>
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
      )}
    </div>
  );
}

interface CodeDisplayProps {
  code: string;
}

function CodeDisplay({ code }: CodeDisplayProps) {
  return (
    <div className="flex-1 overflow-auto bg-muted/30">
      <pre className="text-xs font-mono p-6">
        <code>{code}</code>
      </pre>
    </div>
  );
}

interface NavigationActionsProps {
  onBack: () => void;
  onClose: () => void;
}

function NavigationActions({ onBack, onClose }: NavigationActionsProps) {
  return (
    <div className="flex justify-between gap-2 pt-4 border-t mt-4">
      <Button variant="outline" onClick={onBack}>
        ← Back to Config
      </Button>
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ResultStep({
  activeTab,
  availableTabs,
  currentCode,
  currentFilename,
  canDownload,
  copied,
  onTabChange,
  onCopy,
  onDownload,
  onBack,
  onClose,
}: ResultStepProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tabs */}
      <CodeTabs
        activeTab={activeTab}
        availableTabs={availableTabs}
        onTabChange={onTabChange}
      />

      {/* Code Display */}
      <div className="flex-1 flex flex-col overflow-hidden rounded-md border">
        <CodeActions
          copied={copied}
          canDownload={canDownload}
          onCopy={onCopy}
          onDownload={onDownload}
        />
        <CodeDisplay code={currentCode} />
      </div>

      {/* Navigation Actions */}
      <NavigationActions onBack={onBack} onClose={onClose} />
    </div>
  );
}