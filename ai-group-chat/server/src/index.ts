import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { ChatMessage, WsPacket } from './types';
import { CHARACTER_LIST } from './characters';

// V2 核心模块
import {
  WorldState,
  defaultWorldState,
  advanceTime,
  applyEventToWorld,
} from './worldState';
import { Event, generateEvent, generateEventByTrigger } from './eventEngine';
import { direct, buildCharacterPrompt } from './directorAgent';
import { IdleScheduler } from './idleScheduler';
import {
  GroupMemory,
  createGroupMemory,
  addMemory,
  extractMemoryFromMessages,
  formatMemoriesForPrompt,
} from './groupMemory';

dotenv.config();

const PORT = Number(process.env.PORT) || 3001;
const USE_OPENAI = !!process.env.OPENAI_API_KEY;

// ============================================================
// 全局状态
// ============================================================
let worldState: WorldState = { ...defaultWorldState };
let currentEvent: Event | null = null;
let groupMemory: GroupMemory = createGroupMemory();
let recentMessages: ChatMessage[] = [];
const MAX_RECENT_MESSAGES = 20;

// ============================================================
// HTTP + WebSocket Server
// ============================================================
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// 所有已连接的客户端
const clients = new Set<WebSocket>();

// ----------------------------------------------------------
// 广播函数
// ----------------------------------------------------------
function broadcast(packet: WsPacket): void {
  const data = JSON.stringify(packet);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function broadcastMessage(msg: ChatMessage): void {
  broadcast({ type: 'chat_message', payload: msg });
}

function broadcastTyping(characterId: string, isTyping: boolean): void {
  const char = CHARACTER_LIST.find((c) => c.id === characterId);
  if (!char) return;
  broadcast({
    type: isTyping ? 'typing_start' : 'typing_stop',
    payload: {
      characterId,
      characterName: char.name,
      avatar: char.avatar,
    },
  });
}

function broadcastEvent(event: Event): void {
  broadcast({
    type: 'event_start',
    payload: {
      eventId: event.id,
      eventType: event.type,
      eventName: event.title,
      description: event.description,
    },
  });
}

function broadcastWorldState(): void {
  broadcast({
    type: 'world_state_update',
    payload: { worldState, currentEvent },
  });
}

// ----------------------------------------------------------
// AI 回复生成（内置 or OpenAI）
// ----------------------------------------------------------
async function generateAIReply(
  charId: string,
  userMessage: string | null,
): Promise<string> {
  if (USE_OPENAI) {
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const prompt = buildCharacterPrompt(
        charId,
        worldState,
        currentEvent,
        recentMessages.slice(-6),
        userMessage,
      );
      const memories = formatMemoriesForPrompt(groupMemory, currentEvent?.type ?? null);
      const fullPrompt = memories + '\n' + prompt;

      const res = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'system', content: fullPrompt }],
        max_tokens: charId === 'luffy' ? 50 : charId === 'gojo' ? 80 : 120,
        temperature: 0.9,
      });
      const text = res.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch (e) {
      console.error(`[OpenAI] ${charId} 调用失败:`, e);
    }
  }

  // fallback：内置回复
  return generateFallbackReply(charId, userMessage);
}

function generateFallbackReply(charId: string, userMessage: string | null): string {
  const um = (userMessage || '').trim();
  const umLower = um.toLowerCase();

  // 根据用户消息内容生成针对性 fallback 回复
  // 路飞：热情冲动，围绕吃和行动
  if (charId === 'luffy') {
    if (/吃|饿|食|肉|面|饭|餐|菜|喝|奶茶|咖啡|甜点|烧烤|火锅|好吃|美食/.test(umLower))
      return [`${um.slice(0, 8)}？！我现在就饿了！`, '走走走！先去吃！', '肉！！！', '那家店我听说过！'][Math.floor(Math.random() * 4)];
    if (/干嘛|干什么|在干|在做|大家/.test(um))
      return ['我在想吃什么！', '找好吃的！跟我来！', '准备出发！', '超饿的！'][Math.floor(Math.random() * 4)];
    if (/雨|湿|冷|天气|下雪|热|温度/.test(umLower))
      return ['怕什么！走就是了！', 'Wow好刺激！', '先找地方躲一下！'][Math.floor(Math.random() * 3)];
    if (/迷路|路|方向|导航|地图|在哪/.test(umLower))
      return ['随便走！', '迷路就是冒险！', '那边那边！'][Math.floor(Math.random() * 3)];
    if (/谁|什么|怎么|为什么|哪|多少|吗|呢/.test(um))
      return ['这个嘛……不知道！', '问得好！但我也不知道！', '管他呢，先走！'][Math.floor(Math.random() * 3)];
    return ['好！！', '那就去吧！', '没问题！', '冲！'][Math.floor(Math.random() * 4)];
  }

  // 五条悟：自信嘴欠
  if (charId === 'gojo') {
    if (/吃|饿|食|肉|面|饭|餐/.test(umLower))
      return ['这家评分不会超过7分。', '哦？我吃过更好的。', '还行吧，也就那样。', '排队超过10分钟我就不吃了。'][Math.floor(Math.random() * 4)];
    if (/干嘛|干什么|在干|在做|大家/.test(um))
      return ['我？在看戏。', '随便逛逛。', '你们太慢了。', '有点无聊。'][Math.floor(Math.random() * 4)];
    if (/雨|湿|冷|天气/.test(umLower))
      return ['下雨而已，普通。', '我早就预料到了。', '这天气……还行吧。'][Math.floor(Math.random() * 3)];
    if (/迷路|路|方向|导航/.test(umLower))
      return ['迷路？跟着我就对了。', '这地方我闭着眼睛都能找到。', '导航？那是给弱者的。'][Math.floor(Math.random() * 3)];
    if (/谁|什么|怎么|为什么|哪|多少|吗|呢/.test(um))
      return ['问得好，但我不会告诉你。', '你猜？', '想知道？求我啊。'][Math.floor(Math.random() * 3)];
    return ['哦？', '有趣。', '随便。', '还行吧。'][Math.floor(Math.random() * 4)];
  }

  // 林黛玉：文艺细腻
  if (charId === 'daiyu') {
    if (/吃|饿|食|肉|面|饭|餐/.test(umLower))
      return ['听起来就让人心生向往……', '不知可有故乡的味道？', '进去坐坐也好，外头风有些凉。', '嗯……让我想起一首诗。'][Math.floor(Math.random() * 4)];
    if (/干嘛|干什么|在干|在做|大家/.test(um))
      return ['我……在看风景。', '没干什么，就在想事情。', '你们呢？', '倒也清净。'][Math.floor(Math.random() * 4)];
    if (/雨|湿|冷|天气/.test(umLower))
      return ['下雨了……最近总是这样。', '雨天最适合一个人发呆……', '这雨，倒也有几分诗意。'][Math.floor(Math.random() * 3)];
    if (/迷路|路|方向|导航/.test(umLower))
      return ['迷路了……倒也未尝不是一种风景。', '不知何去，反而自由。', '走走看，哪条路都好。'][Math.floor(Math.random() * 3)];
    if (/谁|什么|怎么|为什么|哪|多少|吗|呢/.test(um))
      return ['这个问题……我也在思考。', '或许，答案就在路上。', '谁知道呢，走一步看一步吧。'][Math.floor(Math.random() * 3)];
    return ['嗯……', '是呢。', '我在想……', '这感觉真好。'][Math.floor(Math.random() * 4)];
  }

  return '……';
}

// ----------------------------------------------------------
// 执行一轮AI发言
// ----------------------------------------------------------
async function executeSpeaker(
  charId: string,
  userMessage: string | null,
  delayMs: number,
): Promise<ChatMessage> {
  await new Promise((r) => setTimeout(r, delayMs));
  broadcastTyping(charId, true);
  await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000));
  broadcastTyping(charId, false);

  const text = await generateAIReply(charId, userMessage);
  const char = CHARACTER_LIST.find((c) => c.id === charId)!;
  const msg: ChatMessage = {
    characterId: charId,
    characterName: char.name,
    avatar: char.avatar,
    content: text,
    timestamp: Date.now(),
  };
  recentMessages.push(msg);
  if (recentMessages.length > MAX_RECENT_MESSAGES) {
    recentMessages = recentMessages.slice(-MAX_RECENT_MESSAGES);
  }
  broadcastMessage(msg);
  return msg;
}

// ----------------------------------------------------------
// Director 调度：决定谁说话、说什么
// ----------------------------------------------------------
async function runDirector(userMessage: string | null): Promise<void> {
  const dirResult = direct(
    worldState,
    recentMessages.slice(-6),
    currentEvent,
    !!userMessage,
  );

  console.log(`[Director] ${dirResult.reasoning}`);

  // 执行发言 —— 所有发言者都能看到用户消息
  for (let i = 0; i < dirResult.speakers.length; i++) {
    const charId = dirResult.speakers[i];
    const delay = i === 0 ? 500 : 800 + Math.random() * 1200;
    // 修复：所有发言者都能看到 userMessage，而不只是第一个
    await executeSpeaker(charId, userMessage, delay);
  }

  // 尝试提取记忆
  const lastFew = recentMessages.slice(-4);
  const memSummary = extractMemoryFromMessages(
    lastFew.map((m) => ({ sender: m.characterId, text: m.content, timestamp: m.timestamp })),
    currentEvent,
  );
  if (memSummary) {
    groupMemory = addMemory(
      groupMemory,
      memSummary,
      lastFew.map((m) => m.characterId),
      worldState.currentMood,
      currentEvent?.type,
    );
  }

  // 是否产生新事件
  if (dirResult.nextEvent) {
    currentEvent = dirResult.nextEvent;
    worldState.lastEvent = currentEvent.title;
    broadcastEvent(currentEvent);
    worldState = applyEventToWorld(worldState, currentEvent);
    broadcastWorldState();
  }

  // 是否继续讨论
  if (dirResult.continueDiscussion) {
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
    await runDirector(null); // 递归，但无用户消息
  }
}

// ----------------------------------------------------------
// Idle Scheduler — AI主动聊天
// ----------------------------------------------------------
const idleScheduler = new IdleScheduler(
  // onMessage
  (sender, text) => {
    const char = CHARACTER_LIST.find((c) => c.id === sender);
    const msg: ChatMessage = {
      characterId: sender,
      characterName: char?.name ?? sender,
      avatar: char?.avatar ?? '🤖',
      content: text,
      timestamp: Date.now(),
    };
    recentMessages.push(msg);
    if (recentMessages.length > MAX_RECENT_MESSAGES) {
      recentMessages = recentMessages.slice(-MAX_RECENT_MESSAGES);
    }
    broadcastMessage(msg);
  },
  // onEvent
  (event) => {
    currentEvent = event;
    worldState.lastEvent = event.title;
    broadcastEvent(event);
    worldState = applyEventToWorld(worldState, event);
    broadcastWorldState();
  },
  // onTyping
  (sender) => broadcastTyping(sender, true),
  // onStopTyping
  () => broadcastTyping('', false),
);

// ----------------------------------------------------------
// WebSocket 处理
// ----------------------------------------------------------
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected. Total: ${clients.size}`);

  // 下发初始状态
  ws.send(
    JSON.stringify({
      type: 'init_state',
      payload: {
        messages: recentMessages,
        characters: CHARACTER_LIST,
        worldState,
        currentEvent,
        groupMemory: groupMemory.entries.slice(-5),
      },
    } satisfies WsPacket),
  );

  ws.on('message', async (raw) => {
    try {
      const packet: WsPacket = JSON.parse(raw.toString());
      if (packet.type === 'user_message') {
        const { content } = packet.payload as { content: string };
        if (!content?.trim()) return;

        // 记录用户消息
        const userMsg: ChatMessage = {
          characterId: 'user',
          characterName: '我',
          avatar: '🧑',
          content: content.trim(),
          timestamp: Date.now(),
        };
        recentMessages.push(userMsg);
        if (recentMessages.length > MAX_RECENT_MESSAGES) {
          recentMessages = recentMessages.slice(-MAX_RECENT_MESSAGES);
        }
        broadcastMessage(userMsg);

        // 通知 idleScheduler 用户活跃
        idleScheduler.userActive();

        // Director 处理
        await runDirector(content.trim());
      }

      if (packet.type === 'request_world_state') {
        ws.send(
          JSON.stringify({
            type: 'world_state_update',
            payload: { worldState, currentEvent },
          } satisfies WsPacket),
        );
      }
    } catch (e) {
      console.error('[WS] parse error', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected. Total: ${clients.size}`);
  });
});

// ----------------------------------------------------------
// REST 接口
// ----------------------------------------------------------
app.get('/api/state', (_req, res) => {
  res.json({ worldState, currentEvent, groupMemory: groupMemory.entries });
});

app.get('/api/characters', (_req, res) => {
  res.json(CHARACTER_LIST);
});

app.post('/api/trigger-event', (_req, res) => {
  const event = generateEvent(worldState);
  currentEvent = event;
  worldState.lastEvent = event.title;
  broadcastEvent(event);
  worldState = applyEventToWorld(worldState, event);
  broadcastWorldState();
  res.json({ event });
});

// ----------------------------------------------------------
// 启动
// ----------------------------------------------------------
server.listen(PORT, () => {
  console.log(`\n🚀 AI Group Chat V2 Server running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready at ws://localhost:${PORT}`);
  console.log(`🤖 OpenAI: ${USE_OPENAI ? 'ENABLED (' + (process.env.OPENAI_MODEL || 'gpt-4o-mini') + ')' : 'DISABLED (fallback mode)'}`);
  console.log(`🌍 World: ${worldState.location} · ${worldState.area} · ${worldState.weather}\n`);

  // 启动 idle scheduler
  idleScheduler.setWorldState(worldState);
  idleScheduler.start();
  console.log('[IdleScheduler] Started — AI will chat proactively when user is idle.');
});
