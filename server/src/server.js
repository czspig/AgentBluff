import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { personaById, personas } from "../../shared/personas.js";
import { LimitError } from "./games.js";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function clientIp(req, trustProxy) {
  if (trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}

function personaStats(db) {
  const stats = Object.fromEntries(
    personas.map((p) => [p.id, { played: 0, wins: 0, roles: {}, wolfGames: 0, wolfWins: 0 }]),
  );
  for (const game of db.finishedGames()) {
    for (const player of game.players) {
      const s = stats[player.personaId];
      if (!s) continue;
      s.played += 1;
      s.roles[player.roleName] = (s.roles[player.roleName] ?? 0) + 1;
      const won = game.winner === player.camp;
      if (won) s.wins += 1;
      if (player.camp === "wolf") {
        s.wolfGames += 1;
        if (won) s.wolfWins += 1;
      }
    }
  }
  return stats;
}

function recentSpeeches(db, personaId, limit = 6) {
  const out = [];
  for (const row of db.recentSpeeches()) {
    const payload = JSON.parse(row.payload);
    const player = JSON.parse(row.players).find((p) => p.seat === payload.actor);
    if (player?.personaId !== personaId) continue;
    out.push({ gameId: row.game_id, ts: row.ts, kind: payload.kind, text: payload.text, thought: payload.thought, roleName: player.roleName });
    if (out.length >= limit) break;
  }
  return out;
}

export function createAppServer({ db, games, config, ai }) {
  function serveStatic(req, res) {
    if (!existsSync(config.staticDir)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("前端尚未构建：在 frontend 目录运行 npm run build。");
      return;
    }
    const url = new URL(req.url, "http://x");
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
    let file = resolve(config.staticDir, rel);
    if (!file.startsWith(config.staticDir) || !existsSync(file) || statSync(file).isDirectory()) {
      file = join(config.staticDir, "index.html");
    }
    const ext = extname(file);
    res.writeHead(200, {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": file.includes(`${join("dist", "assets")}`) ? "public, max-age=31536000, immutable" : "no-cache",
    });
    createReadStream(file).pipe(res);
  }

  function stream(req, res, gameId) {
    const url = new URL(req.url, "http://x");
    const after = Number.parseInt(url.searchParams.get("after") ?? req.headers["last-event-id"] ?? "0", 10) || 0;
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering
    });
    let lastSent = after;
    const send = (event) => {
      if (event.type === "closed") {
        res.write(`event: closed\ndata: {}\n\n`);
        res.end();
        return;
      }
      if (event.seq <= lastSent) return;
      lastSent = event.seq;
      res.write(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`);
    };
    // Subscribe before replaying the backlog so nothing emitted in between is lost;
    // `lastSent` drops anything already delivered.
    const unsubscribe = games.subscribe(gameId, send);
    for (const event of db.events(gameId, after)) send(event);
    if (!games.isRunning(gameId)) {
      unsubscribe();
      send({ type: "closed" });
      return;
    }
    const heartbeat = setInterval(() => res.write(`: ping\n\n`), 20000);
    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }

  async function handleApi(req, res, path) {
    const method = req.method;
    let m;

    if (method === "GET" && path === "/api/meta") {
      return json(res, 200, { provider: ai.name, model: ai.model, limits: config.limits });
    }
    if (method === "GET" && path === "/api/personas") {
      const stats = personaStats(db);
      return json(res, 200, personas.map((p) => ({ ...p, stats: stats[p.id] })));
    }
    if (method === "GET" && (m = path.match(/^\/api\/personas\/([a-z]+)$/))) {
      const persona = personaById[m[1]];
      if (!persona) return json(res, 404, { error: "选手不存在" });
      return json(res, 200, { ...persona, stats: personaStats(db)[persona.id], speeches: recentSpeeches(db, persona.id) });
    }
    if (method === "GET" && path === "/api/games") {
      return json(res, 200, db.listGames(30));
    }
    if (method === "GET" && path === "/api/games/live") {
      return json(res, 200, { id: db.latestGameId() });
    }
    if (method === "POST" && path === "/api/games") {
      try {
        const id = games.start(clientIp(req, config.trustProxy));
        return json(res, 201, { id });
      } catch (error) {
        if (error instanceof LimitError) return json(res, 429, { error: error.message, liveGameId: error.liveGameId });
        throw error;
      }
    }
    if (method === "GET" && (m = path.match(/^\/api\/games\/(\d+)$/))) {
      const game = db.getGame(Number(m[1]));
      if (!game) return json(res, 404, { error: "对局不存在" });
      return json(res, 200, { ...game, events: db.events(game.id) });
    }
    if (method === "GET" && (m = path.match(/^\/api\/games\/(\d+)\/stream$/))) {
      const id = Number(m[1]);
      if (!db.getGame(id)) return json(res, 404, { error: "对局不存在" });
      return stream(req, res, id);
    }
    return json(res, 404, { error: "接口不存在" });
  }

  return createServer(async (req, res) => {
    const path = new URL(req.url, "http://x").pathname;
    try {
      if (path.startsWith("/api/")) return await handleApi(req, res, path);
      if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res);
      json(res, 405, { error: "不支持的请求" });
    } catch (error) {
      console.error(error);
      if (!res.headersSent) json(res, 500, { error: "服务器内部错误" });
      else res.end();
    }
  });
}
