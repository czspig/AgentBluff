import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = resolve(root, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env;
const int = (value, fallback) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};

const apiKey = env.DEEPSEEK_API_KEY?.trim() || "";

export const config = {
  root,
  port: int(env.PORT, 8787),
  host: env.HOST || "127.0.0.1",
  dbPath: resolve(root, env.DB_PATH || "data/agentbluff.db"),
  staticDir: resolve(root, env.STATIC_DIR || "../frontend/dist"),

  // "deepseek" needs DEEPSEEK_API_KEY; "mock" runs offline for free.
  aiProvider: env.AI_PROVIDER || (apiKey ? "deepseek" : "mock"),
  deepseek: {
    apiKey,
    baseUrl: env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    model: env.DEEPSEEK_MODEL || "deepseek-chat",
  },

  // Cost controls: every started game is paid for by the operator.
  limits: {
    maxConcurrentGames: int(env.MAX_CONCURRENT_GAMES, 2),
    gamesPerIpPerHour: int(env.GAMES_PER_IP_PER_HOUR, 3),
    gamesPerDay: int(env.GAMES_PER_DAY, 50),
  },
  // Pause after each speech so spectators can read it: ms per character, clamped to [min, max].
  // Set READING_MS_PER_CHAR=0 to run games at full speed.
  pacing: {
    msPerChar: int(env.READING_MS_PER_CHAR, 45),
    minMs: int(env.READING_MIN_MS, 2500),
    maxMs: int(env.READING_MAX_MS, 9000),
  },
  // Trust X-Forwarded-For only when running behind a reverse proxy (nginx).
  trustProxy: env.TRUST_PROXY === "1",
};
