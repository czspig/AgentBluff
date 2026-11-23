// Werewolf game engine for an 8-seat AI-only table.
// It owns the rules and the state; every decision is delegated to `ai.decide(request)`.
// Everything that happens is reported through `emit(type, payload)`, which is the only
// output channel (events are persisted and streamed to spectators).

import { CAMP_NAMES, ROLE_DECK, ROLES, personas } from "../../../shared/personas.js";

const MAX_DAYS = 8;
// Consecutive failed AI calls (each already retried by the provider) before the game is abandoned.
const MAX_FAIL_STREAK = 6;

// What a failed decision turns into, per request kind: [Chinese action name, fallback description].
const FALLBACKS = {
  speech: ["发言", "本轮视为未发言"],
  last_words: ["遗言", "视为没有遗言"],
  vote: ["投票", "本次视为弃票"],
  wolf_kill: ["夜间行动", "目标随机选取"],
  seer_check: ["查验", "目标随机选取"],
  witch: ["用药", "本夜不用药"],
  hunter: ["开枪", "目标随机选取"],
};
// Night failures reveal the actor's role, so they are only shown in god view.
const SECRET_KINDS = new Set(["wolf_kill", "seer_check", "witch"]);

export const FALLBACK_SPEECH = "（连线中断，这一轮没有发言。）";

export class AiUnavailableError extends Error {
  constructor() {
    super("AI 服务连续无响应，对局已中止。");
    this.userMessage = this.message;
  }
}

function shuffle(list, rng = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Seats are fixed (persona order = seat order, matching the artwork); only roles are dealt.
export function dealPlayers(rng = Math.random) {
  const roles = shuffle(ROLE_DECK, rng);
  return personas.map((persona, index) => ({
    seat: index + 1,
    personaId: persona.id,
    name: persona.name,
    role: roles[index],
    roleName: ROLES[roles[index]].name,
    camp: ROLES[roles[index]].camp,
    alive: true,
  }));
}

export class Game {
  // `readingDelay(text)` returns how long (ms) spectators need to read a line; the engine
  // waits that long after each speech so a live game is watchable. Defaults to no pause.
  // `nightBeatMs` is the same idea for night steps, which have no speech text of their own.
  constructor({ players, ai, emit, signal, readingDelay = () => 0, nightBeatMs = 0 }) {
    this.players = players;
    this.ai = ai;
    this.emit = emit;
    this.signal = signal;
    this.readingDelay = readingDelay;
    this.nightBeatMs = nightBeatMs;
    this.day = 0;
    this.publicLog = [];
    this.notes = Object.fromEntries(players.map((p) => [p.seat, []]));
    this.potions = { save: true, poison: true };
    this.seerChecked = new Set();
    this.winner = null;
    this.failStreak = 0;
    this.aiFailures = 0;
  }

  // ---------- helpers ----------

  get alive() {
    return this.players.filter((p) => p.alive);
  }

  bySeat(seat) {
    return this.players.find((p) => p.seat === seat);
  }

  label(p) {
    return `${p.seat}号 ${p.name}`;
  }

  checkAborted() {
    if (this.signal?.aborted) throw new Error("aborted");
  }

  async ask(player, request) {
    this.checkAborted();
    const context = {
      day: this.day,
      self: player,
      players: this.players.map(({ seat, name, alive }) => ({ seat, name, alive })),
      publicLog: this.publicLog,
      notes: this.notes[player.seat],
      teammates:
        player.role === "wolf"
          ? this.players.filter((p) => p.role === "wolf" && p.seat !== player.seat).map((p) => this.label(p))
          : [],
    };
    const result = await this.ai.decide({ ...request, context });
    this.checkAborted();
    if (result?.__failed) return this.aiFailed(player, request.kind);
    this.failStreak = 0;
    return result ?? {};
  }

  // A decision the AI could not make: tell spectators, count it, and give up if the service is down.
  aiFailed(player, kind) {
    this.failStreak += 1;
    this.aiFailures += 1;
    if (player) {
      const [action, fallback] = FALLBACKS[kind] ?? ["行动", "按默认处理"];
      this.emit("ai_error", {
        actor: player.seat,
        kind,
        secret: SECRET_KINDS.has(kind),
        message: `${this.label(player)} 的${action}请求失败（AI 服务无响应），${fallback}。`,
      });
    }
    if (this.failStreak >= MAX_FAIL_STREAK) throw new AiUnavailableError();
    return { __fallback: true };
  }

  // Keep only targets from the allowed list; otherwise pick a random allowed one.
  pickTarget(raw, allowed, { allowNone = false } = {}) {
    const seat = Number.parseInt(raw, 10);
    if (allowed.includes(seat)) return seat;
    if (allowNone && (raw === 0 || raw === "0" || raw === null || raw === undefined)) return 0;
    if (allowNone) return 0;
    return allowed[Math.floor(Math.random() * allowed.length)];
  }

  log(line) {
    this.publicLog.push(line);
  }

  async pause(text) {
    const ms = this.readingDelay(text);
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
    this.checkAborted();
  }

  // Night beats are emitted back-to-back once a decision returns. Spectators only see a
  // step for as long as the engine waits before the next emit, so hold each one here.
  async holdNight() {
    if (this.nightBeatMs > 0) await new Promise((r) => setTimeout(r, this.nightBeatMs));
    this.checkAborted();
  }

  note(seat, line) {
    this.notes[seat].push(`第${this.day}天：${line}`);
  }

  kill(player, cause) {
    if (!player.alive) return;
    player.alive = false;
    player.cause = cause;
    this.emit("death", { seat: player.seat, cause });
  }

  checkWinner() {
    const alive = this.alive;
    const wolves = alive.filter((p) => p.camp === "wolf").length;
    const gods = alive.filter((p) => ROLES[p.role].god).length;
    const villagers = alive.filter((p) => p.role === "villager").length;
    if (wolves === 0) return { winner: "good", reason: "所有狼人均已出局。" };
    if (gods === 0) return { winner: "wolf", reason: "所有神职均已出局，狼人屠边获胜。" };
    if (villagers === 0) return { winner: "wolf", reason: "所有平民均已出局，狼人屠边获胜。" };
    if (wolves >= alive.length - wolves) return { winner: "wolf", reason: "狼人数量已不少于好人。" };
    return null;
  }

  // ---------- phases ----------

  async run() {
    this.emit("game_start", {
      players: this.players.map(({ seat, personaId, name, role, roleName, camp }) => ({
        seat,
        personaId,
        name,
        role,
        roleName,
        camp,
      })),
    });

    for (this.day = 1; this.day <= MAX_DAYS; this.day += 1) {
      const nightDeaths = await this.night();
      await this.dawn(nightDeaths);
      if (await this.settle()) return this.winner;

      await this.discussion();
      await this.voting();
      if (await this.settle()) return this.winner;
    }

    this.winner = { winner: "draw", reason: `${MAX_DAYS} 天内未分胜负，判定平局。` };
    this.emit("game_end", this.winner);
    return this.winner;
  }

  async settle() {
    const result = this.checkWinner();
    if (!result) return false;
    this.winner = result;
    this.emit("game_end", { ...result, winnerName: CAMP_NAMES[result.winner] });
    return true;
  }

  async night() {
    this.emit("phase", { day: this.day, phase: "night", label: `第 ${this.day} 夜` });
    this.log(`—— 第${this.day}夜 ——`);
    await this.holdNight();

    // Wolves: sequential, the second wolf sees the first one's proposal and makes the final call.
    const wolves = this.alive.filter((p) => p.role === "wolf");
    const wolfTargets = this.alive.filter((p) => p.role !== "wolf").map((p) => p.seat);
    let victimSeat = null;
    let proposal = null;
    for (const wolf of wolves) {
      const decision = await this.ask(wolf, {
        kind: "wolf_kill",
        player: wolf,
        options: wolfTargets,
        proposal: proposal ? this.label(this.bySeat(proposal)) : null,
      });
      const target = this.pickTarget(decision.target, wolfTargets);
      proposal = target;
      victimSeat = target;
      this.emit("night_action", {
        actor: wolf.seat,
        action: "wolf_kill",
        target,
        thought: decision.thought ?? "",
        final: wolf === wolves[wolves.length - 1],
      });
      await this.holdNight();
    }
    for (const wolf of wolves) this.note(wolf.seat, `狼队夜里决定袭击 ${this.label(this.bySeat(victimSeat))}。`);

    // Seer.
    const seer = this.alive.find((p) => p.role === "seer");
    if (seer) {
      const options = this.alive
        .filter((p) => p.seat !== seer.seat && !this.seerChecked.has(p.seat))
        .map((p) => p.seat);
      if (options.length) {
        const decision = await this.ask(seer, { kind: "seer_check", player: seer, options });
        const target = this.pickTarget(decision.target, options);
        this.seerChecked.add(target);
        const checked = this.bySeat(target);
        const isWolf = checked.camp === "wolf";
        this.note(seer.seat, `查验 ${this.label(checked)}，结果是${isWolf ? "狼人（查杀）" : "好人（金水）"}。`);
        this.emit("night_action", {
          actor: seer.seat,
          action: "seer_check",
          target,
          result: isWolf ? "wolf" : "good",
          thought: decision.thought ?? "",
        });
        await this.holdNight();
      }
    }

    // Witch. No self-save; at most one potion per night.
    let savedSeat = null;
    let poisonedSeat = null;
    const witch = this.alive.find((p) => p.role === "witch");
    if (witch && (this.potions.save || this.potions.poison)) {
      const canSave = this.potions.save && victimSeat !== null && victimSeat !== witch.seat;
      const poisonOptions = this.potions.poison
        ? this.alive.filter((p) => p.seat !== witch.seat).map((p) => p.seat)
        : [];
      const decision = await this.ask(witch, {
        kind: "witch",
        player: witch,
        victim: victimSeat ? this.label(this.bySeat(victimSeat)) : null,
        canSave,
        canPoison: poisonOptions.length > 0,
        options: poisonOptions,
      });
      let action = "pass";
      if (decision.action === "save" && canSave) {
        action = "save";
        savedSeat = victimSeat;
        this.potions.save = false;
        this.note(witch.seat, `用解药救下了 ${this.label(this.bySeat(victimSeat))}。`);
      } else if (decision.action === "poison" && poisonOptions.length) {
        action = "poison";
        poisonedSeat = this.pickTarget(decision.target, poisonOptions);
        this.potions.poison = false;
        this.note(witch.seat, `用毒药毒了 ${this.label(this.bySeat(poisonedSeat))}。`);
      } else {
        this.note(witch.seat, victimSeat ? `今晚 ${this.label(this.bySeat(victimSeat))} 被刀，没有用药。` : "今晚没有用药。");
      }
      this.emit("night_action", {
        actor: witch.seat,
        action: `witch_${action}`,
        target: action === "save" ? savedSeat : action === "poison" ? poisonedSeat : victimSeat,
        thought: decision.thought ?? "",
      });
      await this.holdNight();
    }

    const deaths = [];
    if (victimSeat !== null && victimSeat !== savedSeat) deaths.push({ seat: victimSeat, cause: "wolf" });
    if (poisonedSeat !== null && poisonedSeat !== victimSeat) deaths.push({ seat: poisonedSeat, cause: "poison" });
    if (poisonedSeat !== null && poisonedSeat === victimSeat && savedSeat === null) {
      deaths[0].cause = "poison";
    }
    return deaths;
  }

  async dawn(deaths) {
    this.emit("phase", { day: this.day, phase: "day", label: `第 ${this.day} 天 · 天亮` });
    this.log(`—— 第${this.day}天 ——`);
    const sorted = [...deaths].sort((a, b) => a.seat - b.seat);
    const text = sorted.length
      ? `天亮了，昨晚 ${sorted.map((d) => this.label(this.bySeat(d.seat))).join("、")} 死亡。`
      : "天亮了，昨晚是平安夜。";
    this.emit("announce", { text, deaths: sorted.map((d) => d.seat) });
    this.log(text);
    for (const d of sorted) this.kill(this.bySeat(d.seat), d.cause);
    await this.holdNight();

    for (const d of sorted) {
      const dead = this.bySeat(d.seat);
      if (this.day === 1) await this.lastWords(dead);
      if (dead.role === "hunter" && d.cause !== "poison") await this.hunterShot(dead);
    }
  }

  async lastWords(player) {
    const decision = await this.ask(player, { kind: "last_words", player });
    const fallback = Boolean(decision.__fallback);
    const text = fallback ? FALLBACK_SPEECH : String(decision.speech ?? "").trim() || "我没有什么要说的了。";
    this.emit("speech", { actor: player.seat, kind: "last_words", text, thought: decision.thought ?? "", ...(fallback && { fallback }) });
    this.log(`${this.label(player)}（遗言）：${text}`);
    await this.pause(text);
  }

  async hunterShot(hunter) {
    const options = this.alive.map((p) => p.seat);
    if (!options.length) return;
    const decision = await this.ask(hunter, { kind: "hunter", player: hunter, options });
    const shoot = decision.shoot !== false && decision.target !== 0;
    if (!shoot) {
      this.emit("hunter_shot", { actor: hunter.seat, target: null, thought: decision.thought ?? "" });
      this.log(`${this.label(hunter)} 亮出猎人身份，但选择不开枪。`);
      await this.holdNight();
      return;
    }
    const target = this.pickTarget(decision.target, options);
    this.emit("hunter_shot", { actor: hunter.seat, target, thought: decision.thought ?? "" });
    this.log(`${this.label(hunter)} 亮出猎人身份，开枪带走了 ${this.label(this.bySeat(target))}。`);
    this.kill(this.bySeat(target), "hunter");
    await this.holdNight();
  }

  async discussion() {
    this.emit("phase", { day: this.day, phase: "discussion", label: `第 ${this.day} 天 · 公开发言` });
    // Rotate the starting seat each day so nobody always speaks first.
    const alive = this.alive;
    const start = (this.day - 1) % alive.length;
    const order = [...alive.slice(start), ...alive.slice(0, start)];
    for (const [index, player] of order.entries()) {
      if (!player.alive) continue;
      this.emit("turn", { actor: player.seat, index: index + 1, total: order.length });
      const decision = await this.ask(player, { kind: "speech", player });
      const fallback = Boolean(decision.__fallback);
      const text = fallback ? FALLBACK_SPEECH : String(decision.speech ?? "").trim() || "过。";
      this.emit("speech", { actor: player.seat, kind: "speech", text, thought: decision.thought ?? "", ...(fallback && { fallback }) });
      this.log(fallback ? `${this.label(player)} 因连线中断没有发言。` : `${this.label(player)}：${text}`);
      await this.pause(text);
    }

    let judge = await this.ai.decide({
      kind: "judge",
      context: {
        day: this.day,
        players: this.players.map(({ seat, name, alive }) => ({ seat, name, alive })),
        publicLog: this.publicLog,
      },
    });
    // The judge is commentary only: a failure is counted toward the streak but not announced.
    if (judge?.__failed) judge = this.aiFailed(null, "judge");
    else this.failStreak = 0;
    if (judge?.comment) {
      const text = String(judge.comment).trim();
      this.emit("judge", { text });
      await this.pause(text);
    }
  }

  async voting() {
    this.emit("phase", { day: this.day, phase: "vote", label: `第 ${this.day} 天 · 放逐投票` });
    const voters = this.alive;
    const options = voters.map((p) => p.seat);
    const tally = {};
    const votes = [];
    for (const voter of voters) {
      const allowed = options.filter((s) => s !== voter.seat);
      const decision = await this.ask(voter, { kind: "vote", player: voter, options: allowed });
      const target = this.pickTarget(decision.target, allowed, { allowNone: true });
      votes.push({ voter: voter.seat, target });
      if (target) tally[target] = (tally[target] ?? 0) + 1;
      this.emit("vote", {
        actor: voter.seat,
        target: target || null,
        reason: String(decision.reason ?? "").trim(),
        thought: decision.thought ?? "",
        ...(decision.__fallback && { fallback: true }),
      });
    }

    const max = Math.max(0, ...Object.values(tally));
    const leaders = Object.keys(tally).filter((s) => tally[s] === max).map(Number);
    const exiled = max > 0 && leaders.length === 1 ? leaders[0] : null;
    const summary = votes
      .map((v) => `${v.voter}号→${v.target ? `${v.target}号` : "弃票"}`)
      .join("，");
    this.emit("vote_result", { tally, exiled, tie: leaders.length > 1 });
    this.log(`投票：${summary}。${exiled ? `${this.label(this.bySeat(exiled))} 被放逐。` : "平票或无人得票，无人出局。"}`);

    if (exiled) {
      const player = this.bySeat(exiled);
      this.kill(player, "vote");
      await this.lastWords(player);
      if (player.role === "hunter") await this.hunterShot(player);
    }
  }
}
