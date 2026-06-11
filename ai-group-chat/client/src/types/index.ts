// 前后端共享的类型（复制自 server/src/types.ts）
export type CharacterId = 'luffy' | 'gojo' | 'daiyu' | 'user';

export interface Character {
  id: CharacterId;
  name: string;
  avatar: string;
  color: string;
  personality: string;
  goal: string;
  replyLengthMin: number;
  replyLengthMax: number;
  systemPrompt: string;
}

export interface ChatMessage {
  id: string;
  characterId: CharacterId;
  characterName: string;
  avatar: string;
  content: string;
  timestamp: number;
  isTyping?: boolean;
}

export interface TypingState {
  characterId: string;
  characterName: string;
  avatar: string;
}

export interface GroupEvent {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface GroupEventNotice {
  eventName: string;
  openingLine: string;
}

export type WsMessageType =
  | 'chat_message'
  | 'typing_start'
  | 'typing_stop'
  | 'event_start'
  | 'event_end'
  | 'user_message'
  | 'init_state';

export interface WsPacket {
  type: WsMessageType;
  payload: unknown;
}
