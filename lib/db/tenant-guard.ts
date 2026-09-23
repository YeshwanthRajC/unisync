import { Prisma } from "@/lib/db/generated/client";

/**
 * A tripwire that throws when a tenant-scoped query carries no organizationId.
 *
 * This is deliberately a DETECTOR, not an injector. The obvious alternative — a
 * Prisma extension that silently adds `organizationId` to every query — was
 * rejected because it cannot see nested writes: `patient.create({ data: {
 * appointments: { create: [...] } } })` would produce child rows with no tenant
 * filter applied, which is precisely the failure the extension was bought to
 * prevent. It also has to rewrite `findUnique` into `findFirst` to work at all,
 * changing return semantics, and it hides the filter from the reader and from
 * the type checker.
 *
 * Detecting instead means: queries stay legible, return types stay honest, and a
 * forgotten filter fails loudly at the call site that forgot it rather than
 * quietly returning another tenant's rows.
 *
 * It is a backstop, not the mechanism. The mechanism is that services take an
 * `OrganizationContext` and use `orgScope`/`orgWhere`.
 */

/**
 * Models carrying an `organizationId` column.
 *
 * Three groups are intentionally absent:
 *
 *   - `Organization` IS the tenant, and `Profile` is a Supabase Auth user who
 *     may belong to several, so neither can be filtered by one.
 *   - `PrescriptionItem`, `BillItem` and `AIMessage` are child rows with no
 *     independent existence. They are always reached through a parent that IS
 *     scoped, and giving them a redundant organizationId would create a second
 *     copy of the truth that could disagree with the first.
 *
 * Adding a tenant-scoped model without adding it here weakens the backstop, so
 * `tests/tenant-guard.test.ts` reads `prisma/schema.prisma` and asserts this set
 * matches exactly the models that declare an organizationId field.
 */
export const TENANT_SCOPED_MODELS: ReadonlySet<string> = new Set([
  "Membership",
  "AuditLog",
  "Patient",
  "Appointment",
  "Consultation",
  "Prescription",
  "Bill",
  "Payment",
  "InventoryItem",
  "StockMovement",
  "FollowUp",
  "PatientEmail",
  "Notification",
  "AIConversation",
  "AIToolExecution",
]);

/** Operations whose `where` must constrain the tenant. */
const WHERE_SCOPED_OPERATIONS: ReadonlySet<string> = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

/** Operations whose `data` must carry the tenant. */
const DATA_SCOPED_OPERATIONS: ReadonlySet<string> = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
]);

/**
 * `findUnique` is banned on tenant-scoped models by an ESLint rule, because its
 * `where` only accepts unique fields and so cannot express the tenant filter
 * without relying on the id being unguessable. Services use a
 * `get<X>OrThrow` helper built on `findFirst` instead. If one slips through,
 * fail loudly rather than silently allowing a cross-tenant read by id.
 */
const FORBIDDEN_OPERATIONS: ReadonlySet<string> = new Set([
  "findUnique",
  "findUniqueOrThrow",
]);

export class TenantScopeError extends Error {
  readonly status = 500;

  constructor(model: string, operation: string, reason: string) {
    super(
      `Tenant scope violation: ${model}.${operation}() ${reason}. ` +
        "Every tenant-scoped query must filter on organizationId, taken from " +
        "the server-resolved session via orgScope()/orgWhere() in lib/db/scope.ts.",
    );
    this.name = "TenantScopeError";
  }
}

/**
 * Does `organizationId` appear as a constraint in this filter?
 *
 * Looks at the top level and inside `AND` (the two forms our services produce).
 * `OR` and `NOT` are deliberately NOT treated as satisfying the requirement: an
 * `organizationId` inside an `OR` does not constrain the result set to one
 * tenant, so accepting it would make the check worse than useless.
 */
function constrainsTenant(where: unknown, depth = 0): boolean {
  if (depth > 4 || where === null || typeof where !== "object") return false;

  const filter = where as Record<string, unknown>;

  if (filter.organizationId !== undefined) return true;

  const and = filter.AND;
  if (Array.isArray(and)) {
    return and.some((clause) => constrainsTenant(clause, depth + 1));
  }
  if (and !== undefined) return constrainsTenant(and, depth + 1);

  return false;
}

function dataCarriesTenant(data: unknown): boolean {
  if (data === null || typeof data !== "object") return false;

  if (Array.isArray(data)) {
    // createMany: every row must carry it.
    return data.length > 0 && data.every((row) => dataCarriesTenant(row));
  }

  const record = data as Record<string, unknown>;

  // Either the scalar id, or a relation connect.
  return (
    record.organizationId !== undefined || record.organization !== undefined
  );
}

export function tenantTripwire() {
  return Prisma.defineExtension({
    name: "unisync-tenant-tripwire",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          if (FORBIDDEN_OPERATIONS.has(operation)) {
            throw new TenantScopeError(
              model,
              operation,
              "is not allowed on a tenant-scoped model (it cannot express the " +
                "tenant filter); use findFirst with orgWhere() instead",
            );
          }

          const input = (args ?? {}) as Record<string, unknown>;

          if (WHERE_SCOPED_OPERATIONS.has(operation)) {
            if (!constrainsTenant(input.where)) {
              throw new TenantScopeError(
                model,
                operation,
                "was called without organizationId in its where clause",
              );
            }
          }

          if (DATA_SCOPED_OPERATIONS.has(operation)) {
            if (!dataCarriesTenant(input.data)) {
              throw new TenantScopeError(
                model,
                operation,
                "was called without organizationId in its data",
              );
            }
          }

          if (operation === "upsert") {
            if (!constrainsTenant(input.where)) {
              throw new TenantScopeError(
                model,
                operation,
                "was called without organizationId in its where clause",
              );
            }
            if (!dataCarriesTenant(input.create)) {
              throw new TenantScopeError(
                model,
                operation,
                "was called without organizationId in its create data",
              );
            }
          }

          return query(args);
        },
      },
    },
  });
}
