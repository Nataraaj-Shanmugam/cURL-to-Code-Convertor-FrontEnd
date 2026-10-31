import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { getDataFormatDescription, getDataFormatLabel } from "@/lib/utils/dataFormatDetector";
import {
  JAVA_VERSIONS,
  needsCoordinates,
  type CodeGenForm,
  type FormField,
  type JavaVersion,
  type PomType,
} from "@/lib/utils/codeGeneration";
import type { DataFormat } from "@/types/curl";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface AdvancedSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CodeGenForm;
  onChange: (patch: Partial<CodeGenForm>, touched?: FormField) => void;
  /** Errors to show (already filtered to touched fields / after a submit attempt). */
  errors: Partial<Record<FormField, string>>;
  detectedFormat: DataFormat;
  effectiveFormat: DataFormat;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive mt-1">
      {message}
    </p>
  );
}

const FORMATS: readonly DataFormat[] = ["json", "xml", "both"];
const FORMAT_DEPENDENCIES: Record<DataFormat, string> = {
  json: "Includes: Jackson Databind",
  xml: "Includes: Jackson XML, JAXB (Java 11+)",
  both: "Includes: Jackson Databind + Jackson XML + JAXB",
};

export default function AdvancedSection({
  open,
  onOpenChange,
  form,
  onChange,
  errors,
  detectedFormat,
  effectiveFormat,
}: AdvancedSectionProps) {
  const summary = [
    `Java ${form.javaVersion}`,
    getDataFormatLabel(effectiveFormat),
    form.generatePom ? (form.option === "method" || form.pomType === "dependencies_only" ? "POM: dependencies" : "POM: full") : "no POM",
  ].join(" · ");
  const isMethod = form.option === "method";

  return (
    <section className="border rounded-lg">
      <button
        type="button"
        id="advanced-toggle"
        aria-expanded={open}
        aria-controls="advanced-panel"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center gap-2 p-3 text-left text-sm font-semibold hover:bg-accent rounded-lg"
      >
        {open ? <ChevronDown className="w-4 h-4" aria-hidden="true" /> : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
        Maven &amp; advanced
        <span className="ml-auto text-xs font-normal text-muted-foreground">{summary}</span>
      </button>

      {open && (
        <div id="advanced-panel" role="region" aria-labelledby="advanced-toggle" className="space-y-5 p-4 border-t">
          {/* Response time */}
          <div className="space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={form.assertResponseTime}
                onCheckedChange={(c) => onChange({ assertResponseTime: !!c })}
                className="mt-0.5"
                aria-label="Response time check"
              />
              <div className="flex-1">
                <span className="text-sm font-medium">Response time check</span>
                <p className="text-xs text-muted-foreground mt-1">Fail the test when the response is slower than the limit</p>
              </div>
            </label>
            {form.assertResponseTime && (
              <div className="pl-7">
                <label htmlFor="max-response-time" className="text-sm font-medium mb-2 block">
                  Max response time (ms)
                </label>
                <Input
                  id="max-response-time"
                  type="number"
                  min="1"
                  value={form.maxResponseTimeMs}
                  onChange={(e) => onChange({ maxResponseTimeMs: e.target.value }, "maxResponseTimeMs")}
                  placeholder="2000"
                  className={`w-32 ${errors.maxResponseTimeMs ? "border-destructive" : ""}`}
                  aria-invalid={!!errors.maxResponseTimeMs}
                  aria-describedby={errors.maxResponseTimeMs ? "max-response-time-error" : undefined}
                />
                <FieldError id="max-response-time-error" message={errors.maxResponseTimeMs} />
              </div>
            )}
          </div>

          {/* Test groups */}
          <div>
            <label htmlFor="test-groups" className="text-sm font-medium mb-2 block">
              Test groups
            </label>
            <Input
              id="test-groups"
              value={form.testGroups}
              onChange={(e) => onChange({ testGroups: e.target.value })}
              placeholder="smoke, regression"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">Comma separated TestNG groups for the @Test annotation</p>
          </div>

          {/* Data format */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium flex items-center gap-2 mb-1">
              Data format
              {form.dataFormatOverride === null ? (
                <Badge variant="secondary" className="text-xs">
                  Auto-detected: {getDataFormatLabel(detectedFormat)}
                </Badge>
              ) : (
                <button
                  type="button"
                  onClick={() => onChange({ dataFormatOverride: null })}
                  className="text-xs font-normal text-primary hover:underline"
                >
                  Use detected ({getDataFormatLabel(detectedFormat)})
                </button>
              )}
            </legend>
            <p className="text-xs text-muted-foreground">Which formats the API uses; affects POJO annotations and POM dependencies</p>
            {FORMATS.map((format) => (
              <label
                key={format}
                htmlFor={`data-format-${format}`}
                className={`flex items-start gap-3 cursor-pointer p-3 rounded-md border transition-colors ${
                  effectiveFormat === format ? "border-primary bg-primary/5" : "hover:bg-accent"
                }`}
              >
                <input
                  id={`data-format-${format}`}
                  type="radio"
                  name="dataFormat"
                  value={format}
                  checked={effectiveFormat === format}
                  onChange={() => onChange({ dataFormatOverride: format })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium">{getDataFormatLabel(format)}</span>
                  <p className="text-xs text-muted-foreground">{getDataFormatDescription(format)}</p>
                  <p className="text-xs text-muted-foreground">{FORMAT_DEPENDENCIES[format]}</p>
                </div>
              </label>
            ))}
            {effectiveFormat !== "json" && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md flex gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">XML dependencies:</strong> JAXB is required for Java 11+ to handle XML
                  binding. It is included automatically when the Java version is 11, 17 or 21.
                </p>
              </div>
            )}
          </fieldset>

          {/* POM */}
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={form.generatePom}
                onCheckedChange={(c) => onChange({ generatePom: !!c })}
                className="mt-0.5"
                aria-label="Generate pom.xml"
              />
              <div className="flex-1">
                <span className="text-sm font-medium">Generate pom.xml</span>
                <p className="text-xs text-muted-foreground mt-1">Maven POM with the dependencies the generated code needs</p>
              </div>
            </label>

            {form.generatePom && (
              <div className="pl-7 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="pom-type" className="text-sm font-medium mb-2 block">
                      POM type
                    </label>
                    <select
                      id="pom-type"
                      className={SELECT_CLASS}
                      value={isMethod ? "dependencies_only" : form.pomType}
                      disabled={isMethod}
                      onChange={(e) => onChange({ pomType: e.target.value as PomType })}
                    >
                      <option value="full">Full POM (complete project file)</option>
                      <option value="dependencies_only">Dependencies only</option>
                    </select>
                    {isMethod && (
                      <p className="text-xs text-muted-foreground mt-1">A method snippet only gets a dependency list</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="java-version" className="text-sm font-medium mb-2 block">
                      Java version
                    </label>
                    <select
                      id="java-version"
                      className={SELECT_CLASS}
                      value={form.javaVersion}
                      onChange={(e) => onChange({ javaVersion: e.target.value as JavaVersion })}
                    >
                      {JAVA_VERSIONS.map((v) => (
                        <option key={v} value={v}>
                          Java {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {needsCoordinates(form) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(
                      [
                        ["groupId", "pom-group-id", "Group ID", "com.example"],
                        ["artifactId", "pom-artifact-id", "Artifact ID", "rest-assured-tests"],
                        ["version", "pom-version", "Version", "1.0-SNAPSHOT"],
                      ] as const
                    ).map(([field, id, label, placeholder]) => (
                      <div key={field}>
                        <label htmlFor={id} className="text-sm font-medium mb-2 block">
                          {label} <span className="text-destructive">*</span>
                        </label>
                        <Input
                          id={id}
                          value={form[field]}
                          onChange={(e) => onChange({ [field]: e.target.value }, field)}
                          placeholder={placeholder}
                          className={`font-mono ${errors[field] ? "border-destructive" : ""}`}
                          aria-invalid={!!errors[field]}
                          aria-describedby={errors[field] ? `${id}-error` : undefined}
                        />
                        <FieldError id={`${id}-error`} message={errors[field]} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
