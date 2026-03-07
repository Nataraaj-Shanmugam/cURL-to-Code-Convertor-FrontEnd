import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, CheckCircle2, Download, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/api/apiClient";
import type { ParsedCurl, CodeGenConfig } from "@/types/curl";

interface CodeGenerationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    parsedData: ParsedCurl;
}

const generateEndpoint = import.meta.env.VITE_CURL_CRAFT_API_GENERATE_ENDPOINT || "/api/generate-from-parsed";

export default function CodeGenerationDialog({
    open,
    onOpenChange,
    parsedData,
}: CodeGenerationDialogProps) {
    const [currentStep, setCurrentStep] = useState<'config' | 'result'>('config');
    const [codeConfig, setCodeConfig] = useState<CodeGenConfig>({
        option: '',
        className: 'ApiTest',
        methodName: 'testApiRequest',
        assertionRequired: true,
        statusCode: '200',
        loggingRequired: true,
        needPojo: false,
    });
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

    const generatePomDependencies = () => {
        const dependencies: string[] = [];

        dependencies.push(`        <!-- REST Assured -->
        <dependency>
            <groupId>io.rest-assured</groupId>
            <artifactId>rest-assured</artifactId>
            <version>5.3.2</version>
            <scope>test</scope>
        </dependency>`);

        dependencies.push(`        <!-- TestNG -->
        <dependency>
            <groupId>org.testng</groupId>
            <artifactId>testng</artifactId>
            <version>7.8.0</version>
            <scope>test</scope>
        </dependency>`);

        if (codeConfig.needPojo) {
            dependencies.push(`        <!-- Lombok (for POJO @Data, @Builder) -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <version>1.18.30</version>
            <scope>provided</scope>
        </dependency>`);

            dependencies.push(`        <!-- Jackson (for JSON serialization) -->
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>2.15.3</version>
        </dependency>`);
        }

        if (parsedData.data) {
            dependencies.push(`        <!-- JSON Path (for response parsing) -->
        <dependency>
            <groupId>io.rest-assured</groupId>
            <artifactId>json-path</artifactId>
            <version>5.3.2</version>
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
                <version>3.0.0</version>
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
            }, { timeout: 30000 });

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
        } catch (err: any) {
            console.error('Error generating code:', err);
            setError(err.message || 'Failed to generate code. Please try again.');
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
            setTimeout(() => setCopied(false), 2000);
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
    };

    const handleClose = () => {
        setCurrentStep('config');
        setCodeConfig({
            option: '',
            className: 'ApiTest',
            methodName: 'testApiRequest',
            assertionRequired: true,
            statusCode: '200',
            loggingRequired: true,
            needPojo: false,
        });
        setPojoClassName('RequestBody');
        setGeneratedCode('');
        setPojoCode('');
        setCompleteCode('');
        setPomDependencies('');
        setWarnings([]);
        setCopied(false);
        setActiveTab('test');
        setError('');
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
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {currentStep === 'config' ? 'Code Generation Configuration' : 'Generated Code'}
                    </DialogTitle>
                </DialogHeader>

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
                                            onChange={(e) => setCodeConfig({ ...codeConfig, className: e.target.value })}
                                            placeholder="ApiTest"
                                            className="font-mono"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="method-name" className="text-sm font-medium mb-2 block">
                                        Method Name <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        id="method-name"
                                        value={codeConfig.methodName}
                                        onChange={(e) => setCodeConfig({ ...codeConfig, methodName: e.target.value })}
                                        placeholder="testApiRequest"
                                        className="font-mono"
                                    />
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
                                            <label className="text-sm font-medium mb-2 block">
                                                POJO Class Name <span className="text-destructive">*</span>
                                            </label>
                                            <Input
                                                value={pojoClassName}
                                                onChange={(e) => setPojoClassName(e.target.value)}
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
                                disabled={!codeConfig.option || isGenerating || (codeConfig.needPojo && !pojoClassName.trim())}
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

                        {/* Tabs */}
                        <div className="flex gap-1 mb-4 border-b bg-muted/50 rounded-t-md p-1">
                            <button
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
                                    className="relative overflow-hidden"
                                >
                                    <AnimatePresence mode="wait" initial={false}>
                                        {copied ? (
                                            <motion.span
                                                key="copied"
                                                initial={{ y: 20, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                exit={{ y: -20, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="flex items-center text-primary"
                                            >
                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                                Copied
                                            </motion.span>
                                        ) : (
                                            <motion.span
                                                key="copy"
                                                initial={{ y: 20, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                exit={{ y: -20, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="flex items-center"
                                            >
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
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
                            <div className="flex-1 overflow-auto bg-muted/30">
                                <pre className="text-xs font-mono p-6">
                                    <code>{activeTab === 'test' ? (completeCode || generatedCode) : activeTab === 'pojo' ? pojoCode : pomDependencies}</code>
                                </pre>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-between gap-2 pt-4 border-t mt-4">
                            <Button variant="outline" onClick={handleBack}>
                                ← Back to Config
                            </Button>
                            <Button variant="outline" onClick={handleClose}>
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
