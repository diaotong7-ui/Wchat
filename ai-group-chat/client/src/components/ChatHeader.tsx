import React from 'react';
import { GroupEventNotice, Character } from '../types';

interface ChatHeaderProps {
  isConnected: boolean;
  characters: Character[];
  currentEvent: GroupEventNotice | null;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  isConnected,
  characters,
  currentEvent,
}) => {
  const aiChars = characters.filter((c) => c.id !== 'user');

  return (
    <div>
      {/* 顶部标题栏 */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: '#06AD56' }}
      >
        <div className="flex items-center gap-2">
          <button className="text-white opacity-80">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <div className="text-white font-semibold text-base leading-tight">
              旅途日常群 🌏
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-300' : 'bg-gray-400'}`}
                style={{ animation: isConnected ? 'pulse 1.5s infinite' : 'none' }}
              />
              <span className="text-white/75 text-xs">
                {isConnected ? `${aiChars.length + 1}人在线` : '连接中…'}
              </span>
            </div>
          </div>
        </div>

        {/* 成员头像列表 */}
        <div className="flex items-center -space-x-1.5">
          {aiChars.slice(0, 3).map((c) => (
            <div
              key={c.id}
              className="w-7 h-7 rounded-md flex items-center justify-center text-sm bg-white/20 border border-white/30"
              title={c.name}
            >
              {c.avatar}
            </div>
          ))}
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-sm bg-white/20 border border-white/30">
            🧑
          </div>
        </div>
      </div>

      {/* 事件通知条 */}
      {currentEvent && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-start gap-2">
          <span className="text-amber-500 text-base mt-0.5">⚡</span>
          <div>
            <span className="text-amber-700 text-xs font-semibold">{currentEvent.eventName}</span>
            <p className="text-amber-600 text-xs mt-0.5 leading-relaxed">
              {currentEvent.openingLine}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
