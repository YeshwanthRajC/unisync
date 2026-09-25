import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ToolSchemaError, toolParametersFromZod } from "@/lib/ai/agent/schema";
import { defineTool } from "@/lib/ai/tools/define";
import {
  AI_TOOL_REGISTRY,
  ToolRegistryError,
  buildToolRegistry,
  toolDefinitionsFor,
} from "@/lib/ai/tools";
import type { OrganizationContext } from "@/lib/auth/session";

/**
 * These tests guard the boundary where untrusted model output enters the system.
 *
 * They deliberately exercise the REAL `buildToolRegistry` and the REAL
 * `defineTool` rather than reimplementing their rules, because a test that
 * duplicates the logic it checks passes happily after the logic is removed.
 */

const ctx = {
  organizationId: "org-a",
  profileId: "profile-a",
  organizationName: "Test Clinic",
  role: "OWNER",
} as unknown as OrganizationContext;

function readTool(overrides: Partial<Parameters<typeof defineTool>[0]> = {}) {
  return defineTool({
    name: "find_patient",
    description: "Find a patient in this organization by their full name.",
    permission: "patient.read",
    audit: "patient.read",
    mode: "read",
    input: z.object({
      name: z.string().min(1).describe("The patient's full name"),
    }),
    confirmation: { required: false },
    execute: async ({ input }) => ({ found: input }),
    ...overrides,
  } as Parameters<typeof defineTool>[0]);
}

describe("defineTool", () => {
  it("derives the model-facing declaration from the Zod schema", () => {
    // One source of truth: the declaration cannot drift from the validator.
    const tool = readTool();
    expect(tool.definition.parameters).toEqual({
      type: "object",
      properties: {
        name: { type: "string", description: "The patient's full name" },
      },
      required: ["name"],
    });
  });

  it("returns parse issues to the model instead of throwing", async () => {
    // The agent must be able to correct itself. A thrown error would surface to
    // the user as a crash for what is a recoverable mistake by the model.
    const prepared = readTool().prepare({ name: "" });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.issues.join(" ")).toContain("name");
    }
  });

  it("rejects arguments of the wrong shape entirely", async () => {
    const prepared = readTool().prepare({ unexpected: 42 });
    expect(prepared.ok).toBe(false);
  });

  it("passes the PARSED value to execute, not the raw input", async () => {
    const tool = defineTool({
      name: "coerce_probe",
      description: "A tool that proves execute receives parsed, trusted input.",
      permission: "patient.read",
      audit: "patient.read",
      mode: "read",
      input: z.object({
        count: z.coerce.number().describe("A number that may arrive as a string"),
      }),
      confirmation: { required: false },
      execute: async ({ input }) => input,
    });

    const prepared = tool.prepare({ count: "7" });
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      const result = await prepared.invoke(ctx, { db: {} as never });
      expect(result).toEqual({ count: 7 });
    }
  });

  it("renders a confirmation prompt from the parsed input", () => {
    const tool = defineTool({
      name: "cancel_appointment",
      description: "Cancel a scheduled appointment for a patient in this clinic.",
      permission: "appointment.cancel",
      audit: "appointment.cancel",
      mode: "write",
      input: z.object({
        appointmentId: z.string().describe("The appointment to cancel"),
        reason: z.string().describe("Why it is being cancelled"),
      }),
      confirmation: {
        required: true,
        describe: (input) => `Cancel appointment ${input.appointmentId}?`,
      },
      execute: async () => ({ cancelled: true }),
    });

    const prepared = tool.prepare({ appointmentId: "appt-1", reason: "illness" });
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      // `describe` being callable at all is the fix for the old contract, where
      // it was typed `(input: never) => string` — storable but impossible to call.
      expect(prepared.confirmationPrompt).toBe("Cancel appointment appt-1?");
    }
  });

  it("refuses to invoke a write tool with only a read handle", async () => {
    const tool = defineTool({
      name: "create_thing",
      description: "A write tool used to prove the handle type is enforced.",
      permission: "patient.create",
      audit: "patient.create",
      mode: "write",
      input: z.object({ name: z.string().describe("A name") }),
      confirmation: { required: false },
      execute: async () => ({ created: true }),
    });

    const prepared = tool.prepare({ name: "x" });
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      await expect(prepared.invoke(ctx, { db: {} as never })).rejects.toThrow(
        /must be invoked with a UnitOfWork/,
      );
    }
  });
});

describe("tool registry gates", () => {
  it("contains all registered domain tools", () => {
    expect(Object.keys(AI_TOOL_REGISTRY).length).toBe(22);
    expect(AI_TOOL_REGISTRY.search_patients).toBeDefined();
    expect(AI_TOOL_REGISTRY.schedule_appointment).toBeDefined();
    expect(AI_TOOL_REGISTRY.update_appointment).toBeDefined();
    expect(AI_TOOL_REGISTRY.create_bill).toBeDefined();
    expect(AI_TOOL_REGISTRY.record_stock_movement).toBeDefined();
    expect(AI_TOOL_REGISTRY.schedule_followup).toBeDefined();
    expect(AI_TOOL_REGISTRY.draft_patient_email).toBeDefined();
    expect(AI_TOOL_REGISTRY.send_patient_email).toBeDefined();
  });

  it("REFUSES a tool that claims a human-only permission", () => {
    // The central safety property. If this test ever fails, the agent has been
    // handed the ability to close an appointment.
    expect(() =>
      buildToolRegistry([
        readTool({
          name: "close_appointment",
          permission: "appointment.close",
          audit: "appointment.finish",
        }),
      ]),
    ).toThrow(ToolRegistryError);
  });

  it("REFUSES a tool that confirms a payment", () => {
    expect(() =>
      buildToolRegistry([
        readTool({ name: "confirm_payment", permission: "payment.confirm" }),
      ]),
    ).toThrow(/reserved for people/);
  });

  it("REFUSES a tool that sends a patient email", () => {
    expect(() =>
      buildToolRegistry([
        readTool({ name: "send_email", permission: "patient_email.send" }),
      ]),
    ).toThrow(ToolRegistryError);
  });

  it("REFUSES a forbidden audit action even behind an innocuous permission", () => {
    // The second gate: a tool that asks for `patient.read` but audits as
    // `payment.confirm` is trying to launder a forbidden action.
    expect(() =>
      buildToolRegistry([
        readTool({
          name: "sneaky_tool",
          permission: "patient.read",
          audit: "payment.confirm",
        }),
      ]),
    ).toThrow(/may never perform/);
  });

  it("rejects an unknown permission", () => {
    expect(() =>
      buildToolRegistry([
        readTool({ name: "bogus", permission: "not.a.permission" as never }),
      ]),
    ).toThrow(/unknown permission/);
  });

  it("rejects duplicate tool names", () => {
    expect(() => buildToolRegistry([readTool(), readTool()])).toThrow(
      /already exists/,
    );
  });

  it("rejects a malformed tool name", () => {
    expect(() => buildToolRegistry([readTool({ name: "Bad Name" })])).toThrow(
      /snake_case/,
    );
  });

  it("rejects an argument with no description", () => {
    // The schema converter drops numeric bounds and patterns, so the prose is the
    // only place the model learns what a field expects.
    expect(() =>
      buildToolRegistry([
        readTool({ input: z.object({ name: z.string() }) }),
      ]),
    ).toThrow(/has no description/);
  });

  it("rejects a description too short to choose on", () => {
    expect(() =>
      buildToolRegistry([readTool({ description: "Finds stuff." })]),
    ).toThrow(/too short/);
  });

  it("accepts a well-formed tool", () => {
    const registry = buildToolRegistry([readTool()]);
    expect(Object.keys(registry)).toEqual(["find_patient"]);
  });

  it("shows the model only tools the caller may use", () => {
    const registry = buildToolRegistry([readTool()]);
    const shown = Object.values(registry)
      .filter((tool) => tool.permission === "patient.read")
      .map((tool) => tool.definition.name);
    expect(shown).toEqual(["find_patient"]);
    // And with no permissions, nothing is offered.
    expect(toolDefinitionsFor(() => false)).toEqual([]);
  });
});

describe("Zod to tool-schema conversion", () => {
  it("throws on a union rather than mangling it", () => {
    // A union serialises to `type: ["string","number"]`, which the neutral schema
    // cannot express. Dropping it silently would recreate exactly the drift this
    // converter exists to prevent.
    expect(() =>
      toolParametersFromZod(
        z.object({ value: z.union([z.string(), z.number()]).describe("A value") }),
      ),
    ).toThrow(ToolSchemaError);
  });

  it("throws on a Date", () => {
    expect(() =>
      toolParametersFromZod(z.object({ when: z.date().describe("When") })),
    ).toThrow(ToolSchemaError);
  });

  it("throws when the top level is not an object", () => {
    expect(() => toolParametersFromZod(z.string())).toThrow(ToolSchemaError);
  });

  it("carries string enums through", () => {
    const parameters = toolParametersFromZod(
      z.object({
        status: z.enum(["SCHEDULED", "CANCELLED"]).describe("Appointment status"),
      }),
    );
    expect(parameters.properties.status).toEqual({
      type: "string",
      enum: ["SCHEDULED", "CANCELLED"],
      description: "Appointment status",
    });
  });

  it("marks optional and defaulted fields as not required", () => {
    const parameters = toolParametersFromZod(
      z.object({
        required: z.string().describe("Required"),
        optional: z.string().optional().describe("Optional"),
        defaulted: z.boolean().default(false).describe("Defaulted"),
      }),
    );
    expect(parameters.required).toEqual(["required"]);
  });

  it("handles arrays of scalars", () => {
    const parameters = toolParametersFromZod(
      z.object({ tags: z.array(z.string()).describe("Tags") }),
    );
    expect(parameters.properties.tags).toEqual({
      type: "array",
      items: { type: "string" },
      description: "Tags",
    });
  });
});
