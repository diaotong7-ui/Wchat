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
  const replies: Record<string, string[]> = {
    luffy: [
      '好！！', '走走走！', '吃肉！', '冲！！',
      '嗯嗯！', '真的吗！', '好期待！', '我饿了！',
    ],
    gojo: [
      '嗯。', '随便。', '还行吧。', '你说了算。',
      '有点意思。', '我早知道。', '这个嘛……', '好吧。',
    ],
    daiyu: [
      '嗯……', '是呢。', '我在想……', '这感觉真好。',
      '有点感动。', '是这样的。', '真的吗……', '嗯，好。',
    ],
  };
  const pool = replies[charId] ?? ['……'];
  return pool[Math.floor(Math.random() * pool.length)];
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

  // 执行发言
  for (let i = 0; i < dirResult.speakers.length; i++) {
    const charId = dirResult.speakers[i];
    const delay = i === 0 ? 500 : 800 + Math.random() * 1200;
    await executeSpeaker(
      charId,
      i === 0 ? userMessage : null,
      delay,
    );
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
