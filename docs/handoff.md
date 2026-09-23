# UniSync — session handoff

Written 2026-09-23. Read this together with [`CLAUDE.md`](../CLAUDE.md), which
holds the architecture and the full record of decisions. This file covers only
what a new session needs that the code does not already say: current state, the
decisions the user made, and the traps already paid for.

---

## Where the project is

Steps 1–6 of a 14-step plan are done. The plan lives at
`~/.claude/plans/pasted-content-id-418c-unisync-prancy-dawn.md`.

| # | Step | State |
| --- | --- | --- |
| 1 | Server foundation | done |
| 2 | Domain schema, RLS, seed | done |
| 3 | Auth, onboarding, design system | done |
| 4 | App shell — sidebar, Organization Pulse | done (Ask UniSync panel deferred to step 12, by design — see CLAUDE.md) |
| 5 | Patients (the reference module the rest copy) | done |
| 6 | Appointments + calendar + manual closure | done — the first manual gate (`closeAppointment`) built and verified end to end |
| 7 | **Consultations + prescriptions** | **next** |
| 8 | Billing + manual payment confirmation | |
| 9 | Inventory + stock movements | |
| 10 | Follow-ups + cron | |
| 11 | Patient Mail + AI draft generation | |
| 12 | Ask UniSync — agent loop, confirmation flow | |
| 13 | Notifications, Activity, Reports, Settings, ⌘K | |
| 14 | Responsive, a11y, performance, security, docs | |

**Verification status:** 77 Vitest tests pass; typecheck, lint and production
build are clean; `/api/health` reports `ready`. Everything through Appointments
was also walked live in the browser against a throwaway sign-up (deleted
afterward; the seeded `markspector@gmail.com` clinic is untouched): onboarding
and empty states, adding/editing/deactivating a patient, scheduling an
appointment, and the full status lifecycle — confirm, then close through the
manual-gate form, with the outcome notes and the "Completed" status landing
correctly on both the appointment page and the patient's own Appointments
card.

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

- **Services** live in `services/<module>/` as `schema.ts`, `rules.ts`,
  `queries.ts`, `commands.ts`, `index.ts`. Reads take an optional `db`; writes
  take a **required** `UnitOfWork`, so a command cannot run outside a transaction.
- **Every write goes through `runCommand`** — one transaction, one `AuditLog`
  row. Two documented exceptions: auth actions and `createOrganizationForUser`,
  both of which predate the existence of an organization context.
- **Services never call `requireOrganizationContext()`.** They receive `ctx`.
- **AI tools** go in `lib/ai/tools/<module>.tools.ts`, never beside the service,
  so "what can the agent do?" is a directory listing.
- **Pages and components may not import `@/lib/db/prisma`** — enforced by ESLint.
  It already caught the onboarding page during development.
- Money is `Decimal(12,2)`, never a float. Timestamps are UTC; the organization's
  timezone governs display.

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
npm test                                      # 61 tests, needs .env.local
npm run typecheck && npm run lint && npm run build
npm run db:seed -- markspector@gmail.com      # refill the demo clinic
npm run db:seed:clear -- markspector@gmail.com # empty it
npx prisma migrate deploy                     # apply migrations
```
