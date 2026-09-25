import "server-only";

import { getLlmProvider } from "@/lib/ai/provider";
import { AI_TOOL_REGISTRY, toolDefinitionsFor } from "@/lib/ai/tools";
import type { AiMessage, AiToolCall, LlmProvider } from "@/lib/ai/types";
import { roleHasPermission } from "@/lib/auth/permissions";
import type { OrganizationContext } from "@/lib/auth/session";
import type { Db } from "@/lib/db/types";
import { runCommand } from "@/lib/server/unit";

export type AgentConfirmationRequest = {
  toolCallId: string;
  toolName: string;
  prompt: string;
  input: unknown;
};

export type AgentToolExecution = {
  toolCallId?: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result: unknown;
};

export type AgentTurnOutput = {
  message: string;
  toolExecutions: AgentToolExecution[];
  confirmationRequired?: AgentConfirmationRequest | null;
  updatedMessages: AiMessage[];
};

export type RunAgentTurnOptions = {
  ctx: OrganizationContext;
  messages: AiMessage[];
  db: Db;
  confirmedCall?: {
    toolCallId: string;
    confirmed: boolean;
  };
  signal?: AbortSignal;
  provider?: LlmProvider;
  maxTurns?: number;
};

function buildSystemInstruction(ctx: OrganizationContext): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `You are UniSync Assistant, an AI clinical coordinator for ${ctx.organizationName}.`,
    `Today's date is ${today}. User role: ${ctx.role}.`,
    "",
    "ROLE & SAFETY INSTRUCTIONS:",
    "1. You assist the clinic administrator and staff with scheduling appointments, patient lookups, invoice drafting, checking inventory, and setting follow-up recalls.",
    "2. HUMAN GATES (STRICT): You CANNOT close an appointment or confirm a payment without deliberate human action. For patient communications, you can draft messages for human review (draft_patient_email) or dispatch emails directly via the configured Brevo email service (send_patient_email) when requested.",
    "3. HIGH IMPACT ACTIONS REQUIRE CONFIRMATION: Booking appointments, updating patient records, adjusting stock, or creating invoices will be paused for user confirmation before executing.",
    "4. MANDATORY GROUND TRUTH DATA VERIFICATION: Before taking any action or generating any operation on behalf of a patient or user, you MUST FIRST check the patient's real data in the database (using get_patient_details, list_appointments, list_bills, etc.) to verify facts and correct minor mistakes. For instance, if asked to send an appointment reminder or balance payment update, check the records to confirm that the patient actually has an upcoming scheduled appointment or an outstanding balance. If the records show no upcoming appointment or zero balance, DO NOT proceed blindly with the inappropriate communication — instead, explain the discrepancy to the user, state what the real records show, and suggest the proper course of action.",
    "5. MANDATORY INFORMATION COMPLETENESS & ELICITATION (NO ABSTRACT ACTIONS / NO SKELETON RECORDS):",
    "   When the user asks you to create or register a new record (such as a patient profile, an appointment, a bill/invoice, or an inventory item) or update an existing record, you MUST NOT proceed abstractly or call tools with missing or null values. You MUST ask the user for all the related and necessary information first:",
    "   - NEW PATIENT REGISTRATION: Never call create_patient with only a name or empty fields. You must ask the user for: (a) Full legal name, (b) Contact phone number and email address, (c) Date of birth (YYYY-MM-DD), (d) Gender identity, (e) Residential address (street, city, state, postal code), (f) Emergency contact (name & phone), and (g) Clinical notes or medical history. If the user only gave a name, do NOT call the tool yet; respond politely with a structured checklist asking for these details.",
    "   - SCHEDULING APPOINTMENTS: Never invent appointment times, durations, or types. You must ask the user for: (a) Patient name or ID, (b) Specific date and local time, (c) Duration in minutes (e.g. 15, 30, 45, 60), (d) Appointment category/type (General Consultation, Specialist Follow-up, Routine Checkup, Procedure, Emergency), and (e) Reason for visit/symptoms.",
    "   - INVOICE / BILL CREATION: Never generate arbitrary line items or amounts. You must ask the user for: (a) Patient name or ID, (b) Specific itemized services/medications with description, quantity, and unit price for each item, and (c) Any applicable discount, tax, or invoice notes.",
    "   - UPDATES & RESCHEDULING: Always verify the exact record to update, ask what specific fields should be modified, and preserve all existing data without clearing unmentioned fields.",
    "6. Be professional, concise, clinical, and helpful. Always confirm patient names and appointment times clearly.",
  ].join("\n");
}

type ProcessToolCallResult =
  | {
      type: "need_confirmation";
      confirmation: AgentConfirmationRequest;
    }
  | {
      type: "executed";
      toolExecution: AgentToolExecution;
      toolMessage: AiMessage;
    };

async function processToolCall(
  call: AiToolCall,
  ctx: OrganizationContext,
  db: Db,
  activeConfirmedCall?: { toolCallId: string; confirmed: boolean },
): Promise<ProcessToolCallResult> {
  const tool = AI_TOOL_REGISTRY[call.name];

  if (!tool) {
    const errorResult = { error: `Tool "${call.name}" is not registered.` };
    return {
      type: "executed",
      toolExecution: {
        toolCallId: call.id,
        toolName: call.name,
        arguments: call.arguments,
        result: errorResult,
      },
      toolMessage: {
        role: "tool",
        toolCallId: call.id,
        toolName: call.name,
        result: errorResult,
      },
    };
  }

  if (!roleHasPermission(ctx.role, tool.permission)) {
    const permResult = {
      error: `Permission "${tool.permission}" is required to use "${tool.name}".`,
    };
    return {
      type: "executed",
      toolExecution: {
        toolCallId: call.id,
        toolName: call.name,
        arguments: call.arguments,
        result: permResult,
      },
      toolMessage: {
        role: "tool",
        toolCallId: call.id,
        toolName: call.name,
        result: permResult,
      },
    };
  }

  const prepared = tool.prepare(call.arguments);

  if (!prepared.ok) {
    const valResult = {
      error: "Argument validation failed",
      issues: prepared.issues,
    };
    return {
      type: "executed",
      toolExecution: {
        toolCallId: call.id,
        toolName: call.name,
        arguments: call.arguments,
        result: valResult,
      },
      toolMessage: {
        role: "tool",
        toolCallId: call.id,
        toolName: call.name,
        result: valResult,
      },
    };
  }

  if (prepared.confirmationPrompt) {
    const isMatched =
      activeConfirmedCall &&
      (activeConfirmedCall.toolCallId === call.id ||
        activeConfirmedCall.toolCallId === call.name);

    if (!isMatched) {
      return {
        type: "need_confirmation",
        confirmation: {
          toolCallId: call.id || call.name,
          toolName: call.name,
          prompt: prepared.confirmationPrompt,
          input: prepared.input,
        },
      };
    }

    if (!activeConfirmedCall.confirmed) {
      const cancelResult = {
        cancelled: true,
        message: "User declined to confirm this action.",
      };
      return {
        type: "executed",
        toolExecution: {
          toolCallId: call.id,
          toolName: call.name,
          arguments: call.arguments,
          result: cancelResult,
        },
        toolMessage: {
          role: "tool",
          toolCallId: call.id,
          toolName: call.name,
          result: cancelResult,
        },
      };
    }
  }

  // Execute tool
  let output: unknown;
  try {
    if (tool.mode === "write") {
      output = await runCommand(
        {
          ctx,
          action: tool.audit,
          actor: { type: "AI_AGENT", aiToolName: tool.name },
        },
        async (unit) => prepared.invoke(ctx, { unit }),
      );
    } else {
      output = await prepared.invoke(ctx, { db });
    }
  } catch (err) {
    output = {
      error: err instanceof Error ? err.message : "Execution failed",
    };
  }

  return {
    type: "executed",
    toolExecution: {
      toolCallId: call.id,
      toolName: call.name,
      arguments: call.arguments,
      result: output,
    },
    toolMessage: {
      role: "tool",
      toolCallId: call.id,
      toolName: call.name,
      result: output,
    },
  };
}

export async function runAgentTurn(options: RunAgentTurnOptions): Promise<AgentTurnOutput> {
  const {
    ctx,
    messages,
    db,
    confirmedCall,
    signal,
    provider = getLlmProvider(),
    maxTurns = 5,
  } = options;

  const currentMessages: AiMessage[] = [...messages];
  const toolExecutions: AgentToolExecution[] = [];
  const systemInstruction = buildSystemInstruction(ctx);

  const availableTools = toolDefinitionsFor((permission) =>
    roleHasPermission(ctx.role, permission),
  );

  let activeConfirmedCall = confirmedCall;

  // ---------------------------------------------------------------------------
  // Pre-loop: check if the incoming transcript already contains unresolved tool
  // calls from a previous paused turn that need confirmation or execution before
  // we generate any new assistant response.
  // ---------------------------------------------------------------------------
  let lastAssistantMsg: AiMessage | undefined;
  let lastAssistantIdx = -1;

  for (let i = currentMessages.length - 1; i >= 0; i--) {
    if (currentMessages[i]?.role === "assistant") {
      lastAssistantMsg = currentMessages[i];
      lastAssistantIdx = i;
      break;
    }
  }

  if (lastAssistantMsg && "toolCalls" in lastAssistantMsg && lastAssistantMsg.toolCalls?.length) {
    // Count how many tool responses already follow this assistant message
    const subsequentToolMessages = currentMessages
      .slice(lastAssistantIdx + 1)
      .filter((m) => m.role === "tool");

    const resolvedCount = subsequentToolMessages.length;
    const unresolvedCalls = lastAssistantMsg.toolCalls.slice(resolvedCount);

    for (const call of unresolvedCalls) {
      const res = await processToolCall(call, ctx, db, activeConfirmedCall);

      if (res.type === "need_confirmation") {
        return {
          message:
            ("content" in lastAssistantMsg && lastAssistantMsg.content) ||
            "Please confirm this action to proceed:",
          toolExecutions,
          confirmationRequired: res.confirmation,
          updatedMessages: currentMessages,
        };
      }

      currentMessages.push(res.toolMessage);
      toolExecutions.push(res.toolExecution);

      if (
        activeConfirmedCall &&
        (activeConfirmedCall.toolCallId === call.id ||
          activeConfirmedCall.toolCallId === call.name)
      ) {
        activeConfirmedCall = undefined;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Agent loop: generate content, execute any newly requested tools, and repeat
  // until a final text response is produced or confirmation is required.
  // ---------------------------------------------------------------------------
  let currentTurn = 0;

  while (currentTurn < maxTurns) {
    currentTurn += 1;

    const result = await provider.generate({
      messages: currentMessages,
      systemInstruction,
      tools: availableTools,
      signal,
    });

    // If the model did not request any tool invocations, we've reached a final assistant response.
    if (!result.toolCalls || result.toolCalls.length === 0) {
      currentMessages.push({
        role: "assistant",
        content: result.text,
      });

      return {
        message: result.text,
        toolExecutions,
        confirmationRequired: null,
        updatedMessages: currentMessages,
      };
    }

    // Record the model's tool calls in the conversation history
    currentMessages.push({
      role: "assistant",
      content: result.text,
      toolCalls: result.toolCalls,
    });

    // Process each tool call sequentially
    for (const call of result.toolCalls) {
      const res = await processToolCall(call, ctx, db, activeConfirmedCall);

      if (res.type === "need_confirmation") {
        return {
          message: result.text || "Please confirm this action to proceed:",
          toolExecutions,
          confirmationRequired: res.confirmation,
          updatedMessages: currentMessages,
        };
      }

      currentMessages.push(res.toolMessage);
      toolExecutions.push(res.toolExecution);

      if (
        activeConfirmedCall &&
        (activeConfirmedCall.toolCallId === call.id ||
          activeConfirmedCall.toolCallId === call.name)
      ) {
        activeConfirmedCall = undefined;
      }
    }
  }

  // Turn cap reached
  const lastMessage = currentMessages[currentMessages.length - 1];
  const finalAssistantText =
    (lastMessage && "content" in lastMessage ? lastMessage.content : null) ||
    "I have processed your request.";

  return {
    message: finalAssistantText,
    toolExecutions,
    confirmationRequired: null,
    updatedMessages: currentMessages,
  };
}
