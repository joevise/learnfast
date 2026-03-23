# LearnFast 项目进度记录

## 基本信息
- **项目路径**: `/home/elttilz/.openclaw/workspaces/joevise/projects/learnfast`
- **部署地址**: https://learnfast.pages.dev/
- **创建时间**: 2026-03-23
- **Wrangler 版本**: 4.76.0 (Cloudflare Pages)

## 当前状态

### 已完成
- 项目初始化，使用 Wrangler 创建
- 单页 HTML 应用，功能都在 index.html 里
- 基础 UI：输入框、分析按钮、结果展示（摘要/要点/闪卡/测验）
- 免费额度限制：每天 5 次

### 核心代码 (index.html)
- **内容获取**: `allorigins.win` 代理抓取 + 简单 `DOMParser` 提取文字
- **AI 解析**: 调用 MiniMax API (`MiniMax-Text-01` 模型)
- **API URL**: `https://api.minimax.chat/v1/text/chatcompletion_pro?GroupId=1732073`
- **API Key**: 已内置在代码中

### 主要问题
1. **微信公众号链接无法解析** —— 微信有登录墙和 JS 渲染，allorigins.win 抓不到内容
2. **普通网页解析效果一般** —— 现有的 `extractText` 太简陋，只是简单的 `innerText`

## 迭代计划（待完成）

### 优先级高
1. **改进普通网页解析** —— 用 `@mozilla/readability` 替代现有的简单提取
2. **微信公众号支持** —— 接入 wechat-article-exporter 或类似服务

### 优先级中
3. 更丰富的 AI 解析（追问、知识点关联）
4. 本地存储记忆卡学习进度

### 优先级低
5. 用户体系
6. 社交分享功能

## 关键参考信息

### wechat-article-exporter
- GitHub: https://github.com/wechat-article/wechat-article-exporter
- 在线工具: https://down.mptext.top
- 文档: https://docs.mptext.top
- API 支持文章列表和内容提取，需 biz 参数
- MIT 开源，可自部署

### wechat-article-parser (Go 库)
- GitHub: https://github.com/xzdev/wechat-article-parser
- 可提取 title/author/url/summary/photos/readtime/publishtime

### RSSHub 微信 route
- Route: `/wechat/mp/articles/:id`
- 需要 biz 参数（从 `__biz=` 提取）

## 用户反馈
- 用户主要想用微信公众号链接，但读不出来
- 用户希望真正能用 AI 解析，而不是"没有解析出太多东西"
- 用户场景：每天学习，想用这个工具帮助记忆

---
*最后更新: 2026-03-23 00:45 GMT+8*
