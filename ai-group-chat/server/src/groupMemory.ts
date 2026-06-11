/**
 * Group Memory — 群记忆系统
 * 不存全部聊天，只保存摘要
 * 控制在50条以内
 */
export interface MemoryEntry {
  id: string;
  timestamp: number;
  summary: string;      // 简短摘要，如"路飞昨天迷路"
  participants: string[]; // 涉及角色
  emotion: string;       // 情绪：开心/争吵/感动/无聊
  eventType?: string;    // 关联事件类型
}

export interface GroupMemory {
  entries: MemoryEntry[];
  maxEntries: number;
}

let memoryCounter = 0;

/**
 * 创建空群记忆
 */
export function createGroupMemory(): GroupMemory {
  return {
    entries: [],
    maxEntries: 50,
  };
}

/**
 * 新增一条记忆
 */
export function addMemory(
  memory: GroupMemory,
  summary: string,
  participants: string[],
  emotion: string,
  eventType?: string,
): GroupMemory {
  memoryCounter++;
  const entry: MemoryEntry = {
    id: `mem_${String(memoryCounter).padStart(3, '0')}`,
    timestamp: Date.now(),
    summary,
    participants,
    emotion,
    eventType,
  };

  const next = {
    ...memory,
    entries: [...memory.entries, entry],
  };

  // 超过上限，删除最旧的
  if (next.entries.length > next.maxEntries) {
    next.entries = next.entries.slice(-next.maxEntries);
  }

  return next;
}

/**
 * 从聊天记录中自动提取记忆摘要
 * 生产环境应使用LLM提取，这里用关键词匹配
 */
export function extractMemoryFromMessages(
  messages: { sender: string; text: string; timestamp: number }[],
  event: { title: string; type: string } | null,
): string | null {
  if (messages.length === 0) return null;

  const senders = [...new Set(messages.map(m => m.sender))];
  const texts = messages.map(m => m.text).join(' ');

  // 关键词匹配生成摘要
  if (/迷路|方向|导航/.test(texts)) {
    return `${senders.join('和')}迷路了`;
  }
  if (/排队|等/.test(texts) && /饿|吃|餐厅/.test(texts)) {
    return `大家在${senders.includes('luffy') ? '路飞' : ''}的提议下排队等餐`;
  }
  if (/吐槽|嘲笑|笨|傻/.test(texts)) {
    return `${senders.join('和')}互相吐槽`;
  }
  if (/好吃|赞|棒|美/.test(texts)) {
    return `大家对${event?.title ?? '某事'}很满意`;
  }
  if (/累|休息|坐/.test(texts)) {
    return `大家找地方休息`;
  }
  if (senders.length >= 2) {
    return `${senders.join('和')}聊了关于"${messages[messages.length - 1].text.slice(0, 10)}..."`;
  }

  return null;
}

/**
 * 获取相关记忆（用于注入AI prompt）
 * 根据当前事件类型，找出相关历史记忆
 */
export function getRelevantMemories(
  memory: GroupMemory,
  currentEventType: string | null,
  limit: number = 3,
): MemoryEntry[] {
  let relevant = memory.entries;

  if (currentEventType) {
    // 优先返回同类型事件的记忆
    const sameType = relevant.filter(m => m.eventType === currentEventType);
    const other = relevant.filter(m => m.eventType !== currentEventType);
    relevant = [...sameType, ...other];
  }

  // 返回最近的
  return relevant.slice(-limit);
}

/**
 * 格式化记忆用于prompt注入
 */
export function formatMemoriesForPrompt(memory: GroupMemory, currentEventType: string | null): string {
  const relevant = getRelevantMemories(memory, currentEventType, 3);
  if (relevant.length === 0) return '';

  let s = '【群历史记忆】\n';
  relevant.forEach(m => {
    s += `- ${m.summary}（${m.emotion}）\n`;
  });
  return s;
}
