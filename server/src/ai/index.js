import { createDeepSeekProvider } from "./deepseek.js";
import { createMockProvider } from "./mock.js";

export function createProvider(config, { onUsage } = {}) {
  if (config.aiProvider === "deepseek") {
    if (!config.deepseek.apiKey) throw new Error("AI_PROVIDER=deepseek 需要设置 DEEPSEEK_API_KEY");
    return createDeepSeekProvider({ ...config.deepseek, onUsage });
  }
  return createMockProvider();
}
