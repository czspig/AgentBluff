// Offline provider: rule-legal random decisions with templated Chinese lines.
// Used when no DeepSeek key is configured, so the whole product can be run and demoed for free.

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function othersAlive(ctx) {
  return ctx.players.filter((p) => p.alive && p.seat !== ctx.self.seat);
}

function speechFor(ctx) {
  const suspect = pick(othersAlive(ctx));
  const ally = pick(othersAlive(ctx));
  const name = (p) => `${p.seat}号 ${p.name}`;
  const seerNote = ctx.notes.filter((n) => n.includes("查验")).at(-1);
  if (ctx.self.role === "seer" && seerNote && Math.random() < 0.7) {
    return {
      thought: "信息已经够了，该跳出来带队了。",
      speech: `我直接跳预言家。${seerNote.replace(/^第\d+天：/, "")}请大家跟着我的信息走，今天先把狼找出来。`,
    };
  }
  if (ctx.self.role === "wolf" && Math.random() < 0.3) {
    return {
      thought: "得把视线往别人身上引，别让队友被盯上。",
      speech: `我觉得 ${name(suspect)} 的发言很奇怪，前后立场在变，像是在找机会混进好人堆里。今天我会重点听他怎么解释。`,
    };
  }
  return pick([
    {
      thought: `${name(suspect)} 的发言让我有点不安，但证据还不够。`,
      speech: `目前信息不多，我先说我的感觉：${name(suspect)} 的发言比较模糊，像是在回避重点。${name(ally)} 的逻辑我暂时认可。我会继续听后面的发言再决定投票。`,
    },
    {
      thought: "先站稳中立，看看谁在急着带节奏。",
      speech: `我注意到有人很急着把票集中到一个人身上，这种节奏本身就值得怀疑。我建议大家先把各自的理由讲清楚，尤其是 ${name(suspect)}，你的判断依据是什么？`,
    },
    {
      thought: `${name(ally)} 看起来像好人，可以先抱团。`,
      speech: `我愿意相信 ${name(ally)}，他的发言和昨天的信息是对得上的。反倒是 ${name(suspect)}，到现在都没有给出明确的站边，我今天会考虑投他。`,
    },
  ]);
}

export function createMockProvider({ delayMs = [500, 1200] } = {}) {
  return {
    name: "mock",
    model: "offline-mock",
    async decide(req) {
      if (delayMs[1] > 0) await sleep(delayMs[0] + Math.random() * (delayMs[1] - delayMs[0]));
      const ctx = req.context;
      switch (req.kind) {
        case "wolf_kill":
          return { thought: req.proposal ? `跟队友的刀，${req.proposal} 威胁最大。` : "先刀一个发言好的好人。", target: pick(req.options) };
        case "seer_check":
          return { thought: "这个人的发言最难判断，先验他。", target: pick(req.options) };
        case "witch":
          if (req.canSave && ctx.day === 1) return { thought: "第一夜先救人，保留信息。", action: "save" };
          if (req.canPoison && Math.random() < 0.25) return { thought: "我对这个人很有把握，直接毒掉。", action: "poison", target: pick(req.options) };
          return { thought: "局势还不明朗，先不用药。", action: "pass" };
        case "speech":
          return speechFor(ctx);
        case "last_words":
          return { thought: "得留下点有用的信息。", speech: `我是${ctx.self.role === "wolf" ? "好人" : ctx.self.role === "villager" ? "平民" : "神职"}，出局了也没关系，请大家多看看投票的人，票型会说话。` };
        case "vote": {
          const target = pick(req.options);
          return { thought: "跟着今天的主要怀疑对象走。", target, reason: "他今天的发言最可疑。" };
        }
        case "hunter":
          return { thought: "带走我最怀疑的人。", shoot: true, target: pick(req.options) };
        case "judge":
          return { comment: `今天的发言已经结束。几位玩家的立场开始分化，有人急于带节奏，也有人在刻意保持中立。接下来的投票将决定局势的走向，请各位慎重。` };
        default:
          return {};
      }
    },
  };
}
