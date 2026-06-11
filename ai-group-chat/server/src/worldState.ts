/**
 * World State — 群当前世界状态
 * 所有 AI 回复前必须读取此状态
 */
export interface WorldState {
  location: string;        // 当前城市
  area: string;            // 当前区域
  weather: string;         // 天气
  temperature: number;     // 温度
  time: string;            // 当前时间 HH:MM
  travelPhase: string;     // 旅行阶段
  currentMood: string;     // 群整体心情
  lastEvent: string;       // 最近发生的事件描述
  dayOfTrip: number;      // 旅行第几天
  season: string;         // 季节
}

export const defaultWorldState: WorldState = {
  location: '东京',
  area: '涩谷',
  weather: '小雨',
  temperature: 23,
  time: '18:32',
  travelPhase: '寻找晚餐',
  currentMood: '兴奋',
  lastEvent: '发现一家拉面店',
  dayOfTrip: 2,
  season: '夏季',
};

/**
 * 更新世界状态（时间流逝/位置变化/天气变化）
 */
export function advanceTime(state: WorldState): WorldState {
  const next = { ...state };
  // 模拟时间推进（每次事件后推进15~45分钟）
  const [h, m] = state.time.split(':').map(Number);
  const addMin = Math.floor(Math.random() * 30) + 15;
  let newM = m + addMin;
  let newH = h + Math.floor(newM / 60);
  newM = newM % 60;
  next.time = `${String(newH % 24).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;

  // 根据时间自动更新旅行阶段
  if (newH >= 6 && newH < 10) next.travelPhase = '早餐时间';
  else if (newH >= 10 && newH < 12) next.travelPhase = '闲逛探索';
  else if (newH >= 12 && newH < 14) next.travelPhase = '寻找午餐';
  else if (newH >= 14 && newH < 17) next.travelPhase = '下午行程';
  else if (newH >= 17 && newH < 19) next.travelPhase = '寻找晚餐';
  else if (newH >= 19 && newH < 22) next.travelPhase = '夜晚活动';
  else if (newH >= 22 || newH < 2) next.travelPhase = '夜生活';
  else next.travelPhase = '休息中';

  return next;
}

/**
 * 根据事件更新世界状态
 */
export function applyEventToWorld(state: WorldState, event: any): WorldState {
  const next = { ...state, lastEvent: event.title };

  switch (event.type) {
    case 'weather':
      // 事件可能包含天气变化
      if (event.title.includes('下雨')) next.weather = '雨';
      else if (event.title.includes('晴')) next.weather = '晴';
      else if (event.title.includes('雪')) next.weather = '雪';
      break;
    case 'restaurant':
      next.travelPhase = '用餐中';
      next.currentMood = '满足';
      break;
    case 'lost':
      next.currentMood = '焦虑';
      break;
    case 'fireworks':
    case 'nightmarket':
      next.currentMood = '兴奋';
      next.travelPhase = '夜晚活动';
      break;
  }

  return next;
}
