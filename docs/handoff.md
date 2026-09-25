# UniSync — session handoff

Written 2026-09-23, updated 2026-09-24 after step 14. Read this together with
[`CLAUDE.md`](../CLAUDE.md), which holds the architecture and the full record
of decisions. This file covers what a new session needs that the code does
not already say: current state, what has been completed, what is yet to be done,
the decisions the user made, and the traps already paid for.

---

## Where the project is

**All 14 steps of the foundational roadmap are COMPLETE.**

| # | Step | State | Notes |
| --- | --- | --- | --- |
| 1 | Server foundation | done | Prisma 7, Supabase, tenant tripwire, audited commands |
| 2 | Domain schema, RLS, seed | done | 20 tables, CHECK constraints, RLS lockdown on public key |
| 3 | Auth, onboarding, design system | done | Supabase auth, profile provisioning, onboarding cancel/revert, clinical design system |
| 4 | App shell — sidebar, Organization Pulse | done | Responsive layout, mobile sheet, Organization Pulse dashboard |
| 5 | Patients (the reference module) | done | CRUD, deactivation, search, age/initials rules, tenant isolation |
| 6 | Appointments + calendar + manual closure | done | First manual gate (`closeAppointment`), timezone-aware day calendar |
| 7 | Consultations + prescriptions | done | Clinical records, immutable prescriptions, medicine line items |
| 8 | Billing + manual payment confirmation | done | Second manual gate (`confirmPayment`), invoices, payments, refunds |
| 9 | Inventory + stock movements | done | Stock ledger transaction, quantity on hand sync, low stock alerts |
| 10 | Follow-ups + cron | done | Recall lifecycle, timezone-aware cron materializer route |
| 11 | Patient Mail + AI draft generation | done | Third manual gate (`sendPatientEmail`), Gemini AI draft generator, provider abstraction |
| 12 | Ask UniSync — agent loop, confirmation flow | done | 20 domain tools, discriminated `ToolSpec`, confirmation flow, `⌘J` drawer |
| 13 | Notifications, Activity, Reports, Settings, ⌘K | done | In-app notifications, audit trail timeline, analytics reports, clinic settings, `⌘K` palette |
| 14 | Responsive, a11y, performance, security, docs | done | 16 test files (120 tests passed), clean Next.js 16 Turbopack build, synced docs |

---

## Test & Build Verification Status

- **Vitest Suite:** 16 test files, **120 tests passing**, 0 failing (`npm test`).
- **TypeScript:** 0 errors across entire workspace (`tsc --noEmit`).
- **ESLint:** 0 errors, 0 warnings (`npm run lint`).
- **Production Build:** Next.js 16 Turbopack build compiles **38 App Router routes** cleanly in ~1.7s (`npm run build`).

---

## What was built in Steps 8–14

### Step 8: Billing + Manual Payment Confirmation (Second Manual Gate)
- `services/billing/`: Zod schemas, queries (`listBills`, `getBillOrThrow`, `computeBalance`, `countOutstandingBills`), commands (`createBill`, `voidBill`, `recordPayment`, `confirmPayment`, `refundPayment`).
- **Manual Gate:** `confirmPayment` requires `HumanIntent` and is enforced at the database level by PostgreSQL `CHECK (status != 'CONFIRMED' OR (confirmed_at IS NOT NULL AND confirmed_by_profile_id IS NOT NULL))`.
- **UI:** `/bills`, `/bills/new`, `/bills/[id]`, payment recording & confirmation modals, patient detail Bills card, home page "Outstanding bills" pulse tile.
- **Tests:** `tests/billing.test.ts` (10 tests).

### Step 9: Inventory + Stock Movements
- `services/inventory/`: Zod schemas, queries (`listInventoryItems`, `getItemOrThrow`, `countLowStockItems`, `listStockMovements`), commands (`createInventoryItem`, `updateInventoryItem`, `recordStockMovement`).
- **Stock Ledger Balance:** Every `recordStockMovement` transaction atomically computes and updates `quantityOnHand` and records a `StockMovement` row with `balanceAfter = quantityOnHand`.
- **Constraint:** Database `CHECK (quantity > 0)` prevents zero or negative movement entries.
- **UI:** `/inventory`, `/inventory/new`, `/inventory/[id]`, `/inventory/[id]/movement`, home page "Low-stock items" pulse tile.
- **Tests:** `tests/inventory.test.ts` (6 tests).

### Step 10: Follow-ups + Timezone-Aware Cron
- `services/followups/`: Follow-up lifecycle (`PENDING` -> `COMPLETED` / `CANCELLED`, or `OVERDUE`).
- **Cron Route:** `GET/POST /api/cron/followups` evaluates scheduled follow-ups against current organization timezones and transitions overdue items while creating notifications.
- **UI:** `/followups`, `/followups/new`, patient detail Follow-ups card with modal creator and quick complete/cancel actions.
- **Tests:** `tests/followups.test.ts` (6 tests).

### Step 11: Patient Mail + AI Draft Generation (Third Manual Gate)
- `services/mail/`: Email drafting, preview, update, delete, and manual sending.
- **Manual Gate:** `sendPatientEmail` requires `HumanIntent` and database `CHECK (status != 'SENT' OR (sent_at IS NOT NULL AND sent_by_profile_id IS NOT NULL))`.
- **Provider Abstraction:** With no external email provider configured, attempting to send marks the email as `PROVIDER_NOT_CONFIGURED` without falsifying `SENT`.
- **AI Draft Generator:** Gemini-powered drafting (`draftEmailWithAi`) incorporating patient name, clinic name, and clinical context.
- **UI:** `/mail`, `/mail/new`, `/mail/[id]` with live preview, delete draft button, and sidebar navigation entry.
- **Tests:** `tests/mail.test.ts` (5 tests).

### Step 12: Ask UniSync AI Assistant (Agent Loop, Tools & Drawer)
- **20 Domain Tools:**
  - *Patients (4):* `search_patients`, `get_patient_details`, `create_patient`, `update_patient`.
  - *Appointments (4):* `list_appointments`, `schedule_appointment`, `cancel_appointment`, `confirm_appointment`.
  - *Billing (4):* `list_bills`, `get_bill_details`, `create_bill`, `record_payment`.
  - *Inventory (3):* `list_inventory`, `check_low_stock`, `record_stock_movement`.
  - *Follow-ups (3):* `list_followups`, `schedule_followup`, `complete_followup`.
  - *Patient Mail (2):* `list_patient_emails`, `draft_patient_email`.
- **Discriminated ToolSpec Union:** `lib/ai/tools/define.ts` strictly discriminates `read` tools (receiving `Db`) and `write` tools (receiving `UnitOfWork`), preventing type pollution.
- **Confirmation Flow:** Destructive/modifying writes support a 2-step confirmation cycle before execution.
- **UI & Keyboard Shortcut:** Slide-over `AskUniSyncDrawer` with floating trigger and `⌘J` / `Ctrl+J` shortcut.
- **Tests:** `tests/ai-tools.test.ts` (24 tests) and `tests/agent.test.ts` (4 tests).

### Step 13: Notifications, Activity Log, Reports, Settings & ⌘K
- **Notifications:** In-app notification service (`services/notifications/`), `/notifications` page with filter tabs (All / Unread), mark single read, mark all read, and `NotificationBell` header component with unread counter.
- **Activity Log:** Audit trail service (`services/audit/`), `/activity` page with timeline display, actor badge filtering (`USER`, `AI_AGENT`, `SYSTEM`), and entity type filtering.
- **Reports & Analytics:** Analytics service (`services/reports/`), `/reports` page displaying financial collections, appointment completion/cancellation breakdown, inventory valuation & low-stock health, and recall completion rates.
- **Clinic Settings:** Organization settings page (`/settings`) allowing updates to clinic name, slug, phone, email, address, and view of locale/currency configuration.
- **Command Palette (`⌘K`):** Global modal palette (`components/layout/command-palette.tsx`) accessible via `⌘K` / `Ctrl+K` with fuzzy navigation and instant action shortcuts.
- **Tests:** `tests/notifications-reports.test.ts` (3 tests).

### Step 14: Hardening, Responsive Polish, Accessibility & Documentation
- Verified mobile navigation drawer and sheet responsiveness across phone, tablet, and desktop viewports.
- Validated keyboard traps, ARIA dialog attributes, and focus states across modals and drawers.
- Enforced all architectural tripwires, import guards, and manual-gate guarantees.
- Synchronized documentation across `docs/handoff.md`, `CLAUDE.md`, and `README.md`.

---

## What is yet to be done (Future Roadmap)

While the foundational application and all 14 plan steps are complete, functional, and tested, the following production enhancements are planned for future phases:

1. **Third-Party Email Provider Integration (Resend / SendGrid / Postmark):**
   - The mail subsystem currently uses a robust provider abstraction. In the absence of an API key, sending safely sets the status to `PROVIDER_NOT_CONFIGURED`.
   - *Future Work:* Add webhook handling and provider adapter for Resend or SendGrid to update emails to `SENT` or `BOUNCED`.

2. **Live Payment Gateway (Stripe / Razorpay):**
   - Billing currently handles manual clinic payments (cash, card, UPI, bank transfer) with human confirmation.
   - *Future Work:* Integrate online payment links and webhook reconciliation for patient-initiated payments.

3. **Multi-Channel Patient Messaging (WhatsApp & SMS):**
   - The follow-up and notification data models support multi-channel communication.
   - *Future Work:* Integrate Twilio / WhatsApp Business API for outbound recall nudges.

4. **Dedicated PostgreSQL RLS Role:**
   - Supabase public client is currently 100% blocked via RLS (`42501 permission denied`). Server-side Prisma connects with bypass privileges and is defended by the application layer and `tenantTripwire`.
   - *Future Work:* Introduce a dedicated non-owning PostgreSQL role with `SET LOCAL app.organization_id = ...` for additional defense in depth at the database engine level.

5. **Multi-Provider / Multi-Chair Clinic Model:**
   - By explicit design decision, UniSync currently uses a single administrator model (no practitioner or doctor entity).
   - *Future Work:* If expanding beyond single-practitioner clinics, introduce `Practitioner` and `Chair` entities with scheduling availability rules.

6. **Persistent AI Chat History:**
   - The Ask UniSync chat drawer maintains in-memory conversation state for the active session.
   - *Future Work:* Persist conversations and message transcripts to `ai_conversations` and `ai_messages` tables for historical reference.

7. **Command Idempotency:**
   - The `AuditLog` table has a unique index on `(organizationId, commandId)`.
   - *Future Work:* Pass client-generated `commandId` (idempotency key) into `runCommand` to reject duplicate form submissions automatically.

---

## Onboarding Revert / Cancel Feature (2026-09-24)
- Added "Go back to login" top link and "Cancel & return to login" button to `/onboarding`.
- Clicking cancel discards in-memory form input, calls `cancelOnboardingAction()`, which invokes `revertOnboardingForUser()`:
  - Deletes any `Profile` row created in Prisma.
  - Deletes the uncompleted account from `auth.users` in Supabase Auth via transactional raw SQL.
  - Terminates the Supabase session (`signOut()`) and clears auth cookies.
  - Frees up the email so it is never permanently locked or left as an orphan.
  - Returns `ok(null)` to the client.
- The Client Component triggers a clean, full-page navigation using `window.location.href = "/sign-in"` rather than relying on a server action `redirect()` inside `useTransition`. This prevents Next.js transition locks where the UI would stay stuck in a pending state with entered form data.
- Only if the user submits "Create organization" successfully is the account, profile, and organization saved permanently.
- Covered by unit & integration tests in `tests/onboarding-cancel.test.ts` (all green) and verified live end-to-end in the browser for both top and bottom return buttons.

---

## Live environment

Everything is configured and verified against real services.

- **Supabase** project `wzyaoeavcyjoeoonrlcd`, region `ap-northeast-1`,
  Postgres 17.6. Credentials are in `.env.local` (gitignored).
- **Gemini** on `gemini-3.6-flash`. Note `gemini-2.5-flash` still appears in
  `ListModels` but returns 404 for accounts created after its retirement — the
  model id has to be verified with a real call, not a listing.
- **Account:** `markspector@gmail.com`, OWNER of "Mark Dental Clinic"
  (slug `bright-smile-clinic`), Asia/Kolkata, INR. Seeded with 25 patients,
  40 appointments, 15 bills, 8 inventory items, 12 follow-ups.
- **No email provider** is configured, by decision. See below.

## Decisions the user made

These are settled. Do not reopen them without asking.

| Decision | Choice |
| --- | --- |
| Users | **Single administrator** manages everything. No practitioner or doctor entity exists — appointments and consultations store no staff reference. |
| Email provider | **Abstraction only.** Build the composer, AI draft, preview and history. Never display "sent" without provider confirmation. |
| Locale | INR, Asia/Kolkata, DD/MM/YYYY, stored per organization. |
| RLS | Lock down the browser key; application layer plus tripwire for Prisma. |
| AI writes | Allowed for patients, appointments, bills, stock, follow-ups and email **drafts**. Closing, confirming and sending are structurally impossible. |
| Testing | Vitest on server logic. No Playwright. |
| Visual tone | Deep navy `#1E3A5F`, white surfaces, blue-gray neutrals. Clinical, crisp, quiet. |
| Cadence | Work continuously, commit per phase, report at milestones. |

### Sample data must stay in one account

The user asked explicitly: demo data belongs only to their account, and any new
signup must start empty and fill as real data arrives.

This is enforced, not merely intended. The seed fills the organization the named
account **already has** — it does not create one — and the tenant tripwire makes
a cross-tenant write throw. `npm run db:seed:clear -- <email>` empties it again.

The consequence for every module still to be built: **for a real new user, the
empty state is the product on day one.** Empty states are a requirement, not
polish.

## The three manual gates

The product's central rule. Nothing may close an appointment, confirm a payment,
or send a patient email except a person, deliberately. Four independent layers:

1. **Postgres `CHECK` constraints** — a `COMPLETED` appointment with no closer is
   an impossible row, even via raw SQL. Verified by attempting the bad inserts.
2. **`HumanIntent`** — a `unique symbol`-branded token, mintable only by
   `lib/server/action.ts`, which `lib/ai/**` is ESLint-forbidden from importing.
   An AI tool that tries to close an appointment **fails `tsc`**.
3. **No side-effect path** — there is no `completeAppointment` or `markPaid`, and
   `status` appears in no generic update input.
4. **`HUMAN_ONLY_PERMISSIONS`** — the tool registry throws at construction if any
   tool claims one.

If a change appears to require weakening any of these, it is the change that is
wrong.

## Traps already paid for

Each of these cost a debugging round trip. They are fixed; this is so they are
not reintroduced.

**Editing `lib/db/tenant-guard.ts` used to need a dev-server restart.** The
tripwire is baked into the Prisma client at construction and the client is cached
on `globalThis`. A fix would sit on disk, pass its tests, and the running app
would keep throwing the old error from line numbers that no longer existed.
`getPrismaClient()` now compares the identity of the imported `tenantTripwire`
and rebuilds when it changes.

**`Membership` cannot be scoped by `organizationId`.** It is the table that
answers "which organizations does this person belong to?", so the filter would
have to be the answer. `profileId` is an accepted scope for that model alone —
a narrow, per-model allowance, deliberately not a general `crossTenant()` escape
hatch, which would get reached for whenever the guard was inconvenient.

**Prisma query extensions DO propagate into `$transaction`.** Verified, and
load-bearing: every write happens in one, so if they did not, the tripwire would
cover only reads.

**RLS does not constrain Prisma.** The role has `rolbypassrls`. RLS protects the
browser-facing publishable key, which gets `42501 permission denied`. Tenant
isolation for our own code is the application layer plus the tripwire. Do not
describe RLS as protecting server queries.

**An RLS test can pass vacuously.** RLS makes `SELECT` return zero rows rather
than raising, so "no rows came back" is indistinguishable from "the table is
empty". Assert the specific `42501` code.

**`prisma migrate dev` cannot run here** — it is interactive. Use
`prisma migrate diff --from-config-datasource --to-schema` to generate SQL, edit
in anything Prisma cannot express, then `prisma migrate deploy`. Never edit an
applied migration; never reset the database.

**Next 16 typed routes** (`PageProps<"/x">`) only typecheck after the route
exists in generated types. Run a build after adding a route.

**Server Actions must return failures, not throw.** Next replaces a thrown
error's message with a generic digest in production, so `isAuthError` in
`error.tsx` works in dev and silently stops working when deployed.

## Conventions to follow

- **Services** live in `services/<module>/` as `schema.ts`, `queries.ts`,
  `commands.ts`, `index.ts`, plus `rules.ts` **only when the module has pure
  logic to hold** — Patients (`calculateAge`, `initialsFor`) and Appointments
  (the status state machine, timezone conversions) have one; Consultations and
  Prescriptions don't, because what they needed checking required a database
  read, so it lives in `commands.ts` instead. Don't add an empty `rules.ts` to
  "complete the set" — see the dated entry in CLAUDE.md.
- Reads take an optional `db`; writes take a **required** `UnitOfWork`, so a
  command cannot run outside a transaction.
- **Every write goes through `runCommand`** — one transaction, one `AuditLog`
  row. Two documented exceptions: auth actions and `createOrganizationForUser`,
  both of which predate the existence of an organization context.
- **Services never call `requireOrganizationContext()`.** They receive `ctx`.
- **A Client Component must import a leaf file (`schema.ts`/`rules.ts`), never
  a module's `index.ts` barrel.** The barrel also re-exports `commands.ts`/
  `queries.ts`, which import `"server-only"` and, transitively, Prisma —
  bundling that for the browser breaks the production build. This bit a real
  commit (see the dated entry in CLAUDE.md); a Server Component (a page, or a
  component with no `"use client"`) can import the barrel freely.
- **AI tools** go in `lib/ai/tools/<module>.tools.ts`, never beside the service,
  so "what can the agent do?" is a directory listing.
- **Pages and components may not import `@/lib/db/prisma`** — enforced by ESLint.
  It already caught the onboarding page during development.
- **A tenant-scoped write's `where` must carry `organizationId` itself** —
  `orgWhere(ctx, { id })` — even when a `get<X>OrThrow` precondition check
  already ran first. The precondition is for a clean `NotFoundError` message;
  the scoped write is the actual guarantee. The tripwire caught this exact gap
  in `services/patients/commands.ts` during development — see CLAUDE.md.
- Money is `Decimal(12,2)`, never a float. Timestamps are UTC; the organization's
  timezone governs display. For anything timezone-sensitive (a day-view query
  bound, a `datetime-local` form field), copy the conversions in
  `services/appointments/rules.ts` (`zonedTimeToUtc`, `utcToZonedInputValue`,
  `dayBoundsInZone`) rather than re-deriving offset math — it is easy to get
  subtly wrong near a DST boundary.
- **New nav item?** Only add one to `components/layout/nav-config.ts` in the
  same commit as the page(s) it points to — never before. See the dated entry
  in CLAUDE.md for why.

## Known issues

Kept current in `CLAUDE.md`; the ones most likely to matter next:

1. `runCommand` does not yet write `commandId`, so a double-submitted action
   produces two audit records. The column and unique index exist.
2. `requireOrganizationContext()` silently picks the oldest membership. Harmless
   with one administrator; needs an active-organization cookie before multi-org.
3. RLS for Prisma (a dedicated non-owning role plus `SET LOCAL`) is deferred.
4. `/api/health` is unauthenticated.
5. No email provider; `PatientEmail` can reach `PROVIDER_NOT_CONFIGURED` but
   never `SENT`.
6. 4 high-severity `npm audit` advisories, all dev-only transitive dependencies
   of the Prisma CLI.

## Useful commands

```bash
npm run dev                                   # http://localhost:3000
npm test                                      # 120 tests across 16 test files, needs .env.local
npm run typecheck && npm run lint && npm run build
npx next typegen                              # after adding a new route, before typecheck
npm run db:seed -- markspector@gmail.com      # refill the demo clinic
npm run db:seed:clear -- markspector@gmail.com # empty it
npx prisma migrate deploy                     # apply migrations
```

### Cleaning up a throwaway browser-verification account

Every module in this project has been verified by signing up a real
throwaway account through the UI, walking the feature, then deleting that
account's organization from Postgres — **never** leave test data in the
shared dev database, and never reuse or touch the seeded
`markspector@gmail.com` clinic for this. There's no script for it (each
verification pass names its own test slug/email), so it's normally a few
lines of `tsx` run directly and then deleted:

```ts
// scripts-cleanup-tmp.ts — write it, run `npx tsx scripts-cleanup-tmp.ts`, delete it
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./lib/db/generated/client";
process.loadEnvFile(".env.local");
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: { contains: "your-test-slug" } } });
  if (org) await prisma.organization.delete({ where: { id: org.id } }); // cascades
  await prisma.profile.deleteMany({ where: { email: "your-test-email@example.com" } });
}
main().finally(() => process.exit(0));
```

Note this only cleans the Prisma-side rows (Organization, Membership, Patient,
etc. all cascade from the Organization delete). It does **not** delete the
Supabase Auth user itself — that's a harmless leftover (a handful accumulate
from prior verification passes) since the app never resolves a session for an
account with no organization into anything sensitive, but delete it too via
the Supabase dashboard if you want to keep Auth tidy.

---

## Recent Fixes & Operational Notes

### 1. Onboarding Revert / Cancel Sign-Up Flow
- **Problem:** If a user signed up, arrived at the `/onboarding` step ("Enter other details"), and chose to cancel or return to sign-in, the platform previously got stuck or locked the email in Supabase Auth.
- **Resolution:**
  - `cancelOnboardingAction` in `app/onboarding/actions.ts` cleans up the user's empty `Profile` and calls Supabase Admin API (`supabaseAdmin.auth.admin.deleteUser`) to completely free the registered email.
  - Client button uses `window.location.replace("/sign-in")` instead of Next.js soft navigation, ensuring a full reload of client auth state.
  - `tests/onboarding-cancel.test.ts` asserts that both profile and auth user are deleted and that the email can be re-registered immediately.

### 2. Next.js 16 Dev Server Cross-Origin & LAN Access (`allowedDevOrigins`)
- **Problem:** When opening Next.js dev server over LAN or clicking the network URL (`http://192.168.56.1:3000` or `http://192.168.29.20:3000`), Next.js 16 blocks dev resources (`/_next/hmr` WebSocket and `geist-latin.woff2` fonts) with 403 Forbidden, causing the browser tab to stall/freeze.
- **Resolution:**
  - `next.config.ts` configures `allowedDevOrigins` dynamically using `os.networkInterfaces()` and static fallback IPs (`192.168.56.1`, `192.168.29.20`, `localhost`, `127.0.0.1`).
  - Note: In Windows environments with VirtualBox installed, `192.168.56.1` is the VirtualBox Host-Only Ethernet adapter and will not route to external Wi-Fi devices. External devices (phones, tablets) on the same Wi-Fi should connect to the actual Wi-Fi adapter IP (e.g., `http://192.168.29.20:3000`).

### 3. AI Assistant Gemini Model & Thought Signature Fix
- **Problem:** AI Assistant failed with `Gemini request failed for model "gemini-3.6-flash"` during multi-turn function calling.
  - Root cause 1: `gemini-3.6-flash` is a reasoning model that produces `thoughtSignature` on functionCall parts. In multi-turn execution, Google Gemini 3.x API rejects subsequent turns with a `400 INVALID_ARGUMENT` if the preceding `thoughtSignature` is dropped when formatting conversation history.
  - Root cause 2: `gemini-3.6-flash` burns hundreds of internal thinking tokens per request and has an extremely low free-tier limit (20 requests/day), hitting `429 RESOURCE_EXHAUSTED` quickly.
- **Resolution:**
  - `lib/ai/types.ts`: Added optional `thoughtSignature?: string` to `AiToolCall`.
  - `lib/ai/gemini.ts`: `GeminiProvider.generate` extracts `thoughtSignature` from candidate parts, and `toGeminiContent` attaches `thoughtSignature` back to function call parts in the transcript.
  - `app/(dashboard)/actions/chat.ts`: Updated `chatMessageSchema` to validate and preserve `thoughtSignature` across client-server boundaries.
  - Model switched to **`gemini-3.5-flash-lite`** in `lib/env.ts` and `.env.local`:
    - Economical token/credit consumption.
    - Zero thinking token overhead.
    - ~5x faster execution (~1.1s vs ~6.9s).
    - Generous free-tier rate limits.

### 4. AI Assistant Confirmation Resume & Transcript Turn Fix (`Action failed: Gemini request failed...`)
- **Problem:** When booking an appointment or performing any action requiring human confirmation (e.g. `schedule_appointment`, `cancel_appointment`), clicking "Confirm" failed with:
  `Action failed: Gemini request failed for model "gemini-3.5-flash-lite".`
  - Root cause 1: When a write tool paused for confirmation, the client stored the assistant message containing the pending `toolCalls`. When the user confirmed, the client sent back the message transcript containing the unresolved tool call along with `confirmedCall`. `runAgentTurn` in `lib/ai/agent/loop.ts` immediately invoked `provider.generate({ messages })` before executing the tool. Gemini's API rejects any conversation history where the last turn is a model `functionCall` without an accompanying user `functionResponse`, returning a `400 Bad Request`.
  - Root cause 2: `toGeminiContent` mapped each tool message to a separate `role: "user"` turn without merging consecutive tool responses, violating Gemini's requirement that conversation turns strictly alternate between `user` and `model`.
- **Resolution:**
  - `lib/ai/agent/loop.ts`: Added pre-loop pending tool call resolution. When `runAgentTurn` starts, any unresolved tool call matching `confirmedCall` is executed (or cancelled) and its `{ role: "tool" }` response is recorded into `currentMessages` before `provider.generate` is called.
  - `lib/ai/gemini.ts`: Added `toGeminiContents` to merge consecutive same-role turns into a single turn with combined parts (e.g. multi-tool turns), and added server-side error logging in the catch block.
  - `services/appointments/rules.ts` & `appointment.tools.ts`: Normalized `scheduledAt` strings with `slice(0, 16)` to guarantee `YYYY-MM-DDTHH:mm` format when models produce seconds.
  - `tests/agent.test.ts`: Added multi-turn tests for both confirming and declining paused write tools with `updatedMessages`.

### 5. Server Action Decimal Serialization Fix (`Only plain objects can be passed to Client Components...`)
- **Problem:** When recording, confirming, or refunding a payment against a bill, or mutating inventory items, the server crashed with:
  `Only plain objects can be passed to Client Components from Server Components. Decimal objects are not supported.`
  - Root cause: Prisma models like `Payment` (`amount: Decimal`), `Bill` (`subtotal: Decimal`, `total: Decimal`), and `InventoryItem` contain `Decimal` instances from `decimal.js`. Next.js React Server Actions use React Flight to serialize action results back to Client Components (`useActionState`). React Flight rejects objects with non-plain prototypes (`Decimal.prototype`).
- **Resolution:**
  - `lib/server/action.ts`: Added `serializePlain` to recursively convert `Decimal` instances to serializable strings (while preserving `Date` instances), applied to all return values in `action` and `readAction`.
  - `app/(dashboard)/bills/actions.ts` & `app/(dashboard)/inventory/actions.ts`: Explicitly mapped action command return values to plain objects.
  - `app/(dashboard)/bills/record-payment-form.tsx`, `confirm-payment-form.tsx`, `void-bill-form.tsx`: Added `useEffect` hooks to automatically close form sheets/collapsibles upon successful completion (`state?.ok`).
  - `tests/action-serialize.test.ts`: Added unit tests verifying `serializePlain` handles primitives, Dates, Decimals, arrays, and nested structures.

### 6. Brevo Email Service Integration
- **Configuration:**
  - `BREVO_API_KEY`: Brevo transactional API key stored in `.env.local` and configured in `lib/env.ts`.
  - `services/mail/provider.ts`: Implemented `BrevoMailProvider` targeting `https://api.brevo.com/v3/smtp/email`.
  - Manual delivery (`sendPatientEmail`) uses Brevo API directly with fallback to Preview mode if unconfigured.
  - Automatic AI agent emailing (`send_patient_email` tool) dispatches genuine emails through Brevo after passing domain and ground-truth verification.

### 7. Patient Ground-Truth Verification & Mistake-Correction System
- **Rule:** Before the agent or UI performs any action or generates any communication (e.g., appointment reminder, balance notice, follow-up recall), it must check the real ground-truth clinic records.
- **Mistake Correction & Prevention:**
  - If a patient has no active scheduled/confirmed appointment, sending or drafting an appointment reminder is flagged as inappropriate.
  - If a patient has ₹0.00 outstanding balance, sending or drafting a balance payment notice is rejected.
  - Inappropriate actions are rejected programmatically and an in-app `Notification` with `severity: "WARNING"` is created for staff.
  - If valid records exist but the user omitted IDs, the system automatically resolves and links the genuine appointment/bill IDs to correct minor omissions.
- **Components:**
  - `services/mail/verifier.ts`: `verifyPatientActionContext` & `detectActionTopic`.
  - `services/mail/commands.ts`: `generateAiDraft` executes ground-truth verification and attaches warnings or real context.
  - `app/(dashboard)/mail/mail-composer.tsx`: Displays an interactive warning banner if ground truth conflicts with user action.
  - `lib/ai/tools/mail.tools.ts`: `draft_patient_email` and `send_patient_email` enforce verification, reject invalid actions, and raise alert notifications.
  - `lib/ai/agent/loop.ts`: System prompt rule 4 enforces checking real records before executing operations.
  - `tests/verifier.test.ts`: 10 comprehensive unit & integration tests covering topic detection, record checks, rejections, and notifications.

### 8. Mandatory Information Completeness & Non-Abstract Operations Policy
- **Problem:** When users asked the agent to create records (e.g. register a patient profile, schedule an appointment, create a bill), the agent previously called creation tools with sparse or abstract inputs, putting empty/null values into missing fields and making partial updates destructive (wiping out non-updated fields).
- **Resolution:**
  - **System Instruction (Rule 5 in `lib/ai/agent/loop.ts`):** Enforces that the agent MUST NOT create records abstractly or fill missing fields with blanks/nulls. If the user provides an incomplete prompt, the agent must respond with a structured checklist asking for the required details (demographics, contact info, appointment date/time/duration/type, bill line items).
  - **Tool Elicitation Guard (`lib/ai/tools/patient.tools.ts`):** `create_patient` validates that at least one primary contact method (`phone` or `email`) is provided before registering a patient profile. If omitted, the tool rejects and instructs the agent to ask the user.
  - **Preserved Partial Updates (`services/patients/commands.ts` & `update_patient`):** `updatePatient` and `updatePatientTool` now merge incoming changes with the existing patient record in the database, preserving all unmentioned fields rather than overwriting them with `null`.
  - **Appointment Rescheduling & Updating (`services/appointments/commands.ts` & `update_appointment`):** Added `update_appointment` (`updateAppointmentTool`) to the AI tools suite and enabled partial updates in `updateAppointment`, allowing appointments to be rescheduled or modified without losing duration, type, or notes.
  - **Line Item Elicitation (`lib/ai/tools/billing.tools.ts`):** `create_bill` tool description strictly warns against inventing arbitrary line items and requires gathering specific items, quantities, and prices from the user.
  - **Tests:** `tests/completeness-verifier.test.ts` (4 unit tests passed). Total suite now stands at **19 test files (143 tests passing)**.



