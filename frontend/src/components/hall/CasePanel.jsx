import React from "react";
import { describe } from "../../lib/gameState.js";
import { cnNumber } from "../../lib/scenes.js";

const pad = (n) => String(n).padStart(2, "0");
const CLUE_TYPES = new Set(["announce", "vote", "vote_result", "hunter_shot", "judge", "game_end", "error", "ai_error"]);

function byDay(items) {
  const groups = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.day === item.day) last.items.push(item);
    else groups.push({ day: item.day, items: [item] });
  }
  return groups;
}

// The parchment "对局案卷": the speech record and a clue log.
export default function CasePanel({ state, godView, footer }) {
  const [tab, setTab] = React.useState("speech");
  const list = React.useRef(null);

  const clues = state.log.filter(
    (e) =>
      (CLUE_TYPES.has(e.type) && !(e.type === "ai_error" && e.secret && !godView)) ||
      (godView && e.type === "night_action" && !(e.action === "wolf_kill" && !e.final)) ||
      (godView && e.type === "speech" && e.thought),
  );
  const items = tab === "speech" ? state.speeches : clues;
  const latestSpeech = state.speeches.at(-1)?.seq;

  React.useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [items.length, tab]);

  function renderSpeech(item) {
    const p = state.bySeat[item.actor];
    return (
      <li key={item.seq} className={`case-entry ${item.seq === latestSpeech ? "is-current" : ""} ${item.fallback ? "is-fallback" : ""}`}>
        <h4>
          {pad(p.seat)} {p.name}
          {godView && <small className={p.camp === "wolf" ? "wolf" : ""}>{p.roleName}</small>}
          {item.kind === "last_words" && <small>遗言</small>}
          {item.fallback && <small className="fault">连线中断</small>}
        </h4>
        <p>{item.text}</p>
      </li>
    );
  }

  function renderClue(item) {
    if (item.type === "speech") {
      const p = state.bySeat[item.actor];
      return (
        <li key={`${item.seq}-t`} className="case-entry case-entry--thought">
          <h4>{pad(p.seat)} {p.name} · 内心</h4>
          <p>{item.thought}</p>
        </li>
      );
    }
    const secret = item.type === "night_action";
    const fault = item.type === "ai_error";
    return (
      <li key={item.seq} className={`case-entry case-entry--clue ${secret ? "is-secret" : ""} ${fault ? "is-fault" : ""}`}>
        {secret && <h4>夜间密档</h4>}
        {fault && <h4>连线故障</h4>}
        {item.type === "judge" && <h4>审判长</h4>}
        <p>{describe(item, state.bySeat)}</p>
        {godView && item.thought && item.type !== "speech" && <small>内心：{item.thought}</small>}
      </li>
    );
  }

  return (
    <aside className="case-panel" aria-label="对局案卷">
      <header className="case-head">
        <h2>对局案卷</h2>
        <div className="case-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "speech"} onClick={() => setTab("speech")}>
            发言记录
          </button>
          <button type="button" role="tab" aria-selected={tab === "clues"} onClick={() => setTab("clues")}>
            线索
          </button>
        </div>
      </header>
      <div className="case-list" ref={list}>
        {items.length === 0 ? (
          <p className="case-empty">{tab === "speech" ? "还没有人开口。" : "暂时没有线索。"}</p>
        ) : (
          byDay(items).map((group) => (
            <section key={group.day}>
              <h3 className="case-day">第{cnNumber(group.day)}天</h3>
              <ol>{group.items.map(tab === "speech" ? renderSpeech : renderClue)}</ol>
            </section>
          ))
        )}
      </div>
      {footer}
    </aside>
  );
}
