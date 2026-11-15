import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDb(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT NOT NULL,            -- running | finished | aborted
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      finished_at INTEGER,
      winner TEXT,                     -- good | wolf | draw
      reason TEXT,
      players TEXT NOT NULL,           -- JSON array from the game_start event
      creator_ip TEXT,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS events (
      game_id INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      ts INTEGER NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (game_id, seq)
    );
    CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
  `);

  const stmt = {
    insertGame: db.prepare(
      `INSERT INTO games (title, status, provider, model, created_at, players, creator_ip)
       VALUES (?, 'running', ?, ?, ?, ?, ?)`,
    ),
    insertEvent: db.prepare(`INSERT INTO events (game_id, seq, ts, type, payload) VALUES (?, ?, ?, ?, ?)`),
    finishGame: db.prepare(
      `UPDATE games SET status = ?, finished_at = ?, winner = ?, reason = ? WHERE id = ?`,
    ),
    addTokens: db.prepare(
      `UPDATE games SET prompt_tokens = prompt_tokens + ?, completion_tokens = completion_tokens + ? WHERE id = ?`,
    ),
    getGame: db.prepare(`SELECT * FROM games WHERE id = ?`),
    listGames: db.prepare(`SELECT * FROM games ORDER BY id DESC LIMIT ?`),
    latestRunning: db.prepare(`SELECT id FROM games WHERE status = 'running' ORDER BY id DESC LIMIT 1`),
    latestFinished: db.prepare(`SELECT id FROM games WHERE status = 'finished' ORDER BY id DESC LIMIT 1`),
    events: db.prepare(`SELECT seq, ts, type, payload FROM events WHERE game_id = ? AND seq > ? ORDER BY seq`),
    countSince: db.prepare(`SELECT COUNT(*) AS n FROM games WHERE created_at >= ?`),
    countIpSince: db.prepare(`SELECT COUNT(*) AS n FROM games WHERE creator_ip = ? AND created_at >= ?`),
    finishedGames: db.prepare(`SELECT id, players, winner FROM games WHERE status = 'finished'`),
    recentSpeeches: db.prepare(
      `SELECT e.game_id, e.ts, e.payload, g.players FROM events e JOIN games g ON g.id = e.game_id
       WHERE e.type = 'speech' ORDER BY e.game_id DESC, e.seq DESC LIMIT 600`,
    ),
    abortRunning: db.prepare(
      `UPDATE games SET status = 'aborted', finished_at = ?, reason = '服务器重启，对局中断。' WHERE status = 'running'`,
    ),
  };

  const parseGame = (row) =>
    row && {
      id: row.id,
      title: row.title,
      status: row.status,
      provider: row.provider,
      model: row.model,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
      winner: row.winner,
      reason: row.reason,
      players: JSON.parse(row.players),
      tokens: { prompt: row.prompt_tokens, completion: row.completion_tokens },
    };

  return {
    createGame({ title, provider, model, players, ip }) {
      const result = stmt.insertGame.run(title, provider, model, Date.now(), JSON.stringify(players), ip);
      return Number(result.lastInsertRowid);
    },
    addEvent(gameId, seq, type, payload) {
      const ts = Date.now();
      stmt.insertEvent.run(gameId, seq, ts, type, JSON.stringify(payload));
      return { seq, ts, type, ...payload };
    },
    finishGame(gameId, { status, winner = null, reason = null }) {
      stmt.finishGame.run(status, Date.now(), winner, reason, gameId);
    },
    addTokens(gameId, usage) {
      stmt.addTokens.run(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0, gameId);
    },
    getGame: (id) => parseGame(stmt.getGame.get(id)),
    listGames: (limit = 30) => stmt.listGames.all(limit).map(parseGame),
    latestGameId: () => (stmt.latestRunning.get() ?? stmt.latestFinished.get())?.id ?? null,
    events: (id, after = 0) =>
      stmt.events.all(id, after).map((row) => ({ seq: row.seq, ts: row.ts, type: row.type, ...JSON.parse(row.payload) })),
    countSince: (ts) => stmt.countSince.get(ts).n,
    countIpSince: (ip, ts) => stmt.countIpSince.get(ip, ts).n,
    finishedGames: () => stmt.finishedGames.all().map((r) => ({ ...r, players: JSON.parse(r.players) })),
    recentSpeeches: () => stmt.recentSpeeches.all(),
    abortRunning: () => stmt.abortRunning.run(Date.now()),
  };
}
