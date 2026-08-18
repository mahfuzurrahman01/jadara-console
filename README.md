# Jadara

Jadara (جدارة, "merit") is a multi-tenant SaaS where a business connects WhatsApp, defines an AI
agent persona and qualification rules, and lets the agent run customer conversations end to end:
it extracts structured data, qualifies each lead deterministically, and on qualification calls the
business's own API and notifies the owner.

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack) + Tailwind 4
- Supabase (Postgres + RLS), service-role access from the server only
- Gemini (via `@google/genai`) behind an `LLMProvider` interface
- WhatsApp via a self-hosted OpenWA gateway behind a `ChannelProvider` interface

## Flow

1. Inbound WhatsApp message hits the HMAC-verified webhook and is persisted (contact,
   conversation, message), scoped by tenant.
2. The agent extracts field values, merges them into `collected_data`, and asks for the next
   missing required field.
3. A deterministic engine evaluates the tenant's qualification rules.
4. On the first transition to qualified, the integration executor maps the data to the tenant's
   API payload (SSRF-guarded, encrypted bearer secret, timeout, response cap), records the run,
   and notifies the owner. Idempotent, so it never double-creates.

## Local setup

1. `pnpm install`
2. Copy `.env.example` to `.env.local` and fill it in.
3. Apply the schema: `pnpm db:apply`
4. `pnpm dev`

See `AGENTS.md` for Next 16 conventions and `claude-code-mvp-prompt.md` for the original brief.
