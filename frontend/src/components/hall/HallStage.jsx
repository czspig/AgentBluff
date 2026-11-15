import { SCENES } from "../../lib/scenes.js";
import { describe, playerLabel } from "../../lib/gameState.js";

const pad = (n) => String(n).padStart(2, "0");
const pct = (v, total) => `${(v / total) * 100}%`;

const NIGHT_NARRATION = {
  wolves: "天黑请闭眼。狼人请睁眼，选择今晚的目标……",
  seer: "狼人请闭眼。预言家请睁眼，你要查验谁？",
  witch: "预言家请闭眼。女巫请睁眼……",
  quiet: "夜色渐深，所有人都在静候天明。",
};

// The one line shown over the painting: who is talking / what just happened.
export function caption(state, godView) {
  if (state.phase === "ended") {
    return { who: "终局", text: state.ended?.reason ?? state.error ?? "对局中断。" };
  }
  const last = state.log.at(-1);
  const speaker = state.currentSpeaker && state.bySeat[state.currentSpeaker];
  if (speaker && !(last?.type === "speech" && last.actor === speaker.seat)) {
    return { who: `${pad(speaker.seat)} ${speaker.name}`, text: "正在组织发言……", thinking: true };
  }
  if (!last) return { who: "旁白", text: "八位选手正在入座……", thinking: true };
  switch (last.type) {
    case "speech": {
      const p = state.bySeat[last.actor];
      return { who: `${pad(p.seat)} ${p.name}${last.kind === "last_words" ? " · 遗言" : ""}`, text: last.text };
    }
    case "judge":
      return { who: "审判长", text: last.text };
    case "ai_error":
      if (!last.secret || godView) return { who: "连线故障", text: last.message, fault: true };
      return { who: "旁白", text: NIGHT_NARRATION[state.nightStep] ?? NIGHT_NARRATION.quiet };
    case "night_action":
      return godView
        ? { who: "上帝视角", text: describe(last, state.bySeat) }
        : { who: "旁白", text: NIGHT_NARRATION[state.nightStep] ?? NIGHT_NARRATION.quiet };
    case "phase":
      if (last.phase === "night") return { who: "旁白", text: NIGHT_NARRATION.wolves };
      if (last.phase === "vote") return { who: "旁白", text: "发言结束，开始放逐投票。" };
      return { who: "旁白", text: last.label };
    default:
      return { who: "旁白", text: describe(last, state.bySeat) };
  }
}

function VoteLines({ scene, votes, bySeat }) {
  if (!votes.length) return null;
  return (
    <svg className="hall-votes" viewBox={`0 0 ${scene.w} ${scene.h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <marker id="hall-vote-tip" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0 0 L10 5 L0 10 L3 5 Z" fill="currentColor" />
        </marker>
      </defs>
      {votes.map((vote) => {
        const [x1, y1] = scene.figures[vote.actor - 1];
        const [x2, y2] = scene.figures[vote.target - 1];
        // Bend each arrow sideways so crossing votes stay distinguishable.
        const mx = (x1 + x2) / 2 + (y2 - y1) * 0.18;
        const my = (y1 + y2) / 2 - (x2 - x1) * 0.18;
        const wolf = bySeat[vote.actor]?.camp === "wolf";
        return (
          <path
            key={vote.seq}
            className={wolf ? "is-wolf" : ""}
            d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`}
            markerEnd="url(#hall-vote-tip)"
          />
        );
      })}
    </svg>
  );
}

export default function HallStage({ state, sceneKey, godView, children }) {
  const scene = SCENES[sceneKey];
  const plateFont = (scene.plates[0][3] * 0.56 * 100) / scene.w;

  // Arrows stay up for the whole vote phase (including the exiled player's last words).
  const dayVotes = state.phase === "vote" ? state.votes.filter((v) => v.day === state.day && v.target) : [];
  const tally = {};
  for (const v of dayVotes) tally[v.target] = (tally[v.target] ?? 0) + 1;

  return (
    <div
      className={`hall-stage hall-stage--${sceneKey}`}
      style={{ "--ar": `${scene.w} / ${scene.h}`, "--ar-num": scene.w / scene.h, "--plate-font": `${plateFont}cqw` }}
    >
      {Object.entries(SCENES).map(([key, s]) => (
        <img key={key} className={`hall-art ${key === sceneKey ? "is-current" : ""}`} src={s.src} alt="" aria-hidden="true" />
      ))}

      {state.players.map((player) => {
        const [fx, fy] = scene.figures[player.seat - 1];
        const speaking = state.currentSpeaker === player.seat;
        const wolfNight = godView && sceneKey === "wolves" && player.camp === "wolf" && player.alive;
        return (
          <span
            key={`f${player.seat}`}
            className={`hall-figure ${speaking ? "is-speaking" : ""} ${!player.alive ? "is-dead" : ""} ${wolfNight ? "is-wolf" : ""}`}
            style={{ left: pct(fx, scene.w), top: pct(fy, scene.h) }}
          />
        );
      })}

      <VoteLines scene={scene} votes={dayVotes} bySeat={state.bySeat} />

      {state.players.map((player) => {
        const [cx, cy, w, h] = scene.plates[player.seat - 1];
        const speaking = state.currentSpeaker === player.seat;
        const classes = [
          "hall-plate",
          speaking ? "is-speaking" : "",
          !player.alive ? "is-dead" : "",
          godView && player.camp === "wolf" ? "is-wolf" : "",
        ].join(" ");
        return (
          <a
            key={`p${player.seat}`}
            className={classes}
            href={`#/profile/${player.personaId}`}
            title={`${playerLabel(player)}${godView ? ` · ${player.roleName}` : ""}${player.alive ? "" : " · 已出局"}`}
            style={{ left: pct(cx, scene.w), top: pct(cy, scene.h), width: pct(w + 12, scene.w), height: pct(h + 6, scene.h) }}
          >
            {speaking && <i className="hall-plate-dot" />}
            <span>{pad(player.seat)}</span>
            <span>{player.name}</span>
            {(godView || !player.alive || tally[player.seat]) && (
              <em className="hall-plate-tags">
                {godView && <b className={player.camp === "wolf" ? "wolf" : ""}>{player.roleName}</b>}
                {!player.alive && <b className="dead">出局</b>}
                {tally[player.seat] ? <b className="votes">{tally[player.seat]} 票</b> : null}
              </em>
            )}
          </a>
        );
      })}

      {children}
    </div>
  );
}

// One line under the painting: who is talking / what just happened.
export function HallCaption({ state, godView }) {
  const line = caption(state, godView);
  return (
    <div className={`hall-caption ${line.thinking ? "is-thinking" : ""} ${line.fault ? "is-fault" : ""}`} key={`${state.log.length}-${state.currentSpeaker}`} aria-live="polite">
      <strong>{line.who}</strong>
      <p>{line.text}</p>
    </div>
  );
}
