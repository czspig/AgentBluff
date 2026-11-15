export default function Sidebar({ state, godView, onToggleGodView }) {
  const game = state.game;
  return (
    <aside className="sidebar">
      <p className="eyebrow">{state.phase === "ended" ? "对局已结束" : "观战中"}</p>
      <h2>
        对局 #{game?.id ?? "—"}
        {state.day ? ` · 第 ${state.day} 天` : ""}
      </h2>
      {game?.title && <p className="sidebar-title">「{game.title}」</p>}
      <div className="side-nav">
        <button className="is-selected" type="button">
          <span>▣</span>实时对局
        </button>
        <button type="button" onClick={onToggleGodView} aria-pressed={godView}>
          <span>{godView ? "◉" : "○"}</span>上帝视角
          <i className={`switch ${godView ? "is-on" : ""}`} aria-hidden="true" />
        </button>
        <a className="side-link" href="#/replay">
          <span>▤</span>历史对局
        </a>
      </div>
      <p className="side-hint">
        {godView ? "上帝视角：可以看到所有人的身份、内心想法和夜晚行动。" : "村民视角：和场上玩家一样，只能看到公开信息。"}
      </p>
      {game && (
        <a className="ghost-button side-replay" href={`#/replay/${game.id}`}>
          ▷ {state.phase === "ended" ? "查看完整复盘" : "查看对局档案"}
        </a>
      )}
    </aside>
  );
}
