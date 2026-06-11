import { GroupEvent } from './types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// 事件库：群聊永远围绕一个"当前事件"展开
// ============================================================

export interface EventTemplate {
  name: string;
  description: string;
  openingLine: string; // 事件发生时的系统提示语
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    name: '发现拉面馆',
    description: '路飞在旅行中发现了一家香气扑鼻的拉面馆，橱窗上写着"本日推荐：叉烧拉面"',
    openingLine: '【群通知】路飞突然停下脚步，指着街角一家拉面馆大叫！',
  },
  {
    name: '突然下雨',
    description: '天色骤变，突然下起大雨，大家都没带伞',
    openingLine: '【群通知】天空突然阴沉，豆大的雨点劈头盖脸打下来……',
  },
  {
    name: '爬山计划',
    description: '有人提议爬山，但山路陡峭，需要大家商量要不要去',
    openingLine: '【群通知】前方出现一座山，山顶据说能看到绝美日落……',
  },
  {
    name: '迷路了',
    description: '导航失灵，大家完全不知道在哪里，周围都是小巷',
    openingLine: '【群通知】手机没信号，导航罢工，大家不知不觉走进了迷宫般的小巷……',
  },
  {
    name: '酒店太贵了',
    description: '找到的酒店一晚要800元，大家需要决定住不住',
    openingLine: '【群通知】终于找到一家酒店，老板报价：一晚800元……',
  },
  {
    name: '路飞钱包丢了',
    description: '路飞突然发现裤子口袋空了，钱包和手机全不见了',
    openingLine: '【群通知】路飞拍拍口袋，脸色骤变：钱包和手机都不见了！',
  },
  {
    name: '发现神秘甜品店',
    description: '巷子深处有一家没有招牌的甜品店，只有老奶奶一个人在经营',
    openingLine: '【群通知】转角处有一家小店，玻璃橱窗里摆着色彩缤纷的甜品，没有招牌……',
  },
  {
    name: '遇到街头艺人',
    description: '广场上有一个街头艺人在表演吉他弹唱，围了不少人',
    openingLine: '【群通知】广场上传来悠扬的吉他声，一个年轻人在忘情演奏……',
  },
];

export function createRandomEvent(): GroupEvent {
  const template = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
  return {
    id: uuidv4(),
    name: template.name,
    description: template.description,
    triggerCondition: 'idle',
    active: true,
    startedAt: Date.now(),
  };
}

export function getEventTemplate(eventName: string): EventTemplate | undefined {
  return EVENT_TEMPLATES.find((t) => t.name === eventName);
}
