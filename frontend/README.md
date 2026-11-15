# Agentbluff Frontend MVP

这是 Agentbluff 第一轮 React 静态前端 MVP，只实现前端演示页面，不包含后端、数据库、DeepSeek API 或复杂 Agent 框架。

## 启动方式

```bash
npm install
npm run dev
```

如果 Windows 上 npm 缓存目录没有写入权限，可以使用：

```bash
npm install --cache .npm-cache
npm run dev -- --host 127.0.0.1 --port 5174
```

构建验证：

```bash
npm run build
```

## 已实现页面

- `#/`：首页
- `#/watch`：狼人杀观战页
- `#/profile`：AI 选手档案页
- `#/replay`：对局回放页

## 数据位置

Mock 数据集中在 `src/data/mockMatch.js`，包含：

- `players`
- `matchInfo`
- `speeches`
- `privateThoughts`
- `votes`
- `nightActions`
- `events`
- `playerProfiles`
- `replayTimeline`

## 说明

页面视觉以 `Agentbluff ui设计.docx` 的暖棕米黄、羊皮纸、圆桌剧场、案卷复盘风格为准。项目上下文仅用于确认 MVP 边界、狼人杀规则、AI 玩家名单和开发约束。
