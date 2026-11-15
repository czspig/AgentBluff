import Avatar from "../components/Avatar.jsx";
import StatCard from "../components/StatCard.jsx";
import TopNav from "../components/TopNav.jsx";
import archiveMap from "../assets/archive-map.png";
import { personaById, personas } from "../../../shared/personas.js";
import { api } from "../lib/api.js";
import { useApi } from "../lib/useGame.js";

const KIND = { speech: "公开发言", last_words: "遗言" };

export default function ProfilePage({ activeRoute, param }) {
  const persona = personaById[param] ?? personaById.claude;
  const { data } = useApi(() => api.persona(persona.id), [persona.id]);
  const stats = data?.stats;
  const speeches = data?.speeches ?? [];
  const roles = Object.entries(stats?.roles ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <main className="profile-page dossier-page">
      <TopNav activeRoute={activeRoute} compact />

      <nav className="persona-strip" aria-label="选择选手">
        {personas.map((p) => (
          <a className={p.id === persona.id ? "is-selected" : ""} href={`#/profile/${p.id}`} key={p.id} title={p.name}>
            <Avatar persona={p} />
            <small>{p.name}</small>
          </a>
        ))}
      </nav>

      <section className="profile-hero">
        <article className="portrait-card">
          <Avatar persona={persona} className="portrait-avatar" as="div" />
          <strong>{persona.name}</strong>
        </article>
        <div className="profile-intro">
          <span className="small-label">
            {persona.tone} · {persona.tag}
          </span>
          <h1>AI 选手档案：{persona.name}</h1>
          <p>{persona.intro}</p>
          <div className="hero-actions align-left">
            <a className="primary-button" href="#/watch">观看当前对局</a>
            <a className="secondary-button" href="#/replay">翻阅历史对局</a>
          </div>
        </div>
      </section>

      <section className="profile-grid">
        <article className="trait-card">
          <h2>人格特质</h2>
          <div className="radar">
            <span>{persona.tone}</span>
          </div>
          <div className="trait-bars">
            {Object.entries(persona.traits).map(([label, value]) => (
              <label key={label}>
                <span>{label}</span>
                <i><b style={{ width: `${value}%` }} /></i>
                <em>{value}%</em>
              </label>
            ))}
          </div>
        </article>
        <StatCard stats={stats} />
      </section>

      <section className="record-board">
        <header>
          <h2>近期发言</h2>
          <p>{speeches.length ? "来自最近几局的公开发言与内心想法。" : "还没有对局记录，打完第一局后这里会出现它的发言。"}</p>
        </header>
        <div>
          {speeches.map((record) => (
            <article key={`${record.gameId}-${record.ts}`}>
              <span>
                <a href={`#/replay/${record.gameId}`}>#{record.gameId}</a> · {KIND[record.kind]} · 身份：{record.roleName}
              </span>
              <p>{record.text}</p>
              {record.thought && <small className="replay-thought">内心：{record.thought}</small>}
            </article>
          ))}
        </div>
      </section>

      <section className="analysis-grid">
        <article className="analysis-copy">
          <h2>说话风格</h2>
          <p>{persona.style}</p>
          <p className="disclosure">本阶段所有选手都由同一个大模型（DeepSeek）扮演，名字只代表说话风格，不代表对应公司的模型。</p>
        </article>
        <article className="identity-card">
          <h3>担任过的身份</h3>
          {roles.length ? roles.map(([role, n]) => <p key={role}>{role}：{n} 局</p>) : <p>暂无记录</p>}
          <img src={archiveMap} alt="案卷地图" />
        </article>
      </section>
      <footer className="site-footer">
        <strong>Agentbluff</strong>
        <small>选手档案由历史对局记录生成。</small>
      </footer>
    </main>
  );
}
