import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import {
  KeyRound,
  Activity,
  BarChart3,
  Link2,
  Upload,
  Bell,
  Github,
} from "lucide-react";

const features = [
  { icon: KeyRound, title: "Unlimited Key Storage", body: "Organize keys by provider and category. Supports 100,000+ keys with instant search." },
  { icon: Activity, title: "Auto Health Monitoring", body: "Automatic checks every 30 minutes. Detects exhausted credits and invalid keys instantly." },
  { icon: BarChart3, title: "Credit Balance Tracking", body: "See exact credit balances and usage for OpenRouter, Groq, Gemini and more in real time." },
  { icon: Link2, title: "One Endpoint For All Projects", body: "One personal API endpoint any project can call to always get your most active key at runtime." },
  { icon: Upload, title: "Bulk Import", body: "Import thousands of keys at once via CSV or plain text paste. No manual entry needed." },
  { icon: Bell, title: "Webhook Alerts", body: "Get notified instantly when a key fails or runs out of credits via webhook." },
];

const providers = ["OpenRouter", "Groq", "Gemini", "OpenAI", "Custom"];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at top, hsl(var(--primary) / 0.18), transparent 60%), linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "auto, 40px 40px, 40px 40px",
          }}
        />
        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-semibold tracking-tight">
              Adams X <span className="text-primary">API Vault</span>
            </span>
          </Link>
          <Link to="/login">
            <Button variant="outline" size="sm">Sign in</Button>
          </Link>
        </header>

        <div className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-16 text-center">
          <div className="mx-auto mb-6 flex justify-center">
            <Logo size={80} />
          </div>
          <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
            Adams X <span className="text-primary">API Vault</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Your personal API key command center — store, monitor, and serve active keys to any project, 24/7.
          </p>
          <div className="mt-8 flex justify-center">
            <Link to="/login">
              <Button size="lg" className="shadow-[0_0_40px_hsl(var(--primary)/0.35)]">
                <Github className="mr-2 h-4 w-4" />
                Get Started with GitHub
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
          Everything you need to keep your APIs alive
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-card/30 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
            Set up in minutes
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              ["Sign in with GitHub", "Connect your account in one click."],
              ["Add Your API Keys", "Paste keys manually or bulk import via CSV."],
              ["Connect Your Projects", "Use your personal endpoint to always get an active key at runtime."],
            ].map(([title, body], i) => (
              <div key={title} className="rounded-xl border border-border bg-background p-6">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary">
                  {i + 1}
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Providers */}
      <section className="mx-auto max-w-7xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Works with your favorite AI providers
        </h2>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {providers.map((p) => (
            <span
              key={p}
              className="rounded-full border border-border bg-card px-5 py-2 text-sm text-muted-foreground"
            >
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="rounded-2xl border border-primary/30 bg-card p-10 text-center shadow-[0_0_60px_hsl(var(--primary)/0.2)]">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Ready to never lose an API key again?
          </h2>
          <div className="mt-6 flex justify-center">
            <Link to="/login">
              <Button size="lg">
                <Github className="mr-2 h-4 w-4" />
                Start For Free — Sign in with GitHub
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Logo size={20} />
            <span>Adams X API Vault</span>
          </div>
          <nav className="flex items-center gap-5">
            <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
            <Link to="/integration" className="hover:text-foreground">Integration Docs</Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              GitHub
            </a>
          </nav>
          <div>Built by Adams X Project 🇳🇬</div>
        </div>
      </footer>
    </div>
  );
}
