# UniSync

A multi-tenant SaaS web app that gives a small organization one place to run
its administrative work — customers/patients, appointments, billing, reminders
and follow-ups, and inventory — with an AI assistant that can carry out those
tasks on the user's behalf.

The first version is modeled around a **dental clinic**, but the architecture
is multi-tenant and organization-type aware so other kinds of small
organization can be supported later.

> **Status: Fully Built & Tested.** All 14 foundational modules are complete,
> tested with 120 Vitest unit/integration tests across 16 test files, and building
> cleanly with Next.js 16 Turbopack across 38 App Router routes.

For the deeper engineering context — architecture, data model, AI safety
rules, and the record of why things were built this way — see
[`CLAUDE.md`](./CLAUDE.md) and [`docs/handoff.md`](./docs/handoff.md).

---

## Key Features

- **Patients & Medical Records:** Register, search by name/phone/email, edit, archive/reactivate, calculate age and initials, and manage clinical history.
- **Appointments & Timezone Calendar:** Full scheduling workflow (schedule, confirm, start, cancel, mark no-show). Includes day calendar with timezone navigation.
- **Consultations & Prescriptions:** Record clinical findings attached to appointments; issue immutable multi-item prescriptions with dosage instructions.
- **Billing & Invoicing:** Create invoices with dynamic line items and auto-calculated totals/balances. Record payments, issue refunds, and void unconfirmed bills.
- **Inventory & Stock Ledger:** Track consumable supplies with minimum reorder thresholds. All stock movements (`PURCHASE`, `USAGE`, `ADJUSTMENT`, etc.) atomically update stock levels in an immutable balance ledger.
- **Patient Mail & AI Drafting:** In-app email composer with Gemini AI draft generation tailored to patient context. Live preview and draft deletion.
- **Reminders & Follow-ups:** Schedule recall dates, complete follow-ups with notes, and run automated status materialization via timezone-aware cron (`/api/cron/followups`).
- **Ask UniSync (AI Assistant):** Slide-over assistant drawer (`⌘J` / `Ctrl+J`) powered by Google Gemini, equipped with 20 domain tools, write-confirmation flows, and full audit logging.
- **Global Command Palette (⌘K):** Instant modal search (`⌘K` / `Ctrl+K`) for rapid navigation and quick actions across the platform.
- **Activity Log & Reports:** Comprehensive audit trail of all commands with actor filtering (`USER`, `AI_AGENT`, `SYSTEM`); analytics reports covering revenue, appointments, inventory, and recalls.
- **Clinic Settings & Safe Onboarding:** Configure clinic profile, timezone, and currency. Onboarding includes safe cancellation and full account reversion.

---

## The Three Manual Gates

To ensure clinical and financial safety, three high-risk actions can **never** be performed by an AI agent or automated script. They require deliberate human execution:

1. **`closeAppointment`** — Closing an appointment requires a human clinician and recorded clinical outcome notes.
2. **`confirmPayment`** — Confirming a financial payment requires human intent and cannot be automated.
3. **`sendPatientEmail`** — Dispatching an email to a real patient requires human review and confirmation.

These gates are enforced across four independent layers:
- PostgreSQL `CHECK` constraints on `appointments`, `payments`, and `patient_emails`.
- Type-safe `HumanIntent` token minted exclusively by Server Actions.
- ESLint rules forbidding AI tools from importing `HumanIntent` or Prisma.
- AI tool registry compile-time assertions throwing if any manual-gate permission is registered.

---

## Tech stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript 5 |
| Styling | Tailwind CSS v4 + shadcn/ui + Radix UI primitives |
| Database | PostgreSQL on Supabase, via Prisma 7 |
| Auth & Storage | Supabase Auth + Supabase Storage |
| AI Assistant | Google Gemini (`gemini-3.5-flash-lite`), provider abstraction |
| Testing | Vitest (16 test files, 120 tests passed) |

---

## Requirements

- **Node.js 20.6 or newer** (22 LTS recommended)
- npm 10+
- A Supabase project
- A Google Gemini API key

## Install

```bash
git clone <your-repo-url> UniSync
cd UniSync
npm install
```

`npm install` runs `prisma generate` automatically, which writes the typed
database client into `lib/db/generated/`.

## Configure environment variables

Copy the template and fill it in:

```bash
cp .env.example .env.local
```

`.env.local` is gitignored — **never commit it, and never put a real key in
source code or in `CLAUDE.md`.**

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local development |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → Data API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page. Optional; bypasses row-level security, so server-side only |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string → **Transaction pooler** (port 6543). Append `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Same page → **Session/direct** connection (port 5432). Used only for migrations |
| `GEMINI_API_KEY` | <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | Optional; defaults to `gemini-3.5-flash-lite` |

## Set up the database

Once `DIRECT_URL` points at your Supabase project:

```bash
npx prisma migrate deploy    # apply all migrations
```

To create a new migration, generate the SQL and apply it:

```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

Write that into `prisma/migrations/<timestamp>_<name>/migration.sql`, add
anything Prisma cannot express (`CHECK` constraints, row-level security), then
run `npx prisma migrate deploy`. Use `npm run db:studio` to browse the data.

## Run it

```bash
npm run dev
```

Open <http://localhost:3000>.

## Commands

```bash
npm run dev            # development server (http://localhost:3000)
npm run build          # production build (Next.js 16 Turbopack)
npm start              # serve the production build
npm run lint           # ESLint (architectural import guards)
npm run typecheck      # TypeScript verification (tsc --noEmit)
npm test               # Vitest suite (16 test files, 120 tests)
npm run test:watch     # Vitest watch mode
npm run db:generate    # regenerate the Prisma client
npm run db:migrate     # create + apply a migration
npm run db:studio      # browse the database
npm run db:seed        # fill YOUR organization with sample data (dev only)
npm run db:seed:clear  # empty sample data from your organization
```

---

## Project structure

```text
app/
  (auth)/               Sign-in, sign-up, password reset, callback, onboarding
  (dashboard)/          Authenticated dashboard shell and modules:
    home/               Organization Pulse dashboard
    patients/           Patient directory and medical history
    appointments/       Calendar, scheduling, manual close gate
    consultations/      Clinical visit notes
    prescriptions/      Medicine prescriptions
    bills/              Invoicing, payments, manual confirm gate
    inventory/          Stock levels, item catalog, movement modal
    followups/          Recalls, reminders, completion
    mail/               Email composer, AI drafting, manual send gate
    notifications/      Notification center
    activity/           Audit trail timeline
    reports/            Clinic analytics dashboard
    settings/           Organization profile configuration
  api/
    cron/followups/     Timezone-aware recall status cron route
    health/             Dependency and connectivity check
components/
  layout/               Shell, NavLinks, CommandPalette (⌘K), NotificationBell, AskUniSyncDrawer (⌘J)
  ui/                   shadcn/ui accessible components
lib/
  ai/                   Gemini LLM provider, agent loop, 20 domain tools
  auth/                 Session context, permissions matrix, HumanIntent token
  server/               runCommand() transactional envelope, Server Action wrappers
  db/                   Prisma client, tenantTripwire, orgWhere()
services/               Domain business logic (schema, rules, queries, commands)
  patients/ appointments/ consultations/ prescriptions/
  billing/ inventory/ followups/ mail/
  notifications/ audit/ reports/ chat/
prisma/
  schema.prisma         PostgreSQL schema (20 models, 12 enums)
  migrations/           Audited migration history with CHECK constraints
tests/                  16 Vitest test suites (120 tests passed)
```

---

## Future Roadmap (What is Yet to be Done)

1. **Third-Party Email Delivery:** Connect live Resend or SendGrid API credentials and webhooks to advance `PatientEmail` from `PROVIDER_NOT_CONFIGURED` to live `SENT`.
2. **Online Payment Gateway:** Integrate Stripe / Razorpay checkout links and webhook reconciliation for online patient payments.
3. **SMS & WhatsApp Messaging:** Add Twilio and WhatsApp Business API adapters for outbound patient recall notifications.
4. **Dedicated Non-Owning Database Role:** Implement PostgreSQL `SET LOCAL app.organization_id` for defense-in-depth RLS on Prisma queries.
5. **Multi-Practitioner Scheduling:** Expand appointment booking from a single-admin model to multi-doctor / multi-chair scheduling with availability rotas.
6. **Persistent Chat Sessions:** Persist Ask UniSync chat messages to database tables (`AiConversation` / `AiMessage`).
7. **Client Command Idempotency:** Pass client-generated `commandId` tokens into `runCommand` to eliminate accidental duplicate submissions.
