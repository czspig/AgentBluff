# Agentbluff

八位 AI 互相玩狼人杀，观众以上帝视角实时观战、复盘。

```
frontend/   React + Vite 前端（首页、观战、复盘、选手档案）
server/     Node.js 后端：游戏引擎、AI 调用、SQLite 存档、实时推送（零 npm 依赖）
shared/     前后端共用的选手设定（personas.js）
```

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
cd server && npm run dev        # 后端 http://127.0.0.1:8787
cd frontend && npm run dev      # 前端 http://127.0.0.1:5173，/api 自动代理到后端
```

不配置 DeepSeek key 时，后端使用**离线模拟**：规则完整、发言是模板，不花钱，适合调界面。

## 接入 DeepSeek

```bash
cp server/.env.example server/.env
```

在 `server/.env` 里填 `DEEPSEEK_API_KEY`，重启后端即可。首页会显示当前用的是哪种模式。

## 费用控制（server/.env）

| 变量 | 默认 | 含义 |
| --- | --- | --- |
| `MAX_CONCURRENT_GAMES` | 2 | 同时进行的对局上限 |
| `GAMES_PER_IP_PER_HOUR` | 3 | 每个 IP 每小时最多开几局 |
| `GAMES_PER_DAY` | 50 | 全站每天最多开几局 |
| `READING_MS_PER_CHAR` | 45 | 每条发言后按字数停顿，给观众阅读时间（每字毫秒，限制在 2.5–9 秒）；设为 0 则全速 |
| `NIGHT_BEAT_MS` | 7000 | 夜间每一步之间的停顿（天黑请闭眼、狼刀、预言家、女巫、天亮、猎人），方便观战。设为 0 则夜间不等待；`READING_MS_PER_CHAR=0` 且未单独设置时也是 0 |

每局的 token 用量记录在数据库 `games.prompt_tokens / completion_tokens`。

## 规则

8 人局：2 狼人、预言家、女巫、猎人、3 平民。女巫不能自救、每晚最多一瓶药；猎人被毒不能开枪；首夜死者和被放逐者有遗言；平票无人出局；狼人全灭好人胜，屠边或狼人数不少于好人则狼人胜；8 天未分胜负判平局。

验证规则（离线跑大量对局并检查不变量）：

```bash
cd server && npm run simulate -- 2000
```

## 部署

```bash
cd frontend && npm run build    # 生成 frontend/dist
cd server && npm start          # 同一个端口同时提供 API 和前端页面
```

放在 nginx 后面时设置 `TRUST_PROXY=1`，并对 `/api/games/*/stream` 关闭缓冲（服务端已发送 `X-Accel-Buffering: no`）。数据库文件在 `server/data/agentbluff.db`，备份这一个文件即可。
