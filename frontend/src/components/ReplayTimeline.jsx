import { describe } from "../lib/gameState.js";

// Maps engine events onto the dossier's existing visual variants.
const VARIANT = {
  night_action: (e) => (e.action === "seer_check" ? "check" : e.action.startsWith("witch") ? "save" : "night"),
  announce: () => "vote",
  speech: () => "speech",
  vote_result: () => "vote",
  hunter_shot: () => "night",
  death: () => "night",
  judge: () => "speech",
  game_end: () => "result",
  error: () => "result",
  ai_error: () => "fault",
};

const TITLE = {
  night_action: (e) =>
    ({ wolf_kill: "狼人行动", seer_check: "预言家查验", witch_save: "女巫用药", witch_poison: "女巫用药", witch_pass: "女巫行动" })[e.action],
  announce: () => "天亮公布",
  speech: (e, bySeat) => `${e.kind === "last_words" ? "遗言" : "发言"} · ${bySeat[e.actor]?.seat}号 ${bySeat[e.actor]?.name}`,
  vote_result: () => "投票结果",
  hunter_shot: () => "猎人开枪",
  death: () => "出局",
  judge: () => "审判长点评",
  game_end: () => "胜负判定",
  error: () => "对局中断",
  ai_error: () => "AI 连线故障",
};

export default function ReplayTimeline({ events, bySeat }) {
  if (!events.length) return <p className="feed-empty">这个筛选下没有记录。</p>;
  return (
    <section className="replay-timeline">
      {events.map((item) => (
        <article className={`replay-event replay-event--${VARIANT[item.type]?.(item) ?? "speech"}`} key={item.seq}>
          <span>{item.type === "night_action" || (item.type === "ai_error" && item.secret) ? `第 ${item.day} 夜` : `第 ${item.day} 天`}</span>
          <h3>{TITLE[item.type]?.(item, bySeat) ?? ""}</h3>
          <p>{describe(item, bySeat)}</p>
          {item.thought && <small className="replay-thought">内心：{item.thought}</small>}
        </article>
      ))}
    </section>
  );
}
