import { describe } from "../lib/gameState.js";

const PUBLIC_TYPES = new Set(["announce", "death", "vote_result", "hunter_shot", "game_end", "error"]);

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("zh-CN", { hour12: false });
}

// Key moments, newest first. Night actions are secret, so they only show in god view.
export default function EventTimeline({ state, godView, limit = 12 }) {
  const items = state.log
    .filter((e) => PUBLIC_TYPES.has(e.type) || (godView && e.type === "night_action" && e.action !== "witch_pass" && (e.action !== "wolf_kill" || e.final)))
    .slice(-limit)
    .reverse();

  return (
    <article className="timeline-card">
      <div className="panel-title">
        <h2>事件时间轴</h2>
      </div>
      {items.length === 0 ? (
        <p className="feed-empty">天黑请闭眼……</p>
      ) : (
        <ol className="event-list">
          {items.map((event) => {
            const wolfish = event.type === "death" || (event.type === "night_action" && event.action === "wolf_kill");
            return (
              <li className={wolfish ? "wolf-event" : ""} key={event.seq}>
                <span className="event-dot" />
                <div>
                  <strong>第 {event.day} 天</strong>
                  <time>{formatTime(event.ts)}</time>
                  <p>{describe(event, state.bySeat)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}
