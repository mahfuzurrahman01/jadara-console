# Build Prompt: WhatsApp AI Agent SaaS (MVP / Demo)

Paste this whole file into Claude Code in your terminal as the initial brief.

---

## Role and working style

You are building the MVP of a multi-tenant WhatsApp AI agent platform. Work **one slice at a time**. After each slice, stop, tell me exactly what you changed and how to test it, and wait for me to say "continue" before starting the next slice. Make sensible technical and product decisions yourself rather than asking me to decide small things, but flag anything that changes the architecture. Keep the code clean and typed. Do not use em dashes in any user-facing copy or comments.

## What we are building (the point of the product)

A business connects their WhatsApp, sets a persona plus qualification rules, and wires up their own API. Their customers chat on WhatsApp, an AI runs the conversation, quietly extracts structured answers, a deterministic rules engine decides if the person qualifies, and when they do the system calls the business's API to create a record and notifies the owner.

Demo tenant we will use to prove it: **Amanah Foundation**, a charity that gives monthly food support. A family qualifies if monthly income is under 15000 BDT, they have at least one child under 18, they live in a target district, and they have a national ID. When qualified, the system calls a "create beneficiary" API and flags the lead.

The schema and code must support many tenants even though we seed only one for the demo.

## Tech stack (locked)

- Next.js (App Router, TypeScript) for the dashboard, the webhook receiver, and the agent logic.
- UI built with **shadcn/ui** on Tailwind, animated with **Framer Motion**. Follow the design system section below exactly. This is not optional polish, the dashboard should look premium out of the gate.
- Supabase (Postgres) with Row Level Security for tenant isolation. Use the Supabase JS client and SQL migrations.
- Gemini as the LLM, accessed through a small `LLMProvider` interface so it can be swapped later. Use the current Google Generative AI SDK and the current Flash tier model for chat and extraction. Verify the current SDK package name and model id before coding, do not assume.
- WhatsApp through **OpenWA** (self-hosted, see below), accessed through a `ChannelProvider` interface with an `OpenWAProvider` implementation. This abstraction is required from the start so we can add an official Cloud API provider later without touching agent code.
- Resend for the "lead qualified" email is optional. If no API key is set, log the notification instead.
- Upstash / queues are NOT needed for the MVP. Process the message in the webhook handler: return 200 fast, then do the agent work and send the reply. Keep the processing function isolated so a queue can wrap it later.

## The WhatsApp layer: OpenWA

OpenWA is a self-hosted WhatsApp API gateway. It is unofficial (it drives whatsapp-web.js / baileys), so we will only ever connect a **dedicated throwaway number** for the demo, never a real business or personal number, and the demo is reply-driven (the customer always messages first).

Run it with Docker:

```
git clone https://github.com/rmyndharis/OpenWA.git
cd OpenWA
docker compose -f docker-compose.dev.yml up -d
# Dashboard: http://localhost:2785
# API:       http://localhost:2785/api
# Swagger:   http://localhost:2785/api/docs
```

REST API (auth via `X-API-Key` header):

- Create session: `POST /api/sessions` body `{ "name": "amanah-demo" }`
- Start session: `POST /api/sessions/{sessionId}/start`
- Get QR to link the number: `GET /api/sessions/{sessionId}/qr`
- Send text: `POST /api/sessions/{sessionId}/messages/send-text` body `{ "chatId": "...@c.us", "text": "..." }`
- Register webhook: `POST /api/sessions/{sessionId}/webhooks` body `{ "url": "<our endpoint>", "events": ["message.received", "session.status"], "secret": "<hmac secret>" }`

Important: before implementing webhook verification, read OpenWA's own docs for the exact HMAC header name and signing scheme, and the exact inbound `message.received` payload shape. Fetch and read:
- https://github.com/rmyndharis/OpenWA/blob/main/docs/06-api-specification.md
- https://github.com/rmyndharis/OpenWA/blob/main/docs/04-security-design.md
- the Swagger at http://localhost:2785/api/docs once it is running

Do not guess the payload or signature format. When replying, reuse the sender chat id from the inbound payload rather than constructing it. We use OpenWA's REST plus webhooks, not its MCP server.

## Architecture / flow

1. Customer sends a WhatsApp message to the linked number.
2. OpenWA fires a `message.received` webhook to our Next.js endpoint.
3. We verify the HMAC signature, return 200, then process.
4. Resolve `sessionId` to a tenant and agent. Find or create the contact and the conversation. Persist the inbound message.
5. Run the agent: build a Gemini call from the agent's system prompt plus conversation history. Do an extraction pass (structured JSON) to fill `collected_data` against the agent's field schema. Generate a natural reply that asks for the next missing field or closes the conversation.
6. Run the deterministic qualification engine over `collected_data`.
7. If qualified and not already actioned, call the tenant's integration API (the mock CRM) with mapped fields, store the integration run, set the qualified flag, and fire the notification.
8. Send the reply through the `ChannelProvider` (OpenWA). Persist the outbound message and update conversation state.

## Data model (Postgres, RLS on every table, all scoped by tenant_id)

- `tenants` (id, name, status)
- `agents` (id, tenant_id, name, vertical, system_prompt, model, active)
- `field_defs` (id, agent_id, key, label, type, required, question_hint)
- `qualification_rules` (id, agent_id, logic, conditions jsonb, on_qualified jsonb)
- `integrations` (id, agent_id, name, description, method, url, auth_type, auth_secret_ref, input_schema jsonb, field_mapping jsonb, enabled)
- `secrets` (id, tenant_id, key, ciphertext, iv) with app level encryption, no plaintext keys in normal rows
- `channel_connections` (id, tenant_id, agent_id, provider, external_session_id, status)
- `contacts` (id, tenant_id, wa_id, name, attributes jsonb)
- `conversations` (id, tenant_id, agent_id, contact_id, status, created_at)
- `messages` (id, conversation_id, direction, type, content, external_message_id, created_at)
- `conversation_state` (conversation_id, collected_data jsonb, current_step, qualification_status)
- `integration_runs` (id, conversation_id, integration_id, request jsonb, response jsonb, status, created_at)
- `qualification_results` (id, conversation_id, status, matched_rules jsonb, created_at)

Seed one tenant (Amanah Foundation) with one agent, its `field_defs` (income, children_under_18, district, has_national_id), its `qualification_rules`, and one `integration` named `create_beneficiary` that points at the mock CRM (below).

## Mock tenant API (so the tool call does something visible)

Build a tiny mock "beneficiary CRM" as its own route in the app, for example `POST /api/mock-crm/beneficiaries`, protected by a static bearer token. It stores the record in a `mock_beneficiaries` table and returns 201 with an id. This stands in for the customer's real external system, so the integration executor has a real endpoint to call end to end.

## Design system (UI direction)

The whole dashboard uses **shadcn/ui** components on Tailwind, with **Framer Motion** for motion. The aesthetic is minimal, monochrome, and premium. Think a high-end black-and-white SaaS, restraint over decoration, lots of breathing room. Do not add color accents, gradients, or playful elements. The confidence comes from typography, spacing, and motion, not from color.

**Palette (black and white only).** Near-black ink on an off-white paper, with a small gray scale for borders, muted text, and hover states. No brand color. The only "accent" is inversion: a solid black button on white, or a white element on a black surface. Support a dark mode that is the clean inverse (near-black surface, off-white text). Use CSS variables through the shadcn theme tokens so light and dark both come from one set.

Suggested tokens (tune to taste): background `#FAFAFA`, foreground `#0A0A0A`, muted text `#6B7280`, border `#E5E5E5`, subtle surface `#F4F4F5`. Dark mode inverts these.

**Font.** Do not use Inter or the default system stack, they read as generic. Use a distinctive but highly readable family. Primary pick: **Bricolage Grotesque** for headings (it has real character and still reads clean) paired with a neutral, legible body such as **Geist Sans** or **Inter Tight**. If you prefer a single-family system, **General Sans** or **Satoshi** (Fontshare) both work and feel premium. Load fonts with `next/font` (Google fonts) or self-host the Fontshare files. Use **tabular figures** for any numbers or metrics. Set tight, deliberate heading tracking and comfortable body line height.

**Premium touches (add these, they are the point).**
- Generous whitespace and a clear type scale. Large, confident section headings, quiet supporting text.
- Hairline 1px borders instead of heavy shadows. Where a shadow is used, keep it soft and low.
- Consistent rounded corners on one scale (for example `rounded-xl` for cards, `rounded-lg` for inputs and buttons).
- Framer Motion micro-interactions: subtle scale and easing on button and card hover, smooth focus rings, no bouncy or gimmicky easing. Use a calm easing curve and short durations (150 to 250ms).
- Page and list entrance animations: fade with a small upward translate, staggered for lists and cards so a conversation list settles in gracefully.
- A very subtle grain or noise overlay on large surfaces at low opacity, for a tactile premium feel. Keep it barely perceptible.
- Skeleton loaders for data views, and smooth transitions between conversation states (for example when a lead flips to qualified, animate the status badge).
- Clean empty states with a short line of copy, never a blank screen.
- Fully keyboard accessible with visible focus states. Respect `prefers-reduced-motion` and drop the animations when it is set.

Keep the copy plain and human. No em dashes anywhere in the interface.

## Build slices

Do these in order. Each slice ends with a stop and a "how to test".

**Slice 1: Project and schema.** Scaffold the Next.js TypeScript app. Add Supabase migrations for every table above plus RLS policies. Add the seed for Amanah. Add the mock CRM table and route.
Done when: migrations apply, seed rows exist, mock CRM route returns 201 for a test call.

**Slice 2: OpenWA up and linked.** Get OpenWA running in Docker. Write a small setup script or dashboard action that creates a session, shows the QR, and registers our webhook. Link a throwaway number.
Done when: I scan the QR, the number links, and a WhatsApp message sent to it produces a log line in our app from the webhook.

**Slice 3: Ingress.** Implement the webhook endpoint with HMAC verification (using the real OpenWA scheme from their docs). Resolve session to tenant and agent, find or create contact and conversation, persist the inbound message. Return 200 quickly.
Done when: inbound messages are stored and tied to a conversation, bad signatures are rejected.

**Slice 4: Channel abstraction and first AI reply.** Add the `ChannelProvider` interface and `OpenWAProvider`. Add the `LLMProvider` interface and `GeminiProvider`. Send a basic AI reply back over WhatsApp (no qualification logic yet).
Done when: I message the number and get a coherent AI reply on WhatsApp.

**Slice 5: Extraction.** After each message, run a Gemini structured-output pass that fills `collected_data` against the agent's `field_defs`. Have the reply ask for the next missing required field.
Done when: over a short chat, `collected_data` fills correctly and the bot asks only for what is still missing.

**Slice 6: Qualification engine.** Implement a deterministic evaluator for `qualification_rules` (operators like >=, <, ==, plus AND/OR). Write the result and matched rules to `qualification_results` and update `conversation_state.qualification_status`.
Done when: given complete data, status flips to qualified or not_qualified correctly, and it is auditable.

**Slice 7: Integration executor and notify.** On first transition to qualified, map `collected_data` to the integration payload via `field_mapping`, inject auth from `secrets`, call the mock CRM, store the `integration_run`. Guard with a timeout, argument validation against `input_schema`, and block private IP targets. Then fire the notification (Resend if configured, else log) and set the qualified flag. Make it idempotent so it never double-creates.
Done when: a qualifying conversation creates exactly one mock beneficiary record and one lead notification.

**Slice 8: Dashboard.** Build the internal dashboard: a conversations list, a conversation detail view (transcript, collected fields, qualification status), and a qualified-leads view. Apply the design system section in full here: shadcn/ui components, the black-and-white premium look, the chosen font, and the Framer Motion touches (staggered list entrance, hover micro-interactions, animated status badge, skeleton loaders, dark mode). It should look like a premium product, not a scaffold.
Done when: I can watch a live conversation and see the qualified lead appear, and the UI looks polished in both light and dark mode.

## Guardrails

- Keep OpenWA strictly behind `ChannelProvider`. No OpenWA specifics leak into agent, extraction, qualification, or integration code.
- Never put secrets or PII into prompts or logs. Encrypt integration credentials at rest.
- Integration executor must validate arguments, enforce a timeout, cap response size, and refuse requests to private or link-local IP ranges.
- The demo is reply-driven only. Do not build any outbound or bulk sending.
- All env config through `.env`. Provide a `.env.example`.

## Environment variables (fill in .env.example)

```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Gemini
GEMINI_API_KEY=

# OpenWA
OPENWA_BASE_URL=http://localhost:2785/api
OPENWA_API_KEY=
OPENWA_WEBHOOK_SECRET=
OPENWA_SESSION_ID=

# App
APP_PUBLIC_URL=   # public URL OpenWA can reach for the webhook (use a tunnel in dev)
SECRETS_ENCRYPTION_KEY=

# Mock CRM
MOCK_CRM_TOKEN=

# Optional
RESEND_API_KEY=
```

Note for dev: OpenWA needs a reachable URL for the webhook, so run a tunnel (for example cloudflared or ngrok) and set `APP_PUBLIC_URL` to the tunnel URL.

## Acceptance scenario (the whole thing working)

Simulate this from the throwaway number by messaging the linked WhatsApp:

```
User: Assalamu alaikum, can I get support?
Bot:  greets, asks to run a few quick questions
User: 3 kids, ages 5, 9 and 14
User: income around 9000 taka
User: I live in Cumilla
User: yes I have a national ID
Bot:  confirms they qualify and that the team will contact them
```

Expected system result: `collected_data` is fully populated, `qualification_status` is qualified, exactly one row in `mock_beneficiaries`, one lead notification, and the conversation plus lead are visible in the dashboard. Run the same flow with income 40000 and confirm it ends as not_qualified with no beneficiary created.

Start with Slice 1.
