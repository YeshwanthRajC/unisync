"use server";

import { z } from "zod";

import { requireOrganizationContext } from "@/lib/auth/session";
import { executeChatTurn } from "@/services/chat";

const chatMessageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    content: z.string(),
  }),
  z.object({
    role: z.literal("assistant"),
    content: z.string(),
    toolCalls: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string(),
          arguments: z.record(z.string(), z.unknown()),
          thoughtSignature: z.string().optional(),
        }),
      )
      .optional(),
  }),
  z.object({
    role: z.literal("tool"),
    toolCallId: z.string().optional(),
    toolName: z.string(),
    result: z.unknown(),
  }),
]);

const chatInputSchema = z.object({
  messages: z.array(chatMessageSchema),
  confirmedCall: z
    .object({
      toolCallId: z.string(),
      confirmed: z.boolean(),
    })
    .optional(),
});

export async function sendChatMessageAction(rawInput: unknown) {
  try {
    const ctx = await requireOrganizationContext();
    const parsed = chatInputSchema.safeParse(rawInput);

    if (!parsed.success) {
      return {
        ok: false as const,
        error: "Invalid message payload",
        issues: parsed.error.issues,
      };
    }

    const result = await executeChatTurn(ctx, {
      messages: parsed.data.messages,
      confirmedCall: parsed.data.confirmedCall,
    });

    return { ok: true as const, data: result };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Chat failed to process",
    };
  }
}
