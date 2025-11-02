import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, CheckCircle2, Download } from "lucide-react";

interface CodeGenerationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    parsedData: any;
}

interface CodeConfig {
    option: string;
    className: string;
    methodName: string;
    assertionRequired: boolean;
    statusCode: string;
    loggingRequired: boolean;
    needPojo: boolean;
    pojoClassName: string;
}

export default function CodeGenerationDialog({
    open,
    onOpenChange,
    parsedData,
}: CodeGenerationDialogProps) {
    const [currentStep, setCurrentStep] = useState<'config' | 'result'>('config');
    const [codeConfig, setCodeConfig] = useState<CodeConfig>({
        option: '',
        className: 'ApiTest',
        methodName: 'testApiRequest',
        assertionRequired: true,
        statusCode: '200',
        loggingRequired: true,
        needPojo: false,
        pojoClassName: 'RequestBody',
    });

    const [generatedCode, setGeneratedCode] = useState<string>('');
    const [pojoCode, setPojoCode] = useState<string>('');
    const [pomDependencies, setPomDependencies] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'test' | 'pojo' | 'pom'>('test');

    // Generate POM dependencies based on config
    const generatePomDependencies = () => {
        const dependencies: string[] = [];

        // Base dependencies (always needed)
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

        // Add Lombok if POJO is needed
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

        // Check if data exists (JSON handling)
        if (parsedData.data) {
            dependencies.push(`        <!-- JSON Path (for response parsing) -->
        <dependency>
            <groupId>io.rest-assured</groupId>
            <artifactId>json-path</artifactId>
            <version>5.3.2</version>
            <scope>test</scope>
        </dependency>`);
        }

        const pomXml = `<?xml version="1.0" encoding="UTF-8"?>
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

        return pomXml;
    };

    const handleGenerateCodeWithConfig = async () => {
        if (!codeConfig.option) {
            alert('Please select a code generation option');
            return;
        }

        if (codeConfig.needPojo && !codeConfig.pojoClassName.trim()) {
            alert('Please provide a POJO class name');
            return;
        }

        setIsGenerating(true);

        try {
            const response = await fetch(`${import.meta.env.VITE_CURL_CRAFT_API_URL}${import.meta.env.VITE_CURL_CRAFT_API_GENERATE_ENDPOINT}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    parsed_data: parsedData,
                    config: {
                        ...codeConfig,
                        className: codeConfig.needPojo ? codeConfig.pojoClassName : codeConfig.className,
                    },
                }),
            });

            const result = await response.json();

            if (result.success) {
                setGeneratedCode(result.generated_code || '');
                setPojoCode(result.pojo_code || '');
                setPomDependencies(generatePomDependencies());

                // Always default to test tab
                setActiveTab('test');

                setCurrentStep('result');
            } else {
                alert('Failed to generate code: ' + result.error);
            }
        } catch (error) {
            console.error('Error generating code:', error);
            alert('Failed to generate code. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyCode = async () => {
        const codeToCopy = activeTab === 'test'
            ? generatedCode
            : activeTab === 'pojo'
                ? pojoCode
                : pomDependencies;

        try {
            await navigator.clipboard.writeText(codeToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy code:', error);
        }
    };

    const handleDownloadCode = () => {
        let codeToDownload = '';
        let fileName = '';

        switch (activeTab) {
            case 'test':
                codeToDownload = generatedCode;
                fileName = `${codeConfig.className}.java`;
                break;
            case 'pojo':
                codeToDownload = pojoCode;
                fileName = `${codeConfig.pojoClassName}.java`;
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
        URL.revokeObjectURL(url);
    };

    const handleBack = () => {
        setCurrentStep('config');
        setCopied(false);
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
            pojoClassName: 'RequestBody',
        });
        setGeneratedCode('');
        setPojoCode('');
        setPomDependencies('');
        setCopied(false);
        setActiveTab('test');
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
                        {/* Generation Type Selection */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium">
                                Generation Type <span className="text-destructive">*</span>
                            </label>

                            <div className="space-y-2">
                                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md border hover:bg-accent transition-colors">
                                    <input
                                        type="radio"
                                        name="codeOption"
                                        value="full"
                                        checked={codeConfig.option === 'full'}
                                        onChange={(e) => setCodeConfig({ ...codeConfig, option: e.target.value })}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <span className="font-medium">Full Test Class</span>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Complete Java class with imports, @BeforeClass setup, and @Test method
                                        </p>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md border hover:bg-accent transition-colors">
                                    <input
                                        type="radio"
                                        name="codeOption"
                                        value="method"
                                        checked={codeConfig.option === 'method'}
                                        onChange={(e) => setCodeConfig({ ...codeConfig, option: e.target.value })}
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
                                        <label className="text-sm font-medium mb-2 block">
                                            Test Class Name <span className="text-destructive">*</span>
                                        </label>
                                        <Input
                                            value={codeConfig.className}
                                            onChange={(e) => setCodeConfig({ ...codeConfig, className: e.target.value })}
                                            placeholder="ApiTest"
                                            className="font-mono"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        Method Name <span className="text-destructive">*</span>
                                    </label>
                                    <Input
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
                                                value={codeConfig.pojoClassName}
                                                onChange={(e) => setCodeConfig({ ...codeConfig, pojoClassName: e.target.value })}
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
                                disabled={!codeConfig.option || isGenerating || (codeConfig.needPojo && !codeConfig.pojoClassName.trim())}
                                className="bg-primary"
                            >
                                {isGenerating ? 'Generating...' : 'Generate Code'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col flex-1 overflow-hidden">
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
                                >
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
                                    <code>{activeTab === 'test' ? generatedCode : activeTab === 'pojo' ? pojoCode : pomDependencies}</code>
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