import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth/dal";
import { FadeIn } from "@/components/motion/stagger";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "01",
    title: "Connect WhatsApp",
    body: "Link your business number in a minute. Every incoming message lands in Jadara.",
  },
  {
    n: "02",
    title: "Set your agent and rules",
    body: "Describe your agent, the fields it should collect, and the rules that decide a qualified lead.",
  },
  {
    n: "03",
    title: "Qualify and hand off",
    body: "The agent chats, qualifies against your rules, sends ready leads to your CRM, and opens a ticket when a customer wants a person.",
  },
];

const FEATURES = [
  { title: "AI conversations", body: "A natural WhatsApp agent that asks one thing at a time and never dumps a form." },
  { title: "Deterministic qualification", body: "Your rules decide, not the model. Every decision is auditable, condition by condition." },
  { title: "Secure integrations", body: "Send qualified leads to your own API. Credentials are encrypted; private targets are refused." },
  { title: "Human handoff", body: "When a customer asks for a person, the agent pauses and opens a ticket for your team." },
  { title: "Multi-tenant", body: "Every business gets its own isolated workspace, agent, rules, and data." },
  { title: "Premium dashboard", body: "Conversations, qualified leads, and tickets in one calm, fast console." },
];

export default async function LandingPage() {
  const tenant = await getCurrentTenant();
  if (tenant) redirect("/dashboard");

  return (
    <div className="relative z-10">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-lg font-semibold tracking-tight">Jadara</span>
          <span className="hidden text-xs text-muted sm:inline">جدارة</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-sm transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pt-20">
        <FadeIn className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            WhatsApp lead qualification
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Qualify every WhatsApp lead, automatically.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Jadara connects your WhatsApp, runs each customer conversation with an AI agent,
            qualifies them against your own rules, and sends the ready ones straight to your CRM.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-foreground px-6 text-sm font-medium text-background shadow-sm transition-opacity hover:opacity-90"
            >
              Create your workspace
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-6 text-sm font-medium transition-colors hover:bg-surface-hover"
            >
              Sign in
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* Steps */}
      <section className="border-t border-border bg-surface/30">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight">How it works</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border border-border bg-background p-6">
                <span className="tnum font-display text-sm font-semibold text-muted">{s.n}</span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Built for real intake</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-surface/40 p-6">
              <h3 className="text-base font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-border bg-foreground px-8 py-12 text-background sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Start qualifying leads today.
            </h2>
            <p className="mt-2 max-w-md text-sm text-background/70">
              Set up your agent, connect WhatsApp, and let Jadara do the intake.
            </p>
          </div>
          <Link
            href="/register"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-background px-6 text-sm font-medium text-foreground transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-xs text-muted sm:flex-row">
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">Jadara</span>
          <span>Qualify every WhatsApp lead, automatically.</span>
        </div>
      </footer>
    </div>
  );
}
