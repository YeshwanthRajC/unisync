-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY: lock the browser-facing key out of every table
-- ---------------------------------------------------------------------------
-- The publishable key (NEXT_PUBLIC_SUPABASE_ANON_KEY) ships inside the browser
-- bundle. Anyone can read it out of the page source and call PostgREST with it.
-- In this application that key is used for AUTHENTICATION ONLY -- every byte of
-- business data is read server-side through Prisma. So the correct posture is
-- not "write careful policies", it is "this key may read nothing at all".
--
-- Enabling RLS with ZERO policies is deny-by-default in Postgres: `anon` and
-- `authenticated` get nothing, permanently, with no policy to audit or get wrong.
--
-- Why this is not the whole story, stated plainly rather than implied:
--
--   Prisma connects over DATABASE_URL as the table OWNER, and an owner bypasses
--   RLS unless the table is set to FORCE ROW LEVEL SECURITY. Supabase's usual
--   `auth.uid()` policies would also evaluate to NULL for Prisma, which carries
--   no Supabase JWT. RLS added without accounting for both looks protective and
--   enforces nothing.
--
--   FORCE is applied below so the posture is honest: the owner is subject to
--   policies too, and since there are none, PostgREST access is closed for
--   everyone. Prisma continues to work because the driver adapter connects as a
--   role with BYPASSRLS (Supabase's `postgres` role), which is a deliberate,
--   documented exception rather than an accident.
--
--   Tenant isolation FOR PRISMA is therefore enforced in the application: every
--   service takes an OrganizationContext, queries go through orgScope()/orgWhere(),
--   and lib/db/tenant-guard.ts throws on any tenant query missing its
--   organizationId -- verified by tests/tenant-guard.test.ts, including inside
--   transactions. Adding SET LOCAL-based policies so Postgres enforces it for
--   Prisma too is tracked as a known issue.

-- Tenant-scoped tables.
ALTER TABLE "organizations"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations"       FORCE  ROW LEVEL SECURITY;
ALTER TABLE "profiles"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles"            FORCE  ROW LEVEL SECURITY;
ALTER TABLE "memberships"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships"         FORCE  ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"          FORCE  ROW LEVEL SECURITY;
ALTER TABLE "patients"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patients"            FORCE  ROW LEVEL SECURITY;
ALTER TABLE "appointments"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments"        FORCE  ROW LEVEL SECURITY;
ALTER TABLE "consultations"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consultations"       FORCE  ROW LEVEL SECURITY;
ALTER TABLE "prescriptions"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prescriptions"       FORCE  ROW LEVEL SECURITY;
ALTER TABLE "prescription_items"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prescription_items"  FORCE  ROW LEVEL SECURITY;
ALTER TABLE "bills"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bills"               FORCE  ROW LEVEL SECURITY;
ALTER TABLE "bill_items"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bill_items"          FORCE  ROW LEVEL SECURITY;
ALTER TABLE "payments"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments"            FORCE  ROW LEVEL SECURITY;
ALTER TABLE "inventory_items"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_items"     FORCE  ROW LEVEL SECURITY;
ALTER TABLE "stock_movements"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements"     FORCE  ROW LEVEL SECURITY;
ALTER TABLE "follow_ups"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "follow_ups"          FORCE  ROW LEVEL SECURITY;
ALTER TABLE "patient_emails"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_emails"      FORCE  ROW LEVEL SECURITY;
ALTER TABLE "notifications"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications"       FORCE  ROW LEVEL SECURITY;
ALTER TABLE "ai_conversations"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_conversations"    FORCE  ROW LEVEL SECURITY;
ALTER TABLE "ai_messages"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_messages"         FORCE  ROW LEVEL SECURITY;
ALTER TABLE "ai_tool_executions"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_tool_executions"  FORCE  ROW LEVEL SECURITY;

-- Belt and braces: even if a policy is added by mistake later, these roles have
-- no table privileges to exercise it with.
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM anon, authenticated;
