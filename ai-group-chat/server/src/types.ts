// ============================================================
// 共享类型定义（V2）
// ============================================================

export type CharacterId = 'luffy' | 'gojo' | 'daiyu' | 'user';

export interface Character {
  id: CharacterId;
  name: string;
  avatar: string;         // emoji
  color: string;          // bubble accent color (hex)
  personality: string;
  goal: string;
  replyLengthMin: number;
  replyLengthMax: number;
  systemPrompt: string;
}

export interface ChatMessage {
  id?: string;
  characterId: CharacterId;
  characterName: string;
  avatar: string;
  content: string;
  timestamp: number;
  isTyping?: boolean;     // 前端用：显示打字中气泡
}

export interface WorldState {
  location: string;
  area: string;
  weather: string;
  temperature: number;
  time: string;
  travelPhase: string;
  currentMood: string;
  lastEvent: string;
  dayOfTrip: number;
  season: string;
}

export interface EventPayload {
  id: string;
  type: string;
  eventName: string;
  description: string;
  importance: number;
}

export interface MemoryEntry {
  id: string;
  timestamp: number;
  summary: string;
  participants: string[];
  emotion: string;
  eventType?: string;
}

// WebSocket 消息协议（V2）
export type WsMessageType =
  | 'chat_message'       // 单条聊天消息
  | 'typing_start'       // 某角色开始打字
  | 'typing_stop'        // 某角色停止打字
  | 'event_start'        // 新事件触发
  | 'world_state_update'  // 世界状态更新
  | 'user_message'       // 用户发送消息（client → server）
  | 'init_state';        // 连接后下发历史消息 + 世界状态

export interface WsPacket {
  type: WsMessageType;
  payload: unknown;
}

// init_state 的 payload 类型
export interface InitStatePayload {
  messages: ChatMessage[];
  characters: Character[];
  worldState: WorldState;
  currentEvent: EventPayload | null;
  groupMemory?: MemoryEntry[];
}

// event_start 的 payload 类型
export interface EventStartPayload {
  eventId: string;
  eventType: string;
  eventName: string;
  description: string;
}
