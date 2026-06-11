/**
 * Event Engine — 根据世界状态生成事件
 * 事件来源：GPS/时间/天气/附近POI/节假日/用户行为
 */
import { WorldState } from './worldState';

export interface Event {
  id: string;
  type: string;
  title: string;
  description: string;
  importance: number;   // 0~1
  participants?: string[]; // 相关角色
}

// 事件模板库
const EVENT_TEMPLATES: Omit<Event, 'id'>[] = [
  // 美食类
  { type: 'restaurant', title: '发现一家评分4.9的拉面店', description: '藏在巷子里，排队的人不少', importance: 0.8 },
  { type: 'restaurant', title: '路过一家看起来很赞的寿司店', description: '门口有精致的小模型展示', importance: 0.7 },
  { type: 'restaurant', title: '闻到超香的烤肉味', description: '拐角处有家炭火烧肉', importance: 0.75 },
  { type: 'restaurant', title: '发现一家网红咖啡馆', description: 'Ins上很火，装修超好看', importance: 0.6 },
  { type: 'restaurant', title: '路边的自动贩卖机有好玩饮料', description: '有奇怪口味的汽水', importance: 0.4 },

  // 天气类
  { type: 'weather', title: '突然下起小雨', description: '没带伞的人要惨了', importance: 0.6 },
  { type: 'weather', title: '雨停了，出现彩虹', description: '天空超级漂亮', importance: 0.7 },
  { type: 'weather', title: '天气超好，阳光明媚', description: '适合户外拍照', importance: 0.5 },

  // 景点类
  { type: 'spot', title: '发现一座小神社', description: '很安静，几乎没游客', importance: 0.7 },
  { type: 'spot', title: '路过一家超大的扭蛋店', description: '全是限定款', importance: 0.6 },
  { type: 'spot', title: '发现一个隐藏书店', description: '堆满旧书，很有味道', importance: 0.5 },

  // 活动类
  { type: 'event', title: '附近好像有烟花大会', description: '听说每年只有这个时候有', importance: 0.9 },
  { type: 'event', title: '发现夜市开放了', description: '好多小吃摊和手工艺品', importance: 0.8 },
  { type: 'event', title: '路上有街头表演', description: '乐队在唱日文歌', importance: 0.6 },

  // 意外类
  { type: 'lost', title: '迷路了', description: '导航好像指错方向了', importance: 0.7 },
  { type: 'queue', title: '排队的人超多', description: '已经排了20分钟', importance: 0.5 },
  { type: 'missed', title: '差点错过末班车', description: '最后一辆车刚走', importance: 0.8 },
  { type: 'wallet', title: '路飞的钱包好像不见了', description: '可能是掉在刚才的店里了', importance: 0.85 },

  // 社交类
  { type: 'photo', title: '发现超棒的拍照点', description: '光线和背景都完美', importance: 0.6 },
  { type: 'gift', title: '发现一家卖伴手礼的小店', description: '有超可爱的限定款', importance: 0.5 },
];

let eventCounter = 0;

/**
 * 根据世界状态生成随机事件
 */
export function generateEvent(state: WorldState): Event {
  // 根据世界状态过滤合适事件
  let candidates = EVENT_TEMPLATES.filter(e => {
    // 雨天不适合户外
    if (state.weather.includes('雨') && ['spot', 'event'].includes(e.type)) {
      return Math.random() < 0.3; // 降低概率
    }
    // 夜晚时间适合夜市/烟花
    const hour = parseInt(state.time.split(':')[0]);
    if (hour >= 19 && e.type === 'event') return true;
    if (hour < 10 && e.type === 'event') return false;
    return true;
  });

  // 避免重复最近事件（简单去重：检查title）
  // 实际生产环境应记录最近事件历史
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  eventCounter++;
  return {
    ...chosen,
    id: `event_${String(eventCounter).padStart(3, '0')}`,
  };
}

/**
 * 根据特定触发条件生成事件
 */
export function generateEventByTrigger(trigger: string, state: WorldState): Event | null {
  switch (trigger) {
    case 'time':
      // 饭点触发美食事件
      const hour = parseInt(state.time.split(':')[0]);
      if ([7, 8, 12, 13, 18, 19].includes(hour)) {
        const foodEvents = EVENT_TEMPLATES.filter(e => e.type === 'restaurant');
        const chosen = foodEvents[Math.floor(Math.random() * foodEvents.length)];
        eventCounter++;
        return { ...chosen, id: `event_${String(eventCounter).padStart(3, '0')}` };
      }
      break;
    case 'weather_change':
      const weatherEvents = EVENT_TEMPLATES.filter(e => e.type === 'weather');
      const chosen = weatherEvents[Math.floor(Math.random() * weatherEvents.length)];
      eventCounter++;
      return { ...chosen, id: `event_${String(eventCounter).padStart(3, '0')}` };
  }
  return null;
}
