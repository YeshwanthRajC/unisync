import "server-only";

import { GeminiProvider } from "@/lib/ai/gemini";
import type { LlmProvider } from "@/lib/ai/types";

/**
 * Resolves the active LLM provider.
 *
 * Gemini is the only implementation today. When a second provider is added,
 * the choice belongs here — behind an environment variable — and no call site
 * outside `lib/ai/` changes.
 */

let cachedProvider: LlmProvider | undefined;

export function getLlmProvider(): LlmProvider {
  // Constructed lazily so that importing this module does not require an API
  // key — the app must still build and boot before credentials are set.
  cachedProvider ??= new GeminiProvider();
  return cachedProvider;
}
