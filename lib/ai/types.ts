/**
 * Provider-agnostic AI contract.
 *
 * Nothing in this file mentions Gemini. The rest of the application depends
 * only on these types, so swapping the LLM provider later is a change in
 * `lib/ai/` alone — no call site moves.
 */

export type AiRole = "user" | "assistant";

export type AiMessage = {
  role: AiRole;
  content: string;
};

/**
 * A single argument of a tool, described in a JSON-Schema-like shape that
 * every major provider can consume.
 */
export type AiToolParameterSchema = {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: AiToolParameterSchema;
  properties?: Record<string, AiToolParameterSchema>;
  required?: string[];
};

/**
 * What the model is told a tool looks like.
 *
 * This is only the *declaration* handed to the LLM. Execution, argument
 * validation and permission checks all happen server-side in the tool
 * registry — the model never receives an executable handle.
 */
export type AiToolDefinition = {
  name: string;
  description: string;
  parameters: AiToolParameterSchema;
};

/** A tool invocation requested by the model. Arguments are UNTRUSTED. */
export type AiToolCall = {
  id?: string;
  name: string;
  /** Raw, unvalidated arguments as produced by the model. */
  arguments: Record<string, unknown>;
};

export type AiGenerateRequest = {
  /** Conversation so far, oldest first. */
  messages: AiMessage[];
  /** Organization- and role-aware instructions assembled on the server. */
  systemInstruction?: string;
  /** Tools this user is permitted to use in this organization. */
  tools?: AiToolDefinition[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Overrides the provider's configured default model. */
  model?: string;
};

export type AiUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type AiGenerateResult = {
  /** Natural-language reply. Empty when the model only requested tools. */
  text: string;
  /** Tool calls the model wants executed. Never executed automatically. */
  toolCalls: AiToolCall[];
  model: string;
  usage?: AiUsage;
};

/**
 * The interface every LLM provider must satisfy.
 */
export interface LlmProvider {
  /** Stable identifier used in logs and audit records, e.g. "gemini". */
  readonly id: string;
  /** Model used when a request does not name one. */
  readonly defaultModel: string;

  generate(request: AiGenerateRequest): Promise<AiGenerateResult>;
}

/** Raised when a provider call fails, so callers need not know the SDK. */
export class AiProviderError extends Error {
  readonly status = 502;

  constructor(
    message: string,
    readonly providerId: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AiProviderError";
  }
}
