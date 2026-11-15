export default function FeatureCard({ feature }) {
  return (
    <article className="feature-card">
      <span className="feature-icon">{feature.icon}</span>
      <h3>{feature.title}</h3>
      <p>{feature.text}</p>
      {feature.image ? (
        <img src={feature.image} alt="" />
      ) : (
        <a className="profile-mini" href="#/profile">
          翻阅选手档案 →
        </a>
      )}
    </article>
  );
}
