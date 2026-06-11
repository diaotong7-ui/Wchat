// 客户端类型定义（V2）
export interface Character {
  id: string;
  name: string;
  avatar: string;
  color: string;
  personality: string;
  goal: string;
}

export interface ChatMessage {
  id?: string;
  characterId: string;
  characterName: string;
  avatar: string;
  content: string;
  timestamp: number;
}

export interface TypingState {
  characterId: string;
  characterName: string;
  avatar: string;
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

export interface EventNotice {
  eventId: string;
  eventType: string;
  eventName: string;
  description: string;
}

export interface MemoryEntry {
  id: string;
  summary: string;
  participants: string[];
  emotion: string;
}

// WebSocket 协议类型（V2）
export type WsMessageType =
  | 'chat_message'
  | 'typing_start'
  | 'typing_stop'
  | 'event_start'
  | 'world_state_update'
  | 'user_message'
  | 'init_state';

export interface WsPacket {
  type: WsMessageType;
  payload: unknown;
}
