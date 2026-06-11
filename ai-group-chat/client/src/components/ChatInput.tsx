import React, { useState, useRef, useCallback } from 'react';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    inputRef.current?.focus();
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white border-t border-gray-200 px-3 py-2 safe-area-pb">
      {/* 快捷回复建议 */}
      <div className="flex gap-2 mb-2 overflow-x-auto pb-0.5 scrollbar-hide">
        {['哈哈', '真的吗？', '我也想去！', '怎么了？', '好主意！'].map((s) => (
          <button
            key={s}
            onClick={() => { setText(s); inputRef.current?.focus(); }}
            className="flex-shrink-0 text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-500 bg-gray-50 active:bg-gray-100 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {/* 语音按钮（占位） */}
        <button className="w-8 h-8 flex items-center justify-center text-gray-400 flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="2"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* 文本输入框 */}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="说点什么…"
          disabled={disabled}
          className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none text-gray-800 placeholder-gray-400 disabled:opacity-50"
        />

        {/* 发送 / 表情 */}
        {text.trim() ? (
          <button
            onClick={handleSend}
            disabled={disabled}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#07C160' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ) : (
          <button className="w-8 h-8 flex items-center justify-center text-gray-400 flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 12h8M8 8h.01M16 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
