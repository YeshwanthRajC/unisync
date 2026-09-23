import "server-only";

import {
  GoogleGenAI,
  Type,
  type Content,
  type FunctionDeclaration,
  type Schema,
} from "@google/genai";

import { getAiEnv } from "@/lib/env";
import {
  AiProviderError,
  type AiGenerateRequest,
  type AiGenerateResult,
  type AiMessage,
  type AiObjectParameterSchema,
  type AiToolDefinition,
  type AiToolParameterSchema,
  type LlmProvider,
} from "@/lib/ai/types";

/**
 * Google Gemini implementation of `LlmProvider`.
 *
 * This is the ONLY file in the codebase that imports the Gemini SDK. Keeping
 * the SDK contained here is what makes the provider swappable.
 */
export class GeminiProvider implements LlmProvider {
  readonly id = "gemini";
  readonly defaultModel: string;

  private readonly client: GoogleGenAI;

  constructor() {
    const env = getAiEnv();

    // The key stays inside this instance; it is never returned, logged, or
    // included in an error message.
    this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    this.defaultModel = env.GEMINI_MODEL;
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const model = request.model ?? this.defaultModel;

    try {
      const response = await this.client.models.generateContent({
        model,
        contents: request.messages.map(toGeminiContent),
        config: {
          systemInstruction: request.systemInstruction,
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
          ...(request.signal ? { abortSignal: request.signal } : {}),
          ...(request.tools?.length
            ? {
                tools: [
                  { functionDeclarations: request.tools.map(toFunctionDeclaration) },
                ],
              }
            : {}),
        },
      });

      return {
        text: response.text ?? "",
        toolCalls: (response.functionCalls ?? []).map((call) => ({
          id: call.id,
          name: call.name ?? "",
          arguments: (call.args ?? {}) as Record<string, unknown>,
        })),
        model,
        usage: {
          inputTokens: response.usageMetadata?.promptTokenCount,
          outputTokens: response.usageMetadata?.candidatesTokenCount,
          totalTokens: response.usageMetadata?.totalTokenCount,
        },
      };
    } catch (cause) {
      // Surface a provider-neutral error; the raw SDK error may echo request
      // content and must not propagate to the client.
      throw new AiProviderError(
        `Gemini request failed for model "${model}".`,
        this.id,
        { cause },
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Mapping: our neutral message shape -> Gemini's Content turns
// ---------------------------------------------------------------------------

/**
 * Gemini names the assistant turn "model", and represents tool use as two
 * separate turns: a `functionCall` part from the model, then a
 * `functionResponse` part attributed to the user role. Both must be present and
 * in order, or the model loses track of what it already asked for and re-requests
 * the same tool indefinitely.
 *
 * Note Gemini does not always populate a call `id`, so results are correlated by
 * name and position rather than by id.
 */
function toGeminiContent(message: AiMessage): Content {
  if (message.role === "tool") {
    return {
      role: "user",
      parts: [
        {
          functionResponse: {
            name: message.toolName,
            // The SDK expects an object; wrap a bare value so a tool returning a
            // number or a string does not produce an invalid part.
            response: asResponseObject(message.result),
          },
        },
      ],
    };
  }

  if (message.role === "assistant") {
    if (message.toolCalls?.length) {
      return {
        role: "model",
        parts: [
          ...(message.content ? [{ text: message.content }] : []),
          ...message.toolCalls.map((call) => ({
            functionCall: { name: call.name, args: call.arguments },
          })),
        ],
      };
    }
    return { role: "model", parts: [{ text: message.content }] };
  }

  return { role: "user", parts: [{ text: message.content }] };
}

function asResponseObject(result: unknown): Record<string, unknown> {
  if (result !== null && typeof result === "object" && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return { result };
}

// ---------------------------------------------------------------------------
// Mapping: our neutral tool schema -> Gemini's function declarations
// ---------------------------------------------------------------------------

function toFunctionDeclaration(tool: AiToolDefinition): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parameters: toGeminiObjectSchema(tool.parameters),
  };
}

const TYPE_MAP: Record<AiToolParameterSchema["type"], Type> = {
  string: Type.STRING,
  number: Type.NUMBER,
  integer: Type.INTEGER,
  boolean: Type.BOOLEAN,
  array: Type.ARRAY,
  object: Type.OBJECT,
};

function toGeminiObjectSchema(schema: AiObjectParameterSchema): Schema {
  return {
    type: Type.OBJECT,
    description: schema.description,
    properties: Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [
        key,
        toGeminiSchema(value),
      ]),
    ),
    ...(schema.required?.length ? { required: schema.required } : {}),
  };
}

function toGeminiSchema(schema: AiToolParameterSchema): Schema {
  return {
    type: TYPE_MAP[schema.type],
    description: schema.description,
    ...(schema.enum ? { enum: schema.enum } : {}),
    ...(schema.items ? { items: toGeminiSchema(schema.items) } : {}),
    ...(schema.properties
      ? {
          properties: Object.fromEntries(
            Object.entries(schema.properties).map(([key, value]) => [
              key,
              toGeminiSchema(value),
            ]),
          ),
        }
      : {}),
    ...(schema.required ? { required: schema.required } : {}),
  };
}
