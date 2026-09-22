# Connecting UniSync to Supabase

Step-by-step for wiring a Supabase project to a local checkout. Everything here
goes into `.env.local`, which is gitignored.

## 1. Create the project

In the [Supabase dashboard](https://supabase.com/dashboard), create a project.
Choose a region close to your users — it sets the database latency, and moving
later means a migration.

Save the database password shown at creation time. Supabase does not display it
again; you can reset it from **Project Settings → Database**, but a reset
invalidates existing connection strings.

## 2. API credentials

**Project Settings → Data API**:

| Field | Goes to |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` / publishable key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` — optional |

The anon key is designed to be public; it is constrained by Row Level Security.

The `service_role` key **bypasses RLS entirely**. Leave it blank unless a
server-side task genuinely needs administrative privileges. It must never be
given a `NEXT_PUBLIC_` name, and never reaches the AI agent.

## 3. Database connection strings

**Project Settings → Database → Connection string**. You need two, and they are
not interchangeable:

| Variable | Which string | Port | Used by |
| --- | --- | --- | --- |
| `DATABASE_URL` | Transaction pooler | 6543 | Application queries at runtime |
| `DIRECT_URL` | Session / direct | 5432 | Prisma migrations only |

Append `?pgbouncer=true&connection_limit=1` to `DATABASE_URL`. Serverless
functions open many short-lived connections; without the pooler they exhaust
Postgres' connection limit, and without `pgbouncer=true` Prisma will try to use
prepared statements the transaction pooler does not support.

The pooler cannot reliably run DDL or hold advisory locks, which is why
migrations need the direct connection. See `prisma.config.ts`.

Replace the `[YOUR-PASSWORD]` placeholder in each string with your database
password. If the password contains `@`, `:`, `/` or `?`, URL-encode it.

## 4. Apply the schema

```bash
npm run db:generate
npm run db:migrate
```

This creates `organizations`, `profiles`, `memberships`, and `audit_logs`.

## 5. Verify

```bash
npm run dev
curl http://localhost:3000/api/health
```

A configured project reports:

```json
{ "status": "ready",
  "dependencies": {
    "supabase": { "configured": true },
    "database": { "configured": true, "reachable": true },
    "gemini":   { "configured": true } } }
```

If `database.reachable` is `false`, the `detail` field carries the first line
of the connection error. Common causes: the password placeholder was not
replaced, a special character was not URL-encoded, or the pooled and direct
ports were swapped.

## Still outstanding

**Row Level Security policies have not been written.** Tenant isolation is
enforced in the application layer today (see `lib/auth/session.ts`). RLS is the
backstop for an application-layer mistake and must be added before production.

**Storage buckets are not configured.** Patient documents will need a
per-organization bucket layout with matching policies.
