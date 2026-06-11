import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChatMessage,
  Character,
  TypingState,
  GroupEventNotice,
  WsPacket,
} from '../types';

const WS_URL = 'ws://localhost:3001';

interface UseGroupChatReturn {
  messages: ChatMessage[];
  typingCharacters: TypingState[];
  characters: Character[];
  currentEvent: GroupEventNotice | null;
  isConnected: boolean;
  sendMessage: (content: string) => void;
}

export function useGroupChat(): UseGroupChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingCharacters, setTypingCharacters] = useState<TypingState[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [currentEvent, setCurrentEvent] = useState<GroupEventNotice | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('[WS] Connected');
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('[WS] Disconnected, retrying in 3s...');
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = (e) => {
      console.error('[WS] Error', e);
    };

    ws.onmessage = (event) => {
      try {
        const packet: WsPacket = JSON.parse(event.data);
        handlePacket(packet);
      } catch (e) {
        console.error('[WS] Parse error', e);
      }
    };
  }, []);

  function handlePacket(packet: WsPacket): void {
    switch (packet.type) {
      case 'init_state': {
        const { messages: hist, characters: chars } = packet.payload as {
          messages: ChatMessage[];
          characters: Character[];
        };
        setMessages(hist || []);
        setCharacters(chars || []);
        break;
      }
      case 'chat_message': {
        const msg = packet.payload as ChatMessage;
        setMessages((prev) => {
          // 去重
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        break;
      }
      case 'typing_start': {
        const ts = packet.payload as TypingState;
        setTypingCharacters((prev) => {
          if (prev.find((t) => t.characterId === ts.characterId)) return prev;
          return [...prev, ts];
        });
        break;
      }
      case 'typing_stop': {
        const ts = packet.payload as TypingState;
        setTypingCharacters((prev) =>
          prev.filter((t) => t.characterId !== ts.characterId)
        );
        break;
      }
      case 'event_start': {
        const ev = packet.payload as GroupEventNotice;
        setCurrentEvent(ev);
        // 事件提示60秒后自动消失
        setTimeout(() => setCurrentEvent(null), 60000);
        break;
      }
    }
  }

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'user_message', payload: { content } } satisfies WsPacket)
      );
    }
  }, []);

  return {
    messages,
    typingCharacters,
    characters,
    currentEvent,
    isConnected,
    sendMessage,
  };
}
