// Builds the homepage "case file" (seat-by-seat statements and votes for night 1 / day 1)
// from a real archived game. Falls back to a hand-written demo when no game exists yet.

import { personas } from "../../../shared/personas.js";

const pad = (n) => String(n).padStart(2, "0");

function firstSentence(text, max = 26) {
  // Skip throat-clearing openers like "4号发言。" and quote the first substantive sentence.
  const sentences = text.split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean);
  const cut = sentences.find((s) => s.length >= 8) ?? sentences[0] ?? text;
  return cut.length > max ? `${cut.slice(0, max)}……` : cut;
}

const FALLBACK = {
  id: null,
  title: "雨夜圆桌",
  live: false,
  seats: personas.map((p, i) => ({ seat: i + 1, name: p.name, alive: true })),
  night: "夜间行动已封存。进入第一天查看这位选手的公开发言。",
  statements: [
    "先把 02 号和 07 号的原话分开记，我想知道他们各自依据哪一句。",
    "我质疑的是 05 号为什么附和。至于 07 号为何替我解释，这你得问他。",
    "07 号先说没听清 02 号的发言，转头却替 02 号解释。你能说清楚你为什么改口吗？",
    "02 号一直在问谁附和，却没说自己最怀疑谁。",
    "我提议先票 07 号。他对 02 号两次发言的说法对不上。",
    "07 号只引用了半句话。我会先看他没引用的那半句。",
    "我只听清 02 号追问 05 号为什么附和。听清一句，和听清全部是两回事。",
    "07 号解释了自己听到什么，但 02 号从头到尾没给过明确的怀疑对象。",
  ],
  votes: [2, 7, 2, 2, 7, 7, 2, 2],
  voteReasons: [],
  exiled: 2,
  announce: "首夜平安。",
  defaultSeat: 3,
  files: [
    { key: "challenge", seat: 3, step: 1, label: "证词", title: "“你为什么改口？”", text: "03 号质问 07 号为何替 02 号说话。" },
    { key: "defense", seat: 7, step: 1, label: "回应", title: "“听清一句，和听清全部是两回事。”", text: "07 号解释自己听到的那句话。" },
    { key: "ballot", seat: 7, step: 2, label: "票型", title: "07 号最终把票投给了谁？", text: "回到投票轮，追踪这张票的去向。" },
  ],
};

export function buildCase(game) {
  if (!game) return FALLBACK;
  const events = game.events;
  const dayOf = [];
  let day = 0;
  for (const e of events) {
    if (e.type === "phase") day = e.day;
    dayOf.push(day);
  }
  const d1 = events.filter((e, i) => dayOf[i] === 1);
  const speeches = {};
  for (const e of d1) if (e.type === "speech" && !e.fallback && !speeches[e.actor]) speeches[e.actor] = e.text;
  const votes = Array(8).fill(null);
  const voteReasons = Array(8).fill("");
  for (const e of d1) {
    if (e.type === "vote") {
      votes[e.actor - 1] = e.target ?? null;
      voteReasons[e.actor - 1] = e.reason ?? "";
    }
  }
  const result = d1.find((e) => e.type === "vote_result");
  const announce = d1.find((e) => e.type === "announce")?.text ?? "";
  const nightDead = new Set(events.filter((e, i) => e.type === "death" && dayOf[i] === 1 && (e.cause === "wolf" || e.cause === "poison")).map((e) => e.seat));

  const tally = {};
  for (const v of votes) if (v) tally[v] = (tally[v] ?? 0) + 1;
  const top = Number(Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0);
  const exiled = result?.exiled ?? null;
  const focus = exiled ?? top ?? null;

  const files = [];
  const accuser = votes.findIndex((v, i) => v === focus && speeches[i + 1]) + 1;
  if (accuser > 0) {
    files.push({ key: "challenge", seat: accuser, step: 1, label: "证词", title: `“${firstSentence(speeches[accuser])}”`, text: `${pad(accuser)} 号在第一天把矛头指向了 ${pad(focus)} 号。` });
  }
  if (focus && speeches[focus]) {
    files.push({ key: "defense", seat: focus, step: 1, label: "回应", title: `“${firstSentence(speeches[focus])}”`, text: `${pad(focus)} 号是第一天得票最多的人，听听他怎么说。` });
  }
  if (focus && votes[focus - 1]) {
    files.push({ key: "ballot", seat: focus, step: 2, label: "票型", title: `${pad(focus)} 号最终把票投给了谁？`, text: "回到投票轮，追踪这张票的去向。" });
  }

  return {
    id: game.id,
    title: game.title,
    live: game.status === "running",
    seats: game.players.map((p) => ({ seat: p.seat, name: p.name, alive: !nightDead.has(p.seat) })),
    night: "夜间行动已封存。进入第一天查看这位选手的公开发言。",
    statements: Array.from({ length: 8 }, (_, i) =>
      speeches[i + 1] ?? (nightDead.has(i + 1) ? "昨夜出局，没能在第一天发言。" : "这一轮没有留下发言。"),
    ),
    votes,
    voteReasons,
    exiled,
    announce,
    defaultSeat: accuser > 0 ? accuser : 1,
    files,
  };
}
