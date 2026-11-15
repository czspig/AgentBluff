// Runs games in the background, persists every event, and fans events out to live spectators.

import { createProvider } from "./ai/index.js";
import { Game, dealPlayers } from "./game/engine.js";

const TITLES = ["硅基伪装", "寂静村庄", "子夜审判", "月下密谋", "迷雾之镇", "最后的晚餐", "无声证词", "长夜将尽"];
const HOUR = 3600_000;

export class LimitError extends Error {
  constructor(message, liveGameId) {
    super(message);
    this.liveGameId = liveGameId;
  }
}

export function createGameManager({ db, config }) {
  const running = new Map(); // gameId -> { controller }
  const subscribers = new Map(); // gameId -> Set<(event) => void>

  db.abortRunning();

  function broadcast(gameId, event) {
    for (const send of subscribers.get(gameId) ?? []) send(event);
  }

  function checkLimits(ip) {
    const { maxConcurrentGames, gamesPerIpPerHour, gamesPerDay } = config.limits;
    const live = [...running.keys()].at(-1) ?? null;
    if (running.size >= maxConcurrentGames) {
      throw new LimitError("当前进行中的对局已满，先去观战正在进行的对局吧。", live);
    }
    if (db.countSince(Date.now() - 24 * HOUR) >= gamesPerDay) {
      throw new LimitError("今天的对局名额已经用完了，明天再来吧。", live);
    }
    if (db.countIpSince(ip, Date.now() - HOUR) >= gamesPerIpPerHour) {
      throw new LimitError("你开局太频繁了，请稍后再试。", live);
    }
  }

  function start(ip) {
    checkLimits(ip);
    const players = dealPlayers();
    let gameId;
    const ai = createProvider(config, { onUsage: (usage) => db.addTokens(gameId, usage) });
    gameId = db.createGame({
      title: TITLES[Math.floor(Math.random() * TITLES.length)],
      provider: ai.name,
      model: ai.model,
      players: players.map(({ seat, personaId, name, role, roleName, camp }) => ({ seat, personaId, name, role, roleName, camp })),
      ip,
    });

    let seq = 0;
    const emit = (type, payload) => {
      seq += 1;
      const event = db.addEvent(gameId, seq, type, payload);
      broadcast(gameId, event);
      return event;
    };

    const controller = new AbortController();
    running.set(gameId, { controller });
    const { msPerChar, minMs, maxMs } = config.pacing;
    const readingDelay = (text) =>
      msPerChar > 0 ? Math.min(maxMs, Math.max(minMs, String(text).length * msPerChar)) : 0;
    const game = new Game({ players, ai, emit, signal: controller.signal, readingDelay });

    game
      .run()
      .then((result) => db.finishGame(gameId, { status: "finished", winner: result.winner, reason: result.reason }))
      .catch((error) => {
        console.error(`[game ${gameId}]`, error);
        emit("error", { message: error.userMessage ?? "对局因故障中断。" });
        db.finishGame(gameId, { status: "aborted", reason: error.message });
      })
      .finally(() => {
        running.delete(gameId);
        broadcast(gameId, { type: "closed" });
      });

    return gameId;
  }

  function subscribe(gameId, send) {
    if (!subscribers.has(gameId)) subscribers.set(gameId, new Set());
    subscribers.get(gameId).add(send);
    return () => {
      const set = subscribers.get(gameId);
      set?.delete(send);
      if (set && !set.size) subscribers.delete(gameId);
    };
  }

  return {
    start,
    subscribe,
    isRunning: (gameId) => running.has(gameId),
    stopAll() {
      for (const { controller } of running.values()) controller.abort();
    },
  };
}
