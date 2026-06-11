// ============================================================
// 共享类型定义
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
  id: string;
  characterId: CharacterId;
  characterName: string;
  avatar: string;
  content: string;
  timestamp: number;
  isTyping?: boolean;     // 前端用：显示打字中气泡
}

export interface GroupEvent {
  id: string;
  name: string;
  description: string;
  triggerCondition: 'idle' | 'user_message' | 'scheduled';
  active: boolean;
  startedAt?: number;
}

export interface GroupState {
  currentEvent: GroupEvent | null;
  recentMessages: ChatMessage[];      // 最近 20 条
  userLastActiveAt: number;
  isProcessing: boolean;              // Director 是否正在处理
}

// WebSocket 消息协议
export type WsMessageType =
  | 'chat_message'       // 单条聊天消息
  | 'typing_start'       // 某角色开始打字
  | 'typing_stop'        // 某角色停止打字
  | 'event_start'        // 新事件触发
  | 'event_end'          // 事件结束
  | 'user_message'       // 用户发送消息（client → server）
  | 'init_state';        // 连接后下发历史消息

export interface WsPacket {
  type: WsMessageType;
  payload: unknown;
}
