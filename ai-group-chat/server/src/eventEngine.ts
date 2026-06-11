/**
 * Event Engine V3 — 事件引擎（升级版）
 * 事件不再随机，而是基于：
 * 1. 世界状态
 * 2. 用户行为
 * 3. 旅行目标
 * 4. 群历史
 */

import { WorldState } from './worldState';
import { IntentResult } from './intentEngine';
import { GroupMemory } from './memory';
import { TripGoal } from './goalEngine';

export interface Event {
  id: string;
  type: string;
  title: string;
  description: string;
  importance: number;   // 0~1
  participants?: string[]; // 相关角色
  relatedToGoal?: boolean; // 是否与旅行目标相关
}

// 事件模板库（按类型分类）
const EVENT_TEMPLATES: Record<string, Omit<Event, 'id'>[]> = {
  restaurant: [
    { type: 'restaurant', title: '发现一家评分4.9的拉面店', description: '藏在巷子里，排队的人不少', importance: 0.8 },
    { type: 'restaurant', title: '路过一家看起来很赞的寿司店', description: '门口有精致的小模型展示', importance: 0.7 },
    { type: 'restaurant', title: '闻到超香的烤肉味', description: '拐角处有家炭火烧肉', importance: 0.75 },
    { type: 'restaurant', title: '发现一家网红咖啡馆', description: 'Ins上很火，装修超好看', importance: 0.6 },
  ],
  weather: [
    { type: 'weather', title: '突然下起小雨', description: '没带伞的人要惨了', importance: 0.6 },
    { type: 'weather', title: '雨停了，出现彩虹', description: '天空超级漂亮', importance: 0.7 },
    { type: 'weather', title: '天气超好，阳光明媚', description: '适合户外拍照', importance: 0.5 },
  ],
  spot: [
    { type: 'spot', title: '发现一座小神社', description: '很安静，几乎没游客', importance: 0.7 },
    { type: 'spot', title: '路过一家超大的扭蛋店', description: '全是限定款', importance: 0.6 },
    { type: 'spot', title: '发现一个隐藏书店', description: '堆满旧书，很有味道', importance: 0.5 },
  ],
  event: [
    { type: 'event', title: '附近好像有烟花大会', description: '听说每年只有这个时候有', importance: 0.9 },
    { type: 'event', title: '发现夜市开放了', description: '好多小吃摊和手工艺品', importance: 0.8 },
  ],
  photo: [
    { type: 'photo', title: '发现超棒的拍照点', description: '光线和背景都完美', importance: 0.6 },
  ],
};

let eventCounter = 0;

/**
 * 生成事件（V3版本）
 * 基于世界状态、用户行为、旅行目标、群历史
 */
export function generateEvent(
  state: WorldState,
  preferredType?: string,
  tripGoal?: TripGoal | null,
  intent?: IntentResult | null,
  memory?: GroupMemory | null,
): Event {
  let candidates: Omit<Event, 'id'>[] = [];

  // 1. 如果有旅行目标，优先生成与目标相关的事件
  if (tripGoal && !tripGoal.isCompleted) {
    const goalEventType = getGoalEventType(tripGoal);
    if (goalEventType && EVENT_TEMPLATES[goalEventType]) {
      candidates = EVENT_TEMPLATES[goalEventType].map(e => ({
        ...e,
        relatedToGoal: true,
        importance: e.importance + 0.1, // 提高重要性
      }));
    }
  }

  // 2. 如果用户有意图，生成与意图相关的事件
  if (intent && candidates.length === 0) {
    if (intent.intent === 'need_food' && EVENT_TEMPLATES['restaurant']) {
      candidates = EVENT_TEMPLATES['restaurant'];
    } else if (intent.topic === 'scenery' && EVENT_TEMPLATES['spot']) {
      candidates = EVENT_TEMPLATES['spot'];
    }
  }

  // 3. 如果指定了偏好类型，使用对应类型
  if (preferredType && EVENT_TEMPLATES[preferredType]) {
    candidates = EVENT_TEMPLATES[preferredType];
  }

  // 4. 否则，根据世界状态选择合适的事件类型
  if (candidates.length === 0) {
    candidates = selectEventsByWorldState(state);
  }

  // 5. 根据时间过滤事件
  candidates = filterEventsByTime(candidates, state);

  // 6. 根据天气过滤事件
  candidates = filterEventsByWeather(candidates, state);

  // 7. 选择一个事件（不是完全随机，而是根据重要性加权）
  const selected = selectEventByWeight(candidates);

  eventCounter++;
  return {
    ...selected,
    id: `event_${String(eventCounter).padStart(3, '0')}`,
  };
}

/**
 * 根据旅行目标获取相关事件类型
 */
function getGoalEventType(goal: TripGoal): string | null {
  const goalEventMap: Record<string, string> = {
    'find_best_ramen': 'restaurant',
    'visit_10_spots': 'spot',
    'take_100_photos': 'photo',
    'try_5_local_foods': 'restaurant',
  };

  return goalEventMap[goal.id] || null;
}

/**
 * 根据世界状态选择合适的事件类型
 */
function selectEventsByWorldState(state: WorldState): Omit<Event, 'id'>[] {
  const hour = parseInt(state.time.split(':')[0]);

  // 饭点：优先美食事件
  if ([7, 8, 12, 13, 18, 19].includes(hour)) {
    return EVENT_TEMPLATES['restaurant'] || [];
  }

  // 白天：优先景点事件
  if (hour >= 9 && hour <= 17) {
    return [...(EVENT_TEMPLATES['spot'] || []), ...(EVENT_TEMPLATES['photo'] || [])];
  }

  // 晚上：优先活动事件
  if (hour >= 18 && hour <= 22) {
    return EVENT_TEMPLATES['event'] || [];
  }

  // 默认：混合事件
  return [
    ...(EVENT_TEMPLATES['restaurant'] || []),
    ...(EVENT_TEMPLATES['spot'] || []),
  ].slice(0, 5);
}

/**
 * 根据时间过滤事件
 */
function filterEventsByTime(events: Omit<Event, 'id'>[], state: WorldState): Omit<Event, 'id'>[] {
  const hour = parseInt(state.time.split(':')[0]);

  // 晚上不适合户外景点
  if (hour >= 19) {
    return events.filter(e => e.type !== 'spot' || Math.random() < 0.3);
  }

  // 早上不适合夜市
  if (hour < 10) {
    return events.filter(e => e.type !== 'event' || Math.random() < 0.2);
  }

  return events;
}

/**
 * 根据天气过滤事件
 */
function filterEventsByWeather(events: Omit<Event, 'id'>[], state: WorldState): Omit<Event, 'id'>[] {
  // 雨天降低户外事件概率
  if (state.weather.includes('雨')) {
    return events.filter(e => {
      if (['spot', 'event', 'photo'].includes(e.type)) {
        return Math.random() < 0.3; // 降低概率
      }
      return true;
    });
  }

  return events;
}

/**
 * 根据重要性加权选择事件（不是完全随机）
 */
function selectEventByWeight(events: Omit<Event, 'id'>[]): Omit<Event, 'id'> {
  if (events.length === 0) {
    // 兜底事件
    return {
      type: 'general',
      title: '群里继续聊天',
      description: '大家在随意闲聊',
      importance: 0.3,
    };
  }

  // 计算加权概率
  const weights = events.map(e => e.importance);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // 按权重随机选择
  let random = Math.random() * totalWeight;
  for (let i = 0; i < events.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return events[i];
    }
  }

  // 兜底：返回第一个
  return events[0];
}
