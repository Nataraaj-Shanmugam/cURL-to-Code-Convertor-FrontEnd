/**
 * ConfigurationStep Component
 * Handles code generation configuration UI
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  GenerationType,
  CodeConfig,
  GENERATION_TYPE_OPTIONS,
  ERROR_MESSAGES,
} from '@/constants/code-generation';

// ============================================================================
// TYPES
// ============================================================================

interface ConfigurationStepProps {
  config: CodeConfig;
  isGenerating: boolean;
  isValid: boolean;
  error: string | null;
  onConfigChange: (config: Partial<CodeConfig>) => void;
  onGenerate: () => void;
  onCancel: () => void;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface GenerationTypeOptionProps {
  value: GenerationType;
  label: string;
  description: string;
  isSelected: boolean;
  onChange: (value: GenerationType) => void;
}

function GenerationTypeOption({
  value,
  label,
  description,
  isSelected,
  onChange,
}: GenerationTypeOptionProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md border hover:bg-accent transition-colors">
      <input
        type="radio"
        name="codeOption"
        value={value}
        checked={isSelected}
        onChange={() => onChange(value)}
        className="mt-1"
      />
      <div className="flex-1">
        <span className="font-medium">{label}</span>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </label>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ConfigurationStep({
  config,
  isGenerating,
  isValid,
  error,
  onConfigChange,
  onGenerate,
  onCancel,
}: ConfigurationStepProps) {
  return (
    <div className="space-y-6 overflow-y-auto flex-1 pr-2">
      {/* Error Display */}
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Generation Type Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium">
          Generation Type <span className="text-destructive">*</span>
        </label>

        <div className="space-y-2">
          {GENERATION_TYPE_OPTIONS.map((option) => (
            <GenerationTypeOption
              key={option.value}
              value={option.value}
              label={option.label}
              description={option.description}
              isSelected={config.option === option.value}
              onChange={(value) => onConfigChange({ option: value })}
            />
          ))}
        </div>
      </div>

      {/* Configuration Options */}
      {config.option && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <h3 className="font-semibold text-sm">Configuration</h3>

          {/* Class Name (Full mode only) */}
          {config.option === GenerationType.FULL && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Test Class Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={config.className}
                onChange={(e) => onConfigChange({ className: e.target.value })}
                placeholder="ApiTest"
                className="font-mono"
              />
            </div>
          )}

          {/* Method Name */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Method Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={config.methodName}
              onChange={(e) => onConfigChange({ methodName: e.target.value })}
              placeholder="testApiRequest"
              className="font-mono"
            />
          </div>

          {/* POJO Generation */}
          <div className="space-y-3 p-3 border rounded-md">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={config.needPojo}
                onCheckedChange={(checked) =>
                  onConfigChange({ needPojo: !!checked })
                }
                className="mt-0.5"
              />
              <div className="flex-1">
                <span className="text-sm font-medium">Generate POJO Classes</span>
                <p className="text-xs text-muted-foreground mt-1">
                  Create Lombok-based POJOs with @Data and @Builder annotations
                </p>
              </div>
            </label>

            {config.needPojo && (
              <div className="pl-7 pt-2">
                <label className="text-sm font-medium mb-2 block">
                  POJO Class Name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={config.pojoClassName}
                  onChange={(e) =>
                    onConfigChange({ pojoClassName: e.target.value })
                  }
                  placeholder="RequestBody"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Base name for your POJO classes (e.g., UserRequest, OrderDetails)
                </p>
              </div>
            )}
          </div>

          {/* Additional Options */}
          <div className="space-y-3">
            {/* Assertions */}
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={config.assertionRequired}
                onCheckedChange={(checked) =>
                  onConfigChange({ assertionRequired: !!checked })
                }
                className="mt-0.5"
              />
              <div className="flex-1">
                <span className="text-sm font-medium">Include Assertions</span>
                <p className="text-xs text-muted-foreground mt-1">
                  Add TestNG assertions for response validation
                </p>
              </div>
            </label>

            {config.assertionRequired && (
              <div className="pl-7">
                <label className="text-sm font-medium mb-2 block">
                  Expected Status Code
                </label>
                <Input
                  type="number"
                  value={config.statusCode}
                  onChange={(e) => onConfigChange({ statusCode: e.target.value })}
                  placeholder="200"
                  min="100"
                  max="599"
                  className="w-32"
                />
              </div>
            )}

            {/* Logging */}
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={config.loggingRequired}
                onCheckedChange={(checked) =>
                  onConfigChange({ loggingRequired: !!checked })
                }
                className="mt-0.5"
              />
              <div className="flex-1">
                <span className="text-sm font-medium">Include Logging</span>
                <p className="text-xs text-muted-foreground mt-1">
                  Add console output for debugging
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isGenerating}>
          Cancel
        </Button>
        <Button
          onClick={onGenerate}
          disabled={!isValid || isGenerating}
          className="bg-primary"
        >
          {isGenerating ? 'Generating...' : 'Generate Code'}
        </Button>
      </div>
    </div>
  );
}