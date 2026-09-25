# 🦷 UniSync

<div align="center">
  <h3><strong>The Intelligent Admin Workspace for Modern Clinics</strong></h3>
  <p>A multi-tenant SaaS platform powering patient management, scheduling, billing, inventory, and automated follow-ups—driven by a proactive AI Assistant.</p>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Fully%20Built%20%26%20Tested-success?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/PostgreSQL-Prisma%207-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/AI-Google%20Gemini-orange?style=flat-square&logo=google" alt="AI Gemini" />
</p>

---

## 📖 Overview

UniSync is designed as a centralized administrative hub. The first version is optimized for a **dental clinic**, but the robust multi-tenant architecture and organization-aware data model mean it can scale to support any service-based clinic or small business.

With **14 foundational modules**, **38 App Router routes**, and **120 Vitest unit/integration tests**, UniSync is built for production reliability.

> For deeper engineering context—including architecture, data models, AI safety boundaries, and design decisions—see [`CLAUDE.md`](./CLAUDE.md) and [`docs/handoff.md`](./docs/handoff.md).

---

## ✨ Key Features

- 👥 **Patients & Medical Records:** Comprehensive CRM to register, search, archive, and manage clinical history, with automated age calculations.
- 📅 **Appointments & Timezone Calendar:** Full scheduling workflow (schedule, confirm, start, cancel, mark no-show) with day calendar and timezone awareness.
- 🩺 **Consultations & Prescriptions:** Record clinical findings natively attached to appointments. Issue immutable, multi-item prescriptions with dosage rules.
- 💳 **Billing & Invoicing:** Generate dynamic invoices with auto-calculated totals. Record payments, issue refunds, and manage unconfirmed voidable bills.
- 📦 **Inventory & Stock Ledger:** Track consumable supplies with reorder thresholds. All stock movements (`PURCHASE`, `USAGE`, `ADJUSTMENT`) update an immutable balance ledger.
- ✉️ **Patient Mail & AI Drafting:** Built-in email composer powered by Gemini AI to draft context-aware emails to patients (with live preview).
- 🔄 **Reminders & Follow-ups:** Automate recall dates and follow-ups with notes, driven by a timezone-aware background cron job (`/api/cron/followups`).
- 🤖 **Ask UniSync (AI Assistant):** A slide-over assistant (`⌘J` / `Ctrl+J`) powered by Google Gemini. It utilizes 20 domain-specific tools with read/write confirmation flows and complete audit logging.
- 🔍 **Global Command Palette:** Instant modal search (`⌘K` / `Ctrl+K`) for rapid navigation and executing quick actions across the platform.
- 📊 **Activity Log & Reports:** Full audit trail filtering by actor (`USER`, `AI_AGENT`, `SYSTEM`); rich analytics for revenue, appointments, inventory, and recalls.
- ⚙️ **Clinic Settings & Safe Onboarding:** Manage clinic profiles, timezone, and currency. Includes a safe cancellation and full account reversion flow.

---

## 🛡️ The Three Manual Gates (AI Safety)

To guarantee clinical and financial safety, three high-risk actions are strictly cordoned off from the AI agent or automated scripts. They **must** be executed by a human:

1. 🩺 **`closeAppointment`** — Requires a human clinician to finalize clinical outcomes.
2. 💰 **`confirmPayment`** — Confirming a financial payment requires human validation.
3. 📨 **`sendPatientEmail`** — Dispatching communication to a real patient requires human review.

**These gates are enforced via a 4-layer defense:**
- PostgreSQL `CHECK` constraints on the database level.
- Type-safe `HumanIntent` tokens minted exclusively by authorized Server Actions.
- Custom ESLint rules that block AI tools from importing `HumanIntent` or the Prisma client directly.
- AI tool registry compile-time assertions that immediately throw errors if a manual-gate permission is mistakenly registered.

---

## 🛠️ Tech Stack

| Category | Technology |
| --- | --- |
| **Framework** | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript 5 |
| **Styling** | Tailwind CSS v4 + shadcn/ui + Radix UI primitives |
| **Database** | PostgreSQL (hosted on Supabase) via Prisma 7 |
| **Auth & Storage** | Supabase Auth + Supabase Storage |
| **AI Assistant** | Google Gemini (`gemini-3.8-flash`), robust tool abstraction |
| **Testing** | Vitest (16 test files, 120 passing tests) |

---

## 🚀 Getting Started

### Requirements
- **Node.js 20.6+** (22 LTS recommended)
- npm 10+
- A Supabase project
- A Google Gemini API key

### Installation
Clone the repository and install dependencies:
```bash
git clone <your-repo-url> UniSync
cd UniSync
npm install
```
*(Note: `npm install` runs `prisma generate` automatically to build the typed database client in `lib/db/generated/`)*

### Environment Variables
Copy the template and fill in your details:
```bash
cp .env.example .env.local
```
> **⚠️ Security Warning:** `.env.local` is gitignored. NEVER commit it or put real API keys in source code.

| Variable | Description / Where to find it |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (for local development) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → Data API |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Optional, server-side only)* Bypasses RLS |
| `DATABASE_URL` | Supabase → Database → Connection string → **Transaction pooler** (port 6543). Add `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Supabase → Database → **Session/direct** connection (port 5432). Used for migrations. |
| `GEMINI_API_KEY` | Get it from [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | *(Optional)* Defaults to `gemini-3.8-flash` |

### Database Setup
Apply migrations and synchronize the schema:
```bash
npx prisma migrate deploy
```
To generate a new migration:
```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```
> Save the output to `prisma/migrations/<timestamp>_<name>/migration.sql`, add `CHECK` constraints/RLS manually if needed, then deploy. Use `npm run db:studio` to view your data.

### Run the App
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000) to view the application.

---

## 💻 Available Commands

| Command | Action |
| --- | --- |
| `npm run dev` | Start development server |
| `npm run build` | Build production bundle (Next.js Turbopack) |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint (checks architectural import guards) |
| `npm run typecheck` | Run TypeScript verification (`tsc --noEmit`) |
| `npm test` | Run Vitest suite |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:studio` | Open Prisma Studio to browse database |
| `npm run db:seed` | Populate organization with sample data *(Dev only)* |
| `npm run db:seed:clear`| Clear sample data from organization |

---

## 📁 Project Structure

```text
app/
  (auth)/               Sign-in, sign-up, password reset, callback, onboarding
  (dashboard)/          Authenticated dashboard shell and modules:
    ├─ home/            Organization Pulse dashboard
    ├─ patients/        Patient directory and medical history
    ├─ appointments/    Calendar, scheduling, manual close gate
    ├─ consultations/   Clinical visit notes
    ├─ prescriptions/   Medicine prescriptions
    ├─ bills/           Invoicing, payments, manual confirm gate
    ├─ inventory/       Stock levels, item catalog, movement modal
    ├─ followups/       Recalls, reminders, completion
    ├─ mail/            Email composer, AI drafting, manual send gate
    ├─ notifications/   Notification center
    ├─ activity/        Audit trail timeline
    ├─ reports/         Clinic analytics dashboard
    └─ settings/        Organization profile configuration
  api/                  Backend API routes (e.g., cron jobs, health checks)
components/
  ├─ layout/            App shell, NavLinks, CommandPalette (⌘K), AskUniSyncDrawer (⌘J)
  └─ ui/                Accessible shadcn/ui components
lib/
  ├─ ai/                Gemini LLM provider, agent loop, domain tools
  ├─ auth/              Session context, permissions matrix, HumanIntent token
  ├─ server/            runCommand() transactional envelope, Server Actions
  └─ db/                Prisma client, tenant wrappers
services/               Domain business logic (rules, queries, commands)
prisma/                 PostgreSQL schema (20 models) and migrations
tests/                  Vitest test suites
```

---

## 🔮 Future Roadmap

1. **Third-Party Email Delivery:** Connect Resend/SendGrid API for live email dispatch.
2. **Online Payment Gateway:** Stripe/Razorpay integration for online invoice payments.
3. **SMS & WhatsApp Messaging:** Twilio and WhatsApp Business API adapters for patient reminders.
4. **Defense-in-Depth RLS:** Implement `SET LOCAL app.organization_id` in PostgreSQL for strict row-level security.
5. **Multi-Practitioner Scheduling:** Expand single-admin booking to multi-doctor rotas.
6. **Persistent Chat Sessions:** Save "Ask UniSync" chat history to the database.
7. **Client Command Idempotency:** Pass client-generated `commandId` tokens to `runCommand` to prevent duplicate submissions.

---
<div align="center">
  <i>Built with modern web standards to simplify clinical operations.</i>
</div>
