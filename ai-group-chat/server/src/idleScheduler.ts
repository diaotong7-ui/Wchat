/**
 * Idle Scheduler — AI主动聊天机制
 * 用户超过N秒无操作，Director自动触发群聊
 * 让用户回来时看到"未读消息"的感觉
 */
import { WorldState, defaultWorldState, advanceTime } from './worldState';
import { Event } from './eventEngine';
import { direct, DirectorOutput } from './directorAgent';

export interface IdleConfig {
  idleThresholdMs: number;    // 用户无操作多久后触发（默认30000=30秒）
  maxIdleRounds: number;      // 一次idle触发最多几轮对话
  quietProbability: number;    // 在对话结束后，进入"安静期"的概率（避免永远热闹）
}

const DEFAULT_CONFIG: IdleConfig = {
  idleThresholdMs: 30000,
  maxIdleRounds: 3,
  quietProbability: 0.3,
};

export class IdleScheduler {
  private lastUserActiveTime: number = Date.now();
  private isIdleActive: boolean = false;
  private config: IdleConfig;
  private worldState: WorldState;
  private currentEvent: Event | null = null;
  private onMessage: (sender: string, text: string) => void;
  private onEvent: (event: Event) => void;
  private onTyping: (sender: string) => void;
  private onStopTyping: () => void;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    onMessage: (sender: string, text: string) => void,
    onEvent: (event: Event) => void,
    onTyping: (sender: string) => void,
    onStopTyping: () => void,
    config?: Partial<IdleConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.worldState = { ...defaultWorldState };
    this.onMessage = onMessage;
    this.onEvent = onEvent;
    this.onTyping = onTyping;
    this.onStopTyping = onStopTyping;
  }

  /** 用户有操作时调用 */
  public userActive(): void {
    this.lastUserActiveTime = Date.now();
    if (this.isIdleActive) {
      this.isIdleActive = false;
    }
    this.scheduleIdleCheck();
  }

  /** 启动idle检测 */
  public start(): void {
    this.scheduleIdleCheck();
  }

  /** 停止idle检测 */
  public stop(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /** 设置世界状态 */
  public setWorldState(state: WorldState): void {
    this.worldState = state;
  }

  /** 设置当前事件 */
  public setCurrentEvent(event: Event | null): void {
    this.currentEvent = event;
  }

  private scheduleIdleCheck(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);

    this.idleTimer = setTimeout(() => {
      const elapsed = Date.now() - this.lastUserActiveTime;
      if (elapsed >= this.config.idleThresholdMs && !this.isIdleActive) {
        this.triggerIdleChat();
      } else {
        this.scheduleIdleCheck();
      }
    }, this.config.idleThresholdMs);
  }

  /**
   * 触发idle聊天：AI角色们自己聊起来
   */
  private async triggerIdleChat(): Promise<void> {
    this.isIdleActive = true;

    // 随机决定是否真的触发（避免太频繁）
    if (Math.random() < 0.4) {
      this.isIdleActive = false;
      this.scheduleIdleCheck();
      return;
    }

    // 可能产生新事件
    const { generateEvent } = require('./eventEngine');
    let activeEvent = this.currentEvent;
    if (!activeEvent && Math.random() < 0.6) {
      activeEvent = generateEvent(this.worldState);
      this.currentEvent = activeEvent;
      this.onEvent(activeEvent);
      await this.delay(1500);
    }

    // 执行多轮对话
    let rounds = 0;
    const maxRounds = Math.ceil(Math.random() * this.config.maxIdleRounds) + 1;

    while (rounds < maxRounds && this.isIdleActive) {
      const recentMessages: any[] = []; // 实际应从外部传入
      const dirResult: DirectorOutput = direct(
        this.worldState,
        recentMessages,
        activeEvent,
        false, // isUserActive = false
      );

      // 执行发言
      for (const speaker of dirResult.speakers) {
        if (!this.isIdleActive) break;

        this.onTyping(speaker);
        await this.delay(1500 + Math.random() * 2000);
        this.onStopTyping();

        const text = this.generateIdleReply(speaker, activeEvent);
        this.onMessage(speaker, text);
        await this.delay(500 + Math.random() * 1000);
      }

      // 是否继续
      if (!dirResult.continueDiscussion || Math.random() < 0.5) {
        break;
      }
      rounds++;
    }

    // 更新世界状态
    if (activeEvent) {
      const { applyEventToWorld } = require('./worldState');
      this.worldState = applyEventToWorld(this.worldState, activeEvent);
    }
    this.worldState = advanceTime(this.worldState);

    // 进入安静期 or 继续检测
    this.isIdleActive = false;
    this.scheduleIdleCheck();
  }

  /**
   * 生成idle回复（内置回复库，不依赖OpenAI）
   * 生产环境应替换为OpenAI调用
   */
  private generateIdleReply(charId: string, event: Event | null): string {
    const eventType = event?.type ?? 'general';
    const replies: Record<string, string[]> = {
      luffy: {
        restaurant: [
          '喂，你们说晚饭吃什么？',
          '我好饿啊……有没有推荐的？',
          '刚才路过那家店闻起来超香！',
          '要不我们去吃拉面吧！',
        ],
        weather: [
          '哎，好像要下雨了？',
          '天气真好！要不要出去走走？',
          '下雨了……怎么办？',
        ],
        spot: [
          '哎你们看那个！',
          '那边好像有什么好玩的！',
          '走走走，去看看！',
        ],
        event: [
          '听说今晚有烟花！有人要去吗？',
          '夜市！夜市！我要去！',
          '你们有没有听到音乐？',
        ],
        general: [
          '好无聊啊……有人吗？',
          '你们在干嘛？',
          '我刚才发现一个好玩的！',
          '今天玩得好开心！',
        ],
      },
      gojo: {
        restaurant: [
          '又吃？你昨天不是才吃过？',
          '这家店评分才6.5，算了。',
          '我知道一家隐藏版的，跟着我。',
          '排队超过20分钟就换一家。',
        ],
        weather: [
          '下雨？我早就知道了。',
          '天气这种程度，完全没问题。',
          '晴天的话，拍照光线会很好。',
        ],
        spot: [
          '这个角度拍出来会很好看。',
          '神社？还行吧，我以前去过更好的。',
          '你们对这种东西这么兴奋吗？',
        ],
        event: [
          '烟花大会……嗯，还行。',
          '夜市的小吃，7分吧。',
          '你们去吧，我在旁边等。',
        ],
        general: [
          '你们聊，我听着。',
          '嗯。',
          '随便。',
          '这个没意思，下一个。',
        ],
      },
      daiyu: {
        restaurant: [
          '这家店……倒也有几分温馨。',
          '不知道有没有不辣的……',
          '坐着歇歇也好，走了一天了。',
          '你们决定就好，我跟着。',
        ],
        weather: [
          '下雨了呢……倒是挺有诗意。',
          '雨后的空气，真好闻。',
          '晴天虽好，未免太晒了些。',
        ],
        spot: [
          '这神社好安静……喜欢。',
          '你看那棵树，好美。',
          '慢慢走，不急。',
        ],
        event: [
          '烟花……好久没看了。',
          '夜市热闹，只是人有些多。',
          '你们去吧，我在这里坐坐。',
        ],
        general: [
          '今天过得真快。',
          '你们聊得好热闹……',
          '有点累了，找个地方坐坐吧。',
          '嗯，我在这里。',
        ],
      },
    };

    const pool = (replies[charId]?.[eventType] ?? replies[charId]?.general ?? ['……']);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
