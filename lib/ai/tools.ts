import "server-only";

import type { z } from "zod";

import type { OrganizationContext } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import type { AiToolDefinition } from "@/lib/ai/types";

/**
 * The contract for tools the AI agent may invoke.
 *
 * No tools are registered yet — this file defines the shape they must take, so
 * that the safety rules are structural rather than something each tool author
 * has to remember:
 *
 *   - `permission`  : checked against the caller's role BEFORE execution.
 *   - `input`       : a Zod schema; model-produced arguments are parsed, never
 *                     trusted. A tool never sees unvalidated input.
 *   - `confirmation`: destructive or high-impact tools are not executed on the
 *                     model's say-so. The agent must return a confirmation
 *                     request to the user and be invoked again with explicit
 *                     approval.
 *   - `audit`       : the action name written to the AuditLog.
 *   - `execute`     : receives the resolved OrganizationContext. The tool
 *                     derives organizationId from it, never from its own
 *                     arguments, so the model cannot reach another tenant.
 *
 * The model is handed `definition` only. It never receives a function
 * reference, a database handle, or the ability to compose SQL.
 */

export type ToolConfirmation =
  /** Safe, read-only or trivially reversible. Runs immediately. */
  | { required: false }
  /** Needs explicit user approval; `describe` renders the prompt shown. */
  | { required: true; describe: (input: never) => string };

export type AiTool<TInput = unknown, TOutput = unknown> = {
  definition: AiToolDefinition;
  permission: Permission;
  input: z.ZodType<TInput>;
  confirmation: ToolConfirmation;
  /** Audit action name, e.g. "appointment.cancel". */
  audit: string;
  execute: (args: {
    input: TInput;
    context: OrganizationContext;
  }) => Promise<TOutput>;
};

/**
 * Tools available to the agent, keyed by name.
 *
 * Intentionally empty: tools are added alongside the module they belong to,
 * once that module's service layer exists.
 */
export const AI_TOOL_REGISTRY: Record<string, AiTool> = {};

/**
 * The subset of tools a specific caller may use, filtered by their role.
 * The model is only ever shown tools the user could legitimately invoke.
 */
export function toolDefinitionsFor(
  hasPermission: (permission: Permission) => boolean,
): AiToolDefinition[] {
  return Object.values(AI_TOOL_REGISTRY)
    .filter((tool) => hasPermission(tool.permission))
    .map((tool) => tool.definition);
}
