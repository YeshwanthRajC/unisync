import { z } from "zod";

import type {
  AiObjectParameterSchema,
  AiToolParameterSchema,
} from "@/lib/ai/types";

/**
 * Derive a tool's argument declaration from its Zod schema.
 *
 * Without this, every tool declares its arguments twice — once as a Zod schema
 * for validation and once as an `AiObjectParameterSchema` for the model. That is
 * not merely verbose, it is a correctness hazard, and it fails in the least
 * visible direction: the model is told a field is optional while Zod requires it,
 * so the model confidently produces arguments that can never parse and the agent
 * loops until it hits the turn cap. Nobody sees a stack trace; the assistant just
 * seems stupid.
 *
 * One source of truth removes that class of bug entirely.
 *
 * Zod 4 ships `toJSONSchema`, so this is a NARROWING job rather than a traversal:
 * generate standard JSON Schema, then reject anything the neutral provider type
 * cannot express. Throwing is deliberate — silently dropping an unrepresentable
 * constraint would recreate the drift this function exists to prevent. The errors
 * surface at registry construction (a build gate), never on a user request.
 */

export class ToolSchemaError extends Error {
  constructor(path: string, reason: string) {
    super(
      `Tool argument schema is not representable at "${path}": ${reason}. ` +
        "Model tool inputs as flat objects of scalars, enums and arrays; put " +
        "cross-field rules in .describe() prose and enforce them server-side.",
    );
    this.name = "ToolSchemaError";
  }
}

const SCALAR_TYPES = new Set([
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
]);

export function toolParametersFromZod(
  schema: z.ZodType,
): AiObjectParameterSchema {
  let generated: unknown;

  try {
    generated = z.toJSONSchema(schema, {
      target: "draft-7",
      // The model produces INPUT, so defaults are optional rather than present.
      io: "input",
      unrepresentable: "throw",
      cycles: "throw",
      reused: "inline",
    });
  } catch (cause) {
    throw new ToolSchemaError(
      "$",
      cause instanceof Error ? cause.message : "could not be converted",
    );
  }

  const narrowed = narrow(generated, "$");

  if (narrowed.type !== "object" || !narrowed.properties) {
    throw new ToolSchemaError(
      "$",
      "the top level must be an object (providers model tool arguments as a named set)",
    );
  }

  return {
    type: "object",
    ...(narrowed.description ? { description: narrowed.description } : {}),
    properties: narrowed.properties,
    ...(narrowed.required?.length ? { required: narrowed.required } : {}),
  };
}

function narrow(node: unknown, path: string): AiToolParameterSchema {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    throw new ToolSchemaError(path, "expected a schema object");
  }

  const input = node as Record<string, unknown>;

  for (const unsupported of ["anyOf", "oneOf", "allOf", "not", "$ref"]) {
    if (input[unsupported] !== undefined) {
      throw new ToolSchemaError(
        path,
        `"${unsupported}" has no equivalent in the neutral tool schema`,
      );
    }
  }

  const rawType = input.type;

  if (Array.isArray(rawType)) {
    // A Zod union serialises to `type: ["string","number"]`. The neutral schema
    // carries a single type, and widening it would complicate every provider
    // mapper for a construct the model handles badly anyway.
    throw new ToolSchemaError(
      path,
      `a union of types (${rawType.join(" | ")}) is not supported; use a single type with an enum`,
    );
  }

  if (typeof rawType !== "string" || !SCALAR_TYPES.has(rawType)) {
    throw new ToolSchemaError(
      path,
      rawType === undefined
        ? "no type was produced (an unconstrained or transformed schema)"
        : `unsupported type "${String(rawType)}"`,
    );
  }

  const type = rawType as AiToolParameterSchema["type"];
  const result: AiToolParameterSchema = { type };

  if (typeof input.description === "string" && input.description.length > 0) {
    result.description = input.description;
  }

  if (input.enum !== undefined) {
    if (
      !Array.isArray(input.enum) ||
      !input.enum.every((value) => typeof value === "string")
    ) {
      throw new ToolSchemaError(
        path,
        "only string enums are supported (numeric enums confuse tool-calling models)",
      );
    }
    result.enum = input.enum;
  }

  if (type === "array") {
    if (Array.isArray(input.items)) {
      throw new ToolSchemaError(path, "tuple types are not supported");
    }
    if (input.items === undefined) {
      throw new ToolSchemaError(path, "an array must declare its item type");
    }
    result.items = narrow(input.items, `${path}[]`);
  }

  if (type === "object") {
    const properties = input.properties;
    if (properties === undefined || typeof properties !== "object") {
      throw new ToolSchemaError(
        path,
        "an object must declare its properties (a free-form record is not supported)",
      );
    }

    result.properties = Object.fromEntries(
      Object.entries(properties as Record<string, unknown>).map(
        ([key, value]) => [key, narrow(value, `${path}.${key}`)],
      ),
    );

    if (Array.isArray(input.required)) {
      result.required = input.required.filter(
        (value): value is string => typeof value === "string",
      );
    }
  }

  /*
   * Numeric bounds, string lengths and patterns are intentionally dropped: the
   * neutral schema has no place for them, and Zod still enforces every one of
   * them server-side, so nothing becomes less safe. What IS lost is the model's
   * awareness of the constraint — which is why the registry requires every
   * property to carry a description, so the author states it in prose.
   */

  return result;
}
