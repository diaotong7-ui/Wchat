import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { Character } from './types';
import { memory } from './memory';

dotenv.config();

// ============================================================
// Character Agent：单个角色调用 OpenAI 生成一句话
// ============================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * 生成单个角色的一句发言
 * @param character  角色配置
 * @param trigger    触发上下文（用户消息内容，或当前事件描述）
 * @param respondTo  正在回复/吐槽的对象（可选）
 */
export async function generateCharacterMessage(
  character: Character,
  trigger: string,
  respondTo?: string
): Promise<string> {
  const state = memory.getState();
  const eventDesc = state.currentEvent
    ? `当前群里正在发生的事：${state.currentEvent.name} —— ${state.currentEvent.description}`
    : '群里目前比较平静，在随意闲聊。';

  const respondToHint = respondTo
    ? `\n请直接回应或吐槽"${respondTo}"说的话，保持你的性格。`
    : '';

  const contextHistory = memory.buildContextMessages(10);

  const systemPrompt = `${character.systemPrompt}

${eventDesc}

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
