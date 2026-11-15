import React from "react";
import PlayerCard from "./PlayerCard.jsx";

function useElapsed(startedAt, endedAt) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    if (endedAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [endedAt]);
  if (!startedAt) return "00:00";
  const seconds = Math.max(0, Math.floor(((endedAt ?? now) - startedAt) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

const SHORT_PHASE = { night: "夜晚", day: "天亮", discussion: "公开发言", vote: "放逐投票", ended: "对局结束", waiting: "准备中" };

export default function RoundTable({ state, godView }) {
  const elapsed = useElapsed(state.game?.createdAt, state.game?.finishedAt);
  return (
    <section className={`round-table-wrap ${state.phase === "night" ? "is-night" : ""}`} aria-label="圆桌观战区">
      <div className="round-table">
        <div className="table-center">
          <span>{state.day ? `第 ${state.day} 天` : "当前阶段"}</span>
          <strong>{SHORT_PHASE[state.phase] ?? state.phaseLabel}</strong>
          <time>{elapsed}</time>
        </div>
        {state.players.map((player, index) => (
          <div className={`seat seat-${index + 1}`} key={player.seat}>
            <PlayerCard player={player} showRole={godView} speaking={state.currentSpeaker === player.seat} />
          </div>
        ))}
      </div>
    </section>
  );
}
