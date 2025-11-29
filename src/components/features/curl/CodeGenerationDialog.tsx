import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, CheckCircle2, Download, DownloadCloud, Code2, FileCode, Settings2, ChevronRight, Sparkles, FileText, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  javaVersion: "11"
};

export default function CodeGenerationDialog({
  open,
  onOpenChange,
  parsedData,
}: CodeGenerationDialogProps) {
  const [currentStep, setCurrentStep] = useState<'type' | 'config' | 'result'>('type');
  const [configTab, setConfigTab] = useState<'basic' | 'pom'>('basic');
  const [codeConfig, setCodeConfig] = useState<Partial<CodeGenerationConfig>>({
    option: undefined,
    serviceName: 'ServiceName',
    methodName: 'apiNameTest',
    assertionRequired: true,
    statusCode: '200',
    loggingRequired: true,
    needPojo: false,
    useFluentApi: false,
    includeRetry: false,
    testGroups: ['smoke'],
    testPriority: 1,
    testDescription: 'Generated REST-Assured test',
    assertResponseTime: false,
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

    if (codeConfig.serviceName == undefined || !codeConfig.serviceName.trim() || codeConfig.methodName == undefined || !codeConfig.methodName.trim()) {
      alert('Class name and method name are required');
      return;
    }

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
        serviceName: codeConfig.serviceName!,
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
        fileName = `${codeConfig.serviceName}.java`;
        break;
      case 'pojo':
        codeToDownload = pojoCode;
        fileName = `${codeConfig.serviceName}POJO.java`;
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

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const handleDownloadAll = () => {
    const files: { name: string; content: string }[] = [];

    if (generatedCode) {
      files.push({
        name: `${codeConfig.serviceName}.java`,
        content: generatedCode
      });
    }

    if (pojoCode) {
      files.push({
        name: `${codeConfig.serviceName}POJO.java`,
        content: pojoCode
      });
    }

    if (pomDependencies && codeConfig.generatePom && pomConfig.pomType === 'full') {
      files.push({
        name: 'pom.xml',
        content: pomDependencies
      });
    }

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

  // 1. Update handleBack function
  const handleBack = () => {
    if (currentStep === 'config') {
      setCurrentStep('type');
      setConfigTab('basic'); // Reset to basic when going back to type selection
    } else if (currentStep === 'result') {
      setCurrentStep('config');
      setConfigTab('pom'); // Go back to POM tab since that's where Generate was clicked
    }
    setCopied(false);
  };

  // 2. Add validation in handleNextTab
  const handleNextTab = () => {
    // Validate before moving to next tab
    if (configTab === 'basic') {
      if (!codeConfig.serviceName?.trim() || !codeConfig.methodName?.trim()) {
        alert('Class name and method name are required');
        return;
      }
      setConfigTab('pom');
    }
  };

  // 3. Update canProceedToNext logic
  const canProceedToNext = () => {
    if (configTab === 'basic') {
      if (codeConfig.option === 'full') {
        return codeConfig.serviceName?.trim() && codeConfig.methodName?.trim();
      }
      return codeConfig.methodName?.trim(); // Method only needs method name
    }
    return true; // Advanced and POM tabs don't block navigation
  };

  // 4. Add POM validation before generate
  const canGenerate = () => {
    if (!codeConfig.serviceName?.trim() || !codeConfig.methodName?.trim()) {
      return false;
    }

    if (codeConfig.generatePom && pomConfig.pomType === "full") {
      const projectInfo = pomConfig.projectInfo;
      return !!(projectInfo?.groupId?.trim() &&
        projectInfo?.artifactId?.trim() &&
        projectInfo?.version?.trim());
    }

    return true;
  };

  const handleNextToConfig = () => {
    if (!codeConfig.option) {
      alert('Please select a generation type');
      return;
    }
    setCurrentStep('config');
    setConfigTab('basic');
  };

  const handleClose = () => {
    setCurrentStep('type');
    setConfigTab('basic');
    setCodeConfig({
      option: undefined,
      serviceName: 'ServiceName',
      methodName: 'apiNameTest',
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

  const getEstimatedLOC = () => {
    let lines = 50;
    if (codeConfig.option === 'full') lines += 20;
    if (codeConfig.needPojo) lines += 30;
    if (codeConfig.includeRetry) lines += 15;
    if (codeConfig.generatePom) lines += 50;
    return lines;
  };

  const getFileCount = () => {
    let count = 1;
    if (codeConfig.needPojo) count++;
    if (codeConfig.generatePom) count++;
    return count;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-primary" />
              Code Generation Wizard
            </DialogTitle>

            {/* Progress Indicator */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${currentStep === 'type' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                Type
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${currentStep === 'config' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                Configure
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${currentStep === 'result' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                Preview
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* STEP 1: Choose Type */}
        {currentStep === 'type' && (
          <div className="space-y-6 overflow-y-auto flex-1 pr-2">
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-lg font-semibold">Choose Your Generation Type</h3>
              <p className="text-sm text-muted-foreground">Select the type of code you want to generate</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Full Test Class Card */}
              <label className={`relative cursor-pointer group ${codeConfig.option === 'full' ? 'scale-105' : ''
                } transition-transform duration-200`}>
                <input
                  type="radio"
                  name="codeOption"
                  value="full"
                  checked={codeConfig.option === 'full'}
                  onChange={(e) => setCodeConfig({ ...codeConfig, option: e.target.value as "full" | "method" })}
                  className="sr-only"
                />
                <div className={`h-full p-6 rounded-2xl border-2 transition-all duration-200 ${codeConfig.option === 'full'
                  ? 'border-primary bg-primary/5 shadow-lg ring-4 ring-primary/20'
                  : 'border-border hover:border-primary/50 hover:bg-accent/30 hover:shadow-md'
                  }`}>
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-start justify-between">
                      <div className="p-3 bg-primary/10 rounded-xl">
                        <Code2 className="w-8 h-8 text-primary" />
                      </div>
                      {codeConfig.option === 'full' && (
                        <CheckCircle2 className="w-6 h-6 text-primary" />
                      )}
                    </div>

                    <div className="flex-1">
                      <h4 className="text-lg font-bold mb-2">Full Test Class</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                        Complete production-ready test class with imports, setup methods, and annotations
                      </p>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          All imports included
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          @BeforeClass setup
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          @Test annotations
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          Ready to run
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <Badge variant="secondary" className="text-xs">
                        ~70-100 lines
                      </Badge>
                    </div>
                  </div>
                </div>
              </label>

              {/* Method Only Card */}
              <label className={`relative cursor-pointer group ${codeConfig.option === 'method' ? 'scale-105' : ''
                } transition-transform duration-200`}>
                <input
                  type="radio"
                  name="codeOption"
                  value="method"
                  checked={codeConfig.option === 'method'}
                  onChange={(e) => setCodeConfig({ ...codeConfig, option: e.target.value as "full" | "method" })}
                  className="sr-only"
                />
                <div className={`h-full p-6 rounded-2xl border-2 transition-all duration-200 ${codeConfig.option === 'method'
                  ? 'border-primary bg-primary/5 shadow-lg ring-4 ring-primary/20'
                  : 'border-border hover:border-primary/50 hover:bg-accent/30 hover:shadow-md'
                  }`}>
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-start justify-between">
                      <div className="p-3 bg-purple-500/10 rounded-xl">
                        <FileCode className="w-8 h-8 text-purple-600" />
                      </div>
                      {codeConfig.option === 'method' && (
                        <CheckCircle2 className="w-6 h-6 text-primary" />
                      )}
                    </div>

                    <div className="flex-1">
                      <h4 className="text-lg font-bold mb-2">Test Method Only</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                        Lightweight method snippet that you can integrate into existing test classes
                      </p>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          Minimal imports
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          @Test method only
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          Quick integration
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          Compact code
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <Badge variant="secondary" className="text-xs">
                        ~30-50 lines
                      </Badge>
                    </div>
                  </div>
                </div>
              </label>
            </div>

            {/* Preview Snippet */}
            {codeConfig.option && (
              <div className="mt-8 p-6 bg-muted/50 rounded-xl border-2 max-w-4xl mx-auto">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Code Structure Preview
                </h4>
                <pre className="text-xs font-mono bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto">
                  {codeConfig.option === 'full' ? (
                    `import io.restassured.RestAssured;
import org.testng.annotations.*;

public class ServiceName {
    @BeforeClass
    public void setup() {
        RestAssured.baseURI = "...";
    }
    
    @Test
    public void apiNameTest() {
        // Your test code here
    }
}`
                  ) : (
                    `@Test
public void apiNameTest() {
    given()
        .header("Content-Type", "application/json")
    .when()
        .get("/endpoint")
    .then()
        .statusCode(200);
}`
                  )}
                </pre>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t-2">
              <Button variant="outline" onClick={handleClose} className="px-6">
                Cancel
              </Button>
              <Button
                onClick={handleNextToConfig}
                disabled={!codeConfig.option}
                className="bg-primary px-8 gap-2"
              >
                Next: Configure
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Configure */}
        {currentStep === 'config' && (
          <div className="flex flex-1 overflow-hidden gap-6">
            {/* Left Sidebar - Quick Stats */}
            <div className="w-64 flex-shrink-0 space-y-4">
              <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border-2 border-primary/20">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  Generation Summary
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Type:</span>
                    <Badge variant="outline" className="text-xs">
                      {codeConfig.option === 'full' ? 'Full Class' : 'Method Only'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Files:</span>
                    <span className="font-semibold">{getFileCount()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Est. Lines:</span>
                    <span className="font-semibold">~{getEstimatedLOC()}</span>
                  </div>
                  <div className="pt-3 border-t space-y-2">
                    {codeConfig.needPojo && (
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        <span>POJO included</span>
                      </div>
                    )}
                    {codeConfig.generatePom && (
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        <span>POM included</span>
                      </div>
                    )}
                    {codeConfig.includeRetry && (
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        <span>Retry logic</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Configuration Area */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              <Tabs value={configTab} onValueChange={(v) => setConfigTab(v as 'basic' | 'pom')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="pom">POM</TabsTrigger>
                </TabsList>

                {/* Basic Tab */}
                <TabsContent value="basic" className="space-y-6 mt-6">
                  {/* Names Section */}
                  <div className="p-6 border-2 rounded-xl bg-card space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <FileCode className="w-5 h-5 text-primary" />
                      Naming
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {codeConfig.option === 'full' && (
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            API Service Name <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={codeConfig.serviceName}
                            onChange={(e) => setCodeConfig({ ...codeConfig, serviceName: e.target.value })}
                            placeholder="ServiceName"
                            className="font-mono"
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
                          className="font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* POJO Section */}
                  <div className="p-6 border-2 rounded-xl bg-gradient-to-br from-purple-500/5 to-transparent">
                    <label className="flex items-start gap-4 cursor-pointer group">
                      <Checkbox
                        checked={codeConfig.needPojo}
                        onCheckedChange={(checked) =>
                          setCodeConfig({ ...codeConfig, needPojo: !!checked })
                        }
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="w-4 h-4 text-purple-600" />
                          <span className="font-semibold group-hover:text-primary transition-colors">
                            Generate POJO Classes
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Automatically create Lombok-based POJOs with @Data and @Builder annotations for request/response handling
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Core Options */}
                  <div className="p-6 border-2 rounded-xl bg-card space-y-4">
                    <h3 className="font-semibold text-lg">Test Features</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { key: 'assertionRequired', label: 'Include Assertions', desc: 'Validate responses' },
                        { key: 'loggingRequired', label: 'Include Logging', desc: 'Debug output' },
                        { key: 'useFluentApi', label: 'Use Fluent API', desc: 'Modern style' },
                        { key: 'includeRetry', label: 'Retry Logic', desc: 'Handle failures' },
                        { key: 'assertResponseTime', label: 'Response Time Check', desc: 'Performance validation' },
                      ].map((option) => (
                        <label key={option.key} className="flex items-center gap-3 cursor-pointer p-4 rounded-lg border-2 bg-card hover:border-primary/50 transition-all group">
                          <Checkbox
                            checked={codeConfig[option.key as keyof typeof codeConfig] as boolean}
                            onCheckedChange={(checked) =>
                              setCodeConfig({ ...codeConfig, [option.key]: !!checked })
                            }
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium group-hover:text-primary transition-colors">
                              {option.label}
                            </span>
                            <p className="text-xs text-muted-foreground">{option.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    {/* Nested Options */}
                    {codeConfig.assertionRequired && (
                      <div className="ml-8 pl-4 border-l-2 border-primary/30 space-y-3">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Expected Status Code</label>
                          <Input
                            type="number"
                            value={codeConfig.statusCode}
                            onChange={(e) => setCodeConfig({ ...codeConfig, statusCode: e.target.value })}
                            placeholder="200"
                            className="w-32"
                          />
                        </div>
                      </div>
                    )}
                    {codeConfig.assertResponseTime && (
                      <div className="ml-8 pl-4 border-l-2 border-primary/30 space-y-3">
                        <div>
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
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* POM Tab */}
                <TabsContent value="pom" className="space-y-6 mt-6">
                  <div className="p-6 border-2 rounded-xl bg-gradient-to-br from-orange-500/5 to-transparent space-y-6">
                    <label className="flex items-start gap-4 cursor-pointer group">
                      <Checkbox
                        checked={codeConfig.generatePom}
                        onCheckedChange={(checked) =>
                          setCodeConfig({ ...codeConfig, generatePom: !!checked })
                        }
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-4 h-4 text-orange-600" />
                          <span className="font-semibold group-hover:text-primary transition-colors">
                            Generate POM.xml
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Create Maven POM file with all necessary dependencies
                        </p>
                      </div>
                    </label>

                    {codeConfig.generatePom && (
                      <div className="ml-8 pl-6 border-l-2 border-primary/30 space-y-5">
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
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full">Full POM (Complete project file)</SelectItem>
                              <SelectItem value="dependencies_only">Dependencies Only</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {pomConfig.pomType === "full" && (
                          <div className="space-y-4 p-5 border-2 rounded-xl bg-muted/30">
                            <h4 className="text-sm font-semibold">Project Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs font-medium mb-1.5 block">
                                  Group ID <span className="text-red-500">*</span>
                                </label>
                                <Input
                                  value={pomConfig.projectInfo?.groupId || ""}
                                  onChange={(e) => handleProjectInfoChange("groupId", e.target.value)}
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
                                  onChange={(e) => handleProjectInfoChange("artifactId", e.target.value)}
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
                                  onChange={(e) => handleProjectInfoChange("version", e.target.value)}
                                  placeholder="1.0-SNAPSHOT"
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium mb-1.5 block">Java Version</label>
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
                </TabsContent>
              </Tabs>

              <div className="flex justify-between gap-3 pt-4 border-t-2">
                <Button variant="outline" onClick={handleBack} className="px-6">
                  ← Back
                </Button>
                {configTab === 'pom' ? (
                  <Button
                    onClick={handleGenerateCodeWithConfig}
                    disabled={isGenerating || !canProceedToNext()}
                    className="bg-primary px-8 min-w-40"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Code
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNextTab}
                    disabled={!canProceedToNext()}
                    className="bg-primary px-8 gap-2"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Result */}
        {currentStep === 'result' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Success Banner */}
            <div className="mb-4 p-4 bg-green-500/10 border-2 border-green-500/20 rounded-xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Successfully Generated!</p>
                <p className="text-xs text-muted-foreground">
                  {getFileCount()} file{getFileCount() > 1 ? 's' : ''} • ~{getEstimatedLOC()} lines of code
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex justify-between items-center gap-2 mb-4 p-1.5 bg-muted/50 rounded-xl border-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('test')}
                  className={`px-5 py-3 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${activeTab === 'test'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                  <Code2 className="w-4 h-4" />
                  Test Code
                </button>
                {codeConfig.needPojo && pojoCode && (
                  <button
                    onClick={() => setActiveTab('pojo')}
                    className={`px-5 py-3 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${activeTab === 'pojo'
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                  >
                    <Package className="w-4 h-4" />
                    POJO Classes
                  </button>
                )}
                {pomDependencies && (
                  <button
                    onClick={() => setActiveTab('pom')}
                    className={`px-5 py-3 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${activeTab === 'pom'
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                  >
                    <FileText className="w-4 h-4" />
                    POM.xml
                  </button>
                )}
              </div>

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
                <div className="flex items-center gap-3">
                  <div className="text-sm text-muted-foreground font-medium px-2 font-mono">
                    {activeTab === 'test' && `${codeConfig.serviceName}.java`}
                    {activeTab === 'pojo' && `${codeConfig.serviceName}POJO.java`}
                    {activeTab === 'pom' && 'pom.xml'}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {activeTab === 'test' && generatedCode.split('\n').length}
                    {activeTab === 'pojo' && pojoCode.split('\n').length}
                    {activeTab === 'pom' && pomDependencies.split('\n').length}
                    {' lines'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCode}
                    className="hover:bg-primary hover:text-primary-foreground"
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
                      className="hover:bg-primary hover:text-primary-foreground"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-slate-950">
                <pre className="text-xs font-mono p-6 text-slate-50 leading-relaxed">
                  <code>
                    {activeTab === 'test' ? generatedCode : activeTab === 'pojo' ? pojoCode : pomDependencies}
                  </code>
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
    </Dialog>
  )
};