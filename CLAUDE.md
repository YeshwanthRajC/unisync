@AGENTS.md

# UniSync — Engineering Guide

> Living technical documentation and project memory.
> Update this file **in the same change** as any meaningful architectural or
> implementation decision. A decision that is not written down here has not
> been made.

**Last updated:** 2026-09-23 — domain schema applied (20 tables), manual-gate
CHECK constraints and RLS lockdown verified at the database, development seed
written.

---

## Project Overview

UniSync is a multi-tenant SaaS web application that gives a small organization
one place to run its administrative operations: customers/patients,
appointments, billing, reminders and follow-ups, and inventory.

The problem it solves: small organizations run their back office across a
patchwork of paper, spreadsheets, a phone, and a calendar. Information is
duplicated, follow-ups get missed, and one or two people absorb the
coordination cost. Consolidating these operations removes the duplication; an
AI administrative agent on top of the consolidated data removes much of the
remaining manual effort.

## Product Vision

Reduce administrative workload for small organizations through a single
centralized platform plus an AI administrative agent that acts on the user's
behalf.

The agent is a first-class part of the product, not a bolt-on chat box. The
target experience is that an administrator can say what they want in plain
language — "book Mr. Rao for a cleaning next Tuesday afternoon and remind him
the day before" — and the agent carries it out through the same controlled
application services a human user would drive, with the same permission checks
and the same audit trail.

## Current Target Organization

The first implementation is modeled around a **dental clinic**: patients,
appointments with chairs/practitioners, treatment billing, recall reminders,
and consumable inventory.

Dental clinic is a *starting shape*, not a hard-coded assumption.
`Organization.type` is an enum (`DENTAL_CLINIC`, `OTHER`) from day one so other
verticals can be added without reshaping the tenancy layer. Vertical-specific
concepts belong behind that type, never assumed globally.

---

## Core Modules

Status legend: **Not started** · **Scaffolded** · **In progress** · **Done**

### 1. Patients

- **Purpose** — System of record for the people the organization serves.
- **Main entities** *(planned)* — `Patient`, `PatientContact`,
  `MedicalHistoryEntry`, `PatientDocument` (Supabase Storage).
- **Important workflows** *(planned)* — register a patient; search and
  deduplicate; maintain contact and medical history; attach documents (x-rays,
  consent forms); merge duplicate records.
- **Current status** — **Not started.**
- **Future** — patient-facing portal, consent capture, document OCR.

### 2. Appointments

- **Purpose** — Scheduling of patient visits against finite resources
  (practitioners, chairs, rooms).
- **Main entities** *(planned)* — `Appointment`, `Practitioner`, `Resource`,
  `AvailabilityRule`.
- **Important workflows** *(planned)* — find available slots; book;
  reschedule; cancel; no-show handling; day and week calendar views.
- **Current status** — **Not started.**
- **Future** — online self-booking, waitlist auto-fill on cancellation.

### 3. Billing & Payments

- **Purpose** — Turn delivered treatment into invoices and track payment.
- **Main entities** *(planned)* — `Invoice`, `InvoiceLine`, `Payment`,
  `ServiceCatalogItem`, `TaxRate`.
- **Important workflows** *(planned)* — generate an invoice from an
  appointment; record part payments; outstanding-balance reporting; refunds.
- **Current status** — **Not started.**
- **Future** — payment-gateway integration, insurance claims.

### 4. Reminders & Follow-ups

- **Purpose** — Make sure nothing that needs a nudge is forgotten.
- **Main entities** *(planned)* — `ReminderRule`, `ScheduledReminder`,
  `NotificationLog`.
- **Important workflows** *(planned)* — appointment reminders; recall
  follow-ups; overdue-payment nudges; delivery logging.
- **Current status** — **Not started.**
- **Future** — WhatsApp / SMS / email channels, per-organization quiet hours.

### 5. Inventory Management

- **Purpose** — Track consumables and materials so the clinic does not run out.
- **Main entities** *(planned)* — `InventoryItem`, `StockBatch`,
  `StockMovement`, `Supplier`, `PurchaseOrder`.
- **Important workflows** *(planned)* — stock in and out; low-stock alerts;
  expiry tracking; reorder.
- **Current status** — **Not started.**
- **Future** — supplier catalogues, automatic reorder suggestions.

### 6. AI Agent

- **Purpose** — Administrative assistant with organization context, operating
  through controlled tools. See [AI Agent Architecture](#ai-agent-architecture).
- **Main entities** — `AuditLog` (implemented); `AiConversation`,
  `AiMessage` *(planned)*.
- **Current status** — **Scaffolded.** The provider abstraction
  (`LlmProvider`), the Gemini implementation, and the tool contract exist.
  **Zero tools are registered**, and there is no agent loop or UI yet.
- **Future** — streaming responses, multi-step tool execution with
  confirmation, conversation history, per-organization instructions.

---

## Technology Stack

| Area | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router, Turbopack) | One deployable unit for UI and server logic. Server Components keep data access on the server by default, which suits a permission-sensitive app. |
| UI | **React 19**, **TypeScript 5** | Team standard; strict typing is a stated project principle. |
| Styling | **Tailwind CSS v4** | Utility-first, no separate config file in v4, no runtime cost. |
| Components | **shadcn/ui** (`radix-nova` preset, Radix primitives, Lucide icons) | Source is copied into `components/ui/`, so components are ours to modify. Radix gives accessible behaviour without a heavyweight design system. **Chakra UI is explicitly not used.** |
| Database | **PostgreSQL** via **Supabase** | Relational data with real constraints and transactions; a clinic's data is highly relational. Supabase provides managed Postgres, auth, and storage from one vendor. |
| ORM | **Prisma 7** | Typed schema as the single source of truth; the generated client removes a whole class of query bug; first-class migrations. |
| Auth | **Supabase Auth** (`@supabase/ssr`) | Same vendor as the database; cookie-based SSR sessions integrate cleanly with Server Components. |
| Storage | **Supabase Storage** | Same vendor, same auth tokens, RLS-aware buckets. |
| AI | **Google Gemini** (`@google/genai`) behind an `LlmProvider` interface | Native function calling. The interface means swapping providers is a change in `lib/ai/` only. |
| Validation | **Zod 4** | One schema mechanism for environment variables, form input, and AI tool arguments. |
| Hosting | **Vercel** (app) + **Supabase** (data) | Zero-config Next.js deploys; managed Postgres. |

| Testing | **Vitest** | Server-logic tests only — the permission matrix, tenant isolation, AI tool validation and the manual gates. Runs against the real development database. |

Deliberately **not** added: no separate Express backend, no state-management
library, no component library beyond shadcn/ui, no browser E2E framework.

---

## Architecture

```text
Browser (React Server + Client Components)
    │
    ▼
Next.js (App Router)
    │  proxy.ts .................. refreshes the Supabase session per request
    │  Server Components ......... read data directly, server-side
    │  Server Actions ............ mutations from forms
    │  Route Handlers ............ /api/* for webhooks and the AI endpoint
    ▼
Transport wrappers  (lib/server/)
    │  action.ts .................. Server Actions: parse, permit, audit, mint
    │                               HumanIntent; returns ActionResult<T>
    │  route.ts ................... Route Handlers: error -> HTTP status
    │  guard.ts ................... RSC reads: redirect on 401/403
    ▼
Auth & tenancy  (lib/auth/)
    │  session.ts ................. WHO is calling, in WHICH organization
    │  permissions.ts ............. MAY they do this
    │  human-intent.ts ............ did a PERSON ask for this
    ▼
Business services  (services/<module>/)
    │  schema.ts  zod input      rules.ts  pure logic
    │  queries.ts reads          commands.ts writes (require a UnitOfWork)
    ▼
Command envelope  (lib/server/unit.ts)
    │  runCommand() ............... one transaction, one AuditLog row
    ▼
AI Agent  (lib/ai/)  — sits BESIDE the UI, never beneath it
    │  provider.ts ............... resolves the active LlmProvider
    │  gemini.ts ................. the only file importing the Gemini SDK
    │  tools/define.ts ........... defineTool(): parse, erase, invoke
    │  tools/index.ts ............ the registry + its build-time assertions
    │  agent/schema.ts ........... zod -> model-facing declaration
    ▼
Application tools  (validated, permission-checked, audited)
    │  they call the SAME services the UI calls, via runCommand
    ▼
Database  (lib/db/)
    │  prisma.ts ................. the only PrismaClient; lazy, tripwire-extended
    │  scope.ts .................. orgScope() / orgWhere()
    │  tenant-guard.ts ........... throws on an unscoped tenant query
    ▼
PostgreSQL (Supabase)
```

The essential property: **the AI agent sits at the same level as a human
user.** It calls the same application tools, through the same permission
checks, and its actions land in the same audit log. It has no privileged path
to the database.

**Authentication** — Supabase Auth owns credentials and sessions. `proxy.ts`
refreshes the token on each request; `lib/auth/session.ts` verifies it with
`getUser()`, never `getSession()` (which only decodes the cookie without
verifying it).

**Authorization** — enforced server-side only, at the point data is read or
written. Route-level gating is deliberately *not* the security boundary, so a
missing matcher entry can never become a hole.

**Storage** — Supabase Storage, buckets scoped per organization. Not yet
configured.

**Notifications** — no provider integrated. `NotificationLog` is planned so
delivery is auditable from the start.

**External integrations** — none yet.

---

## Database Design

Schema: `prisma/schema.prisma`. Generated client: `lib/db/generated/`
(gitignored; produced by `npm run db:generate`).

### Implemented — tenancy foundation only

| Model | Purpose |
| --- | --- |
| `Organization` | The tenant. `id`, `name`, `slug` (unique), `type`, `timezone`. Every business record will hang off this. |
| `Profile` | Application-side mirror of a Supabase Auth user, keyed by the same UUID (`auth.users.id`). Holds email, name, avatar. **Never stores passwords.** |
| `Membership` | Join between `Profile` and `Organization`, carrying `role` and `status`. Unique on `(organizationId, profileId)`. A user may belong to several organizations. |
| `AuditLog` | Append-only record of meaningful actions, including every AI tool call — `actorType`, `actorProfileId`, `action`, `entityType`, `entityId`, `metadata`, `aiToolName`. |

Enums: `OrganizationType`, `MembershipRole`, `MembershipStatus`, `ActorType`.

```text
Organization 1──* Membership *──1 Profile
Organization 1──* AuditLog   *──? Profile   (actor; null when actorType = SYSTEM)
```

### Implemented — domain modules

| Group | Models |
| --- | --- |
| Patients | `Patient` |
| Appointments | `Appointment` |
| Clinical | `Consultation`, `Prescription`, `PrescriptionItem` |
| Billing | `Bill`, `BillItem`, `Payment` |
| Inventory | `InventoryItem`, `StockMovement` |
| Follow-ups | `FollowUp` |
| Patient mail | `PatientEmail` |
| Internal | `Notification` |
| AI | `AIConversation`, `AIMessage`, `AIToolExecution` |

**No practitioner or doctor entity exists.** The product is built for a single
administrator who maintains all records; appointments and consultations store no
staff reference. Adding staff identities would mean modelling availability, which
is a different product.

Two things are deliberately NOT stored:

- **How much a bill has been paid.** Derived at read time from `CONFIRMED`
  payments, so it cannot drift from the ledger — and, more importantly, nothing
  can mark a bill paid as a side effect of inserting a payment row. `BillStatus`
  covers only the document's lifecycle (`DRAFT`, `ISSUED`, `VOID`).
- **Any practitioner name.** See above.

One thing is deliberately cached: `InventoryItem.quantityOnHand`, updated only
inside the same transaction as the `StockMovement` that changed it. The ledger
remains the source of truth and records `balanceAfter`, so history is readable
without replaying it.

### Conventions

- UUID primary keys (`@db.Uuid`) — avoids leaking row counts and makes
  cross-environment data movement safe.
- `snake_case` table names via `@@map`; `camelCase` in TypeScript.
- **Every tenant-scoped table carries `organizationId`** and is indexed on it.
- `organizationId` always comes from the server-resolved session context, never
  from request input.

### Migrations

Three migrations applied, all on Supabase Postgres 17.6:

1. `20260923022206_init_tenancy_foundation` — the four tenancy tables.
2. `20260923173935_domain_modules` — 16 domain tables, 12 enums, plus the
   hand-written `CHECK` constraints below.
3. `20260923174045_rls_lockdown` — RLS.

`prisma migrate dev` cannot run here (it is interactive and this environment is
not), so migrations are generated with
`prisma migrate diff --from-config-datasource --to-schema` and applied with
`prisma migrate deploy`. The generated SQL is edited by hand before applying
where Prisma cannot express the constraint.

**The existing migration is never edited and the database is never reset.**

#### CHECK constraints — the manual gates, at the database

Prisma cannot express `CHECK`, so these are hand-written in
`20260923173935_domain_modules`:

```sql
("status" = 'COMPLETED') = ("closedAt" IS NOT NULL AND "closedByProfileId" IS NOT NULL)
("status" = 'CONFIRMED') = ("confirmedAt" IS NOT NULL AND "confirmedByProfileId" IS NOT NULL)
("status" = 'SENT')      = ("sentAt" IS NOT NULL AND "sentByProfileId" IS NOT NULL)
```

Written as equivalences rather than implications, so the reverse also holds: a
closer cannot be recorded without the status that justifies it, which stops a
half-applied write leaving a misleading row.

All three were verified by attempting the bad insert over a raw connection — each
was refused by name. Plus: stock movement quantity > 0, payment amount > 0,
appointment duration > 0, bill totals non-negative.

---

## AI Agent Architecture

**Provider** — Google Gemini via `@google/genai`, behind the `LlmProvider`
interface in `lib/ai/types.ts`. `lib/ai/gemini.ts` is the *only* file that
imports the SDK. `lib/ai/provider.ts` resolves the active provider.

**Responsibilities** — understand a request in the context of the current
organization; choose the right tool; ask for missing details; request
confirmation for high-impact actions; report what it did.

**Available tools** — **none registered yet.** `AI_TOOL_REGISTRY` in
`lib/ai/tools/index.ts` is intentionally empty. Each module contributes its tools
when its service layer exists, so a tool can never reference a service that has
not been written.

All tools live in `lib/ai/tools/<module>.tools.ts`, NOT beside their service. The
answer to "what can the agent do in this system?" must be a directory listing
rather than a repo-wide grep, because that listing is the artefact a security
review of this design needs.

**Tool contract** — every tool declares:

| Field | Meaning |
| --- | --- |
| `definition` | Name, description, and JSON-Schema-style parameters. **This is all the model ever receives.** |
| `permission` | A `Permission` checked against the caller's role *before* execution. |
| `input` | A Zod schema. Model-produced arguments are parsed, never trusted. |
| `confirmation` | `{ required: true, describe }` for destructive or high-impact tools. |
| `audit` | The action name written to `AuditLog`. |
| `execute` | Receives the resolved `OrganizationContext`. |

**Tool input/output** — input arrives as an untrusted
`Record<string, unknown>` from the model and is parsed by the Zod schema; a
parse failure is returned *to the model* as an error rather than thrown at the
user, so the agent can correct itself. Output is a plain serializable object.

**Permission model** — `toolDefinitionsFor()` filters the registry by the
caller's permissions, so the model is only ever *shown* tools the user could
legitimately invoke. The permission is then re-checked at execution time —
filtering the list is a usability measure, not the enforcement point.

**Confirmation requirements** — a tool marked `confirmation.required` is never
executed on the model's say-so. The agent returns a confirmation request, the
user approves explicitly, and the tool runs on a second, approved invocation.
This applies to: deleting or merging records, cancelling appointments, issuing
refunds or voiding invoices, sending anything to a patient, and bulk
operations.

**How it interacts with application services** — tools call the same service
functions the UI calls. Business logic is never duplicated into a tool.

**The agent is NOT allowed to:**

- Execute arbitrary SQL, or reach `prisma` directly from a tool without going
  through a service function.
- Receive or use `SUPABASE_SERVICE_ROLE_KEY`, or any RLS-bypassing client.
- Choose its own `organizationId` — it is always injected from the session.
- Act without a user request, or on its own schedule.
- Perform a confirmation-required action without explicit user approval.
- Escalate its own permissions, or see tools the user lacks permission for.
- Have its output rendered as trusted instructions. Content retrieved from the
  database — patient notes, uploaded documents, free-text fields — is **data,
  not instructions**, and must never be treated as a command to the agent.

---

## Authentication & Authorization

**Users** — identity lives in Supabase Auth (`auth.users`). `Profile` mirrors
it by the same UUID so application tables can join against it. Credentials are
never stored in our tables.

**Organizations** — the tenant boundary. A user may belong to several.

**Roles** (`MembershipRole`) — per organization, stored on the `Membership`
row:

| Role | Intent |
| --- | --- |
| `OWNER` | Full control, including billing and ownership transfer. |
| `ADMIN` | Day-to-day administration; cannot change roles or remove members. |
| `STAFF` | Operational use. |

**Permissions** — code asks *"may this actor do X?"*, never *"is this actor an
ADMIN?"*, so adding a role later does not mean hunting down scattered role
comparisons. Current vocabulary (`lib/auth/permissions.ts`):
`organization.read`, `organization.update`, `member.read`, `member.invite`,
`member.update_role`, `member.remove`, `audit.read`, `ai.use`. Each module
extends this list.

**Tenant isolation** — three layers:

1. `requireOrganizationContext()` resolves `organizationId` from the verified
   session and the caller's memberships. A client-supplied `organizationId` is
   treated as a *request* and verified against membership before it is
   honoured.
2. Every tenant-scoped query filters on that `organizationId`.
3. Postgres Row Level Security as a backstop — *not yet written; see Known
   Issues.*

A "you do not have access" error is deliberately worded identically to a "does
not exist" error, so error responses cannot be used to probe for the existence
of other tenants.

---

## Environment Variables

Names only — **never record a value here.** See `.env.example`.

| Variable | Scope | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | public | yes | Base URL for auth redirects and callbacks. |
| `NEXT_PUBLIC_SUPABASE_URL` | public | yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | yes | Anon/publishable key (`sb_publishable_…`); constrained by RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | no | Bypasses RLS. Administrative tasks only. Never exposed to the agent. |
| `DATABASE_URL` | **secret** | yes | Pooled connection, port 6543, `?pgbouncer=true&connection_limit=1`. Runtime queries. |
| `DIRECT_URL` | **secret** | yes | Direct connection, port 5432. Migrations only. |
| `GEMINI_API_KEY` | **secret** | yes | Gemini API key. Server-side only. |
| `GEMINI_MODEL` | config | no | Default model (`gemini-3.6-flash`). |

Rules: anything named `NEXT_PUBLIC_*` is compiled into the browser bundle and
is therefore public — never give a secret such a name. Secrets live in
`.env.local` (gitignored) locally, and in Vercel's encrypted environment
variables in production. All access goes through `lib/env.ts`, which validates
lazily and refuses to evaluate server variables in a browser context.

---

## Development Commands

```bash
npm install          # install dependencies (runs prisma generate afterwards)
npm run dev          # start the dev server on http://localhost:3000
npm run build        # production build
npm start            # serve the production build
npm run lint         # ESLint
npm run lint:fix     # ESLint with autofix
npm run typecheck    # tsc --noEmit
```

Prisma:

```bash
npm run db:generate  # regenerate the client into lib/db/generated
npm run db:push      # push schema to the database without a migration (dev only)
npm run db:migrate   # create and apply a migration
npm run db:studio    # browse data
```

Tests:

```bash
npm test             # vitest run
npm run test:watch   # vitest
```

Tests run against the **real** development database in a single fork with
`fileParallelism: false`, because tenant-isolation tests assert on row counts and
parallel files would see each other's fixtures. `server-only` is aliased to a
no-op in `vitest.config.mts`: that package throws unless the resolver picks its
`react-server` condition, which Node applies only via a CLI flag.

---

## Implementation Status

- [x] **Development environment** — Next.js, strict TypeScript, Tailwind v4,
      shadcn/ui, Prisma 7, Supabase clients, Gemini abstraction, Git;
      lint, typecheck, and build all passing.
- [x] **Supabase API credentials** — project URL and publishable key set and
      verified live: GoTrue reachable, key accepted by Auth and PostgREST.
- [x] **Gemini credentials** — key set and verified live against
      `gemini-3.6-flash`, including a round-trip function call through
      `LlmProvider.generate()`.
- [x] **Database credentials** — pooled `DATABASE_URL` (Supavisor 6543) and
      `DIRECT_URL` (5432) set and verified; Postgres 17.6, region
      `ap-northeast-1`.
- [x] **First migration applied** — the four tenancy tables exist; a Prisma
      write/read/delete round trip over the pooled connection succeeds.
      `/api/health` reports `ready`.
- [x] **Domain schema** — 20 tables, 12 enums. Manual-gate `CHECK` constraints
      verified by attempting the bad insert over a raw connection; RLS enabled,
      forced and policy-free on every table, verified by confirming the
      publishable key receives `42501 permission denied`.
- [x] **Development seed** — `npm run db:seed -- you@example.com`. Attaches a
      full sample clinic to a real Supabase Auth account, refuses to run under
      `NODE_ENV=production`, and is re-runnable. Cannot be executed until
      authentication exists, since it deliberately will not fabricate a profile.
- [x] **Server foundation** — permission vocabulary (45 permissions assembled
      from grant blocks), domain errors, `ActionResult`, `runCommand` audited
      transaction envelope, tenant scoping + tripwire, `HumanIntent` gate, action
      / route / RSC guard wrappers, `defineTool` factory with Zod-derived tool
      schemas, ESLint architectural boundaries, Vitest with 45 tests.
- [ ] **Authentication** — sign-up, sign-in, sign-out, `(auth)` routes, and
      `Profile` provisioning on first login.
- [ ] **Organization setup** — create an organization, invite members, switch
      the active organization, first migration applied.
- [ ] **Patient module**
- [ ] **Appointment module**
- [ ] **Billing module**
- [ ] **Reminder system**
- [ ] **Inventory module**
- [ ] **AI agent** — conversation loop, confirmation flow, chat UI.
- [ ] **AI tools** — registry populated per module.
- [ ] **Notifications** — email / SMS / WhatsApp provider.
- [ ] **Analytics** — dashboards and reporting.
- [ ] **Testing** — framework, unit tests for permissions and tools, E2E.
- [ ] **Production deployment** — Vercel project, production Supabase, RLS
      policies, backups.

---

## Architectural Decisions

Chronological. Append; do not rewrite history.

### 2026-09-23 — Next.js as the full-stack framework, no separate backend

One deployable unit means no cross-service auth handshake and no duplicated
types. Server Components make server-side data access the default rather than
something to remember. A separate Express service would add an
authentication-propagation problem for no benefit at this size; it can be
extracted later if a genuinely separate workload appears.

### 2026-09-23 — PostgreSQL, via Supabase

Clinic data is highly relational (patient → appointment → invoice → payment)
and correctness matters more than write throughput. Postgres gives real foreign
keys, transactions, and `CHECK` constraints. Supabase adds managed hosting,
auth, and storage from a single vendor, keeping the operational surface small
for a small team.

### 2026-09-23 — Prisma as the ORM

The schema becomes the single source of truth, and the generated client makes
whole categories of query bug unrepresentable. Its migration workflow gives
reviewable, version-controlled schema changes. The typed client is also what
lets AI tools stay thin wrappers over service functions instead of
hand-written SQL.

### 2026-09-23 — The AI works through tools, never direct database access

The decisive reason: **an LLM's output is a suggestion, not an
authorization.** If the model could compose SQL, then prompt-injected text in
a patient note or an uploaded document would become an execution path into the
database, and every permission check would be one clever sentence away from
being bypassed.

Routing every action through a declared tool means the attack surface is the
finite set of operations we deliberately exposed. Each tool validates its
arguments with Zod, checks a permission against the caller's real role, takes
`organizationId` from the server session rather than from the model, and writes
an audit record. The model receives only tool *declarations* — never a function
reference, a database handle, or a connection string.

### 2026-09-23 — Lazy environment validation instead of module-load parsing

Eager `env.parse()` at import time is the common pattern, but it makes
`next build` fail on any machine or CI runner without credentials — including
during this very initialization. `lib/env.ts` validates on first *use* and
memoises, so the app builds and boots, and a missing variable produces a
precise error in the one code path that actually needs it.

### 2026-09-23 — Prisma 7 driver adapter, with split pooled and direct URLs

Prisma 7 removed connection URLs from the schema and requires an explicit
driver adapter. Runtime queries use the **pooled** Supabase connection
(Supavisor, port 6543) via `PrismaPg`, because serverless functions open many
short-lived connections and would exhaust Postgres' direct connection limit.
Migrations use the **direct** connection (port 5432) configured in
`prisma.config.ts`, because the pooler cannot reliably run DDL or hold advisory
locks.

Prisma 7 also stopped loading dotenv implicitly, so `prisma.config.ts` calls
`process.loadEnvFile('.env.local')` — keeping **one** local secret file for
both the application and the CLI instead of duplicating credentials into a
second `.env`. The `datasource` block is declared conditionally so that
`prisma generate` still works before any credentials exist.

### 2026-09-23 — Lazy Prisma client construction behind a Proxy

`export const prisma = new PrismaClient()` reads `DATABASE_URL` at import time,
which broke `next build` for routes that never query the database. The client
is now constructed on first property access and cached on `globalThis` so hot
reloads do not accumulate connection pools.

### 2026-09-23 — shadcn/ui with Radix primitives, not the Base UI preset

The shadcn CLI now defaults to a Base UI preset. We chose `-b radix` because
the Radix-based components are the long-established, most heavily documented
variant, and the surrounding ecosystem assumes them. Component source lives in
`components/ui/` and is ours to edit.

### 2026-09-23 — `proxy.ts` refreshes the session but does not gate routes

Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`. Ours refreshes
the Supabase session and nothing else. Authorization lives where data is read,
so a forgotten matcher pattern cannot silently expose a route.

### 2026-09-23 — Server env validated per dependency, not as one object

`getServerEnv()` parsed every server variable through a single Zod object, so
one empty variable failed every unrelated subsystem. Concretely: with
`DATABASE_URL` blank, constructing `GeminiProvider` threw *"missing DATABASE_URL"*
and the AI agent could not be exercised at all until Postgres credentials
existed. That directly contradicted the reason this module validates lazily in
the first place.

It is now three independent, independently memoised accessors —
`getDatabaseEnv()`, `getAiEnv()`, `getServiceRoleKey()` — each validating only
its own group, and each keeping the browser guard. A missing variable now fails
exactly the one code path that needs it. `NODE_ENV` left the schema entirely; it
is supplied by the toolchain, not by us, and `lib/db/prisma.ts` reads
`process.env.NODE_ENV` directly.

### 2026-09-23 — Default Gemini model is `gemini-3.6-flash`

`gemini-2.5-flash` still appears in `ListModels` but `generateContent` returns
HTTP 404 for accounts created after its retirement: *"no longer available to
new users."* A key can therefore look valid and list the model while every
generation fails — so the model id, not just the key, has to be verified
against a real call. `gemini-3.6-flash` is Google's named successor and is
confirmed working, including function calling, which the agent design depends
on.

### 2026-09-23 — One audited transaction per command (`runCommand`)

Every write goes through `lib/server/unit.ts`. It opens the transaction, runs the
body, and writes **one** `AuditLog` row inside that same transaction before
commit.

Two properties follow, and both are the reason it exists rather than being a
convenience. Audit-once becomes a property of the transaction: there is no window
in which a patient exists and no record of who created them does. And service
authors cannot forget to audit, because it was never their job — a command body
never imports the audit module. Composed commands receive the same unit and add
detail via `note()`, so one user action yields one record rather than three.

Rejected: auto-auditing through a Prisma `$allOperations` extension. It sees
`patient.update`, not `appointment.cancel` — it cannot know intent, and it fires
once per row, so a 30-row write would produce 30 records.

Actor attribution (`USER` vs `AI_AGENT` + `aiToolName`) lives in the envelope,
i.e. in the invocation channel, not in `OrganizationContext`. That is why adding
the agent required no change to `lib/auth/session.ts`: the service is genuinely
identical whichever drove it.

### 2026-09-23 — Tenant isolation detects rather than injects

`lib/db/tenant-guard.ts` is a Prisma extension that **throws** when an operation
on a tenant-scoped model carries no `organizationId`. It never rewrites a query.

The obvious alternative — an extension that silently injects the filter — was
rejected for a decisive reason: it cannot see nested writes. A
`patient.create({ data: { appointments: { create: [...] } } })` would produce
child rows with no tenant filter, which is precisely the failure the extension
would have been bought to prevent. It also has to rewrite `findUnique` into
`findFirst` to work at all, changing return semantics, and it hides the filter
from both the reader and the type checker.

Detection keeps queries legible and return types honest, and a forgotten filter
fails loudly at the call site that forgot it. Verified empirically: Prisma 7.10
query extensions **do** propagate to the `tx` client inside `$transaction`, so the
tripwire covers writes and not merely reads (`tests/tenant-guard.test.ts`).
`findUnique` is refused outright on tenant-scoped models.

### 2026-09-23 — The manual gates are carried by the type system

Closing an appointment, confirming a payment and sending a patient email require a
`HumanIntent` — a token branded with a `unique symbol`, mintable only by
`lib/server/action.ts`, which `lib/ai/**` is forbidden by ESLint from importing.

An AI tool that tries to close an appointment therefore does not fail a runtime
check that a later refactor might remove. **It fails `tsc`.** The guarantee is
checked on every build rather than only on the paths a test happened to cover, and
`closedBy` is written from `intent.profileId` so "who and when" cannot be got
wrong by a caller.

This is one of four independent layers: database `CHECK` constraints (arriving
with the schema), this brand, the absence of any service that changes these states
as a side effect, and `HUMAN_ONLY_PERMISSIONS` + the registry assertion.

### 2026-09-23 — Server Actions return failures; `error.tsx` does not classify them

A thrown error does not survive the server/client boundary — Next.js replaces the
message with a generic one plus a digest in production. So actions return
`ActionResult<T>`, and `isAuthError` is consumed in three server-side wrappers
(`action.ts`, `route.ts`, `guard.ts`) and deliberately **not** in `error.tsx`,
where it would appear to work in `next dev` and silently stop working once
deployed. `unstable_rethrow(error)` is the first statement of every catch, or the
wrapper would swallow `redirect()`.

`experimental.authInterrupts` (`unauthorized()` / `forbidden()`) was declined; a
sign-in redirect and a `/no-access` route need no experimental flag.

### 2026-09-23 — `defineTool` erases the generic by closure; tool schemas derive from Zod

`AI_TOOL_REGISTRY` could not hold a concrete tool: `execute` is an arrow-typed
property, so `strictFunctionTypes` checks it contravariantly and
`AiTool<{id:string}>` is not assignable to `AiTool<unknown>`. The old
`describe: (input: never) => string` was storable but impossible to call.

`defineTool` fixes both by erasing the generic in a closure — `prepare()` parses
and returns an `invoke` that closes over the parsed value while `TInput` is still
in scope. No cast, no `any`, and the contravariant `execute` never appears in the
erased type.

Tool argument declarations are DERIVED from the Zod schema via `z.toJSONSchema`
(Zod 4.6.5 ships it), then narrowed — throwing on anything the neutral type cannot
express. Declaring arguments twice is not merely verbose; it drifts in the least
visible direction, telling the model a field is optional while Zod requires it, so
the agent loops on arguments that can never parse and simply appears stupid.
Unions, `.refine`, `.transform` and `z.date()` are unrepresentable by design;
constraints go in `.describe()` prose, which the registry requires on every field.

### 2026-09-23 — `AiMessage` widened to carry tool calls and results

The original `{ role: "user" | "assistant"; content: string }` could not express a
tool request or its result, which makes a multi-turn agent loop unrepresentable —
the provider rejects a transcript where those turns are missing. It is now a union
including an assistant turn with `toolCalls` and a `tool` result turn, mapped in
`gemini.ts` to Gemini's `functionCall` / `functionResponse` parts. Gemini does not
always populate a call `id`, so results are correlated by name and position.

---

## Known Issues

1. **No Supabase Auth users or `Profile` rows exist yet.** All three
   dependencies are connected and `/api/health` reports `ready`, but the
   database holds no data, so `requireOrganizationContext()` has nothing to
   resolve. The authentication module is the next step.
2. **RLS protects the browser key, not Prisma.** Every table has RLS `ENABLE`d
   and `FORCE`d with **zero policies**, and `anon`/`authenticated` have had all
   privileges revoked — verified: the publishable key gets `42501 permission
   denied` on every table. That closes the surface that is actually exposed,
   since that key ships inside the browser bundle.

   It does **not** constrain Prisma, which connects as a role with `BYPASSRLS`.
   Tenant isolation for our own code is application-layer: `OrganizationContext`,
   `orgScope`/`orgWhere`, and the tripwire that throws on an unscoped tenant
   query. Making Postgres enforce it for Prisma too would need a dedicated
   non-owning role plus `SET LOCAL app.organization_id` on every query, which
   makes every read transactional. Tracked as a hardening pass before production.
3. **`npm audit` reports 4 high-severity advisories** in `deepmerge-ts` and
   `mysql2`, both transitive dependencies of the **Prisma CLI** (dev-only).
   `mysql2` is never loaded on a PostgreSQL datasource. The only offered fix is
   a downgrade to Prisma 6, which would be a larger regression. Revisit when
   Prisma 7.x updates the dependency.
4. **Test coverage is deliberately narrow.** 50 Vitest tests cover the
   security-critical declarative logic — the permission matrix, the tenant
   tripwire, AI tool validation and the registry gates. Service behaviour and UI
   are not covered, and there is no browser E2E.
5. **`Profile` rows are not provisioned yet.** A Supabase Auth signup does not
   currently create a `Profile`, so `requireOrganizationContext()` would find
   no membership. The authentication module handles this.
6. **`/api/health` is unauthenticated.** It exposes only booleans, but it
   should be restricted before production.
7. **`runCommand` does not yet write `commandId`.** The column and its unique
   index exist, so a double-submitted action still produces two audit records
   until the wrapper threads an idempotency key through.
8. **`requireOrganizationContext()` silently picks the oldest membership.** Its
   comment claims ambiguity is an error; the code takes `memberships[0]`. Harmless
   while the product has one administrator per organization, but it needs an
   active-organization cookie before multi-org is real.
9. **Prisma 8.0 is in release candidate.** We are on stable 7.10.0
   deliberately.
10. **The `(auth)` and `(dashboard)` route groups do not exist yet.** They are
   created with the authentication module rather than as empty folders — Git
   cannot track an empty directory, and placeholder pages would be deleted at
   the next step.

---

## Future Improvements

Intentionally not implemented yet:

- **Testing** — Vitest for unit tests (the permission matrix and tool argument
  validation are the highest-value targets), Playwright for E2E.
- **Row Level Security** — per-organization policies as defence in depth.
- **Organization switching UI** — the data model supports multiple memberships;
  there is no switcher.
- **AI conversation persistence** — `AiConversation` / `AiMessage` tables.
- **Streaming AI responses** — the provider interface returns a whole result; a
  `generateStream` method would sit alongside it.
- **Background jobs** — reminders need a scheduler (Vercel Cron or Supabase
  Edge Functions).
- **Rate limiting** — on the AI endpoint especially, since tokens cost money.
- **Soft deletes** — clinical records generally should not be hard-deleted.
- **Internationalization** and per-organization timezone handling (the
  `timezone` column exists but nothing reads it yet).
- **Observability** — structured logging and error tracking.
