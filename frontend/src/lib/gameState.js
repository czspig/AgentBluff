// Turns a game's event log into the view model the pages render.
// The server only stores events; all derived state lives here.

import { personaById } from "../../../shared/personas.js";

export const CAUSE_NAMES = { wolf: "夜里被袭击", poison: "被女巫毒杀", vote: "被投票放逐", hunter: "被猎人带走" };
export const WINNER_NAMES = { good: "好人阵营获胜", wolf: "狼人阵营获胜", draw: "平局" };

export function playerLabel(player) {
  return player ? `${player.seat}号 ${player.name}` : "无人";
}

// One readable line per event, used by the timeline and the replay dossier.
export function describe(event, bySeat) {
  const p = (seat) => playerLabel(bySeat[seat]);
  switch (event.type) {
    case "night_action":
      switch (event.action) {
        case "wolf_kill":
          return event.final ? `狼队最终决定袭击 ${p(event.target)}。` : `${p(event.actor)} 提议袭击 ${p(event.target)}。`;
        case "seer_check":
          return `${p(event.actor)} 查验 ${p(event.target)}，结果是${event.result === "wolf" ? "狼人" : "好人"}。`;
        case "witch_save":
          return `${p(event.actor)} 使用解药救下 ${p(event.target)}。`;
        case "witch_poison":
          return `${p(event.actor)} 使用毒药毒杀 ${p(event.target)}。`;
        default:
          return `${p(event.actor)} 今晚没有用药。`;
      }
    case "announce":
      return event.text;
    case "death":
      return `${p(event.seat)} ${CAUSE_NAMES[event.cause] ?? "出局"}。`;
    case "speech":
      return event.text;
    case "vote":
      return `${p(event.actor)} 投给 ${event.target ? p(event.target) : "弃票"}${event.reason ? `：${event.reason}` : "。"}`;
    case "vote_result":
      return event.exiled ? `${p(event.exiled)} 被投票放逐。` : event.tie ? "平票，今天无人出局。" : "无人得票，今天无人出局。";
    case "hunter_shot":
      return event.target ? `${p(event.actor)} 开枪带走了 ${p(event.target)}。` : `${p(event.actor)} 选择不开枪。`;
    case "judge":
      return event.text;
    case "game_end":
      return `${WINNER_NAMES[event.winner]}。${event.reason ?? ""}`;
    case "error":
    case "ai_error":
      return event.message;
    default:
      return "";
  }
}

export function buildState(game, events) {
  const players = (game?.players ?? []).map((p) => ({
    ...p,
    ...personaById[p.personaId],
    id: p.personaId,
    alive: true,
    cause: null,
    lastSpeech: "",
  }));
  const bySeat = Object.fromEntries(players.map((p) => [p.seat, p]));

  const state = {
    game,
    players,
    bySeat,
    day: 0,
    phase: "waiting",
    phaseLabel: "等待开局",
    nightStep: null, // wolves -> seer -> witch -> quiet, for the night banner
    currentSpeaker: null,
    turn: null,
    speeches: [],
    votes: [],
    voteResults: [],
    nightActions: [],
    thoughts: [],
    judge: "",
    log: [], // every event with day attached, for timeline & replay
    ended: null,
    error: null,
    aiErrors: [], // failed AI calls (secret ones only matter in god view)
    voteProgress: null,
  };

  for (const event of events) {
    const withDay = { ...event, day: event.day ?? state.day };
    switch (event.type) {
      case "phase":
        state.day = event.day;
        withDay.day = event.day;
        state.phase = event.phase;
        state.phaseLabel = event.label;
        state.currentSpeaker = null;
        state.turn = null;
        state.nightStep = event.phase === "night" ? "wolves" : null;
        if (event.phase === "vote") state.voteProgress = { done: 0, total: players.filter((p) => p.alive).length };
        break;
      case "turn":
        state.currentSpeaker = event.actor;
        state.turn = { index: event.index, total: event.total };
        break;
      case "speech":
        state.speeches.push(withDay);
        if (bySeat[event.actor]) bySeat[event.actor].lastSpeech = event.text;
        if (event.thought) state.thoughts.push({ ...withDay, source: event.kind === "last_words" ? "遗言" : "发言" });
        break;
      case "vote":
        state.votes.push(withDay);
        if (state.voteProgress) state.voteProgress.done += 1;
        if (event.thought) state.thoughts.push({ ...withDay, source: "投票" });
        break;
      case "vote_result":
        state.voteResults.push(withDay);
        break;
      case "night_action":
        state.nightActions.push(withDay);
        if (event.action === "wolf_kill" && event.final) state.nightStep = "seer";
        else if (event.action === "seer_check") state.nightStep = "witch";
        else if (event.action.startsWith("witch")) state.nightStep = "quiet";
        if (event.thought) state.thoughts.push({ ...withDay, source: "夜晚" });
        break;
      case "hunter_shot":
        if (event.thought) state.thoughts.push({ ...withDay, source: "开枪" });
        break;
      case "death":
        if (bySeat[event.seat]) {
          bySeat[event.seat].alive = false;
          bySeat[event.seat].cause = event.cause;
        }
        break;
      case "judge":
        state.judge = event.text;
        break;
      case "game_end":
        state.ended = event;
        state.phase = "ended";
        state.phaseLabel = WINNER_NAMES[event.winner];
        state.currentSpeaker = null;
        break;
      case "error":
        state.error = event.message;
        break;
      case "ai_error":
        state.aiErrors.push(withDay);
        break;
      default:
        break;
    }
    if (event.type !== "turn" && event.type !== "game_start") state.log.push(withDay);
  }

  if (game?.status === "aborted" && !state.ended) {
    state.phase = "ended";
    state.phaseLabel = "对局中断";
    state.error = state.error ?? game.reason ?? "对局中断";
  }

  state.aliveCount = players.filter((p) => p.alive).length;
  return state;
}
