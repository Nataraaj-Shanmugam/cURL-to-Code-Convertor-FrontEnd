/**
 * CodeTabs Component
 * Tab navigation for generated code display
 */

import { CodeTab, CODE_TAB_CONFIG } from '@/constants/code-generation';

// ============================================================================
// TYPES
// ============================================================================

interface CodeTabsProps {
  activeTab: CodeTab;
  availableTabs: CodeTab[];
  onTabChange: (tab: CodeTab) => void;
}

interface TabButtonProps {
  tab: CodeTab;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function TabButton({ tab, label, isActive, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
      aria-selected={isActive}
      role="tab"
    >
      {label}
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CodeTabs({
  activeTab,
  availableTabs,
  onTabChange,
}: CodeTabsProps) {
  return (
    <div
      className="flex gap-1 mb-4 border-b bg-muted/50 rounded-t-md p-1"
      role="tablist"
    >
      {availableTabs.map((tab) => (
        <TabButton
          key={tab}
          tab={tab}
          label={CODE_TAB_CONFIG[tab].label}
          isActive={activeTab === tab}
          onClick={() => onTabChange(tab)}
        />
      ))}
    </div>
  );
}