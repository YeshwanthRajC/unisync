import "server-only";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";

import { mintHumanIntent, type HumanIntent } from "@/lib/auth/human-intent";
import type { Permission } from "@/lib/auth/permissions";
import { requirePermission, type OrganizationContext } from "@/lib/auth/session";
import { mapError } from "@/lib/server/error-mapping";
import { ok, type ActionResult } from "@/lib/server/result";
import { runCommand, type UnitOfWork } from "@/lib/server/unit";

/**
 * The wrapper every Server Action is built from.
 *
 * It is the only place that resolves the session, asserts a permission, parses
 * untrusted input, opens the audited transaction, and mints `HumanIntent`.
 *
 * That last responsibility is the load-bearing one. `mintHumanIntent` is
 * reachable from here and nowhere else, and `lib/ai/**` is forbidden by an ESLint
 * boundary from importing it. Because the three gated services
 * (`closeAppointment`, `confirmPayment`, `sendPatientEmail`) require a
 * `HumanIntent` whose type is branded with a `unique symbol`, an AI tool cannot
 * call them — not because a runtime check rejects it, but because the code does
 * not compile.
 *
 * Actions RETURN failures rather than throwing. A thrown error does not survive
 * the server/client boundary: Next.js replaces the message with a generic one
 * plus a digest in production, so a recoverable validation failure would reach
 * the user as "something went wrong".
 */

type ActionConfig<TInput, TOutput> = {
  /** Audit action name, e.g. "patient.create". */
  audit: string;
  permission: Permission;
  schema: z.ZodType<TInput>;
  entityType?: string;
  /** Paths to refresh after a successful write. */
  revalidate?: (input: TInput, output: TOutput) => string[];
  run: (args: {
    input: TInput;
    ctx: OrganizationContext;
    unit: UnitOfWork;
    intent: HumanIntent;
  }) => Promise<TOutput>;
};

export function action<TInput, TOutput>(
  config: ActionConfig<TInput, TOutput>,
): (raw: unknown) => Promise<ActionResult<TOutput>> {
  return async function runAction(raw: unknown) {
    try {
      const ctx = await requirePermission(config.permission);
      const input = config.schema.parse(raw);

      const output = await runCommand(
        {
          ctx,
          action: config.audit,
          actor: { type: "USER" },
          entityType: config.entityType,
        },
        (unit) => config.run({ input, ctx, unit, intent: mintHumanIntent(ctx) }),
      );

      for (const path of config.revalidate?.(input, output) ?? []) {
        revalidatePath(path);
      }

      return ok(serializePlain(output));
    } catch (error) {
      // MUST come first. `redirect()` and `notFound()` work by throwing, and
      // swallowing them here would turn a redirect into a silent no-op.
      unstable_rethrow(error);

      const mapped = mapError(error, `action:${config.audit}`);
      return {
        ok: false as const,
        error: {
          code: mapped.code,
          message: mapped.message,
          fieldErrors: mapped.fieldErrors,
        },
      };
    }
  };
}

/**
 * A read-only action, for data a client fetches on demand (a search box, a
 * patient picker). No transaction, no audit record, and no `HumanIntent` —
 * reads are not decisions.
 */
export function readAction<TInput, TOutput>(config: {
  name: string;
  permission: Permission;
  schema: z.ZodType<TInput>;
  run: (args: { input: TInput; ctx: OrganizationContext }) => Promise<TOutput>;
}): (raw: unknown) => Promise<ActionResult<TOutput>> {
  return async function runReadAction(raw: unknown) {
    try {
      const ctx = await requirePermission(config.permission);
      const input = config.schema.parse(raw);
      return ok(serializePlain(await config.run({ input, ctx })));
    } catch (error) {
      unstable_rethrow(error);
      const mapped = mapError(error, `read:${config.name}`);
      return {
        ok: false as const,
        error: {
          code: mapped.code,
          message: mapped.message,
          fieldErrors: mapped.fieldErrors,
        },
      };
    }
  };
}

/**
 * Recursively convert any Decimal instances or non-plain class instances into
 * plain serializable values (e.g. Decimal -> string) so they can safely pass
 * the Server Action React Flight boundary to Client Components.
 */
export function serializePlain<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle Decimal objects (Prisma Decimal, decimal.js, etc.)
  if (
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).toFixed === "function" &&
    typeof (value as Record<string, unknown>).toNumber === "function"
  ) {
    return (value as { toString(): string }).toString() as unknown as T;
  }

  // Preserve native Dates (supported by React Flight)
  if (value instanceof Date) {
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(serializePlain) as unknown as T;
  }

  // Handle plain objects and Prisma model instances
  if (typeof value === "object") {
    const plain: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      plain[key] = serializePlain(val);
    }
    return plain as T;
  }

  return value;
}
