import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { ChatMessage, WsPacket } from './types';
import { memory } from './memory';
import { CHARACTER_LIST } from './characters';
import { DirectorAgent } from './director';

dotenv.config();

const PORT = Number(process.env.PORT) || 3001;

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

function broadcastEvent(eventName: string, openingLine: string): void {
  broadcast({
    type: 'event_start',
    payload: { eventName, openingLine },
  });
}

// ----------------------------------------------------------
// Director 实例
// ----------------------------------------------------------
const director = new DirectorAgent(broadcastMessage, broadcastTyping, broadcastEvent);

// ----------------------------------------------------------
// WebSocket 处理
// ----------------------------------------------------------
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected. Total: ${clients.size}`);

  // 下发历史消息
  const state = memory.getState();
  ws.send(
    JSON.stringify({
      type: 'init_state',
      payload: {
        messages: state.recentMessages,
        characters: CHARACTER_LIST,
        currentEvent: state.currentEvent,
      },
    } satisfies WsPacket)
  );

  ws.on('message', async (raw) => {
    try {
      const packet: WsPacket = JSON.parse(raw.toString());
      if (packet.type === 'user_message') {
        const { content } = packet.payload as { content: string };
        if (!content?.trim()) return;

        // 把用户消息存入 memory 并广播
        const userMsg = memory.addMessage({
          characterId: 'user',
          characterName: '我',
          avatar: '🧑',
          content: content.trim(),
          timestamp: Date.now(),
        });
        broadcastMessage(userMsg);

        // Director 异步处理 AI 回复
        director.onUserMessage(content.trim()).catch(console.error);
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
// REST 接口（可选，用于调试）
// ----------------------------------------------------------
app.get('/api/state', (_req, res) => {
  res.json(memory.getState());
});

app.get('/api/characters', (_req, res) => {
  res.json(CHARACTER_LIST);
});

// ----------------------------------------------------------
// 启动
// ----------------------------------------------------------
server.listen(PORT, () => {
  console.log(`\n🚀 AI Group Chat Server running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready at ws://localhost:${PORT}`);
  console.log(`🔑 OpenAI Model: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}\n`);

  // 延迟启动开场白，等待客户端连接
  setTimeout(() => {
    director.startWelcome().catch(console.error);
  }, 3000);
});
