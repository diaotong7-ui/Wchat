/**
 * Intent Engine - 意图理解引擎
 * 理解用户消息，输出意图、情绪、话题、紧急度
 */

export interface IntentResult {
  intent: string;
  emotion: 'happy' | 'sad' | 'angry' | 'excited' | 'neutral' | 'anxious';
  topic: string;
  urgency: number; // 0-1
}

/**
 * 分析用户消息，提取意图
 */
export function analyzeIntent(userMessage: string): IntentResult {
  const msg = userMessage.toLowerCase().trim();

  // 默认结果
  const result: IntentResult = {
    intent: 'random_chat',
    emotion: 'neutral',
    topic: 'general',
    urgency: 0.3,
  };

  // ============ 意图识别 ============

  // ask_status: 询问状态（在干嘛、大家在做什么）
  if (/干嘛|干什么|在干|在做|大家|你们在|在吗|有人|谁在|怎么样|如何/.test(msg)) {
    result.intent = 'ask_status';
    result.topic = 'social';
  }

  // ask_opinion: 询问意见（觉得、认为、怎么看）
  if (/觉得|认为|怎么看|想法|意见|建议|推荐|哪个好/.test(msg)) {
    result.intent = 'ask_opinion';
    result.topic = 'opinion';
    result.urgency = 0.5;
  }

  // need_food: 需要食物（饿、吃、餐厅）
  if (/饿|吃|食|肉|面|饭|餐|菜|喝|奶茶|咖啡|甜点|烧烤|火锅|好吃|美食|拉面|寿司|味道|餐厅|店/.test(msg)) {
    result.intent = 'need_food';
    result.topic = 'food';
    result.urgency = 0.7;
  }

  // need_help: 需要帮助（帮、问题、困难）
  if (/帮|问题|困难|不知道|迷路|怎么办|不会|教我/.test(msg)) {
    result.intent = 'need_help';
    result.topic = 'help';
    result.urgency = 0.8;
  }

  // ============ 情绪识别 ============

  // emotion_happy: 开心
  if (/哈哈|嘻嘻|开心|高兴|快乐|棒|好用|喜欢|爱|完美|太好了|耶|😄|😊|❤️/.test(msg)) {
    result.emotion = 'happy';
    result.urgency = 0.4;
  }

  // emotion_sad: 伤心
  if (/呜呜|哭|伤心|难过|失望|可惜|遗憾|😢|😭|💔/.test(msg)) {
    result.emotion = 'sad';
    result.urgency = 0.6;
  }

  // emotion_angry: 生气
  if (/气死|生气|愤怒|讨厌|烦|恶心|滚|傻|笨|有病|😡|💢/.test(msg)) {
    result.emotion = 'angry';
    result.urgency = 0.9;
  }

  // emotion_excited: 兴奋
  if (/哇|太|超|巨|疯了|不可思议|震惊|惊讶|!!!|！！！/.test(msg)) {
    result.emotion = 'excited';
    result.urgency = 0.6;
  }

  // emotion_anxious: 焦虑
  if (/担心|害怕|紧张|焦虑|不安|怕|怎么办/.test(msg)) {
    result.emotion = 'anxious';
    result.urgency = 0.7;
  }

  // ============ 话题识别 ============

  // weather: 天气
  if (/天气|下雨|晴天|阴天|雪|风|温度|热|冷/.test(msg)) {
    result.topic = 'weather';
  }

  // location: 位置
  if (/在哪|哪里|位置|地址|地图|导航|路/.test(msg)) {
    result.topic = 'location';
  }

  // money: 金钱
  if (/钱|价格|费用|贵|便宜|花|付|成本|预算/.test(msg)) {
    result.topic = 'money';
  }

  // rest: 休息
  if (/累|休息|睡觉|困|酒店|住宿|房间/.test(msg)) {
    result.topic = 'rest';
  }

  // scenery: 风景
  if (/风景|美景|拍照|照片|打卡|景点|漂亮|美/.test(msg)) {
    result.topic = 'scenery';
  }

  // pace: 节奏
  if (/快|慢|赶|时间|等|急|马上/.test(msg)) {
    result.topic = 'pace';
  }

  // ============ 特殊规则 ============

  // 如果消息很短且是问句，可能是 ask_status
  if (msg.length < 10 && /\?|？/.test(msg)) {
    result.intent = 'ask_status';
    result.topic = 'social';
  }

  // 如果消息包含感叹号，提高紧急度
  if (/!{2,}|！{2,}/.test(userMessage)) {
    result.urgency = Math.min(result.urgency + 0.2, 1.0);
  }

  return result;
}

/**
 * 根据意图生成讨论模式
 */
export function getDiscussionMode(intent: string): string {
  const modeMap: Record<string, string> = {
    ask_status: 'social',
    ask_opinion: 'discussion',
    need_food: 'food',
    need_help: 'support',
    emotion_happy: 'celebration',
    emotion_sad: 'comfort',
    emotion_angry: 'conflict',
    emotion_excited: 'excitement',
    random_chat: 'casual',
  };

  return modeMap[intent] || 'casual';
}
