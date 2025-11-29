import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, CheckCircle2, Download, DownloadCloud } from "lucide-react";
import { curlApi } from "@/lib/api/curl";
import type {
  ParsedCurl,
  CodeGenerationConfig,
  CodeGenerationResponse,
  PomGenerationConfig,
  PomProjectInfo,
} from "@/types/curl";

interface CodeGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedData: ParsedCurl;
}

const defaultPomProjectInfo: PomProjectInfo = {
  groupId: "com.example",
  artifactId: "rest-assured-tests",
  version: "1.0-SNAPSHOT",
  name: "REST Assured Test Project",
  description: "Automated REST API tests using REST Assured",
};

const defaultPomConfig: PomGenerationConfig = {
  pomType: "full",
  projectInfo: defaultPomProjectInfo,
  includeJunit: false,
  includeAllure: false,
  includeExtent: false,
  includeExcel: false,
  includeFaker: false,
  includeLogging: true,
  includeCommonsIo: false,
  javaVersion: "11",
  parallelExecution: "methods",
  threadCount: 3,
};

export default function CodeGenerationDialog({
  open,
  onOpenChange,
  parsedData,
}: CodeGenerationDialogProps) {
  const [currentStep, setCurrentStep] = useState<'config' | 'result'>('config');
  const [codeConfig, setCodeConfig] = useState<Partial<CodeGenerationConfig>>({
    option: undefined,
    className: 'ApiTest',
    methodName: 'testRequest',
    assertionRequired: true,
    statusCode: '200',
    loggingRequired: true,
    needPojo: false,
    useFluentApi: true,
    includeRetry: false,
    testGroups: ['smoke'],
    testPriority: 1,
    testDescription: 'Generated REST-Assured test',
    assertResponseTime: true,
    maxResponseTimeMs: 2000,
    generatePom: false,
    pomConfig: undefined,
  });

  const [pomConfig, setPomConfig] = useState<PomGenerationConfig>(defaultPomConfig);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [pojoCode, setPojoCode] = useState<string>('');
  const [pomDependencies, setPomDependencies] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'test' | 'pojo' | 'pom'>('test');

  const handlePomConfigChange = <K extends keyof PomGenerationConfig>(
    key: K,
    value: PomGenerationConfig[K]
  ) => {
    setPomConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleProjectInfoChange = <K extends keyof PomProjectInfo>(
    key: K,
    value: PomProjectInfo[K]
  ) => {
    setPomConfig((prev) => ({
      ...prev,
      projectInfo: {
        ...prev.projectInfo!,
        [key]: value,
      },
    }));
  };

  const handleGenerateCodeWithConfig = async () => {
    if (!codeConfig.option) {
      alert('Please select a code generation option');
      return;
    }

    if (codeConfig.className == undefined || !codeConfig.className.trim() || codeConfig.methodName == undefined || !codeConfig.methodName.trim()) {
      alert('Class name and method name are required');
      return;
    }

    // Validate POM config if POM generation is enabled
    if (codeConfig.generatePom && pomConfig.pomType === "full") {
      const projectInfo = pomConfig.projectInfo;
      if (!projectInfo?.groupId || !projectInfo?.artifactId || !projectInfo?.version) {
        alert("Group ID, Artifact ID, and Version are required for full POM generation.");
        return;
      }
    }

    setIsGenerating(true);

    try {
      const finalConfig: CodeGenerationConfig = {
        option: codeConfig.option!,
        className: codeConfig.className!,
        methodName: codeConfig.methodName!,
        assertionRequired: codeConfig.assertionRequired!,
        statusCode: codeConfig.statusCode,
        loggingRequired: codeConfig.loggingRequired!,
        needPojo: codeConfig.needPojo!,
        useFluentApi: codeConfig.useFluentApi!,
        includeRetry: codeConfig.includeRetry!,
        testGroups: codeConfig.testGroups,
        testPriority: codeConfig.testPriority,
        testDescription: codeConfig.testDescription,
        assertResponseTime: codeConfig.assertResponseTime!,
        maxResponseTimeMs: codeConfig.maxResponseTimeMs,
        generatePom: codeConfig.generatePom!,
        pomConfig: codeConfig.generatePom ? pomConfig : undefined,
      };

      const result = await curlApi.generateFromParsed(parsedData, finalConfig);

      if (result.success) {
        setGeneratedCode(result.generated_code || '');
        setPojoCode(result.pojo_code || '');
        // FIX: Check both pomXml (API returns) and pom_xml (fallback)
        setPomDependencies(result.pomXml || '');
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
        fileName = `${codeConfig.className}POJO.java`;
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
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // Clean up immediately
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const handleDownloadAll = () => {
    const files: { name: string; content: string }[] = [];

    // Always include test code
    if (generatedCode) {
      files.push({
        name: `${codeConfig.className}.java`,
        content: generatedCode
      });
    }

    // Include POJO if generated
    if (pojoCode) {
      files.push({
        name: `${codeConfig.className}POJO.java`,
        content: pojoCode
      });
    }

    // Include POM if generated AND it's a full POM (not dependencies only)
    if (pomDependencies && codeConfig.generatePom && pomConfig.pomType === 'full') {
      files.push({
        name: 'pom.xml',
        content: pomDependencies
      });
    }

    // Download each file with a small delay to prevent browser blocking
    files.forEach((file, index) => {
      setTimeout(() => {
        const blob = new Blob([file.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      }, index * 200);
    });
  };

  const handleBack = () => {
    setCurrentStep('config');
    setCopied(false);
  };

  const handleClose = () => {
    setCurrentStep('config');
    setCodeConfig({
      option: undefined,
      className: 'ApiTest',
      methodName: 'testRequest',
      assertionRequired: true,
      statusCode: '200',
      loggingRequired: true,
      needPojo: false,
      useFluentApi: true,
      includeRetry: false,
      testGroups: ['smoke'],
      testPriority: 1,
      testDescription: 'Generated REST-Assured test',
      assertResponseTime: true,
      maxResponseTimeMs: 2000,
      generatePom: false,
      pomConfig: undefined,
    });
    setPomConfig(defaultPomConfig);
    setGeneratedCode('');
    setPojoCode('');
    setPomDependencies('');
    setCopied(false);
    setActiveTab('test');
    onOpenChange(false);
  };

  const canDownload = () => {
    if (activeTab === 'pojo' && pojoCode) return true;
    if (activeTab === 'pom' && pomDependencies) return true;
    if (activeTab === 'test' && generatedCode) return true;
    return false;
  };

  const hasMultipleFiles = () => {
    let count = 0;
    if (generatedCode) count++;
    if (pojoCode) count++;
    if (pomDependencies) count++;
    return count > 1;
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
              <label className="text-sm font-semibold text-foreground">
                Generation Type <span className="text-red-500">*</span>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className={`relative flex flex-col gap-3 cursor-pointer p-5 rounded-xl border-2 transition-all duration-200 ${codeConfig.option === 'full'
                  ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50 hover:shadow-sm'
                  }`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="codeOption"
                      value="full"
                      checked={codeConfig.option === 'full'}
                      onChange={(e) => setCodeConfig({ ...codeConfig, option: e.target.value as "full" | "method" })}
                      className="w-4 h-4 text-primary accent-primary"
                    />
                    <span className="font-semibold text-base">Full Test Class</span>
                  </div>
                  <p className="text-sm text-muted-foreground ml-7 leading-relaxed">
                    Complete Java class with imports, @BeforeClass setup, and @Test method
                  </p>
                </label>

                <label className={`relative flex flex-col gap-3 cursor-pointer p-5 rounded-xl border-2 transition-all duration-200 ${codeConfig.option === 'method'
                  ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50 hover:shadow-sm'
                  }`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="codeOption"
                      value="method"
                      checked={codeConfig.option === 'method'}
                      onChange={(e) => setCodeConfig({ ...codeConfig, option: e.target.value as "full" | "method" })}
                      className="w-4 h-4 text-primary accent-primary"
                    />
                    <span className="font-semibold text-base">Test Method Only</span>
                  </div>
                  <p className="text-sm text-muted-foreground ml-7 leading-relaxed">
                    Just the @Test method with required imports
                  </p>
                </label>
              </div>
            </div>

            {/* Configuration Options */}
            {codeConfig.option && (
              <div className="space-y-6 p-6 border-2 rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 shadow-sm">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
                  Configuration Options
                </h3>

                {/* Class and Method Names */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {codeConfig.option === 'full' && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Test Class Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={codeConfig.className}
                        onChange={(e) => setCodeConfig({ ...codeConfig, className: e.target.value })}
                        placeholder="ApiTest"
                        className="font-mono border-2 focus:border-primary"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Method Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={codeConfig.methodName}
                      onChange={(e) => setCodeConfig({ ...codeConfig, methodName: e.target.value })}
                      placeholder="testApiRequest"
                      className="font-mono border-2 focus:border-primary"
                    />
                  </div>
                </div>

                {/* POJO Generation */}
                <div className="space-y-3 p-5 border-2 rounded-xl bg-card shadow-sm">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <Checkbox
                      checked={codeConfig.needPojo}
                      onCheckedChange={(checked) =>
                        setCodeConfig({ ...codeConfig, needPojo: !!checked })
                      }
                      className="w-5 h-5"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold group-hover:text-primary transition-colors">Generate POJO Classes</span>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Create Lombok-based POJOs with @Data and @Builder annotations
                      </p>
                    </div>
                  </label>
                </div>

                {/* Core Options - Modern Grid Layout */}
                <div>
                  <h4 className="text-sm font-semibold mb-4 text-foreground flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                    Test Configuration
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border-2 bg-card hover:border-primary/50 hover:shadow-sm transition-all group">
                      <Checkbox
                        checked={codeConfig.assertionRequired}
                        onCheckedChange={(checked) =>
                          setCodeConfig({ ...codeConfig, assertionRequired: !!checked })
                        }
                        className="w-5 h-5"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">Include Assertions</span>
                        <p className="text-xs text-muted-foreground mt-0.5">Validate responses</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border-2 bg-card hover:border-primary/50 hover:shadow-sm transition-all group">
                      <Checkbox
                        checked={codeConfig.loggingRequired}
                        onCheckedChange={(checked) =>
                          setCodeConfig({ ...codeConfig, loggingRequired: !!checked })
                        }
                        className="w-5 h-5"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">Include Logging</span>
                        <p className="text-xs text-muted-foreground mt-0.5">Debug output</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border-2 bg-card hover:border-primary/50 hover:shadow-sm transition-all group">
                      <Checkbox
                        checked={codeConfig.useFluentApi}
                        onCheckedChange={(checked) =>
                          setCodeConfig({ ...codeConfig, useFluentApi: !!checked })
                        }
                        className="w-5 h-5"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">Use Fluent API</span>
                        <p className="text-xs text-muted-foreground mt-0.5">Modern style</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border-2 bg-card hover:border-primary/50 hover:shadow-sm transition-all group">
                      <Checkbox
                        checked={codeConfig.includeRetry}
                        onCheckedChange={(checked) =>
                          setCodeConfig({ ...codeConfig, includeRetry: !!checked })
                        }
                        className="w-5 h-5"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">Include Retry Logic</span>
                        <p className="text-xs text-muted-foreground mt-0.5">Handle failures</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border-2 bg-card hover:border-primary/50 hover:shadow-sm transition-all group">
                      <Checkbox
                        checked={codeConfig.assertResponseTime}
                        onCheckedChange={(checked) =>
                          setCodeConfig({ ...codeConfig, assertResponseTime: !!checked })
                        }
                        className="w-5 h-5"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">Assert Response Time</span>
                        <p className="text-xs text-muted-foreground mt-0.5">Performance check</p>
                      </div>
                    </label>
                  </div>

                  {/* Nested Configuration Options */}
                  {codeConfig.assertionRequired && (
                    <div className="mt-4 ml-4 pl-4 border-l-2 border-primary/30">
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

                  {codeConfig.assertResponseTime && (
                    <div className="mt-4 ml-4 pl-4 border-l-2 border-primary/30">
                      <label className="text-sm font-medium mb-2 block">Max Response Time (ms)</label>
                      <Input
                        type="number"
                        value={codeConfig.maxResponseTimeMs ?? ''}
                        onChange={(e) => setCodeConfig({
                          ...codeConfig,
                          maxResponseTimeMs: e.target.value ? Number(e.target.value) : undefined
                        })}
                        placeholder="2000"
                        className="w-32"
                      />
                    </div>
                  )}
                </div>

                {/* POM Generation Section */}
                <div className="border-t-2 pt-6 space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer p-5 rounded-xl border-2 bg-card hover:border-primary/50 hover:shadow-sm transition-all group">
                    <Checkbox
                      checked={codeConfig.generatePom}
                      onCheckedChange={(checked) =>
                        setCodeConfig({ ...codeConfig, generatePom: !!checked })
                      }
                      className="w-5 h-5"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold group-hover:text-primary transition-colors">Generate POM.xml</span>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Create Maven POM file with dependencies
                      </p>
                    </div>
                  </label>

                  {codeConfig.generatePom && (
                    <div className="ml-4 pl-5 border-l-2 border-primary/30 space-y-5">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          POM Type <span className="text-red-500">*</span>
                        </label>
                        <Select
                          value={pomConfig.pomType}
                          onValueChange={(value: "full" | "dependencies_only") =>
                            handlePomConfigChange("pomType", value)
                          }
                        >
                          <SelectTrigger className="border-2">
                            <SelectValue placeholder="Select POM type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Full POM</SelectItem>
                            <SelectItem value="dependencies_only">Dependencies Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {pomConfig.pomType === "full" && (
                        <div className="space-y-4 p-5 border-2 rounded-xl bg-muted/30">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                            Project Information
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-medium mb-1.5 block">
                                Group ID <span className="text-red-500">*</span>
                              </label>
                              <Input
                                value={pomConfig.projectInfo?.groupId || ""}
                                onChange={(e) =>
                                  handleProjectInfoChange("groupId", e.target.value)
                                }
                                placeholder="com.example"
                                className="h-9 text-sm"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-medium mb-1.5 block">
                                Artifact ID <span className="text-red-500">*</span>
                              </label>
                              <Input
                                value={pomConfig.projectInfo?.artifactId || ""}
                                onChange={(e) =>
                                  handleProjectInfoChange("artifactId", e.target.value)
                                }
                                placeholder="rest-assured-tests"
                                className="h-9 text-sm"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-medium mb-1.5 block">
                                Version <span className="text-red-500">*</span>
                              </label>
                              <Input
                                value={pomConfig.projectInfo?.version || ""}
                                onChange={(e) =>
                                  handleProjectInfoChange("version", e.target.value)
                                }
                                placeholder="1.0-SNAPSHOT"
                                className="h-9 text-sm"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-medium mb-1.5 block">
                                Java Version
                              </label>
                              <Select
                                value={pomConfig.javaVersion}
                                onValueChange={(value: "8" | "11" | "17" | "21") =>
                                  handlePomConfigChange("javaVersion", value)
                                }
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="8">Java 8</SelectItem>
                                  <SelectItem value="11">Java 11</SelectItem>
                                  <SelectItem value="17">Java 17</SelectItem>
                                  <SelectItem value="21">Java 21</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t-2">
              <Button variant="outline" onClick={handleClose} className="px-6">
                Cancel
              </Button>
              <Button
                onClick={handleGenerateCodeWithConfig}
                disabled={!codeConfig.option || isGenerating}
                className="bg-primary px-8 min-w-40"
              >
                {isGenerating ? 'Generating...' : 'Generate Code'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Tabs */}
            <div className="flex justify-between items-center gap-2 mb-4 p-1.5 bg-muted/50 rounded-xl border-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('test')}
                  className={`px-5 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'test'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                  Test Code
                </button>
                {codeConfig.needPojo && pojoCode && (
                  <button
                    onClick={() => setActiveTab('pojo')}
                    className={`px-5 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'pojo'
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                  >
                    POJO Classes
                  </button>
                )}
                {pomDependencies && (
                  <button
                    onClick={() => setActiveTab('pom')}
                    className={`px-5 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'pom'
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                  >
                    POM.xml
                  </button>
                )}
              </div>

              {/* Download All Button - Moved here */}
              {hasMultipleFiles() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadAll}
                  className="gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <DownloadCloud className="w-4 h-4" />
                  Download All
                </Button>
              )}
            </div>

            {/* Code Display */}
            <div className="flex-1 flex flex-col overflow-hidden rounded-xl border-2 shadow-lg">
              <div className="flex justify-between items-center gap-3 p-3 border-b-2 bg-muted/30">
                <div className="text-sm text-muted-foreground font-medium px-2 font-mono">
                  {activeTab === 'test' && `${codeConfig.className}.java`}
                  {activeTab === 'pojo' && `${codeConfig.className}POJO.java`}
                  {activeTab === 'pom' && 'pom.xml'}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCode}
                    className="hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                        Copied!
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
                      className="hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-slate-950">
                <pre className="text-xs font-mono p-6 text-slate-50 leading-relaxed">
                  <code>{activeTab === 'test' ? generatedCode : activeTab === 'pojo' ? pojoCode : pomDependencies}</code>
                </pre>
              </div>
            </div>
            {/* Action Buttons */}
            <div className="flex justify-between gap-3 pt-4 border-t-2 mt-4">
              <Button variant="outline" onClick={handleBack} className="px-6">
                ← Back to Config
              </Button>
              <Button variant="outline" onClick={handleClose} className="px-6">
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>);
}