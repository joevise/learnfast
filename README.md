# LearnFast

> 用AI把读过的都记住 - 智能文章学习助手

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Node](https://img.shields.io/badge/node-22+-blue)
![Docker](https://img.shields.io/badge/docker-ready-blue)

## 功能特性

- 📰 **智能文章解析** - 输入任意文章链接，AI自动提取核心内容
- 💡 **关键要点总结** - 3个核心要点，快速把握文章精华
- 🃏 **记忆闪卡** - 点击翻转式闪卡，强化记忆效果
- 📝 **小测验** - 即时检验学习成果
- 📚 **学习历史** - 记录每次学习，方便回顾

## 快速开始

### 方法1: Docker 部署（推荐）

```bash
# 克隆项目
git clone https://github.com/joevise/learnfast.git
cd learnfast

# 配置环境变量
cp server/.env.example server/.env
# 编辑 .env 填入你的 MiniMax API Key

# 启动服务
docker compose up -d

# 访问
open http://localhost:3000
```

### 方法2: 手动部署

```bash
# 安装依赖
cd server && npm install

# 启动
npm start
```

## 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `MINIMAX_API_KEY` | MiniMax API 密钥 | ✅ |
| `MINIMAX_GROUP_ID` | MiniMax 分组ID | ✅ |
| `PORT` | 服务端口，默认 3000 | ❌ |
| `DB_PATH` | 数据库路径 | ❌ |

## 技术架构

```
┌─────────────────────────────────────┐
│           LearnFast                 │
├─────────────────────────────────────┤
│  Frontend (HTML/JS)                │
│  - 单页应用                         │
│  - 调用后端 API                     │
├─────────────────────────────────────┤
│  Backend (Node.js/Express)         │
│  - RESTful API                     │
│  - 内容提取服务                     │
│  - AI 分析服务                     │
│  - SQLite 数据库                    │
├─────────────────────────────────────┤
│  MiniMax API                       │
│  - 文章分析与生成                   │
└─────────────────────────────────────┘
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/analyze` | 分析文章 |
| `GET` | `/api/analysis/:id` | 获取分析结果 |
| `GET` | `/api/recent` | 最近分析记录 |
| `GET` | `/health` | 健康检查 |

## CI/CD 部署

推送到 `main` 分支自动触发部署：

1. 配置 GitHub Secrets:
   - `SERVER_HOST` - 服务器 IP
   - `SERVER_SSH_KEY` - SSH 私钥

2. 服务器需要:
   - Docker 和 Docker Compose
   - SSH 密钥认证

## License

MIT
