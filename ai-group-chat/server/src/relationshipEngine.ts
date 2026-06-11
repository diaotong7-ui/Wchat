/**
 * Relationship Engine V3 — 角色关系系统
 * 定义角色之间的关系，影响角色回复风格
 *
 * 关系定义：
 * - 路飞 ↔ 五条悟：经常互怼（bickering）
 * - 林黛玉 ↔ 路飞：经常照顾（caring）
 * - 五条悟 ↔ 林黛玉：偶尔调侃（teasing）
 */

export type RelationshipType = 'bickering' | 'caring' | 'teasing' | 'neutral' | 'admiring';

export interface CharacterRelationship {
  char1: string;
  char2: string;
  type: RelationshipType;
  description: string;
  replyStyle: string; // 回复风格提示
}

// 角色关系定义
const RELATIONSHIPS: CharacterRelationship[] = [
  {
    char1: 'luffy',
    char2: 'gojo',
    type: 'bickering',
    description: '路飞和五条悟经常互怼',
    replyStyle: '互怼风格：互相吐槽、开玩笑，但不要真的生气',
  },
  {
    char1: 'luffy',
    char2: 'daiyu',
    type: 'caring',
    description: '林黛玉经常照顾路飞',
    replyStyle: '照顾风格：林黛玉会关心路飞，路飞会感激但不太懂表达',
  },
  {
    char1: 'gojo',
    char2: 'daiyu',
    type: 'teasing',
    description: '五条悟偶尔调侃林黛玉',
    replyStyle: '调侃风格：五条悟会开玩笑调侃，林黛玉会有些无奈但不真的生气',
  },
];

// 关系值（-1.0 到 1.0，负数表示敌对，正数表示友好）
const RELATIONSHIP_VALUES: Record<string, Record<string, number>> = {
  luffy: {
    gojo: 0.6,   // 互怼但友好
    daiyu: 0.8,  // 被照顾，很友好
  },
  gojo: {
    luffy: 0.6,  // 互怼但友好
    daiyu: 0.5,  // 偶尔调侃，中等友好
  },
  daiyu: {
    luffy: 0.8,  // 照顾路飞，很友好
    gojo: 0.4,   // 被调侃，有点无奈
  },
};

/**
 * 获取两个角色之间的关系类型
 */
export function getRelationship(char1: string, char2: string): RelationshipType {
  // 查找关系定义
  const rel = RELATIONSHIPS.find(r =>
    (r.char1 === char1 && r.char2 === char2) ||
    (r.char1 === char2 && r.char2 === char1)
  );

  return rel ? rel.type : 'neutral';
}

/**
 * 获取两个角色之间的回复风格提示
 */
export function getReplyStyle(char1: string, char2: string): string {
  const rel = RELATIONSHIPS.find(r =>
    (r.char1 === char1 && r.char2 === char2) ||
    (r.char1 === char2 && r.char2 === char1)
  );

  return rel ? rel.replyStyle : '正常交流风格';
}

/**
 * 获取角色对另一个角色的关系值（-1.0 到 1.0）
 */
export function getRelationshipValue(char1: string, char2: string): number {
  if (RELATIONSHIP_VALUES[char1] && RELATIONSHIP_VALUES[char1][char2] !== undefined) {
    return RELATIONSHIP_VALUES[char1][char2];
  }
  return 0.5; // 默认中等友好
}

/**
 * 根据关系类型生成回复提示词
 */
export function buildRelationshipPrompt(charId: string, previousReplies: Array<{ charId: string; reply: string }>): string {
  if (previousReplies.length === 0) {
    return '';
  }

  const lastReply = previousReplies[previousReplies.length - 1];
  const previousCharId = lastReply.charId;

  if (charId === previousCharId) {
    return ''; // 同一个角色，不需要关系提示
  }

  const relationshipType = getRelationship(charId, previousCharId);
  const replyStyle = getReplyStyle(charId, previousCharId);

  let prompt = `\n【角色关系提示】\n`;
  prompt += `你和${getCharName(previousCharId)}的关系是：${getRelationshipDescription(relationshipType)}\n`;
  prompt += `回复风格：${replyStyle}\n`;

  return prompt;
}

/**
 * 获取角色名称
 */
function getCharName(charId: string): string {
  const names: Record<string, string> = {
    luffy: '路飞',
    gojo: '五条悟',
    daiyu: '林黛玉',
  };
  return names[charId] || charId;
}

/**
 * 获取关系类型描述
 */
function getRelationshipDescription(type: RelationshipType): string {
  const descriptions: Record<RelationshipType, string> = {
    bickering: '经常互怼，互相吐槽但其实是朋友',
    caring: '经常照顾对方，关心对方',
    teasing: '偶尔调侃对方，开玩笑',
    neutral: '普通朋友关系',
    admiring: '欣赏对方，有点崇拜',
  };
  return descriptions[type] || '普通朋友关系';
}
