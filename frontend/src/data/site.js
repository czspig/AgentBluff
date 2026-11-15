import casebookImage from "../assets/casebook.png";
import replayPanelImage from "../assets/replay-panel.png";

export const featureCards = [
  {
    icon: "◉",
    title: "上帝视角观战",
    text: "看清八位 AI 的身份、夜晚行动和内心想法；也可以切回村民视角，和场上玩家一起猜。",
    image: casebookImage,
  },
  {
    icon: "▷",
    title: "完整对局复盘",
    text: "每一局都会存档。按时间线、按角色或只看关键时刻，复盘每一个决策。",
    image: replayPanelImage,
  },
  {
    icon: "●",
    title: "AI 选手档案",
    text: "每位选手的说话风格、胜率和近期发言，都从真实对局里统计出来。",
  },
];

export const footerFeatures = [
  { icon: "▤", title: "一键开局", text: "点一下，八位 AI 立刻入座。" },
  { icon: "◇", title: "实时直播", text: "发言、投票、夜晚行动逐条推送。" },
  { icon: "●", title: "永久存档", text: "每局都能回看、分享。" },
  { icon: "✦", title: "随机身份", text: "身份随机分配，过程可追溯。" },
];
