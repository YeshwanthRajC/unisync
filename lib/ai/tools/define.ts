import "server-only";

import type { z } from "zod";

import { toolParametersFromZod } from "@/lib/ai/agent/schema";
import type { AiToolDefinition } from "@/lib/ai/types";
import type { Permission } from "@/lib/auth/permissions";
import type { OrganizationContext } from "@/lib/auth/session";
import type { Db } from "@/lib/db/types";
import type { UnitOfWork } from "@/lib/server/unit";

/**
 * The contract for tools the AI agent may invoke.
 *
 * The safety rules are structural rather than something each tool author has to
 * remember:
 *
 *   - `permission`  : re-checked against the caller's role BEFORE execution.
 *   - `input`       : a Zod schema; model-produced arguments are parsed, never
 *                     trusted. A tool never sees unvalidated input.
 *   - `confirmation`: high-impact tools are not executed on the model's say-so.
 *   - `audit`       : the action name written to the AuditLog.
 *   - `execute`     : receives the resolved OrganizationContext. The tool derives
 *                     organizationId from it, never from its own arguments, so
 *                     the model cannot reach another tenant.
 *
 * The model is handed `definition` only — never a function reference, a database
 * handle, or the ability to compose SQL.
 *
 * Note what is absent: there is no tool for closing an appointment, confirming a
 * payment or sending a patient email, and none can be written. Those services
 * require a `HumanIntent` that this layer cannot construct, so such a tool would
 * fail to compile. See `lib/auth/human-intent.ts`.
 */

/** A read tool gets a database handle; a write tool gets the audited transaction. */
export type ToolExecuteArgs<TInput> =
  | { input: TInput; ctx: OrganizationContext; mode: "read"; db: Db }
  | { input: TInput; ctx: OrganizationContext; mode: "write"; unit: UnitOfWork };

export type ToolSpec<TInput, TOutput> = {
  /** snake_case, matching /^[a-z][a-z0-9_]{2,48}$/ — providers are strict here. */
  name: string;
  /** Written for the model. Tool-selection accuracy mostly lives in this string. */
  description: string;
  permission: Permission;
  /** AuditLog action name, e.g. "appointment.reschedule". */
  audit: string;
  mode: "read" | "write";
  /**
   * An object schema. The model's arguments are parsed with it, and the
   * declaration shown to the model is DERIVED from it, so the two cannot drift.
   */
  input: z.ZodType<TInput>;
  /** Escape hatch for the rare schema the converter cannot express. */
  parameters?: AiToolDefinition["parameters"];
  confirmation:
    | { required: false }
    | { required: true; describe: (input: TInput) => string };
  execute: (args: ToolExecuteArgs<TInput>) => Promise<TOutput>;
};

/**
 * The result of validating a model-produced call.
 *
 * A parse failure is DATA, not an exception: the issues are handed back to the
 * model so it can correct itself, rather than thrown at the user as a crash.
 */
export type PreparedCall =
  | { ok: false; issues: string[] }
  | {
      ok: true;
      /** The parsed arguments, for the audit record and the execution row. */
      input: unknown;
      /** Non-null when the user must approve before this runs. */
      confirmationPrompt: string | null;
      invoke: (
        ctx: OrganizationContext,
        handle: { db: Db } | { unit: UnitOfWork },
      ) => Promise<unknown>;
    };

/**
 * A tool with its generic erased, so a heterogeneous registry can hold it.
 */
export type ErasedTool = {
  readonly name: string;
  readonly definition: AiToolDefinition;
  readonly permission: Permission;
  readonly audit: string;
  readonly mode: "read" | "write";
  readonly requiresConfirmation: boolean;
  prepare(raw: unknown): PreparedCall;
};

/**
 * Build an `ErasedTool` from a typed spec.
 *
 * This factory exists because a concrete `AiTool<{ id: string }>` is NOT
 * assignable to `AiTool<unknown>`: `execute` is an arrow-typed property, so
 * `strictFunctionTypes` checks it contravariantly and `{ input: unknown }` is not
 * accepted where `{ input: { id: string } }` is expected. The old contract also
 * typed `describe` as `(input: never) => string`, which is storable but
 * impossible to call.
 *
 * The generic is erased by CLOSURE rather than by assignment: `prepare` parses,
 * and returns an `invoke` that closes over the parsed value while `TInput` is
 * still in scope. No cast, no `any`, and the contravariant `execute` never
 * appears in the erased type — so the validation guarantee survives exactly at
 * the boundary where untrusted input enters.
 */
export function defineTool<TInput, TOutput>(
  spec: ToolSpec<TInput, TOutput>,
): ErasedTool {
  const parameters = spec.parameters ?? toolParametersFromZod(spec.input);

  return {
    name: spec.name,
    definition: {
      name: spec.name,
      description: spec.description,
      parameters,
    },
    permission: spec.permission,
    audit: spec.audit,
    mode: spec.mode,
    requiresConfirmation: spec.confirmation.required,

    prepare(raw: unknown): PreparedCall {
      const parsed = spec.input.safeParse(raw);

      if (!parsed.success) {
        return {
          ok: false,
          issues: parsed.error.issues.map((issue) => {
            const where = issue.path.length > 0 ? issue.path.join(".") : "(root)";
            return `${where}: ${issue.message}`;
          }),
        };
      }

      const input = parsed.data;

      return {
        ok: true,
        input,
        confirmationPrompt: spec.confirmation.required
          ? spec.confirmation.describe(input)
          : null,
        // `async` so a misuse surfaces as a rejected promise rather than a
        // synchronous throw. The agent loop awaits every invocation, and a
        // caller should not have to guard both forms.
        async invoke(ctx, handle) {
          if (spec.mode === "write") {
            if (!("unit" in handle)) {
              throw new Error(
                `Tool "${spec.name}" is a write tool and must be invoked with a UnitOfWork.`,
              );
            }
            return spec.execute({ input, ctx, mode: "write", unit: handle.unit });
          }
          if (!("db" in handle)) {
            throw new Error(
              `Tool "${spec.name}" is a read tool and must be invoked with a Db handle.`,
            );
          }
          return spec.execute({ input, ctx, mode: "read", db: handle.db });
        },
      };
    },
  };
}
