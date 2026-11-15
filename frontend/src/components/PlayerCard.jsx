import Avatar from "./Avatar.jsx";
import { CAUSE_NAMES } from "../lib/gameState.js";

// `player` is a persona, optionally with game fields (seat, roleName, camp, alive, lastSpeech).
export default function PlayerCard({ player, small = false, showRole = true, speaking = false }) {
  const inGame = player.seat !== undefined;
  const classes = [
    "player-card",
    small ? "player-card--small" : "",
    inGame && !player.alive ? "is-dead" : "",
    speaking ? "is-speaking" : "",
  ].join(" ");

  let text = player.tag;
  if (!small && inGame) {
    if (!player.alive) text = CAUSE_NAMES[player.cause] ?? "已出局";
    else text = player.lastSpeech || (speaking ? "正在组织发言……" : "等待发言");
  }

  return (
    <article className={classes}>
      <Avatar persona={player} as="div" />
      <div className="player-copy">
        <div className="player-line">
          <h3>
            {inGame && <small className="seat-no">{player.seat}</small>}
            {player.name}
          </h3>
          {inGame && <span className={`status-dot ${player.alive ? "alive" : "dead"}`} />}
        </div>
        {inGame ? (
          <span className={showRole && player.camp === "wolf" ? "role-pill wolf" : "role-pill"}>
            {showRole ? player.roleName : "身份未知"}
          </span>
        ) : (
          <span className="role-pill">{player.tone}</span>
        )}
        <p>{text}</p>
      </div>
    </article>
  );
}
