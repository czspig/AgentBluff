import React from "react";
import CasePanel from "../components/hall/CasePanel.jsx";
import HallStage, { HallCaption } from "../components/hall/HallStage.jsx";
import { api } from "../lib/api.js";
import { WINNER_NAMES, buildState } from "../lib/gameState.js";
import { sceneFor } from "../lib/scenes.js";
import { useGame, useStartGame } from "../lib/useGame.js";
import "../styles/hall.css";

function HallBar({ state, banner, godView, onToggleGodView }) {
  const live = state.game?.status === "running";
  return (
    <header className="hall-bar">
      <div className="hall-brand">
        <a href="#/">AgentBluff</a>
        <span>{state.game ? (live ? "观战中" : "已归档") : "观战室"}</span>
      </div>
      <div className={`hall-banner ${banner.night ? "is-night" : ""}`}>
        <span>{banner.title}</span>
        <i>·</i>
        <em>{banner.accent}</em>
      </div>
      <nav className="hall-tools">
        {state.game && (
          <span className="hall-chip">
            存活 {state.aliveCount}/{state.players.length}
          </span>
        )}
        {state.aiErrors.some((e) => godView || !e.secret) && (
          <span className="hall-chip hall-chip--fault" title="有 AI 调用失败，相关发言或投票按默认处理">
            连线故障 {state.aiErrors.filter((e) => godView || !e.secret).length}
          </span>
        )}
        {onToggleGodView && (
          <button type="button" className={`hall-chip hall-toggle ${godView ? "is-on" : ""}`} onClick={onToggleGodView} aria-pressed={godView}>
            上帝视角
          </button>
        )}
        {state.game && <a href={`#/replay/${state.game.id}`}>复盘</a>}
        <a href="#/">首页</a>
      </nav>
    </header>
  );
}

function ViewSwitch({ panelOpen, setPanelOpen }) {
  return (
    <div className="hall-switch" role="group" aria-label="切换视图">
      <button type="button" aria-pressed={!panelOpen} onClick={() => setPanelOpen(false)}>
        圆桌
      </button>
      <button type="button" aria-pressed={panelOpen} onClick={() => setPanelOpen(true)}>
        案卷
      </button>
    </div>
  );
}

function StartCard({ title, text }) {
  const { busy, message, liveGameId, start } = useStartGame();
  return (
    <div className="hall-card">
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="hall-card-actions">
        <button type="button" className="hall-btn hall-btn--gold" onClick={start} disabled={busy}>
          {busy ? "正在开局……" : "开始新对局"}
        </button>
        <a className="hall-btn" href="#/replay">翻阅历史案卷</a>
      </div>
      {message && (
        <p className="hall-card-note">
          {message} {liveGameId && <a href={`#/watch/${liveGameId}`}>去观战 #{liveGameId} →</a>}
        </p>
      )}
    </div>
  );
}

function ResultCard({ state }) {
  const { busy, message, start } = useStartGame();
  const winner = state.ended?.winner;
  return (
    <div className={`hall-card hall-card--result ${winner === "wolf" ? "is-wolf" : ""}`}>
      <span className="hall-seal">{winner ? WINNER_NAMES[winner] : "对局中断"}</span>
      <p>{state.ended?.reason ?? state.error}</p>
      <div className="hall-card-actions">
        <a className="hall-btn hall-btn--gold" href={`#/replay/${state.game.id}`}>查看完整复盘</a>
        <button type="button" className="hall-btn" onClick={start} disabled={busy}>
          {busy ? "正在开局……" : "再开一局"}
        </button>
      </div>
      {message && <p className="hall-card-note">{message}</p>}
    </div>
  );
}

function Hall({ state, godView, setGodView, overlay }) {
  const banner = sceneFor(state);
  const isDay = banner.scene === "day";
  // The case file opens by default in daytime (as in the design) and closes at night,
  // unless the viewer has chosen a side themselves.
  const [manualPanel, setManualPanel] = React.useState(null);
  const panelOpen = manualPanel ?? (isDay && state.phase !== "ended");
  const [dismissed, setDismissed] = React.useState(false);
  // The narrow daytime painting is composed to sit beside the case file; with the file
  // closed, the wide hall painting (warmed up) fills the screen better.
  const sceneKey = isDay && !panelOpen ? "night" : banner.scene;
  const dayTint = isDay && !panelOpen;

  return (
    <main className={`hall-page ${panelOpen ? "has-panel" : ""} ${banner.night ? "is-night" : ""} ${dayTint ? "is-day-tint" : ""}`}>
      <HallBar state={state} banner={banner} godView={godView} onToggleGodView={setGodView && (() => setGodView((v) => !v))} />
      <div className="hall-body">
        <section className="hall-stage-area">
          <HallStage state={state} sceneKey={sceneKey} godView={godView}>
            {overlay}
            {!overlay && state.phase === "ended" && state.game && !dismissed && (
              <div className="hall-overlay" onClick={(e) => e.target === e.currentTarget && setDismissed(true)}>
                <ResultCard state={state} />
              </div>
            )}
          </HallStage>
          {!panelOpen && !overlay && (
            <footer className="hall-foot">
              {state.game && <HallCaption state={state} godView={godView} />}
              <ViewSwitch panelOpen={false} setPanelOpen={setManualPanel} />
            </footer>
          )}
        </section>
        {panelOpen && !overlay && (
          <CasePanel state={state} godView={godView} footer={<ViewSwitch panelOpen setPanelOpen={setManualPanel} />} />
        )}
      </div>
    </main>
  );
}

function LiveGame({ id }) {
  const { state, error } = useGame(id);
  const [godView, setGodView] = React.useState(true);
  if (error) {
    return <Hall state={buildState(null, [])} overlay={<div className="hall-overlay"><StartCard title="找不到这局对局" text={error} /></div>} />;
  }
  return <Hall state={state} godView={godView} setGodView={setGodView} />;
}

export default function WatchPage({ param }) {
  const [resolved, setResolved] = React.useState(param ? "ready" : "loading");

  // "#/watch" with no id: jump to the running (or latest) game.
  React.useEffect(() => {
    if (param) return;
    api
      .liveGame()
      .then(({ id }) => {
        if (id) window.location.replace(`#/watch/${id}`);
        else setResolved("empty");
      })
      .catch(() => setResolved("offline"));
  }, [param]);

  if (param) return <LiveGame id={param} />;

  const empty = buildState(null, []);
  const overlay =
    resolved === "empty" ? (
      <div className="hall-overlay"><StartCard title="圆桌还空着" text="八把椅子都已就位。开一局，看八位 AI 在烛光里互相试探。" /></div>
    ) : resolved === "offline" ? (
      <div className="hall-overlay"><StartCard title="暂时连不上服务器" text="请确认后端服务已经启动，然后刷新页面。" /></div>
    ) : (
      <div className="hall-overlay"><p className="hall-loading">正在寻找进行中的对局……</p></div>
    );
  return <Hall state={empty} overlay={overlay} />;
}
