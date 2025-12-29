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
} from "lucide-react";
import { useBackendStatus } from "@/contexts/BackendStatusContext";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [showLogo, setShowLogo] = useState(true);
  const { backendStatus, downtime, attempt, maxRetries, waitTimeSeconds, isBackendReady } = useBackendStatus();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (!isBackendReady) {
      if (backendStatus === "down") {
        alert("Playground is unavailable. Backend is down. Try after some time.");
      } else {
        alert(`Backend is warming up... Please wait (Attempt ${attempt}/${maxRetries}).`);
      }
      return;
    }
    navigate("/playground");
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
      color: "from-cyan-500 to-teal-500"
    },
    {
      icon: Edit3,
      title: "Visual Editor",
      description: "Edit every aspect of your request through an intuitive accordion-based interface. Modify headers, query params, request body, and configurations inline.",
      color: "from-teal-500 to-emerald-500"
    },
    {
      icon: Zap,
      title: "Code Generation",
      description: "Generate production-ready REST Assured test code with custom class names, assertions, logging, and automatic POJO creation from your request body.",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: FileJson,
      title: "Advanced Body Editor",
      description: "Navigate complex nested JSON structures with expandable/collapsible views, path visualization, and inline editing for all data types.",
      color: "from-emerald-500 to-green-500"
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

  const githubUrl = 'https://github.com/Nataraaj-Shanmugam/cURL-to-Code-Convertor-FrontEnd';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      {!isBackendReady && (
  <div className={`relative overflow-hidden border-b-2 ${
    backendStatus === "down"
      ? "bg-gradient-to-r from-red-50 via-red-50 to-red-100 dark:from-red-950/40 dark:via-red-950/40 dark:to-red-900/40 border-red-200/50 dark:border-red-800/50"
      : "bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/40 dark:via-amber-950/40 dark:to-yellow-950/40 border-orange-200/50 dark:border-orange-800/50"
  }`}>
    {/* Animated background waves */}
    <div className="absolute inset-0 opacity-30">
      <div className={`absolute inset-0 animate-pulse ${
        backendStatus === "down"
          ? "bg-gradient-to-r from-red-400/20 via-red-400/20 to-red-500/20"
          : "bg-gradient-to-r from-orange-400/20 via-amber-400/20 to-yellow-400/20"
      }`} />
      <div className="absolute h-full w-full">
        <div className={`absolute left-0 top-0 h-full w-1/3 bg-gradient-to-r to-transparent animate-[slide_3s_ease-in-out_infinite] ${
          backendStatus === "down" ? "from-red-500/10" : "from-orange-500/10"
        }`} />
        <div className={`absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l to-transparent animate-[slide_3s_ease-in-out_infinite_reverse] ${
          backendStatus === "down" ? "from-red-500/10" : "from-yellow-500/10"
        }`} />
      </div>
    </div>

    <div className="container mx-auto px-4 py-6 relative z-10">
      <div className="text-center">
        {/* Status indicator with glow effect */}
        <div className="inline-flex items-center gap-3 justify-center mb-4">
          <div className="relative">
            <span className={`absolute inset-0 rounded-full blur-md ${
              backendStatus === "down" ? "bg-red-500" : "bg-orange-500 animate-pulse"
            }`} />
            <span className={`relative block h-3 w-3 rounded-full ${
              backendStatus === "down" ? "bg-red-500" : "bg-orange-500"
            }`} />
          </div>
          
          <span className={`text-2xl font-bold tracking-tight ${
            backendStatus === "down"
              ? "text-red-700 dark:text-red-400"
              : "bg-gradient-to-r from-orange-700 via-amber-700 to-yellow-700 dark:from-orange-400 dark:via-amber-400 dark:to-yellow-400 bg-clip-text text-transparent"
          }`}>
            {backendStatus === "down"
              ? "Backend Temporarily Offline"
              : "🚀 Backend Warming Up"}
          </span>
        </div>

        {backendStatus !== "down" && (
          <div className="mt-4 max-w-3xl mx-auto">
            {/* Time display - simple format */}
            <div className="flex items-center justify-between text-base text-slate-600 dark:text-slate-400 mb-4">
              {/* <span>
                Elapsed:{" "}
                <span className="font-semibold text-orange-600 dark:text-orange-400">
                  {formatDowntime(Math.min(downtime, waitTimeSeconds))}
                </span>
              </span> */}
              <span>
                Remaining:{" "}
                <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                  {formatDowntime(Math.max(0, waitTimeSeconds - downtime))}
                </span>
              </span>
            </div>

            {/* Enhanced progress bar with shimmer effect */}
            <div className="relative">
              <div className="h-3 w-full bg-slate-200/80 dark:bg-slate-700/80 rounded-full overflow-hidden shadow-inner backdrop-blur-sm">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 relative transition-all duration-700 ease-out shadow-lg"
                  style={{
                    width: `${Math.min((downtime / waitTimeSeconds) * 100, 100)}%`,
                  }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
                </div>
              </div>
            </div>

            {/* Attempt counter with badge style */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">Retry Attempt</span>
              <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-lg">
                <span className="tabular-nums">{Math.min(attempt, maxRetries)}</span>
                <span className="opacity-70">/</span>
                <span className="tabular-nums">{maxRetries}</span>
              </div>
            </div>
          </div>
        )}

        {backendStatus === "down" && (
          <p className="text-m text-red-600 dark:text-red-400 mt-3">
            Please check back in a few minutes
          </p>
        )}
      </div>
    </div>

    {/* Add keyframes in your global CSS or style tag */}
    <style>{`
      @keyframes slide {
        0%, 100% { transform: translateX(-100%); }
        50% { transform: translateX(200%); }
      }
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(200%); }
      }
    `}</style>
  </div>
)}

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-28 relative overflow-hidden">
        {/* Animated background elements - Updated to cyan/teal */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/8 rounded-full blur-3xl animate-pulse" style={{ animation: 'pulse 4s ease-in-out infinite' }}></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-500/8 rounded-full blur-3xl animate-pulse" style={{ animation: 'pulse 6s ease-in-out infinite', animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-cyan-500/3 to-teal-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="flex flex-col items-center text-center space-y-8 max-w-5xl mx-auto relative z-10">
          {/* Logo - Updated to cyan/teal gradient */}
          {showLogo && (
            <div className="relative">
              <div className="relative w-28 h-28 mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 rounded-3xl blur-2xl opacity-50 animate-pulse"></div>
                <div className="relative w-28 h-28 bg-gradient-to-br from-cyan-600 via-teal-600 to-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl hover:scale-110 transition-all duration-500 cursor-pointer hover:rotate-6 group">
                  <Code2 className="w-14 h-14 text-white group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
              </div>
            </div>
          )}

          {!showLogo && (
            <button
              onClick={() => setShowLogo(true)}
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors underline"
            >
              Show logo
            </button>
          )}

          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 dark:from-cyan-400 dark:via-teal-400 dark:to-emerald-400">
                CurlCraft Assured
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
              Transform cURL commands into production-ready{" "}
              <span className="text-cyan-600 dark:text-cyan-400 font-semibold bg-cyan-500/10 px-2 py-0.5 rounded">
                REST Assured+TestNG
              </span>{" "}
              tests with an intelligent visual editor
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <button
              onClick={handleGetStarted}
              disabled={!isBackendReady}
              className={`group relative inline-flex items-center justify-center rounded-xl text-base font-semibold h-14 px-10 shadow-lg transition-all duration-300 overflow-hidden
                ${!isBackendReady
                  ? "bg-gray-400 text-gray-700 cursor-not-allowed opacity-60"
                  : "bg-cyan-600 text-white hover:shadow-2xl hover:scale-105"
                }`}
            >
              {isBackendReady && (
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}

              <span className="relative z-10 flex items-center">
                {!isBackendReady
                  ? backendStatus === "down"
                    ? "Playground Unavailable"
                    : "Backend Warming Up"
                  : "Get Started"}
              </span>

              {isBackendReady && (
                <ArrowRight className="relative z-10 ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              )}
            </button>

            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl text-base font-semibold border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-cyan-500/50 h-14 px-10 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
            >
              <Github className="mr-2 w-5 h-5" />
              Documentation
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-white">
            Powerful Capabilities
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">
            Everything you need to convert cURL to REST Assured seamlessly
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="group">
                <div className="h-full rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-teal-500/20 to-emerald-500/20 blur-xl"></div>
                  </div>

                  <div className="p-8 relative z-10">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3 text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{feature.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="rounded-3xl border-2 border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-10 md:p-16 shadow-xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-white">
              How It Works
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Four simple steps to generate your test code
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative group">
                  <div className="h-full text-center rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                    <div className="p-8">
                      <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-300">
                        <Icon className="w-9 h-9 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 via-teal-600 to-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                        {index + 1}
                      </div>
                      <h3 className="font-bold mb-2 text-lg text-slate-900 dark:text-white">{step.text}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-cyan-500/50 to-transparent z-10"></div>
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
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500/10 via-teal-500/10 to-emerald-500/10 p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                  What You Can Do
                </h2>
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                {capabilities.map((capability, index) => (
                  <div key={index} className="flex items-start gap-3 group">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5 group-hover:scale-125 transition-transform duration-200" />
                    <span className="text-sm md:text-base leading-relaxed text-slate-700 dark:text-slate-300">{capability}</span>
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
          <div className="rounded-3xl border-2 border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-teal-500/10 to-emerald-500/10 shadow-2xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-teal-500/5 animate-pulse"></div>

            <div className="p-12 md:p-16 text-center relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-5 text-slate-900 dark:text-white">
                Ready to Transform Your Testing Workflow?
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                Start converting your cURL commands to REST Assured+TestNG tests in seconds. No signup required, completely free.
              </p>
              <button
                onClick={handleGetStarted}
                disabled={!isBackendReady}
                className={`group inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-4 text-base font-semibold transition-all duration-200
                  ${!isBackendReady
                    ? "cursor-not-allowed bg-gray-400 text-gray-700"
                    : "bg-cyan-600 text-white hover:bg-cyan-700 hover:shadow-lg"
                  }`}
              >
                {!isBackendReady ? (
                  backendStatus === "down" ? (
                    "Playground Unavailable"
                  ) : (
                    <>
                      <span>Backend Warming Up</span>
                      <span className="text-sm font-normal opacity-80">(please wait)</span>
                    </>
                  )
                ) : (
                  "Get Started"
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}