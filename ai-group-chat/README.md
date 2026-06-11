# AI 群聊 MVP · 旅途日常群 🌏

> 一个微信群风格的 AI 多角色群聊应用。路飞、五条悟、林黛玉三个 AI 角色在群里旅行，用户可以随时插话。

---

## 快速启动

### 第一步：配置 OpenAI Key

```bash
cd server
cp .env.example .env
# 编辑 .env，填入你的 OPENAI_API_KEY
```

`.env` 内容：
```
OPENAI_API_KEY=sk-你的key
OPENAI_BASE_URL=https://api.openai.com/v1   # 如使用代理，改这里
OPENAI_MODEL=gpt-4o-mini                     # 或 gpt-3.5-turbo
PORT=3001
```

### 第二步：安装依赖

```bash
# 在项目根目录
npm install           # 安装 concurrently
npm run install:all   # 同时安装 server + client 依赖
```

### 第三步：启动

```bash
npm run dev
```

- 后端：http://localhost:3001
- 前端：http://localhost:5173 ← 在这里体验

---

## 项目结构

```
ai-group-chat/
├── package.json              # 根 package，含并发启动脚本
├── server/                   # Node.js 后端
│   ├── src/
│   │   ├── index.ts          # HTTP + WebSocket 服务器入口
│   │   ├── types.ts          # 共享类型定义
│   │   ├── characters.ts     # 角色配置（路飞/五条悟/林黛玉）
│   │   ├── events.ts         # 事件库（8种群事件）
│   │   ├── memory.ts         # Memory Manager（最近20条消息）
│   │   ├── characterAgent.ts # Character Agent（调用 OpenAI）
│   │   └── director.ts       # Director Agent（控制群聊节奏）
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── client/                   # React 前端
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── index.css         # Tailwind + 打字动画
    │   ├── types/index.ts    # 前端类型
    │   ├── hooks/
    │   │   └── useGroupChat.ts  # WebSocket hook
    │   └── components/
    │       ├── ChatScreen.tsx   # 主界面
    │       ├── ChatHeader.tsx   # 顶部导航 + 事件通知
    │       ├── MessageBubble.tsx # 聊天气泡
    │       ├── TypingBubble.tsx  # 打字中动效
    │       └── ChatInput.tsx    # 输入框
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── tsconfig.json
```

---

## 核心架构

### Director Agent
- 用户发消息 → 选主要响应者（权重随机）→ 其他角色60%概率接话
- 用户沉默15~30秒 → 触发随机事件 or 角色间闲聊
- 所有角色发言前会先显示"正在输入"2~3秒，再发送

### Event Engine
内置8种群事件：发现拉面馆、突然下雨、爬山计划、迷路了、酒店太贵、钱包丢了、甜品店、街头艺人。
每次从库中随机抽取，触发后所有角色依次对事件作出反应。

### Character Agent
每个角色有独立 System Prompt，字数严格控制：
- 路飞：3~12字
- 五条悟：5~18字
- 林黛玉：10~28字

### Memory Manager
维护最近20条消息上下文，每次 OpenAI 调用携带最近10条作为对话历史。

---

## 添加新角色

在 `server/src/characters.ts` 中添加：

```typescript
your_char: {
  id: 'your_char',
  name: '角色名',
  avatar: '🎭',
  color: '#FF6B6B',
  personality: '性格描述',
  goal: '目标',
  replyLengthMin: 5,
  replyLengthMax: 20,
  systemPrompt: `你是...（详细设定）`,
}
```

并在 `director.ts` 的 `pickPrimaryResponder` 中加入权重。

---

## 自定义事件

在 `server/src/events.ts` 的 `EVENT_TEMPLATES` 数组中添加：

```typescript
{
  name: '事件名',
  description: '事件详细描述（会作为 AI prompt 上下文）',
  openingLine: '【群通知】展示给用户的事件提示语',
}
```

---

## 注意事项

1. **API Key 费用**：每次角色发言调用一次 OpenAI API。`gpt-4o-mini` 费用很低。
2. **无真实小程序**：本 MVP 为 Web 版，可直接在浏览器体验。Taro 版需额外配置微信开发者工具。
3. **无持久化**：重启服务器，聊天记录清空。如需持久化，可接入 SQLite / Redis。
