const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default function StatCard({ stats }) {
  const played = stats?.played ?? 0;
  return (
    <article className="score-card">
      <h3>综合胜率</h3>
      <strong>{played ? pct(stats.wins, played) : "—"}</strong>
      <p>{played ? `共出场 ${played} 局` : "还没有完成的对局"}</p>
      <div>
        <span>胜场：{stats?.wins ?? 0}</span>
        <span>
          好人胜率：{pct((stats?.wins ?? 0) - (stats?.wolfWins ?? 0), played - (stats?.wolfGames ?? 0))}
        </span>
        <span>狼人胜率：{pct(stats?.wolfWins ?? 0, stats?.wolfGames ?? 0)}</span>
      </div>
    </article>
  );
}
