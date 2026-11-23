// Geometry of the three hall paintings, in source-image pixels (after cropping off the
// mock-up chrome). Seat order: 01 ChatGPT, 02 Claude, 03 DeepSeek, 04 Gemini, 05 Qwen,
// 06 Kimi, 07 Grok, 08 GLM.
//   plate  = the painted name plate [centerX, centerY, width, height]; the live plate covers it.
//   figure = roughly the hooded figure's chest, used for glows, death shading and vote lines.

import hallDay from "../assets/scenes/hall-day.webp";
import hallNight from "../assets/scenes/hall-night.webp";
import hallWolves from "../assets/scenes/hall-wolves.webp";

export const SCENES = {
  wolves: {
    src: hallWolves,
    w: 1672,
    h: 885,
    plates: [
      [845, 30, 177, 36], [1358, 114, 166, 36], [1502, 380, 195, 36], [1474, 664, 185, 36],
      [845, 824, 199, 36], [261, 661, 169, 36], [176, 382, 164, 36], [414, 104, 155, 36],
    ],
    figures: [
      [760, 140], [1165, 170], [1360, 330], [1310, 520], [835, 600], [380, 540], [270, 330], [560, 160],
    ],
    // Parchment well on the inner tabletop [centerX, centerY, width, height]. Inside the rim, clear of hoods.
    well: [836, 418, 400, 176],
  },
  night: {
    src: hallNight,
    w: 1672,
    h: 828,
    plates: [
      [836, 31, 155, 29], [1238, 119, 140, 29], [1416, 360, 158, 29], [1298, 599, 147, 29],
      [835, 699, 155, 29], [360, 599, 145, 29], [270, 358, 136, 29], [446, 119, 124, 29],
    ],
    figures: [
      [836, 140], [1110, 175], [1310, 320], [1205, 500], [836, 570], [445, 500], [365, 310], [555, 175],
    ],
    well: [836, 352, 440, 248],
  },
  day: {
    src: hallDay,
    w: 1016,
    h: 885,
    plates: [
      [535, 105, 152, 33], [860, 169, 136, 33], [926, 417, 161, 33], [920, 675, 149, 33],
      [534, 801, 158, 33], [138, 675, 140, 33], [90, 417, 132, 33], [215, 169, 127, 33],
    ],
    figures: [
      [536, 215], [715, 240], [880, 360], [820, 560], [530, 680], [210, 590], [150, 360], [330, 240],
    ],
    well: [508, 448, 348, 208],
  },
};

const CN = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
export const cnNumber = (n) => CN[n] ?? String(n);

// Which painting to show and what the banner says, from the live game state.
export function sceneFor(state) {
  const day = cnNumber(state.day || 1);
  if (state.phase === "ended") {
    return { scene: "night", title: "胜负揭晓", accent: state.ended ? (state.ended.winner === "wolf" ? "狼人胜" : state.ended.winner === "good" ? "好人胜" : "平局") : "对局中断", night: false };
  }
  if (state.phase === "night") {
    const steps = {
      wolves: { scene: "wolves", accent: "狼人密谈" },
      seer: { scene: "night", accent: "预言家查验" },
      witch: { scene: "night", accent: "女巫用药" },
      quiet: { scene: "night", accent: "静候" },
    };
    return { ...steps[state.nightStep ?? "wolves"], title: `第${day}夜`, night: true };
  }
  if (state.phase === "day") return { scene: "day", title: `第${day}天`, accent: "天亮", night: false };
  if (state.phase === "discussion") return { scene: "day", title: `第${day}天`, accent: "白天质询", night: false };
  if (state.phase === "vote") return { scene: "day", title: `第${day}天`, accent: "放逐投票", night: false };
  return { scene: "night", title: "入夜", accent: "静候", night: true };
}
