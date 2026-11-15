import React from "react";
import ReplayTimeline from "../components/ReplayTimeline.jsx";
import TopNav from "../components/TopNav.jsx";
import { api } from "../lib/api.js";
import { WINNER_NAMES } from "../lib/gameState.js";
import { useApi, useGame } from "../lib/useGame.js";

const SHOWN = new Set(["night_action", "announce", "speech", "vote_result", "hunter_shot", "judge", "game_end", "error", "ai_error"]);
const KEY = new Set(["announce", "vote_result", "hunter_shot", "game_end", "error"]);

const FILTERS = {
  按时间线: (e) => SHOWN.has(e.type) && !(e.type === "night_action" && e.action === "wolf_kill" && !e.final),
  按角色: (e, seat) => SHOWN.has(e.type) && (e.actor === seat || e.target === seat || e.exiled === seat),
  关键时刻: (e) => KEY.has(e.type) || (e.type === "night_action" && (e.action === "seer_check" || e.action === "witch_save" || e.action === "witch_poison")),
  伤亡记录: (e) => e.type === "death" || e.type === "game_end",
};

function formatDate(ts) {
  return ts ? new Date(ts).toLocaleString("zh-CN", { hour12: false }) : "—";
}

function statusLabel(game) {
  if (game.status === "running") return "进行中";
  if (game.status === "aborted") return "已中断";
  return WINNER_NAMES[game.winner] ?? "已结束";
}

function GameList({ games, currentId }) {
  if (!games) return <p className="feed-empty">加载中……</p>;
  if (!games.length) return <p className="feed-empty">还没有对局记录。</p>;
  return games.slice(0, 8).map((game) => (
    <a className={`archive-link ${String(game.id) === String(currentId) ? "is-selected" : ""}`} href={`#/replay/${game.id}`} key={game.id}>
      <strong>#{game.id} {game.title}</strong>
      <small>{statusLabel(game)}</small>
    </a>
  ));
}

function Dossier({ state, loading, error }) {
  const [filter, setFilter] = React.useState("按时间线");
  const [seat, setSeat] = React.useState(1);
  const [copied, setCopied] = React.useState(false);

  if (error) return <section className="archive-paper"><p className="feed-empty">{error}</p></section>;
  if (loading) return <section className="archive-paper"><p className="feed-empty">正在调取档案……</p></section>;

  const game = state.game;
  const events = state.log.filter((e) => FILTERS[filter](e, seat));
  const stamp = game.status === "running" ? "对局进行中" : game.status === "aborted" ? "对局中断" : WINNER_NAMES[game.winner];

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="archive-paper">
      <span className="small-label">对局编号 #{game.id}</span>
      <h1>{game.title}复盘</h1>
      <strong className={`result-stamp ${game.winner === "wolf" ? "result-stamp--wolf" : ""}`}>{stamp}</strong>
      <p>
        {game.status === "running" ? (
          <>这局还在进行，<a href={`#/watch/${game.id}`}>去现场观战 →</a></>
        ) : (
          `${state.ended?.reason ?? game.reason ?? ""} 共进行 ${state.day} 天。`
        )}
      </p>
      <div className="filter-row">
        {Object.keys(FILTERS).map((item) => (
          <button className={filter === item ? "is-active" : ""} key={item} onClick={() => setFilter(item)} type="button">
            {item}
          </button>
        ))}
        {filter === "按角色" && (
          <select value={seat} onChange={(e) => setSeat(Number(e.target.value))} aria-label="选择玩家">
            {state.players.map((p) => (
              <option value={p.seat} key={p.seat}>
                {p.seat}号 {p.name}（{p.roleName}）
              </option>
            ))}
          </select>
        )}
      </div>
      <ReplayTimeline events={events} bySeat={state.bySeat} />
      <footer className="archive-footer">
        <p>记录者：System · {game.provider === "mock" ? "离线模拟" : game.model}</p>
        <p>归档时间：{formatDate(game.finishedAt ?? game.createdAt)}</p>
        <button type="button" onClick={() => window.print()}>打印文件</button>
        <button type="button" onClick={share}>{copied ? "链接已复制" : "分享档案"}</button>
      </footer>
    </section>
  );
}

function IdentityPanel({ state }) {
  if (!state.game) return <aside className="archive-right" />;
  const count = (filter) => {
    const group = state.players.filter(filter);
    return `${group.filter((p) => p.alive).length} / ${group.length}`;
  };
  return (
    <aside className="archive-right">
      <h3>玩家身份总览</h3>
      <ol>
        {state.players.map((player) => (
          <li className={player.camp === "wolf" ? "wolf-row" : ""} key={player.seat}>
            <span>{String(player.seat).padStart(2, "0")}</span>
            <a href={`#/profile/${player.personaId}`}>
              {player.name} · {player.roleName}
            </a>
            {!player.alive && <em className="dead-mark">✕</em>}
          </li>
        ))}
      </ol>
      <article>
        <h3>{state.phase === "ended" ? "终局存活" : "当前存活"}</h3>
        <p>平民：{count((p) => p.role === "villager")}</p>
        <p>神职：{count((p) => p.camp === "good" && p.role !== "villager")}</p>
        <p>狼人：{count((p) => p.camp === "wolf")}</p>
      </article>
    </aside>
  );
}

function ReplayDetail({ id }) {
  const game = useGame(id, { live: false });
  return (
    <>
      <Dossier {...game} />
      <IdentityPanel state={game.state} />
    </>
  );
}

export default function ReplayPage({ activeRoute, param }) {
  const { data: games } = useApi(() => api.games(), []);
  const firstFinished = games?.find((g) => g.status === "finished")?.id ?? games?.[0]?.id;
  const id = param ?? firstFinished ?? null;

  return (
    <main className="replay-page dossier-page">
      <TopNav activeRoute={activeRoute} compact />
      <div className="replay-shell">
        <aside className="archive-sidebar">
          <h2>复盘档案</h2>
          <p>最近的对局</p>
          <GameList games={games} currentId={id} />
          <a className="gold-button" href="#/watch">观看新对局</a>
        </aside>
        {id ? (
          <ReplayDetail id={id} key={id} />
        ) : (
          <section className="archive-paper">
            <h1>档案柜还是空的</h1>
            <p>{games ? "还没有任何对局。去开第一局吧。" : "正在调取档案……"}</p>
            {games && <a className="primary-button" href="#/watch">开始第一局</a>}
          </section>
        )}
      </div>
      <footer className="site-footer">
        <strong>Agentbluff</strong>
        <small>每一段沉默都记录着查验中的真相。</small>
      </footer>
    </main>
  );
}
