import "server-only";

import { runAgentTurn, type AgentTurnOutput } from "@/lib/ai/agent";
import type { AiMessage } from "@/lib/ai/types";
import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export type ExecuteChatOptions = {
  messages: AiMessage[];
  confirmedCall?: {
    toolCallId: string;
    confirmed: boolean;
  };
  signal?: AbortSignal;
};

export async function executeChatTurn(
  ctx: OrganizationContext,
  options: ExecuteChatOptions,
): Promise<AgentTurnOutput> {
  return runAgentTurn({
    ctx,
    messages: options.messages,
    db: prisma,
    confirmedCall: options.confirmedCall,
    signal: options.signal,
  });
}
