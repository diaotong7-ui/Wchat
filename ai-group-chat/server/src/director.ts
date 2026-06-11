import { AI_CHARACTER_IDS, CHARACTER_LIST, CHARACTERS } from './characters';
import { ChatMessage, CharacterId } from './types';
import { memory } from './memory';
import { generateCharacterMessage } from './characterAgent';
import { createRandomEvent, getEventTemplate } from './events';

// ============================================================
// Director Agent：控制谁说话、说什么、什么节奏
// ============================================================

type BroadcastFn = (msg: ChatMessage) => void;
type TypingFn = (characterId: string, isTyping: boolean) => void;
type EventBroadcastFn = (eventName: string, openingLine: string) => void;

// 打字延迟：模拟真实的输入感
const TYPING_DELAY_MS = 2200;
const BETWEEN_MSG_DELAY_MS = 1200;

// 角色被动回复概率（非直接触发时）
const PASSIVE_REPLY_PROBABILITY = 0.6;

let idleTimerHandle: ReturnType<typeof setTimeout> | null = null;

export class DirectorAgent {
  private broadcast: BroadcastFn;
  private setTyping: TypingFn;
  private broadcastEvent: EventBroadcastFn;

  constructor(
    broadcast: BroadcastFn,
    setTyping: TypingFn,
    broadcastEvent: EventBroadcastFn
  ) {
    this.broadcast = broadcast;
    this.setTyping = setTyping;
    this.broadcastEvent = broadcastEvent;
  }

  // ----------------------------------------------------------
  // 用户发消息时触发
  // ----------------------------------------------------------
  async onUserMessage(userContent: string): Promise<void> {
    this.resetIdleTimer();
    memory.updateUserActivity();

    const state = memory.getState();
    if (state.isProcessing) return;
    memory.setProcessing(true);

    try {
      const trigger = userContent;

      // 1. 决定主要响应者（随机 or 与用户最"匹配"的角色）
      const primaryId = this.pickPrimaryResponder();
      await this.speakAs(primaryId, trigger);

      // 2. 其他角色有概率"接话"
      const others = AI_CHARACTER_IDS.filter((id) => id !== primaryId);
      for (const id of others) {
        if (Math.random() < PASSIVE_REPLY_PROBABILITY) {
          await this.delay(BETWEEN_MSG_DELAY_MS);
          const lastMsg = memory.getState().recentMessages.slice(-1)[0];
          await this.speakAs(id, trigger, lastMsg?.content);
        }
      }
    } finally {
      memory.setProcessing(false);
      this.startIdleTimer();
    }
  }

  // ----------------------------------------------------------
  // Idle 模式：用户沉默时，AI 自发互动
  // ----------------------------------------------------------
  private startIdleTimer(): void {
    if (idleTimerHandle) clearTimeout(idleTimerHandle);
    // 15~30秒后触发 idle 事件
    const delay = 15000 + Math.random() * 15000;
    idleTimerHandle = setTimeout(() => this.onIdle(), delay);
  }

  private resetIdleTimer(): void {
    if (idleTimerHandle) {
      clearTimeout(idleTimerHandle);
      idleTimerHandle = null;
    }
  }

  async onIdle(): Promise<void> {
    const state = memory.getState();
    if (state.isProcessing) {
      this.startIdleTimer();
      return;
    }
    memory.setProcessing(true);

    try {
      // 50% 概率触发新事件，50% 概率只是角色间闲聊
      if (Math.random() < 0.5) {
        await this.triggerRandomEvent();
      } else {
        await this.doIdleChat();
      }
    } finally {
      memory.setProcessing(false);
      this.startIdleTimer();
    }
  }

  private async triggerRandomEvent(): Promise<void> {
    const event = createRandomEvent();
    memory.setEvent(event);

    const template = getEventTemplate(event.name);
    if (template) {
      this.broadcastEvent(event.name, template.openingLine);
    }

    await this.delay(1500);

    // 让所有角色依次对事件作出反应
    const order = this.shuffleCharacters();
    for (const id of order) {
      await this.speakAs(id, `${event.name}：${event.description}`);
      await this.delay(BETWEEN_MSG_DELAY_MS);
    }

    // 事件持续一段时间后自动结束
    setTimeout(() => {
      memory.setEvent(null);
    }, 60000);
  }

  private async doIdleChat(): Promise<void> {
    // 两个角色互相说一两句
    const [a, b] = this.shuffleCharacters().slice(0, 2);
    const state = memory.getState();
    const lastMsg = state.recentMessages.slice(-1)[0];
    const context = lastMsg ? lastMsg.content : '随意闲聊旅行的事情';

    await this.speakAs(a, context);
    await this.delay(BETWEEN_MSG_DELAY_MS + 500);
    const aMsg = memory.getState().recentMessages.slice(-1)[0];
    await this.speakAs(b, context, aMsg?.content);
  }

  // ----------------------------------------------------------
  // 核心：让某个角色"打字后发言"
  // ----------------------------------------------------------
  private async speakAs(
    characterId: CharacterId,
    trigger: string,
    respondTo?: string
  ): Promise<void> {
    const character = CHARACTERS[characterId];
    if (!character) return;

    // 显示"正在输入"
    this.setTyping(characterId, true);
    await this.delay(TYPING_DELAY_MS + Math.random() * 800);

    const content = await generateCharacterMessage(character, trigger, respondTo);

    // 关闭打字状态
    this.setTyping(characterId, false);

    const msg = memory.addMessage({
      characterId,
      characterName: character.name,
      avatar: character.avatar,
      content,
      timestamp: Date.now(),
    });

    this.broadcast(msg);
  }

  // ----------------------------------------------------------
  // 工具方法
  // ----------------------------------------------------------
  private pickPrimaryResponder(): CharacterId {
    // 简单策略：随机，但有权重（路飞最容易先接话）
    const weights: [CharacterId, number][] = [
      ['luffy', 0.4],
      ['gojo', 0.35],
      ['daiyu', 0.25],
    ];
    const rand = Math.random();
    let cumulative = 0;
    for (const [id, weight] of weights) {
      cumulative += weight;
      if (rand < cumulative) return id;
    }
    return 'luffy';
  }

  private shuffleCharacters(): CharacterId[] {
    const ids = [...AI_CHARACTER_IDS] as CharacterId[];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** 启动时触发开场白 */
  async startWelcome(): Promise<void> {
    memory.setProcessing(true);
    try {
      await this.delay(1000);
      await this.speakAs('gojo', '大家好，旅途开始了，今天去哪？');
      await this.delay(1000);
      await this.speakAs('luffy', '旅途开始啦！出发！');
      await this.delay(800);
      await this.speakAs('daiyu', '旅途开始');
    } finally {
      memory.setProcessing(false);
      this.startIdleTimer();
    }
  }
}
