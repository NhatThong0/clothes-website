import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/src/constants/config';
import { tokenStorage } from '@/src/utils/tokenStorage';
import { ChatMessage } from '@/src/api/chatApi';

interface UseChatSocketOptions {
  convId:    string | null;
  onMessage: (msg: ChatMessage) => void;
  onTyping:  (isTyping: boolean) => void;
  onReadAck: () => void;
}

export function useChatSocket({
  convId,
  onMessage,
  onTyping,
  onReadAck,
}: UseChatSocketOptions) {
  const socketRef    = useRef<Socket | null>(null);
  const typingTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dùng ref cho callbacks để tránh re-create socket khi prop thay đổi
  const onMessageRef = useRef(onMessage);
  const onTypingRef  = useRef(onTyping);
  const onReadAckRef = useRef(onReadAck);
  const convIdRef    = useRef(convId);

  // Cập nhật ref mỗi khi prop thay đổi — không cần recreate socket
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onTypingRef.current  = onTyping;  }, [onTyping]);
  useEffect(() => { onReadAckRef.current = onReadAck; }, [onReadAck]);
  useEffect(() => { convIdRef.current    = convId;    }, [convId]);

  // Chỉ tạo socket 1 lần duy nhất khi mount
  useEffect(() => {
    let socket: Socket;
    let mounted = true;

    (async () => {
      const token = await tokenStorage.getAccessToken();
      if (!mounted) return;

      socket = io(SOCKET_URL, {
        auth:                { token },
        transports:          ['polling','websocket'],
        reconnection:        true,
        reconnectionDelay:   2000,
        reconnectionAttempts: 5,
        // Không tự disconnect khi tab inactive
        closeOnBeforeunload: false,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
      });

      socket.on('connect_error', (err) => {
        console.warn('[Chat] connect_error:', err.message);
      });

      socket.on('disconnect', (reason) => {
        
        // Nếu server chủ động disconnect → thử reconnect
        if (reason === 'io server disconnect') {
          socket.connect();
        }
      });

      socket.on('chat:message', ({ convId: cid, message }: { convId: string; message: ChatMessage }) => {
        // Dùng ref để luôn lấy convId mới nhất
        if (cid === convIdRef.current) {
          onMessageRef.current(message);
        }
      });

      socket.on('chat:typing', ({ isTyping }: { isTyping: boolean }) => {
        onTypingRef.current(isTyping);
      });

      socket.on('chat:read_ack', ({ convId: cid }: { convId: string }) => {
        if (cid === convIdRef.current) {
          onReadAckRef.current();
        }
      });
    })();

    // Cleanup chỉ khi unmount hoàn toàn
    return () => {
      mounted = false;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      socket?.disconnect();
      socketRef.current = null;
    };
  }, []); // ← [] — chỉ chạy 1 lần

  const emitTyping = useCallback(() => {
    const cid = convIdRef.current;
    if (!socketRef.current?.connected || !cid) return;

    socketRef.current.emit('chat:typing', { convId: cid, isTyping: true });

    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit('chat:typing', { convId: cid, isTyping: false });
    }, 2000);
  }, []);

  const emitRead = useCallback(() => {
    const cid = convIdRef.current;
    if (!socketRef.current?.connected || !cid) return;
    socketRef.current.emit('chat:read', { convId: cid });
  }, []);

  return { emitTyping, emitRead };
}