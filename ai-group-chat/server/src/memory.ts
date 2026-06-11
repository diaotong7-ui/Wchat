/**
 * Memory Engine V3 — 群记忆系统（升级版）
 * 每轮聊天后自动提取摘要并保存
 * 支持：最近3条相关记忆注入Prompt
 */

import { ChatMessage } from './types';
import { v4 as uuidv4 } from 'uuid';

export interface GroupMemory {
  summaries: string[]; // 对话摘要列表
  keyMemories: string[]; // 关键记忆（重要事件）
  lastUpdated: number;
}

export interface ConversationSummary {
  id: string;
  content: string; // 摘要内容
  timestamp: number;
  participants: string[]; // 参与者
  important: boolean; // 是否重要
}

// ============================================================
// Memory Manager V3：维护群聊记忆和最近20条消息
// ============================================================

const MAX_MEMORY = 20;
const MAX_SUMMARIES = 50; // 最多保存50条摘要

class MemoryManager {
  private recentMessages: ChatMessage[] = [];
  private memory: GroupMemory = {
    summaries: [],
    keyMemories: [],
    lastUpdated: Date.now(),
  };

  /**
   * 获取群记忆
   */
  getMemory(): GroupMemory {
    return this.memory;
  }

  /**
   * 添加消息
   */
  addMessage(msg: Omit<ChatMessage, 'id'>): ChatMessage {
    const full: ChatMessage = { ...msg, id: uuidv4() };
    this.recentMessages.push(full);

    // 限制最近消息数量
    if (this.recentMessages.length > MAX_MEMORY) {
      this.recentMessages = this.recentMessages.slice(-MAX_MEMORY);
    }

    return full;
  }

  /**
   * 获取最近消息
   */
  getRecentMessages(limit: number = 20): ChatMessage[] {
    return this.recentMessages.slice(-limit);
  }

  /**
   * 提取对话摘要（V3核心功能）
   * 每轮聊天后自动调用
   */
  extractSummary(messages: ChatMessage[]): string {
    if (messages.length === 0) return '';

    // 简单的摘要提取逻辑（实际应使用AI提取，这里用规则）
    const userMessages = messages.filter(m => m.characterId === 'user');
    const aiMessages = messages.filter(m => m.characterId !== 'user');

    if (userMessages.length === 0) return '';

    // 提取关键信息
    const topics: string[] = [];
    const actions: string[] = [];

    // 分析用户消息
    userMessages.forEach(m => {
      const content = m.content.toLowerCase();

      // 食物相关
      if (/吃|饿|食|肉|面|饭|餐|拉面|寿司/.test(content)) {
        topics.push('食物');
      }

      // 位置相关
      if (/在哪|哪里|位置|导航|路|迷路/.test(content)) {
        topics.push('位置');
      }

      // 天气相关
      if (/天气|下雨|晴天|温度/.test(content)) {
        topics.push('天气');
      }
    });

    // 分析AI回复
    aiMessages.forEach(m => {
      const content = m.content;

      // 提取行动
      if (/去|走|找|发现/.test(content)) {
        actions.push(`${this.getCharName(m.characterId)}提议行动`);
      }
    });

    // 生成摘要
    let summary = '';

    if (topics.length > 0) {
      summary += `讨论了${topics.join('、')}`;
    }

    if (actions.length > 0) {
      if (summary) summary += '，';
      summary += actions.join('，');
    }

    if (!summary) {
      summary = '群聊讨论了旅行相关话题';
    }

    return summary;
  }

  /**
   * 保存对话摘要
   */
  saveSummary(summary: string, important: boolean = false): void {
    if (!summary) return;

    this.memory.summaries.push(summary);

    // 限制摘要数量
    if (this.memory.summaries.length > MAX_SUMMARIES) {
      this.memory.summaries = this.memory.summaries.slice(-MAX_SUMMARIES);
    }

    // 如果是重要记忆，保存到关键记忆
    if (important) {
      this.memory.keyMemories.push(summary);

      // 限制关键记忆数量
      if (this.memory.keyMemories.length > 20) {
        this.memory.keyMemories = this.memory.keyMemories.slice(-20);
      }
    }

    this.memory.lastUpdated = Date.now();
  }

  /**
   * 获取最近N条摘要（用于Prompt注入）
   */
  getRecentSummaries(count: number = 3): string[] {
    return this.memory.summaries.slice(-count);
  }

  /**
   * 获取关键记忆
   */
  getKeyMemories(): string[] {
    return this.memory.keyMemories;
  }

  /**
   * 清空记忆（用于测试）
   */
  clearMemory(): void {
    this.memory = {
      summaries: [],
      keyMemories: [],
      lastUpdated: Date.now(),
    };
    this.recentMessages = [];
  }

  /**
   * 获取角色名称
   */
  private getCharName(charId: string): string {
    const names: Record<string, string> = {
      luffy: '路飞',
      gojo: '五条悟',
      daiyu: '林黛玉',
      user: '用户',
    };
    return names[charId] || charId;
  }
}

// 导出单例
export const memory = new MemoryManager();
