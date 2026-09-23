# UniSync — session handoff

Written 2026-09-23, updated same day after step 7. Read this together with
[`CLAUDE.md`](../CLAUDE.md), which holds the architecture and the full record
of decisions. This file covers what a new session needs that the code does
not already say: current state, exactly what to do next, the decisions the
user made, and the traps already paid for.

**If you are picking this up fresh: read "What to do next" below first.**

---

## Where the project is

Steps 1–7 of a 14-step plan are done. The plan lives at
`~/.claude/plans/pasted-content-id-418c-unisync-prancy-dawn.md`.

| # | Step | State |
| --- | --- | --- |
| 1 | Server foundation | done |
| 2 | Domain schema, RLS, seed | done |
| 3 | Auth, onboarding, design system | done |
| 4 | App shell — sidebar, Organization Pulse | done (Ask UniSync panel deferred to step 12, by design — see CLAUDE.md) |
| 5 | Patients (the reference module the rest copy) | done |
| 6 | Appointments + calendar + manual closure | done — the first manual gate (`closeAppointment`) built and verified end to end |
| 7 | Consultations + prescriptions | done — see "not yet done" note below |
| 8 | **Billing + manual payment confirmation** | **next** |
| 9 | Inventory + stock movements | |
| 10 | Follow-ups + cron | |
| 11 | Patient Mail + AI draft generation | |
| 12 | Ask UniSync — agent loop, confirmation flow | |
| 13 | Notifications, Activity, Reports, Settings, ⌘K | |
| 14 | Responsive, a11y, performance, security, docs | |

**Verification status:** 84 Vitest tests pass; typecheck, lint and production
build are all clean as of the last commit
(`801e028 Add the Consultations and Prescriptions modules`).

Steps 1–6 (through Appointments) were walked live in the browser end to end
against a throwaway sign-up (deleted afterward; the seeded
`markspector@gmail.com` clinic is untouched): onboarding and empty states,
adding/editing/deactivating a patient, scheduling an appointment, and the
full status lifecycle — confirm, then close through the manual-gate form,
with the outcome notes and the "Completed" status landing correctly on both
the appointment page and the patient's own Appointments card.

**Step 7 (Consultations + Prescriptions) is NOT yet browser-verified.** The
session that built it was interrupted mid-walkthrough (had just created a
throwaway account and a test patient; both were cleaned up from the database
before this handoff was written, so there is nothing left over to worry
about). Everything automated is green — typecheck, lint, build, and
`tests/consultations.test.ts` / `tests/prescriptions.test.ts` all pass — but
nobody has clicked through the actual pages yet. **Do this first**, before
building anything new:

1. `npm run dev`, sign up a throwaway account (or reuse one you make and
   delete), add a patient.
2. Schedule an appointment for them, confirm it.
3. From the appointment detail page, use "Record consultation" — check the
   form loads, submits, and the appointment's own status is untouched
   afterward.
4. From the patient detail page, use the new Prescriptions card → "Issue" —
   check the dynamic add/remove medicine rows work, submission succeeds, and
   the prescription shows up correctly on `/prescriptions/[id]` and in the
   patient's Prescriptions list.
5. Delete the throwaway account/org from Postgres afterward (see the cleanup
   pattern in "Useful commands" below) — never leave test data in the shared
   dev database.

If something's broken, fix it and note what was wrong in `CLAUDE.md`'s
Architectural Decisions log (same pattern as the two entries already there
from earlier verification passes) before moving on to Billing.

## What to do next

**Step 8: Billing + manual payment confirmation.** This is the module that
carries the product's **second manual gate**, `confirmPayment` — go build it
by directly copying the pattern `closeAppointment` established in step 6, not
by re-deriving it:

- Read `services/appointments/commands.ts`'s `closeAppointment` and
  `app/(dashboard)/appointments/close-appointment-form.tsx` first. The shape
  to copy: a command that takes `(ctx, input, intent: HumanIntent, unit)`,
  reachable from exactly one UI form that is the only path to it, with a test
  that (a) reloads the row after calling the real command and (b) attempts a
  raw-SQL insert of the gated state to prove the database `CHECK` constraint
  holds independently — see `tests/appointments.test.ts`'s "the manual close
  gate" describe block for the exact pattern.
- `Bill`, `BillItem`, `Payment` models already exist in `prisma/schema.prisma`
  (see the Database Design section of `CLAUDE.md`). The `CHECK` constraint for
  `PaymentStatus.CONFIRMED` requiring `confirmedAt`/`confirmedByProfileId`
  already exists too (from the `20260923173935_domain_modules` migration) — it
  has never been exercised by application code yet, so verify it with the same
  raw-SQL-refusal test technique before trusting it.
- Permissions already exist in `lib/auth/permissions.ts`: `bill.read`,
  `bill.create`, `bill.void`, `payment.read`, `payment.record`,
  `payment.confirm`, `payment.refund`. `payment.confirm` and `payment.refund`
  are already in `HUMAN_ONLY_PERMISSIONS`; `bill.void` is too.
- Reminder from CLAUDE.md: `BillStatus` deliberately has no `PAID`/
  `PARTIALLY_PAID` value. How much of a bill is paid is derived at read time
  from `CONFIRMED` payments — don't add a stored "amount paid" field.
- Same UI shape as Patients/Appointments: list, detail, create; reachable
  from the patient detail page (a "Bills" card, same as Appointments/
  Consultations/Prescriptions got). Decide whether Billing needs its own
  top-level nav entry (Patients and Appointments have one; Consultations and
  Prescriptions deliberately don't, since they're accessed via a patient, not
  browsed independently day to day) — Billing probably does want one, since
  "which bills are outstanding" is itself a daily-use list, similar in spirit
  to the Appointments day view.

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
npm test                                      # 84 tests, needs .env.local
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
