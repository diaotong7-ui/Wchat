import React from 'react';
import { TypingState } from '../types';

const CHARACTER_COLORS: Record<string, string> = {
  luffy: '#EF4444',
  gojo: '#6366F1',
  daiyu: '#EC4899',
};

interface TypingBubbleProps {
  typingCharacters: TypingState[];
}

export const TypingBubble: React.FC<TypingBubbleProps> = ({ typingCharacters }) => {
  if (typingCharacters.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 px-3">
      {typingCharacters.map((t) => {
        const color = CHARACTER_COLORS[t.characterId] || '#888';
        return (
          <div key={t.characterId} className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
              style={{ backgroundColor: `${color}18` }}
            >
              {t.avatar}
            </div>
            <div className="flex flex-col max-w-[68%]">
              <span className="text-xs mb-1 font-medium" style={{ color }}>
                {t.characterName}
              </span>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white shadow-sm flex gap-1 items-center">
                <span className="typing-dot" style={{ animationDelay: '0ms' }} />
                <span className="typing-dot" style={{ animationDelay: '200ms' }} />
                <span className="typing-dot" style={{ animationDelay: '400ms' }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
