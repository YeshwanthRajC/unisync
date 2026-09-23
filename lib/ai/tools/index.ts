import "server-only";

import type { ErasedTool } from "@/lib/ai/tools/define";
import {
  HUMAN_ONLY_PERMISSIONS,
  PERMISSIONS,
  type Permission,
} from "@/lib/auth/permissions";

/**
 * The tools the AI agent may invoke, keyed by name.
 *
 * Tools are added here as each module's service layer lands. Keeping every tool
 * in one directory is deliberate: the answer to "what can the agent do in this
 * system?" must be a directory listing rather than a repo-wide grep, because that
 * listing is the artefact a security review of this design needs.
 *
 * Registry construction VALIDATES. Every assertion below is a build gate — they
 * run when this module is first imported and are exercised by
 * `tests/ai-tools.test.ts`, so a violation fails CI rather than a user request.
 */

/**
 * Audit actions no tool may ever claim, whatever permission it declares.
 *
 * A defence-in-depth pair with HUMAN_ONLY_PERMISSIONS: that set catches a tool
 * that asks for the permission, this one catches a tool that tries to perform the
 * action while declaring something innocuous.
 */
const FORBIDDEN_AI_ACTIONS: ReadonlySet<string> = new Set([
  "appointment.close",
  "payment.confirm",
  "payment.refund",
  "patient_email.send",
  "patient.delete",
  "bill.void",
]);

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{2,48}$/;

export class ToolRegistryError extends Error {
  constructor(toolName: string, reason: string) {
    super(`AI tool "${toolName}" is not permitted: ${reason}`);
    this.name = "ToolRegistryError";
  }
}

/**
 * Validate a set of tools and index them by name.
 *
 * Exported separately from the registry itself so tests can feed it deliberately
 * invalid tools and assert it rejects them — testing the real gate rather than a
 * copy of its logic.
 */
export function buildToolRegistry(
  tools: readonly ErasedTool[],
): Record<string, ErasedTool> {
  const vocabulary = new Set<string>(PERMISSIONS);
  const registry: Record<string, ErasedTool> = {};

  for (const tool of tools) {
    if (!TOOL_NAME_PATTERN.test(tool.name)) {
      throw new ToolRegistryError(
        tool.name,
        "the name must be snake_case, 3-49 characters, starting with a letter",
      );
    }

    if (registry[tool.name]) {
      throw new ToolRegistryError(tool.name, "a tool with this name already exists");
    }

    if (!vocabulary.has(tool.permission)) {
      throw new ToolRegistryError(
        tool.name,
        `it declares the unknown permission "${tool.permission}"`,
      );
    }

    if (HUMAN_ONLY_PERMISSIONS.has(tool.permission)) {
      throw new ToolRegistryError(
        tool.name,
        `"${tool.permission}" is reserved for people. Closing an appointment, ` +
          "confirming a payment and sending a patient email are decisions a human " +
          "makes; the agent may prepare them and ask, never perform them",
      );
    }

    if (FORBIDDEN_AI_ACTIONS.has(tool.audit)) {
      throw new ToolRegistryError(
        tool.name,
        `it audits as "${tool.audit}", which the agent may never perform`,
      );
    }

    // Tool-selection accuracy is mostly a function of description quality, and
    // the schema converter drops numeric bounds and patterns — so the prose is
    // the only place the model learns a field's constraints.
    if (tool.definition.description.trim().length < 20) {
      throw new ToolRegistryError(
        tool.name,
        "its description is too short for the model to choose it reliably",
      );
    }

    for (const [property, schema] of Object.entries(
      tool.definition.parameters.properties,
    )) {
      if (!schema.description || schema.description.trim().length === 0) {
        throw new ToolRegistryError(
          tool.name,
          `its "${property}" argument has no description — add .describe() in the Zod schema`,
        );
      }
    }

    if (tool.mode === "read" && tool.requiresConfirmation) {
      throw new ToolRegistryError(
        tool.name,
        "a read-only tool must not require confirmation",
      );
    }

    registry[tool.name] = tool;
  }

  return registry;
}

/**
 * Tools registered today.
 *
 * Intentionally empty: each module contributes its tools when its service layer
 * exists, so a tool can never reference a service that has not been written.
 */
const REGISTERED_TOOLS: readonly ErasedTool[] = [];

export const AI_TOOL_REGISTRY: Record<string, ErasedTool> =
  buildToolRegistry(REGISTERED_TOOLS);

/**
 * The subset of tools a caller may use, given a permission predicate.
 *
 * The model is only ever SHOWN tools the user could legitimately invoke. That is
 * a usability measure, not the enforcement point — the agent loop re-checks the
 * permission on every call, because a filtered list protects nobody against a
 * model that invents a tool name.
 */
export function toolDefinitionsFor(
  hasPermission: (permission: Permission) => boolean,
) {
  return Object.values(AI_TOOL_REGISTRY)
    .filter((tool) => hasPermission(tool.permission))
    .map((tool) => tool.definition);
}
