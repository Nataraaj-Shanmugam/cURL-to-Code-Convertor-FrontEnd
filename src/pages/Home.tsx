import { useEffect, useRef, useState } from "react";
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
  GitBranch,
  Package,
} from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { apiClient } from "@/lib/api/apiClient";
import { Button } from "@/components/ui/button";
function FadeInSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) setVisible(true); },
      { rootMargin: '-60px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(24px)',
        transition: `opacity 0.5s ${delay}s ease-out, transform 0.5s ${delay}s ease-out`,
      }}
    >
      {children}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "cURLCraft Assured — cURL to REST Assured Test Generator";
    apiClient.get("/api/health").catch(() => {});
  }, []);

  const features = [
    {
      icon: Code2,
      title: "Smart cURL Parsing",
      description: "Paste any cURL command and instantly parse it into structured, editable components with full support for headers, body, auth, and more.",
    },
    {
      icon: Edit3,
      title: "Visual Editor",
      description: "Edit every aspect of your request through an intuitive accordion-based interface. Modify headers, query params, request body, and configurations inline.",
    },
    {
      icon: Zap,
      title: "Code Generation",
      description: "Generate production-ready REST Assured test code with custom class names, assertions, logging, and automatic POJO creation from your request body.",
    },
    {
      icon: FileJson,
      title: "Advanced Body Editor",
      description: "Navigate complex nested JSON structures with expandable/collapsible views, path visualization, and inline editing for all data types.",
    },
    {
      icon: GitBranch,
      title: "POJO Generation",
      description: "Automatically create Java POJOs from your request body with Lombok annotations, ready to use in your generated test classes.",
    },
    {
      icon: Package,
      title: "Maven Dependencies",
      description: "Get a complete pom.xml with all required REST Assured, Jackson, and Lombok dependencies — copy and paste into your project.",
    },
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

  const handleGetStarted = () => navigate('/playground');

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-noise">
        <div className="absolute inset-0 bg-grid opacity-50 dark:opacity-30"></div>
        {/* Gradient mesh blob */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative container mx-auto px-4 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            {/* Left: Text */}
            <div className="space-y-6 animate-hero-left">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25">
                <Code2 className="w-7 h-7 text-primary-foreground" strokeWidth={2.5} />
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight font-mono">
                  <span className="text-foreground">cURLCraft</span>{" "}
                  <span className="text-primary">Assured</span>
                </h1>

                <p className="text-lg md:text-xl text-muted-foreground max-w-lg font-sans">
                  Transform cURL commands into production-ready REST Assured tests with an intelligent visual editor
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button onClick={handleGetStarted} size="lg" className="gap-2 text-base group">
                  Get Started
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>

            {/* Right: Terminal preview */}
            <div className="hidden md:block animate-hero-right">
              <div className="rounded-xl border border-border bg-card shadow-2xl shadow-primary/5 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b border-border">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-400/70" />
                    <span className="w-3 h-3 rounded-full bg-yellow-400/70" />
                    <span className="w-3 h-3 rounded-full bg-green-400/70" />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono ml-2">terminal</span>
                </div>
                <div className="p-5 font-mono text-sm leading-relaxed text-muted-foreground">
                  <p><span className="text-primary">$</span> curl -X POST \</p>
                  <p className="pl-4">"https://api.example.com/users" \</p>
                  <p className="pl-4">-H <span className="text-accent-foreground">"Content-Type: application/json"</span> \</p>
                  <p className="pl-4">-H <span className="text-accent-foreground">"Authorization: Bearer token"</span> \</p>
                  <p className="pl-4">-d <span className="text-accent-foreground">'{`{"name": "John"}`}'</span></p>
                  <p className="mt-3 text-xs text-muted-foreground/60">→ Generates REST Assured test code instantly</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <FadeInSection>
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Powerful Features
            </h2>
            <p className="text-muted-foreground text-lg font-sans">
              Everything you need to convert cURL to REST Assured
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group rounded-xl border bg-card p-6 hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col gap-4 animate-fade-up"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1.5 font-mono text-foreground">{feature.title}</h3>
                    <p className="text-muted-foreground text-xs font-sans leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </FadeInSection>

      {/* How It Works */}
      <FadeInSection>
      <section className="container mx-auto px-4 py-16">
        <div className="bg-muted/40 rounded-2xl p-8 md:p-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              How It Works
            </h2>
            <p className="text-muted-foreground text-lg font-sans">
              Four simple steps to generate your test code
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-0 max-w-6xl mx-auto">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative flex flex-col items-center px-4">
                  {/* Step number + icon circle */}
                  <div className="relative z-10 w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-[10px] font-mono shadow-sm">
                      {index + 1}
                    </span>
                  </div>
                  {/* Connecting line */}
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-7 left-[calc(50%+28px)] w-[calc(100%-56px)] right-0">
                      <div className="h-px bg-border w-full" />
                      <ArrowRight className="absolute -right-2 -top-1.5 w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                  {/* Text */}
                  <h3 className="font-semibold mb-1 text-sm font-mono text-center">{step.text}</h3>
                  <p className="text-xs text-muted-foreground font-sans text-center">{step.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      </FadeInSection>

      {/* Capabilities */}
      <FadeInSection>
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-6 h-6 text-primary" />
                <h2 className="text-2xl md:text-3xl font-bold">
                  What You Can Do
                </h2>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {capabilities.map((capability, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                    <span className="text-sm text-muted-foreground font-sans">{capability}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      </FadeInSection>

      {/* CTA Section */}
      <FadeInSection>
      <section className="container mx-auto px-4 py-16 pb-24">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-xl border-2 border-primary/20 bg-accent/30 text-card-foreground">
            <div className="p-10 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                Ready to Transform Your Testing Workflow?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 font-sans">
                Start converting your cURL commands to REST Assured tests in seconds
              </p>
              <Button onClick={handleGetStarted} size="lg" className="gap-2 text-base group">
                Open Playground
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </section>
      </FadeInSection>
    </div>
  );
}
