import { useState, useRef, useEffect, memo } from "react";
import { Highlight, themes } from "prism-react-renderer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, CheckCircle2, Download, AlertCircle, MessageSquare } from "lucide-react";
import { apiClient, GENERATE_TIMEOUT_MS } from "@/lib/api/apiClient";
import { ENV } from "@/lib/env";
import type { ParsedCurl, CodeGenConfig } from "@/types/curl";
import FeedbackDialog from "@/components/features/feedback/FeedbackDialog";

function CodeBlock({ code, language }: { code: string; language: string }) {
    return (
        <Highlight code={code} language={language} theme={themes.vsDark}>
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
                <pre
                    className={`${className} text-xs font-mono p-6 overflow-auto`}
                    style={style}
                >
                    {tokens.map((line, i) => (
                        <div key={i} {...getLineProps({ line })}>
                            {line.map((token, key) => (
                                <span key={key} {...getTokenProps({ token })} />
                            ))}
                        </div>
                    ))}
                </pre>
            )}
        </Highlight>
    );
}

// POM dependency versions — update these when bumping library versions
const POM_VERSIONS = {
  REST_ASSURED: '5.3.2',
  TESTNG: '7.8.0',
  LOMBOK: '1.18.30',
  JACKSON: '2.15.3',
  MAVEN_SUREFIRE: '3.0.0',
} as const;

const DEFAULT_CODE_CONFIG: CodeGenConfig = {
  option: '',
  className: 'ApiTest',
  methodName: 'testApiRequest',
  assertionRequired: true,
  statusCode: '200',
  loggingRequired: true,
  needPojo: false,
};

interface CodeGenerationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    parsedData: ParsedCurl;
}

const generateEndpoint = ENV.GENERATE_ENDPOINT;

function CodeGenerationDialogInner({
    open,
    onOpenChange,
    parsedData,
}: CodeGenerationDialogProps) {
    const [currentStep, setCurrentStep] = useState<'config' | 'result'>('config');
    const [codeConfig, setCodeConfig] = useState<CodeGenConfig>(DEFAULT_CODE_CONFIG);
    const [pojoClassName, setPojoClassName] = useState('RequestBody');

    const [generatedCode, setGeneratedCode] = useState<string>('');
    const [pojoCode, setPojoCode] = useState<string>('');
    const [completeCode, setCompleteCode] = useState<string>('');
    const [pomDependencies, setPomDependencies] = useState<string>('');
    const [warnings, setWarnings] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'test' | 'pojo' | 'pom'>('test');
    const [error, setError] = useState<string>('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const resultHeadingRef = useRef<HTMLSpanElement>(null);

    // Move focus to the result area when generation completes so screen readers announce it
    useEffect(() => {
        if (currentStep === 'result') {
            resultHeadingRef.current?.focus();
        }
    }, [currentStep]);

    const JAVA_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
    const validateJavaIdentifier = (value: string, field: string) => {
        if (!value.trim()) return setFieldErrors(prev => ({ ...prev, [field]: 'Required' }));
        if (!JAVA_IDENTIFIER.test(value.trim()))
            return setFieldErrors(prev => ({ ...prev, [field]: 'Must be a valid Java identifier (no spaces or special characters)' }));
        setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    };

    const generatePomDependencies = () => {
        const dependencies: string[] = [];

        dependencies.push(`        <!-- REST Assured -->
        <dependency>
            <groupId>io.rest-assured</groupId>
            <artifactId>rest-assured</artifactId>
            <version>${POM_VERSIONS.REST_ASSURED}</version>
            <scope>test</scope>
        </dependency>`);

        dependencies.push(`        <!-- TestNG -->
        <dependency>
            <groupId>org.testng</groupId>
            <artifactId>testng</artifactId>
            <version>${POM_VERSIONS.TESTNG}</version>
            <scope>test</scope>
        </dependency>`);

        if (codeConfig.needPojo) {
            dependencies.push(`        <!-- Lombok (for POJO @Data, @Builder) -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <version>${POM_VERSIONS.LOMBOK}</version>
            <scope>provided</scope>
        </dependency>`);

            dependencies.push(`        <!-- Jackson (for JSON serialization) -->
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>${POM_VERSIONS.JACKSON}</version>
        </dependency>`);
        }

        if (parsedData.data) {
            dependencies.push(`        <!-- JSON Path (for response parsing) -->
        <dependency>
            <groupId>io.rest-assured</groupId>
            <artifactId>json-path</artifactId>
            <version>${POM_VERSIONS.REST_ASSURED}</version>
            <scope>test</scope>
        </dependency>`);
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>api-tests</artifactId>
    <version>1.0-SNAPSHOT</version>

    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <dependencies>
${dependencies.join('\n\n')}
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>${POM_VERSIONS.MAVEN_SUREFIRE}</version>
                <configuration>
                    <suiteXmlFiles>
                        <suiteXmlFile>testng.xml</suiteXmlFile>
                    </suiteXmlFiles>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>`;
    };

    const handleGenerateCodeWithConfig = async () => {
        setError('');
        setWarnings([]);

        if (!codeConfig.option) {
            setError('Please select a code generation option');
            return;
        }

        if (codeConfig.needPojo && !pojoClassName.trim()) {
            setError('Please provide a POJO class name');
            return;
        }

        setIsGenerating(true);

        try {
            const { data: result } = await apiClient.post(generateEndpoint, {
                parsed_data: parsedData,
                config: codeConfig,
            }, { timeout: GENERATE_TIMEOUT_MS });

            if (result.success) {
                setGeneratedCode(result.generated_code || '');
                setPojoCode(result.pojo_code || '');
                setCompleteCode(result.complete_code || '');
                setWarnings(result.warnings || []);
                setPomDependencies(generatePomDependencies());
                setActiveTab('test');
                setCurrentStep('result');
            } else {
                const errMsg = typeof result.error === 'object'
                    ? result.error.message
                    : result.error || 'Unknown error';
                setError('Failed to generate code: ' + errMsg);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to generate code. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyCode = async () => {
        const codeToCopy = activeTab === 'test'
            ? (completeCode || generatedCode)
            : activeTab === 'pojo'
                ? pojoCode
                : pomDependencies;

        try {
            await navigator.clipboard.writeText(codeToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    const handleDownloadCode = () => {
        let codeToDownload = '';
        let fileName = '';

        switch (activeTab) {
            case 'test':
                codeToDownload = completeCode || generatedCode;
                fileName = `${codeConfig.className}.java`;
                break;
            case 'pojo':
                codeToDownload = pojoCode;
                fileName = `${pojoClassName}.java`;
                break;
            case 'pom':
                codeToDownload = pomDependencies;
                fileName = 'pom.xml';
                break;
        }

        const blob = new Blob([codeToDownload], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    const handleBack = () => {
        setCurrentStep('config');
        setCopied(false);
        setError('');
        setFieldErrors({});
    };

    const handleClose = () => {
        setCurrentStep('config');
        setCodeConfig(DEFAULT_CODE_CONFIG);
        setPojoClassName('RequestBody');
        setGeneratedCode('');
        setPojoCode('');
        setCompleteCode('');
        setPomDependencies('');
        setWarnings([]);
        setCopied(false);
        setActiveTab('test');
        setError('');
        setFieldErrors({});
        onOpenChange(false);
    };

    const canDownload = () => {
        if (activeTab === 'pojo') return true;
        if (activeTab === 'pom') return true;
        if (activeTab === 'test' && codeConfig.option === 'full') return true;
        return false;
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg md:max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {currentStep === 'config' ? 'Code Generation Configuration' : (
                            // tabIndex -1 allows programmatic focus without entering the tab order
                            <span ref={resultHeadingRef} tabIndex={-1} className="outline-none">Generated Code</span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {/* Screen-reader live region */}
                <div aria-live="polite" aria-atomic="true" className="sr-only">
                    {isGenerating ? 'Generating code, please wait…'
                        : currentStep === 'result' ? 'Code generation complete. Review the generated code below.'
                        : error ? `Error: ${error}`
                        : ''}
                </div>

                {currentStep === 'config' ? (
                    <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                        {/* Inline Error Display */}
                        {error && (
                            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm border border-destructive/30">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Generation Type Selection */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium">
                                Generation Type <span className="text-destructive">*</span>
                            </label>

                            <div className="space-y-2">
                                <label htmlFor="option-full" className="flex items-start gap-3 cursor-pointer p-3 rounded-md border hover:bg-accent transition-colors">
                                    <input
                                        id="option-full"
                                        type="radio"
                                        name="codeOption"
                                        value="full"
                                        checked={codeConfig.option === 'full'}
                                        onChange={(e) => { setCodeConfig({ ...codeConfig, option: e.target.value }); setError(''); }}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <span className="font-medium">Full Test Class</span>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Complete Java class with imports, @BeforeClass setup, and @Test method
                                        </p>
                                    </div>
                                </label>

                                <label htmlFor="option-method" className="flex items-start gap-3 cursor-pointer p-3 rounded-md border hover:bg-accent transition-colors">
                                    <input
                                        id="option-method"
                                        type="radio"
                                        name="codeOption"
                                        value="method"
                                        checked={codeConfig.option === 'method'}
                                        onChange={(e) => { setCodeConfig({ ...codeConfig, option: e.target.value }); setError(''); }}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <span className="font-medium">Test Method Only</span>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Just the @Test method with required imports
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Configuration Options */}
                        {codeConfig.option && (
                            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                                <h3 className="font-semibold text-sm">Configuration</h3>

                                {codeConfig.option === 'full' && (
                                    <div>
                                        <label htmlFor="class-name" className="text-sm font-medium mb-2 block">
                                            Test Class Name <span className="text-destructive">*</span>
                                        </label>
                                        <Input
                                            id="class-name"
                                            value={codeConfig.className}
                                            onChange={(e) => {
                                                setCodeConfig({ ...codeConfig, className: e.target.value });
                                                validateJavaIdentifier(e.target.value, 'className');
                                            }}
                                            placeholder="ApiTest"
                                            className={`font-mono ${fieldErrors.className ? 'border-destructive' : ''}`}
                                            aria-describedby={fieldErrors.className ? 'class-name-error' : undefined}
                                        />
                                        {fieldErrors.className && (
                                            <p id="class-name-error" className="text-xs text-destructive mt-1">{fieldErrors.className}</p>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="method-name" className="text-sm font-medium mb-2 block">
                                        Method Name <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="method-name"
                                        value={codeConfig.methodName}
                                        onChange={(e) => {
                                            setCodeConfig({ ...codeConfig, methodName: e.target.value });
                                            validateJavaIdentifier(e.target.value, 'methodName');
                                        }}
                                        placeholder="testApiRequest"
                                        className={`font-mono ${fieldErrors.methodName ? 'border-destructive' : ''}`}
                                        aria-describedby={fieldErrors.methodName ? 'method-name-error' : undefined}
                                    />
                                    {fieldErrors.methodName && (
                                        <p id="method-name-error" className="text-xs text-destructive mt-1">{fieldErrors.methodName}</p>
                                    )}
                                </div>

                                {/* POJO Generation */}
                                <div className="space-y-3 p-3 border rounded-md">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <Checkbox
                                            checked={codeConfig.needPojo}
                                            onCheckedChange={(checked) =>
                                                setCodeConfig({ ...codeConfig, needPojo: !!checked })
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

                                    {codeConfig.needPojo && (
                                        <div className="pl-7 pt-2">
                                            <label htmlFor="pojo-class-name" className="text-sm font-medium mb-2 block">
                                                POJO Class Name <span className="text-destructive">*</span>
                                            </label>
                                            <Input
                                                id="pojo-class-name"
                                                value={pojoClassName}
                                                onChange={(e) => {
                                                    setPojoClassName(e.target.value);
                                                    validateJavaIdentifier(e.target.value, 'pojoClassName');
                                                }}
                                                placeholder="RequestBody"
                                                className={`font-mono ${fieldErrors.pojoClassName ? 'border-destructive' : ''}`}
                                                aria-describedby={fieldErrors.pojoClassName ? 'pojo-class-name-error' : undefined}
                                            />
                                            {fieldErrors.pojoClassName && (
                                                <p id="pojo-class-name-error" className="text-xs text-destructive mt-1">{fieldErrors.pojoClassName}</p>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Base name for your POJO classes (e.g., UserRequest, OrderDetails)
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Additional Options */}
                                <div className="space-y-3">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <Checkbox
                                            checked={codeConfig.assertionRequired}
                                            onCheckedChange={(checked) =>
                                                setCodeConfig({ ...codeConfig, assertionRequired: !!checked })
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

                                    {codeConfig.assertionRequired && (
                                        <div className="pl-7">
                                            <label className="text-sm font-medium mb-2 block">Expected Status Code</label>
                                            <Input
                                                type="number"
                                                value={codeConfig.statusCode}
                                                onChange={(e) => setCodeConfig({ ...codeConfig, statusCode: e.target.value })}
                                                placeholder="200"
                                                min="100"
                                                max="599"
                                                className="w-32"
                                            />
                                        </div>
                                    )}

                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <Checkbox
                                            checked={codeConfig.loggingRequired}
                                            onCheckedChange={(checked) =>
                                                setCodeConfig({ ...codeConfig, loggingRequired: !!checked })
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

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button variant="outline" onClick={handleClose}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleGenerateCodeWithConfig}
                                disabled={!codeConfig.option || isGenerating || (codeConfig.needPojo && !pojoClassName.trim()) || Object.keys(fieldErrors).length > 0}
                                className="bg-primary"
                            >
                                {isGenerating ? 'Generating...' : 'Generate Code'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col flex-1 overflow-hidden">
                        {/* Warnings */}
                        {warnings.length > 0 && (
                            <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-sm">
                                <p className="font-medium text-yellow-700 dark:text-yellow-400 mb-1">Warnings:</p>
                                <ul className="list-disc list-inside text-yellow-600 dark:text-yellow-300 text-xs space-y-0.5">
                                    {warnings.map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            </div>
                        )}

                        {/* Tabs — accessible tab pattern */}
                        <div role="tablist" aria-label="Generated output tabs" className="flex gap-1 mb-4 border-b bg-muted/50 rounded-t-md p-1">
                            <button
                                role="tab"
                                id="tab-test"
                                aria-selected={activeTab === 'test'}
                                aria-controls="tabpanel-test"
                                onClick={() => setActiveTab('test')}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'test'
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                            >
                                Test Code
                            </button>
                            {codeConfig.needPojo && pojoCode && (
                                <button
                                    role="tab"
                                    id="tab-pojo"
                                    aria-selected={activeTab === 'pojo'}
                                    aria-controls="tabpanel-pojo"
                                    onClick={() => setActiveTab('pojo')}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'pojo'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                        }`}
                                >
                                    POJO Classes
                                </button>
                            )}
                            <button
                                role="tab"
                                id="tab-pom"
                                aria-selected={activeTab === 'pom'}
                                aria-controls="tabpanel-pom"
                                onClick={() => setActiveTab('pom')}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'pom'
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                            >
                                Dependencies (pom.xml)
                            </button>
                        </div>

                        {/* Code Display */}
                        <div className="flex-1 flex flex-col overflow-hidden rounded-md border">
                            <div className="flex justify-end gap-2 p-2 border-b bg-muted/30">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyCode}
                                    className={copied ? 'text-primary' : ''}
                                >
                                    {copied ? (
                                        <><CheckCircle2 className="w-4 h-4 mr-2" />Copied</>
                                    ) : (
                                        <><Copy className="w-4 h-4 mr-2" />Copy</>
                                    )}
                                </Button>
                                {canDownload() && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleDownloadCode}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download
                                    </Button>
                                )}
                            </div>
                            <div
                                role="tabpanel"
                                id={`tabpanel-${activeTab}`}
                                aria-labelledby={`tab-${activeTab}`}
                                className="flex-1 overflow-auto bg-muted/30"
                            >
                                {/* SECURITY: Rendered via prism-react-renderer which uses React children
                                    (no dangerouslySetInnerHTML), so XSS is not a concern. */}
                                <CodeBlock
                                    code={activeTab === 'test' ? (completeCode || generatedCode) : activeTab === 'pojo' ? pojoCode : pomDependencies}
                                    language={activeTab === 'pom' ? 'xml' : 'java'}
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-between gap-2 pt-4 border-t mt-4">
                            <Button variant="outline" onClick={handleBack}>
                                ← Back to Config
                            </Button>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setFeedbackOpen(true)}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Feedback
                                </Button>
                                <Button variant="outline" onClick={handleClose}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>

            <FeedbackDialog
                open={feedbackOpen}
                onOpenChange={setFeedbackOpen}
                generatedCode={completeCode || generatedCode}
            />
        </Dialog>
    );
}

export default memo(CodeGenerationDialogInner);
