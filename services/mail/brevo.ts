import "server-only";

import { getBrevoEnv, isBrevoConfigured, isBrevoMcpConfigured } from "@/lib/env";

export type SendEmailParams = {
  to: string;
  recipientName?: string;
  subject: string;
  htmlContent?: string;
  textContent?: string;
  senderEmail?: string;
  senderName?: string;
};

export type EmailDispatchResult = {
  messageId: string;
  provider: "brevo_rest" | "brevo_mcp";
};

/**
 * Format plaintext email content into clean, responsive HTML with clinic branding.
 */
export function formatEmailHtml(body: string, clinicName?: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const paragraphs = escaped
    .split(/\n\s*\n/)
    .map(
      (p) =>
        `<p style="margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b;">${p.replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");

  const clinicHeader = clinicName
    ? `<div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #3b82f6;">
         <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 700; color: #1e3a8a;">${clinicName}</span>
       </div>`
    : "";

  const clinicFooter = clinicName
    ? `<div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; font-family: sans-serif;">
         Sent securely on behalf of <strong>${clinicName}</strong> via UniSync Healthcare Platform.
       </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    ${clinicHeader}
    <div style="color: #334155;">
      ${paragraphs}
    </div>
    ${clinicFooter}
  </div>
</body>
</html>`;
}

/**
 * Send transactional email using the Brevo REST API v3.
 * Endpoint: POST https://api.brevo.com/v3/smtp/email
 */
export async function sendBrevoTransactionalEmail(
  params: SendEmailParams,
): Promise<{ messageId: string }> {
  const env = getBrevoEnv();

  // Determine API key (direct key or extracted from MCP token)
  let apiKey = env.BREVO_API_KEY?.trim();
  if (!apiKey && env.BREVO_MCP_API_KEY) {
    try {
      const decoded = JSON.parse(
        Buffer.from(env.BREVO_MCP_API_KEY, "base64").toString("utf-8"),
      );
      if (decoded.api_key) apiKey = decoded.api_key;
    } catch {
      // Ignore base64 parse failure
    }
  }

  if (!apiKey) {
    throw new Error("Brevo API key is not configured.");
  }

  const senderEmail = params.senderEmail || env.BREVO_SENDER_EMAIL;
  const senderName = params.senderName || env.BREVO_SENDER_NAME;
  const htmlContent =
    params.htmlContent ||
    formatEmailHtml(params.textContent || "", senderName);

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [
      {
        email: params.to.trim().toLowerCase(),
        name: params.recipientName || params.to,
      },
    ],
    subject: params.subject.trim(),
    htmlContent,
    ...(params.textContent ? { textContent: params.textContent.trim() } : {}),
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedMessage = errorBody;
    try {
      const json = JSON.parse(errorBody);
      parsedMessage = json.message || json.error || errorBody;
    } catch {
      // Keep errorBody
    }
    throw new Error(`Brevo REST API error (${response.status}): ${parsedMessage}`);
  }

  const data = (await response.json()) as { messageId?: string };
  return {
    messageId: data.messageId || `brevo-${Date.now()}`,
  };
}

/**
 * Send transactional email using the Brevo MCP Server over JSON-RPC / SSE.
 * Endpoint: POST https://mcp.brevo.com/v1/brevo/mcp
 */
export async function sendBrevoMcpEmail(
  params: SendEmailParams,
): Promise<{ messageId: string }> {
  const env = getBrevoEnv();
  const token = env.BREVO_MCP_API_KEY?.trim() || env.BREVO_API_KEY?.trim();

  if (!token) {
    throw new Error("Brevo MCP server token is not configured.");
  }

  const senderEmail = params.senderEmail || env.BREVO_SENDER_EMAIL;
  const senderName = params.senderName || env.BREVO_SENDER_NAME;
  const htmlContent =
    params.htmlContent ||
    formatEmailHtml(params.textContent || "", senderName);

  const mcpRequestBody = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: {
      name: "transac_templates_send_transac_email",
      arguments: {
        sender: { name: senderName, email: senderEmail },
        to: [
          {
            email: params.to.trim().toLowerCase(),
            name: params.recipientName || params.to,
          },
        ],
        subject: params.subject.trim(),
        htmlContent,
        ...(params.textContent ? { textContent: params.textContent.trim() } : {}),
      },
    },
  };

  const response = await fetch("https://mcp.brevo.com/v1/brevo/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mcpRequestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo MCP server error (${response.status}): ${errorText}`);
  }

  const rawText = await response.text();

  // Parse SSE response (event: message\ndata: { ... })
  const dataLine = rawText
    .split("\n")
    .find((line) => line.startsWith("data: "));

  if (!dataLine) {
    throw new Error("Brevo MCP server returned an invalid or empty SSE stream.");
  }

  const jsonRpcResponse = JSON.parse(dataLine.slice(6));

  if (jsonRpcResponse.error) {
    throw new Error(
      `Brevo MCP RPC error: ${jsonRpcResponse.error.message || JSON.stringify(jsonRpcResponse.error)}`,
    );
  }

  if (jsonRpcResponse.result?.isError) {
    const content = jsonRpcResponse.result.content?.[0]?.text;
    throw new Error(`Brevo MCP tool execution failed: ${content || "Unknown tool error"}`);
  }

  // Parse messageId from text content inside result
  let messageId = `brevo-mcp-${Date.now()}`;
  try {
    const text = jsonRpcResponse.result?.content?.[0]?.text;
    if (text) {
      const parsedText = JSON.parse(text);
      if (parsedText.messageId) {
        messageId = parsedText.messageId;
      }
    }
  } catch {
    // Keep fallback generated ID
  }

  return { messageId };
}

/**
 * Universal dispatcher: dispatches via Brevo MCP or Brevo REST API with automatic fallback.
 */
export async function dispatchEmail(
  params: SendEmailParams & { preferMcp?: boolean },
): Promise<EmailDispatchResult> {
  const preferMcp = params.preferMcp ?? isBrevoMcpConfigured();

  if (preferMcp) {
    try {
      const mcpResult = await sendBrevoMcpEmail(params);
      return { messageId: mcpResult.messageId, provider: "brevo_mcp" };
    } catch (mcpError) {
      // If MCP fails, fallback to direct REST API if configured
      if (process.env.BREVO_API_KEY?.trim()) {
        const restResult = await sendBrevoTransactionalEmail(params);
        return { messageId: restResult.messageId, provider: "brevo_rest" };
      }
      throw mcpError;
    }
  }

  try {
    const restResult = await sendBrevoTransactionalEmail(params);
    return { messageId: restResult.messageId, provider: "brevo_rest" };
  } catch (restError) {
    // If REST fails, attempt MCP if configured
    if (isBrevoMcpConfigured()) {
      const mcpResult = await sendBrevoMcpEmail(params);
      return { messageId: mcpResult.messageId, provider: "brevo_mcp" };
    }
    throw restError;
  }
}
