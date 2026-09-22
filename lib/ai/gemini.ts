import "server-only";

import { GoogleGenAI, Type, type FunctionDeclaration, type Schema } from "@google/genai";

import { getServerEnv } from "@/lib/env";
import {
  AiProviderError,
  type AiGenerateRequest,
  type AiGenerateResult,
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
    const env = getServerEnv();

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
        contents: request.messages.map((message) => ({
          // Gemini names the assistant turn "model".
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        config: {
          systemInstruction: request.systemInstruction,
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
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
// Mapping: our neutral tool schema -> Gemini's function declarations
// ---------------------------------------------------------------------------

function toFunctionDeclaration(tool: AiToolDefinition): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parameters: toGeminiSchema(tool.parameters),
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
