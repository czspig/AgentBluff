import React from "react";
import { describe, playerLabel } from "../lib/gameState.js";

const KIND = { speech: "发言", last_words: "遗言" };
const SOURCE_DESC = { 发言: "发言时", 遗言: "遗言时", 投票: "投票时", 夜晚: "夜里", 开枪: "开枪时" };

function groupByDay(items) {
  const groups = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.day === item.day) last.items.push(item);
    else groups.push({ day: item.day, items: [item] });
  }
  return groups;
}

export default function SpeechPanel({ state, godView }) {
  const [tab, setTab] = React.useState("公开发言");
  const tabs = godView ? ["公开发言", "心路历程", "投票记录", "夜晚日志"] : ["公开发言", "投票记录"];
  const activeTab = tabs.includes(tab) ? tab : "公开发言";
  const scroller = React.useRef(null);
  const name = (seat) => playerLabel(state.bySeat[seat]);

  const lists = {
    公开发言: state.speeches,
    心路历程: state.thoughts,
    投票记录: state.votes,
    夜晚日志: state.nightActions,
  };
  const items = lists[activeTab];

  // Keep the newest entry in view while the game is live.
  React.useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length, activeTab]);

  const speaker = state.currentSpeaker ? state.bySeat[state.currentSpeaker] : state.speeches.at(-1) && state.bySeat[state.speeches.at(-1).actor];

  function renderItem(item) {
    switch (activeTab) {
      case "公开发言":
        return (
          <li key={item.seq} className="feed-item">
            <header>
              <strong style={{ color: state.bySeat[item.actor]?.color }}>{name(item.actor)}</strong>
              {godView && <em>{state.bySeat[item.actor]?.roleName}</em>}
              {item.kind !== "speech" && <span className="feed-tag">{KIND[item.kind]}</span>}
            </header>
            <p>{item.text}</p>
          </li>
        );
      case "心路历程":
        return (
          <li key={`${item.seq}-t`} className="feed-item feed-item--thought">
            <header>
              <strong style={{ color: state.bySeat[item.actor]?.color }}>{name(item.actor)}</strong>
              <em>{state.bySeat[item.actor]?.roleName}</em>
              <span className="feed-tag">{SOURCE_DESC[item.source]}</span>
            </header>
            <p>{item.thought}</p>
          </li>
        );
      case "投票记录":
        return (
          <li key={item.seq} className="feed-item feed-item--compact">
            <p>{describe(item, state.bySeat)}</p>
            {godView && item.thought && <small>内心：{item.thought}</small>}
          </li>
        );
      default:
        return (
          <li key={item.seq} className="feed-item feed-item--compact">
            <p>{describe(item, state.bySeat)}</p>
            {item.thought && <small>内心：{item.thought}</small>}
          </li>
        );
    }
  }

  return (
    <section className="speech-panel">
      <div className="tabs">
        {tabs.map((item) => (
          <button className={activeTab === item ? "is-active" : ""} key={item} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
        {speaker && (
          <span>
            {state.currentSpeaker ? "正在发言" : "最近发言"}：{speaker.name}
            {godView ? `（${speaker.roleName}）` : ""}
          </span>
        )}
      </div>
      <div className="speech-content" ref={scroller}>
        {items.length === 0 ? (
          <p className="feed-empty">{state.phase === "ended" ? "本局没有相关记录。" : "还没有内容，稍等片刻……"}</p>
        ) : (
          groupByDay(items).map((group) => (
            <div className="feed-day" key={group.day}>
              <h4>第 {group.day} 天</h4>
              <ol className="feed">{group.items.map(renderItem)}</ol>
            </div>
          ))
        )}
        {activeTab === "投票记录" &&
          state.voteResults.map((result) => (
            <p className="feed-result" key={result.seq}>
              第 {result.day} 天结果：{describe(result, state.bySeat)}
            </p>
          ))}
      </div>
    </section>
  );
}
