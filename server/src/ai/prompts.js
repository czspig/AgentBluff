// Prompt construction for LLM-backed players. Each request asks for a single JSON object.

import { ROLES, personaById } from "../../../shared/personas.js";

const RULES = `这是一局 8 人狼人杀：2 狼人、预言家、女巫、猎人、3 平民。
- 夜晚：狼人共同袭击一人；预言家查验一人阵营；女巫有一瓶解药（不能自救）和一瓶毒药，每晚最多用一瓶。
- 白天：公布昨夜死讯（首夜死者有遗言），然后存活玩家依次发言，再投票放逐一人（平票则无人出局），被放逐者有遗言。
- 猎人被刀或被放逐时可以开枪带走一人，被毒死不能开枪。
- 胜负：狼人全部出局则好人胜；所有神职或所有平民出局（屠边），或狼人数不少于好人，则狼人胜。`;

const ROLE_GUIDE = {
  wolf: "你是狼人。白天要伪装成好人，可以悍跳预言家、带节奏或保护队友，但别暴露狼队友关系。",
  seer: "你是预言家。合适的时机公开身份并报出查验结果，带领好人投票。",
  witch: "你是女巫。谨慎使用药水，白天可以视情况公开自己用药的信息。",
  hunter: "你是猎人。可以隐藏身份，也可以在必要时亮枪威慑狼人。",
  villager: "你是平民。没有技能，要靠听发言和票型找出狼人，保护神职。",
};

function playersLine(players) {
  return players.map((p) => `${p.seat}号 ${p.name}${p.alive ? "" : "（已出局）"}`).join("，");
}

function contextBlock(ctx) {
  const self = ctx.self;
  const persona = personaById[self.personaId];
  const lines = [
    `你是 ${self.seat}号玩家「${self.name}」。性格：${persona.tone}，${persona.tag}。说话风格：${persona.style}`,
    `你的身份：${ROLES[self.role].name}。${ROLE_GUIDE[self.role]}`,
  ];
  if (ctx.teammates?.length) lines.push(`你的狼队友：${ctx.teammates.join("、")}。`);
  lines.push(`当前是第 ${ctx.day} 天。座位：${playersLine(ctx.players)}。`);
  if (ctx.notes?.length) lines.push(`只有你知道的信息：\n${ctx.notes.join("\n")}`);
  lines.push(`公开记录（所有人可见）：\n${ctx.publicLog.length ? ctx.publicLog.join("\n") : "（暂无）"}`);
  return lines.join("\n\n");
}

const TASKS = {
  wolf_kill: (req) =>
    `现在是夜晚，选择今晚要袭击的玩家。可选座位：${req.options.join("、")}。${
      req.proposal ? `你的狼队友提议袭击 ${req.proposal}，你做最终决定。` : ""
    }
输出 JSON：{"thought": "你的内心想法（1-2句）", "target": 座位号}`,
  seer_check: (req) =>
    `现在是夜晚，选择要查验身份的玩家。可选座位：${req.options.join("、")}。
输出 JSON：{"thought": "你的内心想法（1-2句）", "target": 座位号}`,
  witch: (req) =>
    `现在是夜晚。${req.victim ? `今晚被狼人袭击的是 ${req.victim}。` : "今晚没有人被袭击。"}
${req.canSave ? "你可以用解药救他。" : "你现在不能使用解药。"}${
      req.canPoison ? `你可以用毒药毒杀一人，可选座位：${req.options.join("、")}。` : "你没有毒药了。"
    }
每晚最多使用一瓶药。
输出 JSON：{"thought": "你的内心想法（1-2句）", "action": "save" | "poison" | "pass", "target": 毒药目标座位号（仅 poison 时需要）}`,
  speech: () =>
    `轮到你公开发言了。用你的说话风格发言，80-160 字，要结合场上已有的发言和信息，给出你的判断。
不要用旁白或动作描写，只输出你说的话。
输出 JSON：{"thought": "你真实的内心想法，别人看不到（1-3句）", "speech": "你的公开发言"}`,
  last_words: () =>
    `你已经出局了，请留下遗言（40-100 字），可以留下线索或身份信息。
输出 JSON：{"thought": "你的内心想法（1句）", "speech": "你的遗言"}`,
  vote: (req) =>
    `现在投票放逐一名玩家。可选座位：${req.options.join("、")}，也可以填 0 表示弃票。
输出 JSON：{"thought": "你的内心想法（1-2句）", "target": 座位号, "reason": "公开的投票理由（一句话）"}`,
  hunter: (req) =>
    `你是猎人，已经出局，可以开枪带走一名存活玩家。可选座位：${req.options.join("、")}。
输出 JSON：{"thought": "你的内心想法（1-2句）", "shoot": true/false, "target": 座位号}`,
};

export function buildMessages(req) {
  if (req.kind === "judge") {
    return [
      {
        role: "system",
        content: `你是狼人杀对局的「审判长」，一位中立的解说员。你只能看到公开信息，不知道任何人的真实身份。\n${RULES}`,
      },
      {
        role: "user",
        content: `第 ${req.context.day} 天的发言刚刚结束。座位：${playersLine(req.context.players)}。
公开记录：\n${req.context.publicLog.join("\n")}

用 60-120 字点评今天的局势：谁的发言可信、谁可疑、投票可能怎么走。语气像一位冷静的庭审主持人，不要编造未公开的身份。
输出 JSON：{"comment": "你的点评"}`,
      },
    ];
  }

  return [
    {
      role: "system",
      content: `你在玩狼人杀，是一名会推理、会伪装的玩家。你必须始终以 JSON 格式回答，不要输出任何其他内容。\n${RULES}`,
    },
    { role: "user", content: `${contextBlock(req.context)}\n\n${TASKS[req.kind](req)}` },
  ];
}
