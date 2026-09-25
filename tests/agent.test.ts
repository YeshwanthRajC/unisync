import { describe, expect, it } from "vitest";

import { runAgentTurn } from "@/lib/ai/agent";
import type {
  AiGenerateRequest,
  AiGenerateResult,
  LlmProvider,
} from "@/lib/ai/types";
import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const mockCtx = {
  organizationId: "99999999-9999-4999-9999-999999999999",
  profileId: "88888888-8888-4888-8888-888888888888",
  organizationName: "Test Clinic",
  role: "OWNER",
} as unknown as OrganizationContext;

class MockLlmProvider implements LlmProvider {
  readonly id = "mock";
  readonly defaultModel = "mock-model";

  private responses: AiGenerateResult[];
  public capturedRequests: AiGenerateRequest[] = [];

  constructor(responses: AiGenerateResult[]) {
    this.responses = [...responses];
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    this.capturedRequests.push(request);
    const next = this.responses.shift();
    if (!next) {
      return {
        text: "Default response",
        toolCalls: [],
        model: "mock-model",
      };
    }
    return next;
  }
}

describe("runAgentTurn", () => {
  it("completes a basic conversational turn without tools", async () => {
    const provider = new MockLlmProvider([
      {
        text: "Hello! I am UniSync Assistant. How can I help your clinic today?",
        toolCalls: [],
        model: "mock-model",
      },
    ]);

    const result = await runAgentTurn({
      ctx: mockCtx,
      messages: [{ role: "user", content: "Hi" }],
      db: prisma,
      provider,
    });

    expect(result.message).toContain("Hello! I am UniSync Assistant");
    expect(result.confirmationRequired).toBeNull();
    expect(result.toolExecutions).toHaveLength(0);
    expect(result.updatedMessages).toHaveLength(2);
  });

  it("executes a read tool and passes result back to the model", async () => {
    const provider = new MockLlmProvider([
      {
        text: "Let me check the inventory for low stock.",
        toolCalls: [
          {
            id: "call-1",
            name: "check_low_stock",
            arguments: { includeDetails: false },
          },
        ],
        model: "mock-model",
      },
      {
        text: "There are currently 0 items below the reorder point.",
        toolCalls: [],
        model: "mock-model",
      },
    ]);

    const result = await runAgentTurn({
      ctx: mockCtx,
      messages: [{ role: "user", content: "Do we have any low stock items?" }],
      db: prisma,
      provider,
    });

    expect(result.message).toContain("0 items below the reorder point");
    expect(result.toolExecutions).toHaveLength(1);
    expect(result.toolExecutions[0]!.toolName).toBe("check_low_stock");
    expect(result.confirmationRequired).toBeNull();
  });

  it("pauses and requests user confirmation for destructive/write tools", async () => {
    const provider = new MockLlmProvider([
      {
        text: "I will cancel this appointment for you.",
        toolCalls: [
          {
            id: "call-cancel-1",
            name: "cancel_appointment",
            arguments: {
              appointmentId: "11111111-1111-4111-1111-111111111111",
              cancellationReason: "Patient called to reschedule",
            },
          },
        ],
        model: "mock-model",
      },
    ]);

    const result = await runAgentTurn({
      ctx: mockCtx,
      messages: [{ role: "user", content: "Please cancel appointment 11111111-1111-4111-1111-111111111111" }],
      db: prisma,
      provider,
    });

    expect(result.confirmationRequired).toBeDefined();
    expect(result.confirmationRequired?.toolName).toBe("cancel_appointment");
    expect(result.confirmationRequired?.prompt).toContain("Cancel appointment ID");
    expect(result.toolExecutions).toHaveLength(0);
  });

  it("handles user rejection of a confirmation prompt gracefully", async () => {
    const provider = new MockLlmProvider([
      {
        text: "I will cancel this appointment for you.",
        toolCalls: [
          {
            id: "call-cancel-1",
            name: "cancel_appointment",
            arguments: {
              appointmentId: "11111111-1111-4111-1111-111111111111",
            },
          },
        ],
        model: "mock-model",
      },
      {
        text: "Understood. The appointment was not cancelled.",
        toolCalls: [],
        model: "mock-model",
      },
    ]);

    const result = await runAgentTurn({
      ctx: mockCtx,
      messages: [{ role: "user", content: "Cancel the appointment" }],
      db: prisma,
      provider,
      confirmedCall: {
        toolCallId: "call-cancel-1",
        confirmed: false,
      },
    });

    expect(result.message).toContain("Understood. The appointment was not cancelled.");
    expect(result.toolExecutions).toHaveLength(1);
    expect(result.toolExecutions[0]!.result).toEqual({
      cancelled: true,
      message: "User declined to confirm this action.",
    });
  });

  it("preserves thoughtSignature on toolCalls during multi-turn tool execution", async () => {
    const provider = new MockLlmProvider([
      {
        text: "Checking patients...",
        toolCalls: [
          {
            id: "call-search-1",
            name: "search_patients",
            arguments: { query: "John" },
            thoughtSignature: "sig-test-12345",
          },
        ],
        model: "gemini-3.5-flash-lite",
      },
      {
        text: "Found 0 matching patients.",
        toolCalls: [],
        model: "gemini-3.5-flash-lite",
      },
    ]);

    const result = await runAgentTurn({
      ctx: mockCtx,
      messages: [{ role: "user", content: "Search for John" }],
      db: prisma,
      provider,
    });

    expect(result.message).toContain("Found 0 matching patients.");
    // In turn 2, the assistant message should preserve the thoughtSignature
    const assistantMsg = result.updatedMessages.find(
      (m) => m.role === "assistant" && m.toolCalls?.length,
    );
    expect(assistantMsg).toBeDefined();
    if (assistantMsg && "toolCalls" in assistantMsg) {
      expect(assistantMsg.toolCalls?.[0]?.thoughtSignature).toBe("sig-test-12345");
    }
  });

  it("resumes and completes turn when user confirms an action using updatedMessages", async () => {
    const turn1Provider = new MockLlmProvider([
      {
        text: "I will cancel this appointment.",
        toolCalls: [
          {
            id: "call-cancel-step-1",
            name: "cancel_appointment",
            arguments: {
              appointmentId: "11111111-1111-4111-1111-111111111111",
              cancellationReason: "Patient called to cancel",
            },
          },
        ],
        model: "gemini-3.5-flash-lite",
      },
    ]);

    // Turn 1: user asks to cancel, agent pauses for confirmation
    const turn1Result = await runAgentTurn({
      ctx: mockCtx,
      messages: [{ role: "user", content: "Cancel appointment 11111111-1111-4111-1111-111111111111" }],
      db: prisma,
      provider: turn1Provider,
    });

    expect(turn1Result.confirmationRequired).toBeDefined();
    expect(turn1Result.confirmationRequired?.toolCallId).toBe("call-cancel-step-1");
    expect(turn1Result.updatedMessages).toHaveLength(2); // user + assistant with toolCalls

    // Turn 2: user confirms. Provider generates the assistant response to the tool execution.
    const turn2Provider = new MockLlmProvider([
      {
        text: "Appointment 11111111-1111-4111-1111-111111111111 has been successfully cancelled.",
        toolCalls: [],
        model: "gemini-3.5-flash-lite",
      },
    ]);

    const turn2Result = await runAgentTurn({
      ctx: mockCtx,
      messages: turn1Result.updatedMessages,
      db: prisma,
      provider: turn2Provider,
      confirmedCall: {
        toolCallId: turn1Result.confirmationRequired!.toolCallId,
        confirmed: true,
      },
    });

    expect(turn2Result.confirmationRequired).toBeNull();
    expect(turn2Result.message).toContain("successfully cancelled");
    expect(turn2Result.toolExecutions).toHaveLength(1);
    expect(turn2Result.toolExecutions[0]?.toolName).toBe("cancel_appointment");

    // Verify conversation transcript has all 4 steps in order: user -> assistant(call) -> tool(result) -> assistant(reply)
    expect(turn2Result.updatedMessages).toHaveLength(4);
    expect(turn2Result.updatedMessages[0]?.role).toBe("user");
    expect(turn2Result.updatedMessages[1]?.role).toBe("assistant");
    expect(turn2Result.updatedMessages[2]?.role).toBe("tool");
    expect(turn2Result.updatedMessages[3]?.role).toBe("assistant");
  });

  it("resumes and completes turn when user declines an action using updatedMessages", async () => {
    const turn1Provider = new MockLlmProvider([
      {
        text: "I will cancel this appointment.",
        toolCalls: [
          {
            id: "call-cancel-step-2",
            name: "cancel_appointment",
            arguments: {
              appointmentId: "11111111-1111-4111-1111-111111111111",
            },
          },
        ],
        model: "gemini-3.5-flash-lite",
      },
    ]);

    const turn1Result = await runAgentTurn({
      ctx: mockCtx,
      messages: [{ role: "user", content: "Cancel appointment" }],
      db: prisma,
      provider: turn1Provider,
    });

    expect(turn1Result.confirmationRequired).toBeDefined();

    const turn2Provider = new MockLlmProvider([
      {
        text: "No problem. The cancellation was aborted.",
        toolCalls: [],
        model: "gemini-3.5-flash-lite",
      },
    ]);

    const turn2Result = await runAgentTurn({
      ctx: mockCtx,
      messages: turn1Result.updatedMessages,
      db: prisma,
      provider: turn2Provider,
      confirmedCall: {
        toolCallId: turn1Result.confirmationRequired!.toolCallId,
        confirmed: false,
      },
    });

    expect(turn2Result.confirmationRequired).toBeNull();
    expect(turn2Result.message).toContain("cancellation was aborted");
    expect(turn2Result.toolExecutions).toHaveLength(1);
    expect(turn2Result.toolExecutions[0]?.result).toEqual({
      cancelled: true,
      message: "User declined to confirm this action.",
    });
    expect(turn2Result.updatedMessages).toHaveLength(4);
    expect(turn2Result.updatedMessages[2]?.role).toBe("tool");
  });
});
