import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/src/constants/config';
import { tokenStorage } from '@/src/utils/tokenStorage';
import { ChatMessage } from '@/src/api/chatApi';

interface UseChatSocketOptions {
  convId:      string | null;
  onMessage:   (msg: ChatMessage) => void;
  onTyping:    (isTyping: boolean) => void;
  onReadAck:   () => void;
}

export function useChatSocket({
  convId,
  onMessage,
  onTyping,
  onReadAck,
}: UseChatSocketOptions) {
  const socketRef   = useRef<Socket | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!convId) return;

    let socket: Socket;

    (async () => {
      const token = await tokenStorage.getAccessToken();

      // Kết nối socket với auth token
      socket = io(API_BASE_URL, {
        auth:            { token },
        transports:      ['websocket'],
        reconnection:    true,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[Chat] socket connected:', socket.id);
      });

      socket.on('disconnect', () => {
        console.log('[Chat] socket disconnected');
      });

      // Nhận tin nhắn mới
      socket.on('chat:message', ({ convId: cid, message }: { convId: string; message: ChatMessage }) => {
        if (cid === convId) onMessage(message);
      });

      // Nhận trạng thái typing từ admin
      socket.on('chat:typing', ({ isTyping }: { convId: string; isTyping: boolean }) => {
        onTyping(isTyping);
      });

      // Ack đã đọc
      socket.on('chat:read_ack', ({ convId: cid }: { convId: string }) => {
        if (cid === convId) onReadAck();
      });
    })();

    return () => {
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [convId]);

  /** Emit typing debounced — tự tắt sau 2s */
  const emitTyping = useCallback(() => {
    if (!socketRef.current || !convId) return;
    socketRef.current.emit('chat:typing', { convId, isTyping: true });

    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit('chat:typing', { convId, isTyping: false });
    }, 2000);
  }, [convId]);

  /** Emit đã đọc */
  const emitRead = useCallback(() => {
    if (!socketRef.current || !convId) return;
    socketRef.current.emit('chat:read', { convId });
  }, [convId]);

  return { emitTyping, emitRead };
}