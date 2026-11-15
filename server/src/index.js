import { createProvider } from "./ai/index.js";
import { config } from "./config.js";
import { openDb } from "./db.js";
import { createGameManager } from "./games.js";
import { createAppServer } from "./server.js";

const db = openDb(config.dbPath);
const games = createGameManager({ db, config });
const ai = createProvider(config); // only used to report provider/model in /api/meta
const server = createAppServer({ db, games, config, ai });

server.listen(config.port, config.host, () => {
  console.log(`Agentbluff server on http://${config.host}:${config.port}  (AI: ${ai.name} / ${ai.model})`);
});

function shutdown() {
  games.stopAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
