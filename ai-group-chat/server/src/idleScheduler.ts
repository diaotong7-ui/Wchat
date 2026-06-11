/**
 * Idle Scheduler V3 — AI主动聊天调度器（升级版）
 * 用户30秒不说话，群继续推进旅行
 * 示例：发现拉面店 → 路飞提议进去 → 五条悟吐槽 → 林黛玉同意 → 保存记忆 → 更新目标进度
 */

import { WorldState } from './worldState';
import { Event } from './eventEngine';
import { GroupMemory } from './memory';
import { TripGoal } from './goalEngine';
import { generateCharacterReply } from './characterAgent';
import { generateEvent } from './eventEngine';
import { updateGoalProgress } from './goalEngine';

export interface IdleAction {
  charId: string;
  reply: string;
  action: string; // 动作（如：提议、吐槽、同意）
}

/**
 * 生成空闲时的群聊推进
 * 用户30秒不说话，群继续推进旅行
 */
export async function generateIdleConversation(
  worldState: WorldState,
  currentEvent: Event | null,
  memory: GroupMemory,
  tripGoal: TripGoal | null,
): Promise<IdleAction[]> {
  const actions: IdleAction[] = [];

  // 1. 如果没有当前事件，生成一个新事件
  let event = currentEvent;
  if (!event) {
    event = generateEvent(worldState, tripGoal ? undefined : undefined, tripGoal, null, memory);
  }

  // 2. 路飞先发现/提议（热情主动）
  const luffyReply = await generateCharacterReply({
    charId: 'luffy',
    userMessage: null,
    worldState,
    currentEvent: event,
    intent: null,
    memory,
    previousReplies: [],
    tripGoal: tripGoal ? tripGoal.title : null,
    isFirstSpeaker: true,
    previousSpeakerReply: null,
  });

  actions.push({
    charId: 'luffy',
    reply: luffyReply,
    action: '提议',
  });

  // 3. 五条悟吐槽（嘴欠）
  const gojoReply = await generateCharacterReply({
    charId: 'gojo',
    userMessage: null,
    worldState,
    currentEvent: event,
    intent: null,
    memory,
    previousReplies: [{ charId: 'luffy', reply: luffyReply }],
    tripGoal: tripGoal ? tripGoal.title : null,
    isFirstSpeaker: false,
    previousSpeakerReply: luffyReply,
  });

  actions.push({
    charId: 'gojo',
    reply: gojoReply,
    action: '吐槽',
  });

  // 4. 林黛玉同意/评论（文艺）
  const daiyuReply = await generateCharacterReply({
    charId: 'daiyu',
    userMessage: null,
    worldState,
    currentEvent: event,
    intent: null,
    memory,
    previousReplies: [
      { charId: 'luffy', reply: luffyReply },
      { charId: 'gojo', reply: gojoReply },
    ],
    tripGoal: tripGoal ? tripGoal.title : null,
    isFirstSpeaker: false,
    previousSpeakerReply: gojoReply,
  });

  actions.push({
    charId: 'daiyu',
    reply: daiyuReply,
    action: '评论',
  });

  // 5. 保存记忆
  const summary = `空闲时，大家讨论了${event ? event.title : '旅行'}，${luffyReply} → ${gojoReply} → ${daiyuReply}`;
  // 这里应该调用 memory.saveSummary(summary)，但需要修改 memory 导出

  // 6. 更新目标进度（如果事件与目标相关）
  if (event && tripGoal && !tripGoal.isCompleted) {
    updateGoalProgress(1);
  }

  return actions;
}

/**
 * 检查用户是否空闲
 */
export function isUserIdle(lastActiveTime: number, idleThreshold: number = 30000): boolean {
  return Date.now() - lastActiveTime >= idleThreshold;
}

/**
 * 生成空闲时的单条消息（简化版）
 */
export async function generateIdleMessage(
  charId: string,
  worldState: WorldState,
  currentEvent: Event | null,
  memory: GroupMemory,
  tripGoal: TripGoal | null,
): Promise<string> {
  const reply = await generateCharacterReply({
    charId,
    userMessage: null,
    worldState,
    currentEvent,
    intent: null,
    memory,
    previousReplies: [],
    tripGoal: tripGoal ? tripGoal.title : null,
    isFirstSpeaker: true,
    previousSpeakerReply: null,
  });

  return reply;
}
