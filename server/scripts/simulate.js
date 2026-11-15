// Plays N games with the instant mock provider and checks rule invariants.
// Usage: npm run simulate -- 200

import { createMockProvider } from "../src/ai/mock.js";
import { Game, dealPlayers } from "../src/game/engine.js";

const runs = Number(process.argv[2] ?? 100);
const ai = createMockProvider({ delayMs: [0, 0] });
const results = { good: 0, wolf: 0, draw: 0 };
let maxDays = 0;

for (let i = 0; i < runs; i += 1) {
  const events = [];
  const game = new Game({ players: dealPlayers(), ai, emit: (type, payload) => events.push({ type, ...payload }) });
  const result = await game.run();
  results[result.winner] += 1;

  const deaths = events.filter((e) => e.type === "death").map((e) => e.seat);
  if (new Set(deaths).size !== deaths.length) throw new Error(`game ${i}: a player died twice`);
  const ends = events.filter((e) => e.type === "game_end");
  if (ends.length !== 1 || events.at(-1).type !== "game_end") throw new Error(`game ${i}: bad game_end`);
  const saves = events.filter((e) => e.action === "witch_save").length;
  const poisons = events.filter((e) => e.action === "witch_poison").length;
  if (saves > 1 || poisons > 1) throw new Error(`game ${i}: potion used twice`);
  for (const e of events.filter((e) => e.type === "vote" || e.type === "speech")) {
    if (!game.bySeat(e.actor)) throw new Error(`game ${i}: unknown actor`);
  }
  maxDays = Math.max(maxDays, game.day);
}

console.log(`${runs} games:`, results, `longest: day ${maxDays}`);
