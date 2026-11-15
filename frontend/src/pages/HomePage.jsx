import React from "react";
import TopNav from "../components/TopNav.jsx";
import Avatar from "../components/Avatar.jsx";
import rainyRoundtable from "../assets/scenes/rainy-roundtable.webp";
import { personas } from "../../../shared/personas.js";
import { api } from "../lib/api.js";
import { buildCase } from "../lib/demoCase.js";
import { useApi, useStartGame } from "../lib/useGame.js";
import "../styles/home.css";

const pad = (n) => String(n).padStart(2, "0");
// Chair positions on the overhead painting (percent of a 3:2 frame), clockwise from the top.
const SLOTS = [[50, 12], [66, 22], [76, 47], [66, 73], [50, 85], [34, 73], [24, 47], [34, 22]];
const STEPS = ["首夜", "第一天 · 发言", "第一天 · 投票"];

// Latest archived game (a finished one reads best as a demo), plus whether one is live now.
async function loadCase() {
  const games = await api.games();
  const running = games.find((g) => g.status === "running");
  // Skip games whose first day carries no usable evidence (e.g. AI calls failed and everyone abstained).
  for (const summary of games.filter((g) => g.status === "finished").slice(0, 6)) {
    const caseFile = buildCase(await api.game(summary.id));
    if (caseFile.files.length >= 2) return { caseFile, liveId: running?.id ?? null };
  }
  return { caseFile: buildCase(null), liveId: running?.id ?? null };
}

function useCoverScale(ref) {
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => {
      // The painting is 3:2 and drawn with background-size: cover; when the frame is
      // taller than 3:2 the sides get cropped, so spread the seats outward to stay on the chairs.
      setScale(Math.max(1, (el.clientHeight * 1.5) / el.clientWidth));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return scale;
}

function CaseCard({ caseFile, step, setStep, selected, setSelected }) {
  const scene = React.useRef(null);
  const scale = useCoverScale(scene);
  const positions = SLOTS.map(([x, y]) => [Math.min(94, Math.max(6, 50 + (x - 50) * scale)), y]);
  const target = step === 2 ? caseFile.votes[selected - 1] : null;
  const tallies = {};
  for (const v of caseFile.votes) if (v) tallies[v] = (tallies[v] ?? 0) + 1;

  const stageTitle = STEPS[step] === "首夜" ? "首夜" : step === 1 ? "公开发言" : "投票结果";
  const stageHint =
    step === 0
      ? caseFile.announce || "夜间行动封存"
      : step === 1
        ? "点击任意座位读证词"
        : caseFile.exiled
          ? `${pad(caseFile.exiled)} 号被放逐 · ${tallies[caseFile.exiled] ?? 0} 票`
          : "平票，无人出局";

  let meta;
  let quote;
  if (step === 0) {
    meta = `${pad(selected)} 号 · 首夜记录`;
    quote = caseFile.night;
  } else if (step === 1) {
    meta = `${pad(selected)} 号 ${caseFile.seats[selected - 1]?.name ?? ""} · 公开证词`;
    quote = `“${caseFile.statements[selected - 1]}”`;
  } else {
    meta = `${pad(selected)} 号 · 投票记录`;
    quote = target
      ? `${pad(selected)} 号投给了 ${pad(target)} 号。${pad(target)} 号获得 ${tallies[target] ?? 0} 票。${caseFile.voteReasons[selected - 1] ? `理由：${caseFile.voteReasons[selected - 1]}` : ""}`
      : `${pad(selected)} 号没有投票。`;
  }

  let votePath = null;
  if (target) {
    const [x, y] = positions[selected - 1];
    const [ex, ey] = positions[target - 1];
    const el = scene.current;
    const ratio = el ? el.clientWidth / el.clientHeight : 1.5;
    const dx = ex - x;
    const dy = ey - y;
    const dist = Math.hypot(dx * ratio, dy);
    const gap = Math.min(0.26, (28 / (el?.clientHeight || 400)) * 100 / dist);
    votePath = `M${x + dx * gap} ${y + dy * gap} Q${(x + ex) / 2 + 6} ${(y + ey) / 2 - 10} ${ex - dx * gap} ${ey - dy * gap}`;
  }

  return (
    <figure className="home-case" id="home-case" aria-label="对局案卷演示">
      <div className="home-case-header">
        <span>
          案卷 {caseFile.id ? pad(caseFile.id).padStart(3, "0") : "001"} / {caseFile.title}
        </span>
        <span className="home-demo">{caseFile.id ? "真实对局回放" : "演示对局"}</span>
      </div>
      <div className="home-scene" data-step={step} ref={scene}>
        <div className="home-scene-art" style={{ backgroundImage: `url(${rainyRoundtable})` }} aria-hidden="true" />
        <svg className="home-lines" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <marker id="home-vote-tip" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0 0 L5 2.5 L0 5 L1.4 2.5 Z" fill="currentColor" />
            </marker>
          </defs>
          {votePath && <path d={votePath} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" markerEnd="url(#home-vote-tip)" />}
        </svg>
        <div className="home-stage-center" aria-hidden="true">
          <i>✧</i>
          <strong>{stageTitle}</strong>
          <small>{stageHint}</small>
        </div>
        <div role="group" aria-label="八位 AI 选手">
          {positions.map(([x, y], index) => {
            const seat = index + 1;
            const info = caseFile.seats[index];
            const total = tallies[seat] ?? 0;
            return (
              <button
                type="button"
                key={seat}
                className={`home-seat ${info && !info.alive && step > 0 ? "is-out" : ""}`}
                style={{ "--x": `${x}%`, "--y": `${y}%` }}
                aria-pressed={selected === seat}
                data-voted-for={target === seat}
                aria-label={`${pad(seat)} 号 ${info?.name ?? ""}${step === 2 && total ? `，${total} 票` : ""}`}
                title={info?.name}
                onClick={() => setSelected(seat)}
              >
                {pad(seat)}
                {step === 2 && total > 0 && <abbr aria-hidden="true">{total} 票</abbr>}
              </button>
            );
          })}
        </div>
      </div>
      <figcaption className="home-note" aria-live="polite" key={`${step}-${selected}`}>
        <p className="home-meta">{meta}</p>
        <p>{quote}</p>
      </figcaption>
      <div className="home-steps" role="group" aria-label="回放片段">
        {STEPS.map((label, i) => (
          <button type="button" key={label} aria-pressed={step === i} onClick={() => setStep(i)}>
            {label}
          </button>
        ))}
      </div>
    </figure>
  );
}

export default function HomePage({ activeRoute }) {
  const { data } = useApi(loadCase, []);
  const { data: meta } = useApi(() => api.meta(), []);
  const { busy, message, liveGameId, start } = useStartGame();
  const caseFile = data?.caseFile ?? buildCase(null);
  const [step, setStep] = React.useState(1);
  const [selected, setSelected] = React.useState(null);
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const seat = selected ?? caseFile.defaultSeat;
  const activeFile = caseFile.files.find((f) => f.seat === seat && f.step === step)?.key;

  function openFile(file) {
    setSelected(file.seat);
    setStep(file.step);
    document.getElementById("home-case")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  return (
    <main className="home">
      <div className="home-shell">
        <TopNav activeRoute={activeRoute} onRules={() => setRulesOpen(true)} />

        <section className="home-hero" aria-label="AI 狼人杀观战">
          <div className="home-intro">
            <p className="home-eyebrow">AI 狼人杀 · 观战室</p>
            <h1>
              八位 AI 上桌。<span>谁在说谎？</span>
            </h1>
            <p>从证词到投票，亲眼看八位 AI 如何试探、结盟，又如何在落票时倒戈。</p>
            <div className="home-actions">
              <button type="button" className="home-cta" onClick={start} disabled={busy}>
                {busy ? "正在开局……" : "开始新对局"} <span aria-hidden="true">↗</span>
              </button>
              <a className="home-text-link" href={data?.liveId ? `#/watch/${data.liveId}` : "#/watch"}>
                {data?.liveId ? "正在直播，进入观战" : "进入观战室"} <span aria-hidden="true">→</span>
              </a>
            </div>
            {message && (
              <p className="home-notice">
                {message} {liveGameId && <a href={`#/watch/${liveGameId}`}>去观战 #{liveGameId} →</a>}
              </p>
            )}
            {meta?.provider === "mock" && <p className="home-disclosure">演示模式：对局由离线模拟生成，没有调用大模型。</p>}
          </div>
          <CaseCard caseFile={caseFile} step={step} setStep={setStep} selected={seat} setSelected={setSelected} />
        </section>

        {caseFile.files.length > 0 && (
          <section className="home-evidence" id="home-evidence" aria-labelledby="home-evidence-title">
            <h2 id="home-evidence-title">本局证物</h2>
            <div className="home-files">
              {caseFile.files.map((file) => (
                <button type="button" className="home-file" key={file.key} aria-pressed={activeFile === file.key} onClick={() => openFile(file)}>
                  <small>
                    {file.label} / {pad(file.seat)} 号
                  </small>
                  <strong>{file.title}</strong>
                  <span>{file.text}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="home-evidence" aria-labelledby="home-roster-title">
          <h2 id="home-roster-title">上桌选手</h2>
          <div className="home-roster">
            {personas.map((p, i) => (
              <a className="home-file home-file--roster" href={`#/profile/${p.id}`} key={p.id}>
                <Avatar persona={p} className="home-roster-logo" />
                <small>{pad(i + 1)} 号座</small>
                <strong>{p.name}</strong>
                <span>
                  {p.tone} · {p.tag}
                </span>
              </a>
            ))}
          </div>
        </section>

        <details className="home-rules" id="home-rules" open={rulesOpen} onToggle={(e) => setRulesOpen(e.currentTarget.open)}>
          <summary>怎么玩</summary>
          <p>
            八位 AI 分属好人阵营和狼人阵营：2 名狼人，预言家、女巫、猎人各一，另有 3 名平民。夜间按角色行动，白天公开发言并投票放逐一人；狼人全部出局则好人胜，神职或平民被屠尽则狼人胜。
          </p>
          <p>观战时可以打开「上帝视角」看清每个人的身份与内心想法，也可以关掉它，和场上的好人一起猜。</p>
        </details>

        <footer className="home-footer">
          <span>Agentbluff</span>
          <span>© 2026 · 每一局都会存档，可回看、可分享。</span>
        </footer>
      </div>
    </main>
  );
}
