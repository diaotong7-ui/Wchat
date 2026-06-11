/**
 * Conversation Engine V3 — 对话引擎
 * 生成完整群对话，确保角色之间形成上下文
 * 流程：用户消息 → Director决定角色 → 角色1回复用户 → 角色2回复角色1 → 角色3评论 → 结束
 */

import { WorldState } from './worldState';
import { Event } from './eventEngine';
import { IntentResult } from './intentEngine';
import { GroupMemory } from './memory';
import { generateCharacterReply } from './characterAgent';

export interface ConversationContext {
  worldState: WorldState;
  currentEvent: Event | null;
  intent: IntentResult | null;
  memory: GroupMemory | null;
  tripGoal: string | null;
  userMessage: string | null;
  previousReplies: Array<{ charId: string; reply: string }>;
}

/**
 * 生成完整的群对话
 * 确保角色之间形成上下文，而不是各说各的
 */
export async function generateConversation(
  speakers: string[],
  context: ConversationContext,
): Promise<Array<{ charId: string; reply: string }>> {
  const replies: Array<{ charId: string; reply: string }> = [];

  // 为每个发言者生成回复（按顺序，后续发言者能看到前面发言者的回复）
  for (let i = 0; i < speakers.length; i++) {
    const charId = speakers[i];

    // 构建上下文：前面的发言者的回复
    const previousReplies = replies.map(r => ({
      charId: r.charId,
      reply: r.reply,
    }));

    // 生成当前角色的回复
    const reply = await generateCharacterReply({
      charId,
      userMessage: i === 0 ? context.userMessage : null, // 只有第一个发言者直接回应用户
      worldState: context.worldState,
      currentEvent: context.currentEvent,
      intent: context.intent,
      memory: context.memory,
      previousReplies,
      tripGoal: context.tripGoal,
      isFirstSpeaker: i === 0,
      previousSpeakerReply: i > 0 ? replies[i - 1].reply : null,
    });

    replies.push({ charId, reply });
  }

  return replies;
}

/**
 * 构建角色的回复提示词（V3版本）
 * 确保角色回应用户、接话前面的角色、结合事件和记忆
 */
export function buildConversationPrompt(
  charId: string,
  context: ConversationContext,
  previousReplies: Array<{ charId: string; reply: string }>,
  isFirstSpeaker: boolean,
  previousSpeakerReply: string | null,
): string {
  const charNames: Record<string, string> = {
    luffy: '路飞',
    gojo: '五条悟',
    daiyu: '林黛玉',
  };
  const name = charNames[charId];

  let prompt = `你是${name}，正在和日本旅行群的朋友聊天。\n\n`;

  // 世界状态
  prompt += `【当前情况】\n`;
  prompt += `- 位置：${context.worldState.location} · ${context.worldState.area}\n`;
  prompt += `- 天气：${context.worldState.weather} ${context.worldState.temperature}°C\n`;
  prompt += `- 时间：现在${context.worldState.time}\n`;
  prompt += `- 旅行阶段：${context.worldState.travelPhase}\n`;
  prompt += `- 群氛围：${context.worldState.currentMood}\n`;
  if (context.worldState.lastEvent) {
    prompt += `- 最近发生：${context.worldState.lastEvent}\n`;
  }
  prompt += `\n`;

  // 当前事件
  if (context.currentEvent) {
    prompt += `【当前事件】${context.currentEvent.title}\n`;
    prompt += `${context.currentEvent.description}\n\n`;
  }

  // 用户意图
  if (context.intent) {
    prompt += `【用户意图】\n`;
    prompt += `- 意图类型：${context.intent.intent}\n`;
    prompt += `- 情绪：${context.intent.emotion}\n`;
    prompt += `- 话题：${context.intent.topic}\n\n`;
  }

  // 旅行目标
  if (context.tripGoal) {
    prompt += `【旅行目标】\n`;
    prompt += `${context.tripGoal}\n\n`;
  }

  // 群记忆
  if (context.memory && context.memory.summaries.length > 0) {
    prompt += `【群记忆】（最近3条）\n`;
    const recentSummaries = context.memory.summaries.slice(-3);
    recentSummaries.forEach((s, i) => {
      prompt += `${i + 1}. ${s}\n`;
    });
    prompt += `\n`;
  }

  // 用户消息
  if (context.userMessage) {
    prompt += `【用户刚说】${context.userMessage}\n\n`;
  }

  // 前面的角色回复（关键：形成上下文）
  if (previousReplies.length > 0) {
    prompt += `【前面的角色回复】\n`;
    previousReplies.forEach(r => {
      const senderName = charNames[r.charId];
      prompt += `${senderName}说：${r.reply}\n`;
    });
    prompt += `\n`;
  }

  // 回复要求
  prompt += `【你的回复要求】\n`;

  if (isFirstSpeaker) {
    prompt += `1. 你是第一个发言者，必须直接回应用户的消息\n`;
  } else {
    prompt += `1. 你不是第一个发言者，必须接话前面角色的回复，形成上下文\n`;
  }

  if (previousSpeakerReply) {
    prompt += `2. 特别是要回应${charNames[previousReplies[previousReplies.length - 1].charId]}说的："${previousSpeakerReply}"\n`;
  }

  prompt += `3. 必须结合当前事件（如果有）\n`;
  prompt += `4. 必须结合历史记忆（如果有）\n`;
  prompt += `5. 必须结合旅行目标（如果有）\n`;
  prompt += `6. 保持性格：${charId === 'luffy' ? '热情冲动，句子短，爱用感叹号' : charId === 'gojo' ? '自信嘴欠，偶尔吐槽，语气轻松' : '文艺细腻，偶尔emo，句子偏长'}\n`;
  prompt += `7. 回复长度：${charId === 'luffy' ? '5~20字' : charId === 'gojo' ? '10~30字' : '15~40字'}\n`;
  prompt += `8. 不要描述动作，直接输出说的话。\n`;

  return prompt;
}
