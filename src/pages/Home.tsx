// src/pages/Home.tsx
import { useState } from "react";
import {
  Code2,
  Edit3,
  FileJson,
  Zap,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Download,
  Eye,
  Settings,
  Copy,
  Github,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { useBackendStatus } from '@/contexts/BackendStatusContext';

export default function Home() {
  const navigate = useNavigate();
  const [showLogo, setShowLogo] = useState(true);
  const { backendStatus, downtime, isBackendDown } = useBackendStatus();

  const handleGetStarted = () => {
    if (isBackendDown) {
      return; // Prevent navigation when backend is down
    }
    navigate('/playground');
  };

  const formatDowntime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const features = [
    {
      icon: Code2,
      title: "Smart cURL Parsing",
      description: "Paste any cURL command and instantly parse it into structured, editable components with full support for headers, body, auth, and more.",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: Edit3,
      title: "Visual Editor",
      description: "Edit every aspect of your request through an intuitive accordion-based interface. Modify headers, query params, request body, and configurations inline.",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: Zap,
      title: "Code Generation",
      description: "Generate production-ready REST Assured test code with custom class names, assertions, logging, and automatic POJO creation from your request body.",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: FileJson,
      title: "Advanced Body Editor",
      description: "Navigate complex nested JSON structures with expandable/collapsible views, path visualization, and inline editing for all data types.",
      color: "from-green-500 to-emerald-500"
    }
  ];

  const steps = [
    { icon: Copy, text: "Paste your cURL command", detail: "From Postman, Chrome DevTools, or any source" },
    { icon: Eye, text: "Review & Edit", detail: "Modify any part of the request visually" },
    { icon: Settings, text: "Configure Generation", detail: "Set class names, assertions, and options" },
    { icon: Download, text: "Export Code", detail: "Get REST Assured tests + POJOs + dependencies" }
  ];

  const capabilities = [
    "All HTTP methods (GET, POST, PUT, PATCH, DELETE)",
    "Headers, cookies, and authentication",
    "Query parameters and path variables",
    "JSON, form-data, and raw body types",
    "SSL/TLS and network configurations",
    "Full test class or method-only generation",
    "Automatic POJO creation with Lombok",
    "Complete Maven dependencies (pom.xml)",
    "Hyper powered curl parser",
    "Export to JSON for backup"
  ];

  const githubUrl = import.meta.env.VITE_GITHUB_URL || 'https://github.com/Nataraaj-Shanmugam/cURL-to-Code-Convertor-FrontEnd';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/10">
      {/* Backend Status Banner */}
      {backendStatus === 'warning' && (
        <div className="bg-orange-500/10 border-b-2 border-orange-500/30">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-center gap-3">
              <div className="relative">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-2 h-2 bg-orange-500 rounded-full animate-ping"></div>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                  Backend is warming up... ({formatDowntime(downtime)})
                </span>
              </div>
              <div className="w-32 h-1.5 bg-orange-200 dark:bg-orange-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all duration-1000 ease-linear"
                  style={{ width: `${Math.min((downtime / 600) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {backendStatus === 'down' && (
        <div className="bg-red-500/10 border-b-2 border-red-500/30">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-center gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                  Backend is currently down. Playground features are disabled.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section with Enhanced Visuals */}
      <section className="container mx-auto px-4 py-20 md:py-28 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animation: 'pulse 4s ease-in-out infinite' }}></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animation: 'pulse 6s ease-in-out infinite', animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-pink-500/5 to-blue-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="flex flex-col items-center text-center space-y-8 max-w-5xl mx-auto relative z-10">
          {/* Logo with enhanced animation */}
          {showLogo && (
            <div className="relative">
              <div className="relative w-28 h-28 mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-50 animate-pulse"></div>
                <div className="relative w-28 h-28 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-3xl flex items-center justify-center shadow-2xl hover:scale-110 transition-all duration-500 cursor-pointer hover:rotate-6 group">
                  <Code2 className="w-14 h-14 text-white group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
              </div>
            </div>
          )}

          {!showLogo && (
            <button
              onClick={() => setShowLogo(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
            >
              Show logo
            </button>
          )}
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400">
                CurlCraft Assured
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed">
              Transform cURL commands into production-ready{" "}
              <span className="text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded">
                REST Assured+TestNG
              </span>{" "}
              tests with an intelligent visual editor
            </p>
          </div>

          {/* CTA Buttons with Enhanced Styling */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <button
              onClick={handleGetStarted}
              disabled={isBackendDown}
              className={`group relative inline-flex items-center justify-center rounded-xl text-base font-semibold h-14 px-10 shadow-lg transition-all duration-300 overflow-hidden ${
                isBackendDown
                  ? 'bg-gray-400 text-gray-700 cursor-not-allowed opacity-50'
                  : 'bg-primary text-primary-foreground hover:shadow-2xl hover:scale-105'
              }`}
            >
              {!isBackendDown && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              )}
              <span className="relative z-10">
                {isBackendDown ? 'Playground Unavailable' : 'Get Started'}
              </span>
              {!isBackendDown && (
                <ArrowRight className="relative z-10 ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              )}
            </button>

            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl text-base font-semibold border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-primary/50 h-14 px-10 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
            >
              <Github className="mr-2 w-5 h-5" />
              Documentation
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid with Enhanced Cards */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-none">
            Powerful Capabilities
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything you need to convert cURL to REST Assured seamlessly
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="group">
                <div className="h-full rounded-2xl border-2 border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden relative">
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  {/* Animated border effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-xl"></div>
                  </div>

                  <div className="p-8 relative z-10">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="rounded-3xl border-2 border-border bg-card/50 backdrop-blur-sm p-10 md:p-16 shadow-xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground text-lg">
              Four simple steps to generate your test code
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative group">
                  <div className="h-full text-center rounded-2xl border-2 border-border bg-background text-card-foreground shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                    <div className="p-8">
                      <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-300">
                        <Icon className="w-9 h-9 text-primary" />
                      </div>
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                        {index + 1}
                      </div>
                      <h3 className="font-bold mb-2 text-lg">{step.text}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-primary/50 to-transparent z-10"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border-2 border-border bg-card text-card-foreground shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">
                  What You Can Do
                </h2>
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                {capabilities.map((capability, index) => (
                  <div key={index} className="flex items-start gap-3 group">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5 group-hover:scale-125 transition-transform duration-200" />
                    <span className="text-sm md:text-base leading-relaxed">{capability}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 pb-28">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 text-card-foreground shadow-2xl overflow-hidden relative">
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-pink-500/5 animate-pulse"></div>

            <div className="p-12 md:p-16 text-center relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-5">
                Ready to Transform Your Testing Workflow?
              </h2>
              <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                Start converting your cURL commands to REST Assured+TestNG tests in seconds. No signup required, completely free.
              </p>
              <button
                onClick={handleGetStarted}
                disabled={isBackendDown}
                className={`group relative inline-flex items-center justify-center rounded-xl text-lg font-semibold h-14 px-12 shadow-xl transition-all duration-300 overflow-hidden ${
                  isBackendDown
                    ? 'bg-gray-400 text-gray-700 cursor-not-allowed opacity-50'
                    : 'bg-primary text-primary-foreground hover:shadow-2xl hover:scale-110'
                }`}
              >
                {!isBackendDown && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                )}
                <span className="relative z-10">
                  {isBackendDown ? 'Playground Unavailable' : 'Open Playground'}
                </span>
                {!isBackendDown && (
                  <ArrowRight className="relative z-10 ml-2 w-6 h-6 group-hover:translate-x-2 transition-transform" />
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}