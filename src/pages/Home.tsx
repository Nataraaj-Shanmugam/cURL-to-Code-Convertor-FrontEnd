import { useState, useEffect } from "react";
import {
  Code2,
  Edit3,
  FileJson,
  Zap,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  GitBranch,
  Download,
  Eye,
  Settings,
  Copy,
} from "lucide-react";
import { useNavigate } from 'react-router-dom';


export default function Home() {
  const navigate = useNavigate();

  const [_isBackendReady, setIsBackendReady] = useState(false);

  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_CURL_CRAFT_API_URL}`, {
          method: 'GET',
        });
        if (response.ok) {
          setIsBackendReady(true);
        }
      } catch (error) {
        console.log('Backend is warming up...');
        // Optionally retry after a delay
      }
    };

    checkBackendHealth();
  }, []);
  const [showLogo, setShowLogo] = useState(true);

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
    "Light & dark theme support",
    "Export to JSON for backup"
  ];

  const handleGetStarted = () => {
    navigate('/playground');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
          {/* Logo */}
          {showLogo && (
            <div className="relative animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="relative w-24 h-24 mb-4">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
                <div className="relative w-24 h-24 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-2xl">
                  <Code2 className="w-12 h-12 text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>
          )}

          {!showLogo && (
            <button
              onClick={() => setShowLogo(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors animate-in fade-in duration-300"
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

            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl">
              Transform cURL commands into production-ready REST Assured tests with an intelligent visual editor
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 text-lg py-6 group"
            >
              Get Started
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 px-8 text-lg py-6">
              <GitBranch className="mr-2 w-5 h-5" />
              View Documentation
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Powerful Features
          </h2>
          <p className="text-muted-foreground text-lg">
            Everything you need to convert cURL to REST Assured
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="animate-in fade-in slide-in-from-bottom-4 duration-700"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="h-full rounded-lg border-2 bg-card text-card-foreground shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="p-6">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-muted/30 rounded-3xl p-8 md:p-12">
          <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground text-lg">
              Four simple steps to generate your test code
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={index}
                  className="relative animate-in fade-in slide-in-from-bottom-4 duration-700"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="h-full text-center rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-6">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Icon className="w-8 h-8 text-primary" />
                      </div>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <h3 className="font-semibold mb-2">{step.text}</h3>
                      <p className="text-sm text-muted-foreground">{step.detail}</p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-border z-10"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-8 h-8 text-yellow-500" />
                <h2 className="text-2xl md:text-3xl font-bold">
                  What You Can Do
                </h2>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {capabilities.map((capability, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 animate-in fade-in slide-in-from-left-4 duration-500"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm md:text-base">{capability}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 pb-24">
        <div className="max-w-3xl mx-auto animate-in fade-in zoom-in duration-700">
          <div className="rounded-lg border-2 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 text-card-foreground shadow-sm">
            <div className="p-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Transform Your Testing Workflow?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Start converting your cURL commands to REST Assured tests in seconds
              </p>
              <button
                onClick={handleGetStarted}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-10 text-lg py-6 group"
              >
                Open Playground
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}