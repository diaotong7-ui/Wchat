/**
 * Character Agent V3 — 角色发言生成器（升级版）
 * 生成单个角色的发言，支持：
 * - 回应用户消息
 * - 结合当前事件
 * - 结合历史记忆
 * - 结合旅行目标
 * - 接话前面的角色
 */

import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { Character } from './types';
import { WorldState } from './worldState';
import { Event } from './eventEngine';
import { IntentResult } from './intentEngine';
import { GroupMemory } from './memory';
import { buildConversationPrompt } from './conversationEngine';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export interface GenerateReplyParams {
  charId: string;
  userMessage: string | null;
  worldState: WorldState;
  currentEvent: Event | null;
  intent: IntentResult | null;
  memory: GroupMemory | null;
  previousReplies: Array<{ charId: string; reply: string }>;
  tripGoal: string | null;
  isFirstSpeaker: boolean;
  previousSpeakerReply: string | null;
}

/**
 * 生成单个角色的一句发言（V3版本）
 * 支持回应用户、接话前面角色、结合事件和记忆
 */
export async function generateCharacterReply(
  params: GenerateReplyParams
): Promise<string> {
  const { charId, userMessage, worldState, currentEvent, intent, memory, previousReplies, tripGoal, isFirstSpeaker, previousSpeakerReply } = params;

  // 构建上下文
  const context = {
    worldState,
    currentEvent,
    intent,
    memory,
    tripGoal,
    userMessage,
    previousReplies,
  };

  // 使用 conversationEngine 的 prompt 构建逻辑
  const prompt = buildConversationPrompt(
    charId,
    context,
    previousReplies,
    isFirstSpeaker,
    previousSpeakerReply,
  );

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: '请以上面描述的角色身份说一句话：' },
      ],
      max_tokens: 100,
      temperature: 0.9,
    });

    const raw = response.choices[0]?.message?.content?.trim() || '……';

    // 根据角色截断到合适长度
    const maxLength = charId === 'luffy' ? 40 : charId === 'gojo' ? 60 : 80;
    return raw.slice(0, maxLength);
  } catch (err) {
    console.error(`[CharacterAgent V3] ${charId} error:`, err);
    // 降级：返回性格化占位
    const fallbacks: Record<string, string> = {
      luffy: '肉肉肉！！',
      gojo: '这不是很简单嘛～',
      daiyu: '倒是……罢了，随他去吧。',
    };
    return fallbacks[charId] || '……';
  }
}

/**
 * 生成单个角色的一句发言（兼容旧版本）
 * @param character  角色配置
 * @param trigger    触发上下文（用户消息内容，或当前事件描述）
 * @param respondTo  正在回复/吐槽的对象（可选）
 */
export async function generateCharacterMessage(
  character: Character,
  trigger: string,
  respondTo?: string
): Promise<string> {
  const contextHistory = memory.buildContextMessages(10);

  const respondToHint = respondTo
    ? `\n请直接回应或吐槽"${respondTo}"说的话，保持你的性格。`
    : '';

  const systemPrompt = `${character.systemPrompt}

重要规则：
1. 每次只说一句话，字数严格在 ${character.replyLengthMin}~${character.replyLengthMax} 字之间。
2. 完全用中文回复，保持角色性格。
3. 不要带引号、不要加角色名前缀。
4. 直接输出要说的内容，不加任何解释。${respondToHint}`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...contextHistory,
        { role: 'user', content: `触发内容：${trigger}\n请以角色${character.name}的身份说一句话：` },
      ],
      max_tokens: 80,
      temperature: 0.9,
    });

    const raw = response.choices[0]?.message?.content?.trim() || '……';
    // 截断到最大长度保险
    return raw.slice(0, character.replyLengthMax * 2);
  } catch (err) {
    console.error(`[CharacterAgent] ${character.name} error:`, err);
    // 降级：返回性格化占位
    const fallbacks: Record<string, string> = {
      luffy: '肉肉肉！！',
      gojo: '这不是很简单嘛～',
      daiyu: '倒是……罢了，随他去吧。',
    };
    return fallbacks[character.id] || '……';
  }
}

// 为了兼容旧代码，导出 memory
import { memory } from './memory';
export { memory };
