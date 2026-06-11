import { ChatMessage, GroupState } from './types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Memory Manager：维护群聊状态和最近20条消息
// ============================================================

const MAX_MEMORY = 20;

class MemoryManager {
  private state: GroupState = {
    currentEvent: null,
    recentMessages: [],
    userLastActiveAt: Date.now(),
    isProcessing: false,
  };

  getState(): GroupState {
    return this.state;
  }

  addMessage(msg: Omit<ChatMessage, 'id'>): ChatMessage {
    const full: ChatMessage = { ...msg, id: uuidv4() };
    this.state.recentMessages.push(full);
    if (this.state.recentMessages.length > MAX_MEMORY) {
      this.state.recentMessages = this.state.recentMessages.slice(-MAX_MEMORY);
    }
    return full;
  }

  setEvent(event: GroupState['currentEvent']): void {
    this.state.currentEvent = event;
  }

  updateUserActivity(): void {
    this.state.userLastActiveAt = Date.now();
  }

  setProcessing(val: boolean): void {
    this.state.isProcessing = val;
  }

  getIdleSeconds(): number {
    return (Date.now() - this.state.userLastActiveAt) / 1000;
  }

  /** 构建发给 OpenAI 的对话上下文（最近N条） */
  buildContextMessages(limit = 12): Array<{ role: 'user' | 'assistant'; content: string }> {
    return this.state.recentMessages
      .slice(-limit)
      .map((m) => ({
        role: m.characterId === 'user' ? ('user' as const) : ('assistant' as const),
        content: `[${m.characterName}]: ${m.content}`,
      }));
  }
}

export const memory = new MemoryManager();
