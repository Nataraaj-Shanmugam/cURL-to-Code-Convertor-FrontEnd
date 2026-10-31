/**
 * Pure helpers for the Code Generation dialog: form state, validation, the request payload
 * (production's contract), result file names and testng.xml.
 */
import type {
  CodeGenerationConfig,
  CodeGenerationResponse,
  DataFormat,
  ParsedCurl,
  PomGenerationConfig,
} from "@/types/curl";

export type JavaVersion = PomGenerationConfig["javaVersion"];
export type PomType = PomGenerationConfig["pomType"];

export const JAVA_VERSIONS: readonly JavaVersion[] = ["8", "11", "17", "21"];

/** Methods that carry no request body, so POJO generation is not offered for them (production: isNonBodyMethod). */
const NON_BODY_METHODS = ["GET", "DELETE", "HEAD", "OPTIONS"];

export const isNonBodyMethod = (method: string | undefined): boolean =>
  NON_BODY_METHODS.includes((method ?? "").toUpperCase());

/** What the user edits. Text inputs stay strings; they are converted when the request is built. */
export interface CodeGenForm {
  option: "" | "full" | "method";
  className: string;
  methodName: string;
  pojoClassName: string;
  needPojo: boolean;
  assertionRequired: boolean;
  statusCode: string;
  loggingRequired: boolean;
  assertResponseTime: boolean;
  maxResponseTimeMs: string;
  /** Comma separated. */
  testGroups: string;
  generatePom: boolean;
  pomType: PomType;
  javaVersion: JavaVersion;
  groupId: string;
  artifactId: string;
  version: string;
  /** null = use the format detected from the request. */
  dataFormatOverride: DataFormat | null;
}

export const DEFAULT_FORM: CodeGenForm = {
  option: "",
  className: "ApiTest",
  methodName: "testApiRequest",
  pojoClassName: "RequestBody",
  needPojo: false,
  assertionRequired: true,
  statusCode: "200",
  loggingRequired: true,
  assertResponseTime: false,
  maxResponseTimeMs: "2000",
  testGroups: "smoke",
  generatePom: false,
  pomType: "full",
  javaVersion: "11",
  groupId: "com.example",
  artifactId: "rest-assured-tests",
  version: "1.0-SNAPSHOT",
  dataFormatOverride: null,
};

// Production's fixed values for the fields it has no control for.
const POM_NAME = "REST Assured Test Project";
const POM_DESCRIPTION = "Automated REST API tests using REST Assured";
const TEST_DESCRIPTION = "Generated REST-Assured test";

export type FormField =
  | "option"
  | "className"
  | "methodName"
  | "pojoClassName"
  | "statusCode"
  | "maxResponseTimeMs"
  | "groupId"
  | "artifactId"
  | "version";

/** Fields that live in the collapsed "Maven & advanced" section. */
export const ADVANCED_FIELDS: readonly FormField[] = ["maxResponseTimeMs", "groupId", "artifactId", "version"];

const JAVA_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/** The POM coordinates are asked for only when a full POM is produced for a full class. */
export const needsCoordinates = (form: CodeGenForm): boolean =>
  form.generatePom && form.option === "full" && form.pomType === "full";

export interface FormContext {
  pojoDisabled: boolean;
}

function identifierError(value: string): string | undefined {
  if (!value.trim()) return "Required";
  if (!JAVA_IDENTIFIER.test(value.trim())) return "Must be a valid Java identifier (no spaces or special characters)";
  return undefined;
}

/**
 * Errors for the fields that are in use right now. Derived from the form each time, never stored, so a field that
 * is hidden (class name in Method-only mode, POJO name with POJO off, ...) can never block Generate.
 */
export function validateForm(form: CodeGenForm, ctx: FormContext): Partial<Record<FormField, string>> {
  const errors: Partial<Record<FormField, string>> = {};
  if (!form.option) errors.option = "Choose what to generate";
  if (form.option === "full") {
    const e = identifierError(form.className);
    if (e) errors.className = e;
  }
  const methodError = identifierError(form.methodName);
  if (methodError) errors.methodName = methodError;

  if (form.needPojo && !ctx.pojoDisabled) {
    const e = identifierError(form.pojoClassName);
    if (e) errors.pojoClassName = e;
  }
  if (form.assertionRequired) {
    const code = Number(form.statusCode);
    if (!form.statusCode.trim() || !Number.isInteger(code) || code < 100 || code > 599) {
      errors.statusCode = "Enter a status code between 100 and 599";
    }
  }
  if (form.assertResponseTime) {
    const ms = Number(form.maxResponseTimeMs);
    if (!form.maxResponseTimeMs.trim() || !Number.isFinite(ms) || ms <= 0) {
      errors.maxResponseTimeMs = "Enter a maximum response time above 0 ms";
    }
  }
  if (needsCoordinates(form)) {
    if (!form.groupId.trim()) errors.groupId = "Required";
    if (!form.artifactId.trim()) errors.artifactId = "Required";
    if (!form.version.trim()) errors.version = "Required";
  }
  return errors;
}

export function parseTestGroups(value: string): string[] {
  return value
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
}

/** The config object POSTed to the backend: production's field set plus pojoClassName. */
export function buildGenerateConfig(
  form: CodeGenForm,
  opts: { dataFormat: DataFormat; pojoDisabled: boolean },
): CodeGenerationConfig {
  if (!form.option) throw new Error("A generation type is required");
  const needPojo = form.needPojo && !opts.pojoDisabled;
  const maxMs = Number(form.maxResponseTimeMs);
  const config: CodeGenerationConfig = {
    option: form.option,
    serviceName: form.className.trim(),
    methodName: form.methodName.trim(),
    assertionRequired: form.assertionRequired,
    statusCode: form.statusCode,
    loggingRequired: form.loggingRequired,
    needPojo,
    useFluentApi: false,
    includeRetry: false,
    testGroups: parseTestGroups(form.testGroups),
    testPriority: 1,
    testDescription: TEST_DESCRIPTION,
    assertResponseTime: form.assertResponseTime,
    maxResponseTimeMs: form.maxResponseTimeMs.trim() && Number.isFinite(maxMs) ? maxMs : undefined,
    generatePom: form.generatePom,
    dataFormat: opts.dataFormat,
    pomConfig: form.generatePom
      ? {
          // A method snippet has no project of its own, so it only ever gets a dependency list.
          pomType: form.option === "method" ? "dependencies_only" : form.pomType,
          projectInfo: {
            groupId: form.groupId.trim(),
            artifactId: form.artifactId.trim(),
            version: form.version.trim(),
            name: POM_NAME,
            description: POM_DESCRIPTION,
          },
          includeJunit: false,
          includeAllure: false,
          includeExtent: false,
          includeExcel: false,
          includeFaker: false,
          includeLogging: true,
          includeCommonsIo: false,
          javaVersion: form.javaVersion,
        }
      : undefined,
  };
  if (needPojo) config.pojoClassName = form.pojoClassName.trim();
  return config;
}

// ── generated result ─────────────────────────────────────────────────────────

export type ResultTab = "test" | "pojo" | "pom" | "testng";

export interface GeneratedResult {
  option: "full" | "method";
  serviceName: string;
  methodName: string;
  testCode: string;
  pojoCode: string;
  pomXml: string;
  /** True when pomXml is a complete project file rather than a dependency list. */
  pomIsFull: boolean;
  warnings: string[];
  /** testng.xml to go with a full POM; empty otherwise. */
  testngXml: string;
  testngFileName: string;
  testngHint: string;
}

/** Test code, POJOs, POM and warnings from a successful response (production's field names). */
export function readGenerateResponse(
  response: CodeGenerationResponse,
  config: CodeGenerationConfig,
): GeneratedResult {
  const testCode = response.generated_code || response.complete_code || "";
  const pojoCode =
    response.pojo_code || (response.pojo_classes ? Object.values(response.pojo_classes).join("\n\n") : "");
  const pomXml = response.pomXml || "";
  const pomIsFull = !!pomXml && config.pomConfig?.pomType === "full";
  const suite = pomIsFull ? suiteFileFromPom(pomXml) : undefined;
  return {
    option: config.option,
    serviceName: config.serviceName,
    methodName: config.methodName,
    testCode,
    pojoCode,
    pomXml,
    pomIsFull,
    warnings: response.warnings ?? [],
    testngXml: pomIsFull ? buildTestngXml(testCode, config.serviceName) : "",
    testngFileName: suite ? suite.split("/").pop()! : "testng.xml",
    testngHint: suite
      ? `The generated pom.xml runs ${suite}. Save this file at that path, relative to pom.xml, then run mvn test.`
      : "Save this file next to pom.xml. If the pom does not already list it, add " +
        "<suiteXmlFiles><suiteXmlFile>testng.xml</suiteXmlFile></suiteXmlFiles> to the maven-surefire-plugin configuration, then run mvn test.",
  };
}

const TYPE_DECLARATION = /^\s*public\s+(?:(?:abstract|final|static)\s+)*(?:class|interface|enum|record)\s+([A-Za-z_$][\w$]*)/gm;

/** Names of the public top-level types declared in Java source. */
export function publicTypeNames(code: string): string[] {
  return [...code.matchAll(TYPE_DECLARATION)].map((m) => m[1]!);
}

const PACKAGE_DECLARATION = /^\s*package\s+([\w.]+)\s*;/m;

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A TestNG suite that runs the generated test class. */
export function buildTestngXml(testCode: string, serviceName: string): string {
  const pkg = PACKAGE_DECLARATION.exec(testCode)?.[1];
  const type = publicTypeNames(testCode)[0] ?? serviceName;
  const fqn = pkg ? `${pkg}.${type}` : type;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="API Tests">
    <test name="${escapeXml(type)}">
        <classes>
            <class name="${escapeXml(fqn)}"/>
        </classes>
    </test>
</suite>
`;
}

/** The suite file a pom's surefire configuration points at, if any. */
export function suiteFileFromPom(pomXml: string): string | undefined {
  const path = /<suiteXmlFile>\s*([^<\s][^<]*?)\s*<\/suiteXmlFile>/.exec(pomXml)?.[1];
  return path && !path.includes("${") ? path : undefined;
}

export interface ResultFile {
  tab: ResultTab;
  name: string;
  content: string;
}

/**
 * The files of a result. Java files are named after the public class inside them (a file named differently from
 * its class does not compile); the {Service}_Test / {Service}_Model names are the fallback.
 */
export function resultFiles(result: GeneratedResult): ResultFile[] {
  const files: ResultFile[] = [];
  if (result.testCode) {
    const type = publicTypeNames(result.testCode)[0];
    const name =
      result.option === "full"
        ? `${type ?? `${result.serviceName}_Test`}.java`
        : `${type ?? result.methodName}.java`;
    files.push({ tab: "test", name, content: result.testCode });
  }
  if (result.pojoCode) {
    const types = publicTypeNames(result.pojoCode);
    files.push({
      tab: "pojo",
      name: types.length === 1 ? `${types[0]}.java` : `${result.serviceName}_Model.java`,
      content: result.pojoCode,
    });
  }
  if (result.pomXml) {
    files.push({
      tab: "pom",
      name: result.pomIsFull ? "pom.xml" : "pom-dependencies.xml",
      content: result.pomXml,
    });
  }
  if (result.testngXml) files.push({ tab: "testng", name: result.testngFileName, content: result.testngXml });
  return files;
}

/** Files that "Download All" saves: a dependency list is a fragment, not a project file, so it is left out. */
export function downloadAllFiles(result: GeneratedResult): ResultFile[] {
  return resultFiles(result).filter((f) => f.tab !== "pom" || result.pomIsFull);
}

export function downloadTextFile(name: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/** A signature that changes whenever the request changes, so a result for an older request can be dropped. */
export function requestSignature(parsed: ParsedCurl): string {
  return JSON.stringify(parsed);
}
