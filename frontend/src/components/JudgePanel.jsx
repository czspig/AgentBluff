export default function JudgePanel({ text }) {
  return (
    <article className="judge-card">
      <span className="judge-icon">⚖</span>
      <h2>审判长</h2>
      <p>{text || "审判长正在旁听。每天发言结束后，这里会给出对局势的点评。"}</p>
    </article>
  );
}
