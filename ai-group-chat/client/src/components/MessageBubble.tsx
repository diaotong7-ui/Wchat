import React from 'react';
import { ChatMessage } from '../types';

// 角色颜色映射
const CHARACTER_COLORS: Record<string, string> = {
  luffy: '#EF4444',
  gojo: '#6366F1',
  daiyu: '#EC4899',
  user: '#07C160',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// 是否显示时间戳（与上一条消息间隔>3分钟）
function shouldShowTime(curr: ChatMessage, prev?: ChatMessage): boolean {
  if (!prev) return true;
  return curr.timestamp - prev.timestamp > 3 * 60 * 1000;
}

interface MessageBubbleProps {
  message: ChatMessage;
  prevMessage?: ChatMessage;
  isMe: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  prevMessage,
  isMe,
}) => {
  const showTime = shouldShowTime(message, prevMessage);
  const accentColor = CHARACTER_COLORS[message.characterId] || '#888';

  return (
    <div className="mb-1">
      {showTime && (
        <div className="flex justify-center my-2">
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-3 py-0.5">
            {formatTime(message.timestamp)}
          </span>
        </div>
      )}

      {isMe ? (
        /* ---- 自己的消息：靠右 ---- */
        <div className="flex items-end justify-end gap-2 px-3 mb-1">
          <div
            className="max-w-[68%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed text-white"
            style={{ backgroundColor: '#07C160', wordBreak: 'break-word' }}
          >
            {message.content}
          </div>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 bg-green-50">
            {message.avatar}
          </div>
        </div>
      ) : (
        /* ---- 他人消息：靠左 ---- */
        <div className="flex items-start gap-2 px-3 mb-1">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
            style={{ backgroundColor: `${accentColor}18` }}
          >
            {message.avatar}
          </div>
          <div className="flex flex-col max-w-[68%]">
            <span
              className="text-xs mb-1 font-medium"
              style={{ color: accentColor }}
            >
              {message.characterName}
            </span>
            <div
              className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed bg-white text-gray-800"
              style={{ wordBreak: 'break-word', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
            >
              {message.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
