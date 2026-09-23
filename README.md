# UniSync

A multi-tenant SaaS web app that gives a small organization one place to run
its administrative work — customers/patients, appointments, billing, reminders
and follow-ups, and inventory — with an AI assistant that can carry out those
tasks on the user's behalf.

The first version is modeled around a **dental clinic**, but the architecture
is multi-tenant and organization-type aware so other kinds of small
organization can be supported later.

> **Status: server foundation and database complete.** The full domain schema
> (20 tables), the audited command layer, tenant isolation, the AI tool
> contract, and the manual-gate constraints are in place and tested. The user
> interface and the module service layers are being built now.

For the deeper engineering context — architecture, data model, AI safety
rules, and the record of why things were built this way — see
[`CLAUDE.md`](./CLAUDE.md).

---

## Tech stack

| | |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | PostgreSQL on Supabase, via Prisma 7 |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| AI | Google Gemini, behind a swappable provider interface |
| Hosting | Vercel + Supabase |

## Requirements

- **Node.js 20.6 or newer** (22 LTS recommended — the Prisma config uses the
  built-in `process.loadEnvFile`)
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
| `GEMINI_MODEL` | Optional; defaults to `gemini-3.6-flash` |

Anything named `NEXT_PUBLIC_*` is compiled into the browser bundle and is
therefore public. Never give a secret one of those names.

## Set up the database

Once `DIRECT_URL` points at your Supabase project:

```bash
npx prisma migrate deploy    # apply all migrations
```

`prisma migrate dev` is interactive and does not run in every environment. To
create a new migration, generate the SQL and apply it:

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

Open <http://localhost:3000>. The home page shows which dependencies are
configured; <http://localhost:3000/api/health> additionally checks that the
database is reachable.

## Commands

```bash
npm run dev          # development server
npm run build        # production build
npm start            # serve the production build
npm run lint         # ESLint
npm run typecheck    # TypeScript, no emit
npm run db:generate  # regenerate the Prisma client
npm run db:migrate   # create + apply a migration
npm run db:push      # push schema without a migration (dev only)
npm run db:studio    # browse the database
npm run db:seed      # sample clinic (dev only; pass your signup email)
npm test             # Vitest, single run
npm run test:watch   # Vitest, watch mode
```

The test suite covers server logic only — the permission matrix, tenant
isolation, AI tool validation, and the manual-gate rules that keep appointment
closure, payment confirmation and email sending in human hands. It runs against
the real development database, so `.env.local` must be configured first. There is
no browser end-to-end suite.

## Project structure

```text
app/                    Next.js App Router
  api/health/           dependency + connectivity check
  layout.tsx            root layout
  page.tsx              temporary bring-up status page
components/
  ui/                   shadcn/ui components (ours to edit)
lib/
  ai/                   LLM abstraction — swap providers here, nowhere else
    types.ts            provider-agnostic contract (no vendor SDK)
    gemini.ts           the only file that imports the Gemini SDK
    provider.ts         resolves the active provider
    agent/schema.ts     derives tool declarations from Zod schemas
    tools/define.ts     defineTool(): parse, erase the generic, invoke
    tools/index.ts      the registry and its build-time safety assertions
  auth/
    session.ts          who is calling, in which organization
    permissions.ts      role to permission mapping
    human-intent.ts     the token the AI layer cannot construct
    errors.ts           401 / 403 error types
  server/
    action.ts           Server Action wrapper; the only minter of HumanIntent
    unit.ts             runCommand(): one transaction, one audit record
    guard.ts            Server Component guard
    route.ts            Route Handler error mapping
    result.ts           ActionResult<T>, shared with the client
    errors.ts           404 / 409 / 422 domain errors
  db/
    prisma.ts           the single PrismaClient in the codebase
    scope.ts            orgScope() / orgWhere()
    tenant-guard.ts     throws on any unscoped tenant query
    generated/          generated client (gitignored)
  supabase/             browser, server and session-refresh clients
  env.ts                validated environment access
services/<module>/      business logic (schema, rules, queries, commands)
prisma/
  schema.prisma         database schema
  migrations/           tenancy, domain modules, RLS lockdown
  seed.ts               development sample clinic
tests/                  Vitest: permissions, tenancy, AI tool safety
proxy.ts                runs per request; refreshes the Supabase session
prisma.config.ts        Prisma CLI config (loads .env.local, direct DB URL)
docs/                   longer-form design notes
```

The `(auth)` and `(dashboard)` route groups will be added with the
authentication module.

## How it fits together

Requests flow: **browser → Next.js → server-side business logic → application
tools → database.**

Two rules the codebase is built around:

1. **Authorization happens on the server, where data is read.** Route-level
   gating is not the security boundary. Every tenant-scoped query takes its
   `organizationId` from the verified session, never from request input.
2. **The AI agent has no special access.** It calls the same tools a human
   user's actions call, with the same permission checks, argument validation,
   and audit logging. It cannot run SQL, cannot pick its own organization, and
   must ask for confirmation before anything destructive.
