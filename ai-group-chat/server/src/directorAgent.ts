/**
 * Director Agent — 核心调度器
 * 读取 worldState + 最近聊天记录 + 当前事件
 * 决定：谁发言、发言顺序、是否产生新事件、是否继续对话
 */
import { WorldState } from './worldState';
import { Event, generateEvent } from './eventEngine';

export interface DirectorOutput {
  speakers: string[];   // 发言角色列表（有序）
  nextEvent: Event | null;
  continueDiscussion: boolean;
  reasoning: string;     // 调试用：Director的决策理由
}

interface Message {
  sender: string;
  text: string;
  timestamp: number;
}

// 角色目标系统
const CHARACTER_GOALS: Record<string, string[]> = {
  luffy: [
    '寻找美食',
    '寻找乐趣',
    '拉着大家行动',
    '对什么都充满热情',
  ],
  gojo: [
    '寻找有趣事情',
    '吐槽别人',
    '制造话题',
    '保持高冷但嘴欠',
  ],
  daiyu: [
    '享受旅行',
    '关注感受',
    '观察环境',
    '文艺地表达心情',
  ],
};

// 角色在事件类型下的发言优先级权重
const EVENT_TYPE_PREFERENCE: Record<string, Record<string, number>> = {
  restaurant: { luffy: 0.9, gojo: 0.6, daiyu: 0.5 },
  weather:    { luffy: 0.5, gojo: 0.4, daiyu: 0.9 },
  spot:       { luffy: 0.6, gojo: 0.5, daiyu: 0.8 },
  event:      { luffy: 0.8, gojo: 0.7, daiyu: 0.6 },
  lost:       { luffy: 0.3, gojo: 0.7, daiyu: 0.5 },
  queue:      { luffy: 0.6, gojo: 0.8, daiyu: 0.4 },
  missed:     { luffy: 0.5, gojo: 0.6, daiyu: 0.7 },
  wallet:     { luffy: 0.9, gojo: 0.5, daiyu: 0.4 },
  photo:      { luffy: 0.4, gojo: 0.7, daiyu: 0.8 },
  gift:       { luffy: 0.7, gojo: 0.5, daiyu: 0.6 },
};

/**
 * Director 主函数：决定下一轮发言安排
 * 发言规则：
 *  1. 同一个角色不能连续发言超过1次
 *  2. 最近3条消息出现过的角色降低发言概率
 *  3. 优先选择未发言角色参与互动
 */
export function direct(
  worldState: WorldState,
  recentMessages: Message[],
  currentEvent: Event | null,
  isUserActive: boolean,
): DirectorOutput {
  const speakers: string[] = [];
  let continueDiscussion = false;

  const chars = ['luffy', 'gojo', 'daiyu'];

  // 最近3条消息的发言者（用于降权）
  const recentSenders = recentMessages.slice(-3).map(m => m.sender);

  // 最后一条消息的发言者（防止连续发言）
  const lastSender = recentMessages.length > 0
    ? recentMessages[recentMessages.length - 1].sender
    : null;

  // 基础权重：事件偏好
  const eventType = currentEvent?.type ?? 'general';
  const prefs = EVENT_TYPE_PREFERENCE[eventType] ?? { luffy: 0.5, gojo: 0.5, daiyu: 0.5 };

  // 计算最终权重
  const weighted = chars.map(c => {
    let w = prefs[c] ?? 0.5;

    // 规则2：最近3条出现过的角色降权
    if (recentSenders.includes(c)) {
      w *= 0.3;
    }

    // 规则1：最后发言者额外降权（防止连续发言）
    if (c === lastSender) {
      w *= 0.1;
    }

    return { char: c, w };
  });

  // 规则3：如果有未发言角色（最近3条都没出现），大幅提高权重
  const silentChars = chars.filter(c => !recentSenders.includes(c));
  if (silentChars.length > 0) {
    weighted.forEach(item => {
      if (silentChars.includes(item.char)) {
        item.w += 0.5;
      }
    });
  }

  // 按权重排序
  weighted.sort((a, b) => b.w - a.w);

  // 选主发言人（带随机性）
  const primaryRoll = Math.random();
  let primary: string;
  if (primaryRoll < 0.5) primary = weighted[0].char;
  else if (primaryRoll < 0.8) primary = weighted[1].char;
  else primary = weighted[2].char;

  // 双重保险：确保主发言人不是 lastSender
  if (primary === lastSender && weighted.length > 1) {
    primary = weighted[1].char;
  }

  speakers.push(primary);

  // 2. 决定是否触发第二个角色接话
  const secondaryChance = isUserActive ? 0.7 : 0.4;
  if (Math.random() < secondaryChance) {
    const others = chars.filter(c => c !== primary && c !== lastSender);
    if (others.length > 0) {
      const secondaryPrefs = others.map(c => ({ char: c, w: prefs[c] ?? 0.5 }));
      secondaryPrefs.sort((a, b) => b.w - a.w);
      speakers.push(secondaryPrefs[0].char);
    }
  }

  // 3. 判断是否继续讨论
  if (isUserActive && currentEvent && currentEvent.importance > 0.6) {
    continueDiscussion = Math.random() < 0.5;
  }
  if (!isUserActive && currentEvent && currentEvent.importance > 0.8) {
    continueDiscussion = Math.random() < 0.3;
  }

  // 4. 是否产生新事件
  let nextEvent: Event | null = null;
  if (!currentEvent) {
    if (Math.random() < 0.5) {
      nextEvent = generateEvent(worldState);
    }
  }

  const reasoning = [
    `事件类型: ${eventType}`,
    `主发言人: ${primary} (权重${weighted[0].w.toFixed(2)})`,
    `接话者: ${speakers.slice(1).join(', ') || '无'}`,
    `继续讨论: ${continueDiscussion}`,
    `新事件: ${nextEvent?.title ?? '无'}`,
  ].join(' | ');

  return { speakers, nextEvent, continueDiscussion, reasoning };
}

/**
 * 生成角色的发言内容（结合世界状态 + 事件 + 目标）
 * 这是 Character Agent 的核心
 */
export function buildCharacterPrompt(
  charId: string,
  worldState: WorldState,
  currentEvent: Event | null,
  recentMessages: Message[],
  userMessage: string | null,
): string {
  const goals = CHARACTER_GOALS[charId] ?? [];
  const charNames: Record<string, string> = {
    luffy: '路飞',
    gojo: '五条悟',
    daiyu: '林黛玉',
  };
  const name = charNames[charId];

  let prompt = `你是${name}，正在和日本旅行群的朋友聊天。\n\n`;

  // 世界状态
  prompt += `【当前情况】\n`;
  prompt += `- 位置：${worldState.location} · ${worldState.area}\n`;
  prompt += `- 天气：${worldState.weather} ${worldState.temperature}°C\n`;
  prompt += `- 时间：现在${worldState.time}\n`;
  prompt += `- 旅行阶段：${worldState.travelPhase}\n`;
  prompt += `- 群氛围：${worldState.currentMood}\n`;
  if (worldState.lastEvent) {
    prompt += `- 最近发生：${worldState.lastEvent}\n`;
  }
  prompt += `\n`;

  // 当前事件
  if (currentEvent) {
    prompt += `【当前事件】${currentEvent.title}\n`;
    prompt += `${currentEvent.description}\n\n`;
  }

  // 你的目标
  prompt += `【你的性格和目标】\n`;
  goals.forEach(g => { prompt += `- ${g}\n`; });
  prompt += `\n`;

  // 最近对话
  if (recentMessages.length > 0) {
    prompt += `【最近对话】\n`;
    const recent = recentMessages.slice(-6);
    recent.forEach(m => {
      const senderName = charNames[m.sender] ?? m.sender;
      prompt += `${senderName}: ${m.text}\n`;
    });
    prompt += `\n`;
  }

  // 用户消息
  if (userMessage) {
    prompt += `【用户刚说】${userMessage}\n\n`;
  }

  prompt += `请根据以上情况，以${name}的身份回复。`;
  prompt += `保持性格：${charId === 'luffy' ? '热情冲动，句子短，爱用感叹号' : charId === 'gojo' ? '自信嘴欠，偶尔吐槽，语气轻松' : '文艺细腻，偶尔emo，句子偏长'}`;
  prompt += `回复长度：${charId === 'luffy' ? '5~20字' : charId === 'gojo' ? '10~30字' : '15~40字'}。`;
  prompt += `不要描述动作，直接输出说的话。`;

  return prompt;
}
