# UniSync

A multi-tenant SaaS web app that gives a small organization one place to run
its administrative work — customers/patients, appointments, billing, reminders
and follow-ups, and inventory — with an AI assistant that can carry out those
tasks on the user's behalf.

The first version is modeled around a **dental clinic**, but the architecture
is multi-tenant and organization-type aware so other kinds of small
organization can be supported later.

> **Status: foundation only.** The development environment, database schema for
> tenancy, auth plumbing, and the AI abstraction layer are in place. No
> business modules are implemented yet.

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
| `GEMINI_MODEL` | Optional; defaults to `gemini-2.5-flash` |

Anything named `NEXT_PUBLIC_*` is compiled into the browser bundle and is
therefore public. Never give a secret one of those names.

## Set up the database

Once `DIRECT_URL` points at your Supabase project:

```bash
npm run db:migrate    # create and apply the first migration
```

For quick local iteration without a migration file, `npm run db:push` works
too. Use `npm run db:studio` to browse the data.

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
```

There is no test suite yet.

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
    tools.ts            AI tool contract + registry (empty by design)
  auth/
    session.ts          who is calling, in which organization
    permissions.ts      role to permission mapping
    errors.ts           401 / 403 error types
  db/
    prisma.ts           the single PrismaClient in the codebase
    generated/          generated client (gitignored)
  supabase/
    client.ts           browser client
    server.ts           server client + admin client
    proxy.ts            session refresh helper
  env.ts                validated environment access
  utils.ts              shadcn `cn` helper
prisma/
  schema.prisma         database schema
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
