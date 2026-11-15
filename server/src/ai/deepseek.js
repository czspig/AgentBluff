// DeepSeek provider (OpenAI-compatible chat completions with JSON output).

import { buildMessages } from "./prompts.js";

export function createDeepSeekProvider({ apiKey, baseUrl, model, timeoutMs = 60000, onUsage }) {
  async function call(messages) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.9,
        max_tokens: 600,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`DeepSeek ${response.status}: ${body.slice(0, 200)}`);
    }
    const data = await response.json();
    if (data.usage) onUsage?.(data.usage);
    const content = data.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(content);
  }

  return {
    name: "deepseek",
    model,
    async decide(req) {
      const messages = buildMessages(req);
      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await call(messages);
        } catch (error) {
          lastError = error;
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
      // Report the failure explicitly: the engine substitutes a safe default, tells spectators,
      // and aborts the game if the service stays down.
      console.error(`[deepseek] ${req.kind} failed after retries:`, lastError?.message);
      return { __failed: true, error: lastError?.message ?? "unknown" };
    },
  };
}
