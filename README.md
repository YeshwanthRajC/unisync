# 🦷 UniSync - https://unisync-platform.vercel.app/

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

## 👋 Welcome to UniSync

Hi there! I built **UniSync** because I wanted to create a truly modern, centralized administrative hub that takes the friction out of running a clinic. Originally optimized for a **dental clinic**, I designed it with a robust multi-tenant architecture so it can easily scale to support any service-based clinic or small business.

I wanted this platform to feel like you have an extra staff member working alongside you, which is why I integrated a proactive AI Assistant right into the core workflow. Instead of just another CRM, UniSync is a complete ecosystem that handles everything from the moment a patient books an appointment to their final bill and follow-up.

With **14 foundational modules**, I've made sure UniSync is built for production reliability.

---

## ✨ What I've Built (Key Features)

Here is a human-friendly breakdown of what you can do with this platform:

- 👥 **Manage Patients Effortlessly:** I've built a comprehensive CRM where you can register patients, search through their medical history, and automatically calculate ages without doing the math yourself.
- 📅 **Stay on Top of the Calendar:** The scheduling system handles the entire lifecycle of an appointment (schedule, confirm, start, cancel, or mark no-show). Plus, it's fully timezone-aware, so you don't have to worry about mixed-up times.
- 🩺 **Track Consultations & Prescriptions:** During a visit, you can record clinical findings directly on the appointment. I also added a prescription generator that creates immutable, multi-item prescriptions with specific dosage rules.
- 💳 **Handle Billing with Confidence:** You can generate dynamic invoices that auto-calculate totals, record partial or full payments, issue refunds, and void unconfirmed bills if a mistake is made.
- 📦 **Never Run Out of Supplies:** The inventory ledger tracks all your consumable supplies. Whether it's a purchase, a usage, or an adjustment, every stock movement updates an immutable balance ledger and alerts you when stocks fall below reorder thresholds.
- ✉️ **Draft Emails with AI:** Instead of writing follow-up emails from scratch, the built-in Gemini AI looks at the context of the visit and drafts personalized emails to patients for you. You just review and hit send!
- 🔄 **Automate Follow-ups:** I set up a background job that automatically tracks recall dates and generates follow-up tasks so no patient falls through the cracks.
- 🤖 **Ask UniSync (AI Assistant):** Need help? Press `⌘J` (or `Ctrl+J`) to slide out my AI assistant. It utilizes 20 domain-specific tools to read data and suggest actions.
- 🔍 **Global Command Palette:** Need to jump to a page fast? Press `⌘K` (or `Ctrl+K`) for instant modal search and rapid navigation.
- 📊 **Activity Log & Reports:** I included a full audit trail that tracks who did what (User, AI, or System) and rich analytics for revenue, appointments, inventory, and recalls.
- ⚙️ **Clinic Settings & Safe Onboarding:** Manage clinic profiles, timezone, and currency easily, complete with a safe cancellation and full account reversion flow.

---

## 🛡️ The Three Manual Gates (My Approach to AI Safety)

To guarantee clinical and financial safety, I strictly cordoned off three high-risk actions from the AI agent or automated scripts. They **must** be executed by a human:

1. 🩺 **`closeAppointment`** — Requires a human clinician to finalize clinical outcomes.
2. 💰 **`confirmPayment`** — Confirming a financial payment requires human validation.
3. 📨 **`sendPatientEmail`** — Dispatching communication to a real patient requires human review.

**I enforced these gates via a 4-layer defense:**
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
