import React, { useEffect, useRef } from 'react';
import { useGroupChat } from '../hooks/useGroupChat';
import { MessageBubble } from './MessageBubble';
import { TypingBubble } from './TypingBubble';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';

export const ChatScreen: React.FC = () => {
  const {
    messages,
    typingCharacters,
    characters,
    currentEvent,
    isConnected,
    sendMessage,
  } = useGroupChat();

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // 消息更新时自动滚到底部
  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingCharacters]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const aiCount = characters.filter((c) => c.id !== 'user').length;

  return (
    <div
      className="flex flex-col h-screen max-h-screen overflow-hidden"
      style={{ backgroundColor: '#EDEDED', maxWidth: 480, margin: '0 auto' }}
    >
      {/* 头部 */}
      <ChatHeader
        isConnected={isConnected}
        characters={characters}
        currentEvent={currentEvent}
      />

      {/* 连线提示 */}
      {!isConnected && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-center">
          <span className="text-yellow-600 text-xs">正在连接服务器…请确认后端已启动 (port 3001)</span>
        </div>
      )}

      {/* 消息列表 */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-3"
        style={{ overscrollBehavior: 'contain' }}
      >
        {messages.length === 0 && isConnected && (
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
            <div className="text-3xl">🌏</div>
            <div className="text-sm text-gray-400">AI伙伴们正在准备中…</div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            prevMessage={messages[idx - 1]}
            isMe={msg.characterId === 'user'}
          />
        ))}

        {/* 打字中气泡 */}
        <TypingBubble typingCharacters={typingCharacters} />

        <div ref={bottomRef} />
      </div>

      {/* AI 成员信息条 */}
      {characters.length > 0 && (
        <div className="bg-white/60 px-4 py-1.5 flex items-center gap-3 border-t border-gray-100">
          <div className="flex -space-x-1">
            {characters
              .filter((c) => c.id !== 'user')
              .map((c) => (
                <div
                  key={c.id}
                  className="w-6 h-6 rounded-md text-sm flex items-center justify-center bg-gray-100 border border-white"
                  title={c.name}
                >
                  {c.avatar}
                </div>
              ))}
          </div>
          <span className="text-xs text-gray-400">
            {aiCount}个AI伙伴已就位 · 每15~30秒自动互动
          </span>
        </div>
      )}

      {/* 输入框 */}
      <ChatInput onSend={sendMessage} disabled={!isConnected} />
    </div>
  );
};
