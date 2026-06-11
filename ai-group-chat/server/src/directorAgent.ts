/**
 * Director Agent V3 — 核心调度器（升级版）
 * 读取 worldState + intent + memory + tripGoal
 * 决定：谁先说、谁接话、讨论模式、是否推进旅行目标、是否触发新事件
 */

import { WorldState } from './worldState';
import { Event, generateEvent } from './eventEngine';
import { IntentResult, getDiscussionMode } from './intentEngine';
import { GroupMemory } from './memory';

export interface DirectorOutput {
  speakers: string[];   // 发言角色列表（有序）
  nextEvent: Event | null;
  continueDiscussion: boolean;
  discussionMode: string; // 讨论模式（food/social/discussion/support/conflict等）
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

// 讨论模式下的角色优先级权重
const DISCUSSION_MODE_PREFERENCE: Record<string, Record<string, number>> = {
  food:       { luffy: 0.9, gojo: 0.6, daiyu: 0.5 },
  social:     { luffy: 0.7, gojo: 0.6, daiyu: 0.8 },
  discussion: { luffy: 0.6, gojo: 0.8, daiyu: 0.7 },
  support:    { luffy: 0.7, gojo: 0.5, daiyu: 0.9 },
  conflict:   { luffy: 0.4, gojo: 0.9, daiyu: 0.6 },
  celebration:{ luffy: 0.9, gojo: 0.7, daiyu: 0.5 },
  excitement: { luffy: 0.9, gojo: 0.7, daiyu: 0.6 },
  casual:     { luffy: 0.6, gojo: 0.6, daiyu: 0.6 },
};

// 意图对应的理想发言者数量
const INTENT_SPEAKER_COUNT: Record<string, number> = {
  ask_status: 2,      // 询问状态：2人回复
  ask_opinion: 3,     // 询问意见：3人都回复
  need_food: 3,       // 需要食物：3人都参与
  need_help: 2,       // 需要帮助：2人回复
  emotion_happy: 2,   // 开心：2人一起庆祝
  emotion_sad: 2,     // 伤心：2人安慰
  emotion_angry: 2,   // 生气：2人回应（可能冲突）
  emotion_excited: 3, // 兴奋：3人一起兴奋
  random_chat: 1,     // 随机聊天：1人回复
};

/**
 * Director 主函数 V3：根据用户意图决定发言安排
 * 新增参数：userMessage, intent, memory, tripGoal
 */
export function direct(
  worldState: WorldState,
  recentMessages: Message[],
  currentEvent: Event | null,
  isUserActive: boolean,
  userMessage: string | null,
  intent: IntentResult | null,
  memory: GroupMemory | null,
  tripGoal: string | null,
): DirectorOutput {
  const speakers: string[] = [];
  let continueDiscussion = false;

  const chars = ['luffy', 'gojo', 'daiyu'];

  // 1. 确定讨论模式
  const discussionMode = intent ? getDiscussionMode(intent.intent) : 'casual';

  // 2. 最近3条消息的发言者（用于降权）
  const recentSenders = recentMessages.slice(-3).map(m => m.sender);

  // 3. 最后一条消息的发言者（防止连续发言）
  const lastSender = recentMessages.length > 0
    ? recentMessages[recentMessages.length - 1].sender
    : null;

  // 4. 基础权重：讨论模式偏好
  const prefs = DISCUSSION_MODE_PREFERENCE[discussionMode] ?? DISCUSSION_MODE_PREFERENCE['casual'];

  // 5. 根据意图调整权重
  if (intent) {
    // need_food: 路飞权重最高
    if (intent.intent === 'need_food') {
      prefs['luffy'] = 0.95;
      prefs['gojo'] = 0.6;
      prefs['daiyu'] = 0.5;
    }

    // emotion_angry: 五条悟权重最高（可能冲突）
    if (intent.intent === 'emotion_angry') {
      prefs['gojo'] = 0.9;
      prefs['daiyu'] = 0.7;
      prefs['luffy'] = 0.4;
    }

    // emotion_sad: 林黛玉权重最高（安慰）
    if (intent.intent === 'emotion_sad') {
      prefs['daiyu'] = 0.95;
      prefs['luffy'] = 0.6;
      prefs['gojo'] = 0.4;
    }

    // ask_opinion: 五条悟权重最高（意见领袖）
    if (intent.intent === 'ask_opinion') {
      prefs['gojo'] = 0.9;
      prefs['daiyu'] = 0.7;
      prefs['luffy'] = 0.5;
    }
  }

  // 6. 计算最终权重（含降权规则）
  const weighted = chars.map(c => {
    let w = prefs[c] ?? 0.5;

    // 规则1：最近3条出现过的角色降权
    if (recentSenders.includes(c)) {
      w *= 0.3;
    }

    // 规则2：最后发言者额外降权（防止连续发言）
    if (c === lastSender) {
      w *= 0.05;
    }

    return { char: c, w };
  });

  // 7. 规则3：如果有未发言角色（最近3条都没出现），大幅提高权重
  const silentChars = chars.filter(c => !recentSenders.includes(c));
  if (silentChars.length > 0) {
    weighted.forEach(item => {
      if (silentChars.includes(item.char)) {
        item.w += 0.5;
      }
    });
  }

  // 8. 按权重排序
  weighted.sort((a, b) => b.w - a.w);

  // 9. 确定需要多少个发言者
  const targetSpeakerCount = intent ? (INTENT_SPEAKER_COUNT[intent.intent] ?? 1) : 1;

  // 10. 选择发言者（带随机性）
  for (let i = 0; i < Math.min(targetSpeakerCount, 3); i++) {
    if (i === 0) {
      // 主发言人：按权重选择（带随机性）
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
    } else {
      // 后续发言者：选择权重次高的（且不是最后发言者）
      const nextSpeakers = weighted.filter(w => !speakers.includes(w.char) && w.char !== lastSender);
      if (nextSpeakers.length > 0) {
        speakers.push(nextSpeakers[0].char);
      }
    }
  }

  // 11. 判断是否继续讨论
  if (isUserActive) {
    // 用户活跃：根据意图决定是否继续讨论
    if (intent && ['ask_opinion', 'need_help', 'emotion_angry'].includes(intent.intent)) {
      continueDiscussion = Math.random() < 0.7; // 这些意图更可能继续讨论
    } else {
      continueDiscussion = Math.random() < 0.4;
    }
  } else {
    // 用户不活跃：根据事件重要性决定是否继续讨论
    if (currentEvent && currentEvent.importance > 0.8) {
      continueDiscussion = Math.random() < 0.3;
    }
  }

  // 12. 是否产生新事件（基于意图、世界状态、旅行目标）
  let nextEvent: Event | null = null;

  // 如果没有当前事件，或者当前事件已经结束，考虑生成新事件
  if (!currentEvent || Math.random() < 0.3) {
    // 根据意图生成相关事件
    if (intent && intent.intent === 'need_food' && Math.random() < 0.6) {
      // 用户饿了，高概率生成餐厅相关事件
      nextEvent = generateEvent(worldState, 'restaurant');
    } else if (intent && intent.emotion === 'angry' && Math.random() < 0.4) {
      // 用户生气，中等概率生成冲突相关事件
      nextEvent = generateEvent(worldState, 'conflict');
    } else {
      // 否则正常生成事件
      nextEvent = generateEvent(worldState);
    }
  }

  // 13. 生成决策理由（用于调试）
  const reasoning = [
    `意图: ${intent ? intent.intent : '无'}`,
    `情绪: ${intent ? intent.emotion : '无'}`,
    `讨论模式: ${discussionMode}`,
    `主发言人: ${speakers[0]}`,
    `其他发言者: ${speakers.slice(1).join(', ') || '无'}`,
    `发言者数量: ${speakers.length}/${targetSpeakerCount}`,
    `继续讨论: ${continueDiscussion}`,
    `新事件: ${nextEvent?.title ?? '无'}`,
  ].join(' | ');

  return {
    speakers,
    nextEvent,
    continueDiscussion,
    discussionMode,
    reasoning,
  };
}

/**
 * 生成角色的发言内容（结合世界状态 + 事件 + 目标 + 意图）
 * 这是 Character Agent 的核心
 */
export function buildCharacterPrompt(
  charId: string,
  worldState: WorldState,
  currentEvent: Event | null,
  recentMessages: Message[],
  userMessage: string | null,
  intent: IntentResult | null,
  memory: GroupMemory | null,
  tripGoal: string | null,
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

  // 用户意图（新增）
  if (intent) {
    prompt += `【用户意图】\n`;
    prompt += `- 意图类型：${intent.intent}\n`;
    prompt += `- 情绪：${intent.emotion}\n`;
    prompt += `- 话题：${intent.topic}\n`;
    prompt += `- 紧急度：${intent.urgency}\n\n`;
  }

  // 旅行目标（新增）
  if (tripGoal) {
    prompt += `【旅行目标】\n`;
    prompt += `${tripGoal}\n\n`;
  }

  // 群记忆（新增）
  if (memory && memory.summaries.length > 0) {
    prompt += `【群记忆】（最近3条）\n`;
    const recentSummaries = memory.summaries.slice(-3);
    recentSummaries.forEach((s, i) => {
      prompt += `${i + 1}. ${s}\n`;
    });
    prompt += `\n`;
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

  // 回复要求
  prompt += `请根据以上情况，以${name}的身份回复。\n`;
  prompt += `要求：\n`;
  prompt += `1. 必须回应用户的消息（如果有）\n`;
  prompt += `2. 必须结合当前事件（如果有）\n`;
  prompt += `3. 必须结合历史记忆（如果有）\n`;
  prompt += `4. 必须结合旅行目标（如果有）\n`;
  prompt += `5. 如果有上一位角色发言，需要接话（形成上下文）\n`;
  prompt += `6. 保持性格：${charId === 'luffy' ? '热情冲动，句子短，爱用感叹号' : charId === 'gojo' ? '自信嘴欠，偶尔吐槽，语气轻松' : '文艺细腻，偶尔emo，句子偏长'}\n`;
  prompt += `7. 回复长度：${charId === 'luffy' ? '5~20字' : charId === 'gojo' ? '10~30字' : '15~40字'}\n`;
  prompt += `8. 不要描述动作，直接输出说的话。\n`;

  return prompt;
}
