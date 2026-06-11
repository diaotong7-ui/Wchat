/**
 * Trip Goal Engine V3 — 旅行目标引擎
 * 定义旅行目标，所有事件围绕目标推进
 *
 * 示例目标：
 * - "找到东京最好吃的拉面"
 * - "打卡10个景点"
 * - "拍满100张照片"
 */

export interface TripGoal {
  id: string;
  title: string;
  description: string;
  progress: number; // 0-100
  target: number;
  current: number;
  unit: string; // 单位（如：个、张、家）
  isCompleted: boolean;
  createdAt: number;
}

// 预设旅行目标
const PRESET_GOALS: TripGoal[] = [
  {
    id: 'find_best_ramen',
    title: '找到东京最好吃的拉面',
    description: '在东京寻找最好吃的拉面店，尝试至少3家',
    progress: 0,
    target: 3,
    current: 0,
    unit: '家',
    isCompleted: false,
    createdAt: Date.now(),
  },
  {
    id: 'visit_10_spots',
    title: '打卡10个景点',
    description: '在旅行期间打卡10个热门景点',
    progress: 0,
    target: 10,
    current: 0,
    unit: '个',
    isCompleted: false,
    createdAt: Date.now(),
  },
  {
    id: 'take_100_photos',
    title: '拍满100张照片',
    description: '在旅行期间拍摄100张照片',
    progress: 0,
    target: 100,
    current: 0,
    unit: '张',
    isCompleted: false,
    createdAt: Date.now(),
  },
  {
    id: 'try_5_local_foods',
    title: '尝试5种本地美食',
    description: '尝试5种不同的日本本地美食',
    progress: 0,
    target: 5,
    current: 0,
    unit: '种',
    isCompleted: false,
    createdAt: Date.now(),
  },
];

// 当前旅行目标
let currentGoal: TripGoal | null = null;

/**
 * 初始化旅行目标（随机选择一个预设目标）
 */
export function initTripGoal(): TripGoal {
  const randomIndex = Math.floor(Math.random() * PRESET_GOALS.length);
  currentGoal = { ...PRESET_GOALS[randomIndex] };
  return currentGoal;
}

/**
 * 设置旅行目标
 */
export function setTripGoal(goalId: string): TripGoal | null {
  const goal = PRESET_GOALS.find(g => g.id === goalId);
  if (goal) {
    currentGoal = { ...goal };
    return currentGoal;
  }
  return null;
}

/**
 * 获取当前旅行目标
 */
export function getTripGoal(): TripGoal | null {
  return currentGoal;
}

/**
 * 更新目标进度
 */
export function updateGoalProgress(increment: number = 1): TripGoal | null {
  if (!currentGoal) return null;

  currentGoal.current = Math.min(currentGoal.current + increment, currentGoal.target);
  currentGoal.progress = Math.floor((currentGoal.current / currentGoal.target) * 100);
  currentGoal.isCompleted = currentGoal.current >= currentGoal.target;

  return currentGoal;
}

/**
 * 检查目标是否完成
 */
export function isGoalCompleted(): boolean {
  return currentGoal ? currentGoal.isCompleted : false;
}

/**
 * 获取目标进度描述
 */
export function getGoalProgressDescription(): string {
  if (!currentGoal) return '暂无旅行目标';

  if (currentGoal.isCompleted) {
    return `🎉 旅行目标已完成：${currentGoal.title}！`;
  }

  return `旅行目标：${currentGoal.title}（进度：${currentGoal.current}/${currentGoal.target}${currentGoal.unit}，${currentGoal.progress}%）`;
}

/**
 * 根据旅行目标生成相关事件类型
 */
export function getGoalRelatedEventType(): string | null {
  if (!currentGoal) return null;

  const goalEventMap: Record<string, string> = {
    'find_best_ramen': 'restaurant',
    'visit_10_spots': 'spot',
    'take_100_photos': 'photo',
    'try_5_local_foods': 'restaurant',
  };

  return goalEventMap[currentGoal.id] || null;
}

/**
 * 根据旅行目标生成事件描述
 */
export function generateGoalEventDescription(): string | null {
  if (!currentGoal) return null;

  const descriptions: Record<string, string[]> = {
    'find_best_ramen': [
      '发现了一家评价很高的拉面店！',
      '路过一个巷子里飘来拉面香味！',
      '听本地人推荐了一家隐藏拉面店！',
    ],
    'visit_10_spots': [
      '发现了一个热门景点！',
      '来到了一个打卡圣地！',
      '听说这里是个必去景点！',
    ],
    'take_100_photos': [
      '这里的风景太适合拍照了！',
      '发现了一个超美的拍照点！',
      '这里的夜景一定很美！',
    ],
    'try_5_local_foods': [
      '发现了一家本地特色餐厅！',
      '闻到空气中飘来美食香味！',
      '听说这里有地道日本美食！',
    ],
  };

  const goalDescriptions = descriptions[currentGoal.id];
  if (!goalDescriptions) return null;

  return goalDescriptions[Math.floor(Math.random() * goalDescriptions.length)];
}
