import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import apiClient from '@services/apiClient';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

// ── Singleton socket instance ─────────────────────────────────────────────────
let socketInstance = null;

function getSocket(token) {
    if (socketInstance?.connected) return socketInstance;
    socketInstance = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        autoConnect: true,
    });
    return socketInstance;
}

export function disconnectSocket() {
    if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
    }
}

// ── useChat hook ──────────────────────────────────────────────────────────────
export function useChat({ token, isAdmin = false }) {
    const [connected,       setConnected]       = useState(false);
    const [conversations,   setConversations]   = useState([]);   // admin only
    const [activeConv,      setActiveConv]      = useState(null); // { _id, messages[], userId, unread... }
    const [unreadCount,     setUnreadCount]      = useState(0);   // user: badge on bubble
    const [isTyping,        setIsTyping]         = useState(false);
    const [loading,         setLoading]          = useState(false);
    const socketRef = useRef(null);
    const typingTimeout = useRef(null);

    // ── Connect socket ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!token) return;
        const socket = getSocket(token);
        socketRef.current = socket;

        socket.on('connect',    () => setConnected(true));
        socket.on('disconnect', () => setConnected(false));

        // Nhận tin nhắn mới
        socket.on('chat:message', ({ convId, message }) => {
            // Cập nhật activeConv nếu đang mở
            setActiveConv(prev => {
                if (!prev || prev._id !== convId) return prev;
                const exists = prev.messages.some(m => m._id === message._id);
                if (exists) return prev;
                return { ...prev, messages: [...prev.messages, message] };
            });

            // Cập nhật list conversations (admin)
            setConversations(prev => prev.map(c =>
                c._id === convId
                    ? { ...c, lastMessage: message.content, lastMessageAt: message.createdAt,
                        unreadByAdmin: isAdmin && message.senderRole === 'user' ? (c.unreadByAdmin || 0) + 1 : c.unreadByAdmin }
                    : c
            ));

            // User badge
            if (!isAdmin && message.senderRole === 'admin') {
                setUnreadCount(n => n + 1);
            }
        });

        // Typing indicator
        socket.on('chat:typing', ({ isTyping: t }) => {
            setIsTyping(t);
            if (t) {
                clearTimeout(typingTimeout.current);
                typingTimeout.current = setTimeout(() => setIsTyping(false), 3000);
            }
        });

        // Unread badge update (admin)
        socket.on('chat:unread_update', ({ convId, unreadByAdmin, lastMessage, lastMessageAt }) => {
            setConversations(prev => prev.map(c =>
                c._id === convId ? { ...c, unreadByAdmin, lastMessage, lastMessageAt } : c
            ));
        });

        socket.on('chat:read_ack', ({ convId }) => {
            setActiveConv(prev => prev?._id === convId ? { ...prev, unreadByUser: 0 } : prev);
        });

        return () => {
            socket.off('chat:message');
            socket.off('chat:typing');
            socket.off('chat:unread_update');
            socket.off('chat:read_ack');
        };
    }, [token, isAdmin]);

    // ── Load user conversation ────────────────────────────────────────────────
    const loadUserConversation = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/chat/conversation');
            const conv = res.data.data;
            setActiveConv(conv);
            setUnreadCount(conv.unreadByUser || 0);
        } catch (e) {
            console.error('loadUserConversation', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Load admin conversation list ──────────────────────────────────────────
    const loadConversations = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/chat/admin/conversations');
            setConversations(res.data.data.conversations || []);
        } catch (e) {
            console.error('loadConversations', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Open specific conversation (admin) ────────────────────────────────────
    const openConversation = useCallback(async (convId) => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/chat/admin/conversations/${convId}`);
            setActiveConv(res.data.data);
            // Mark read
            await apiClient.post(`/chat/admin/conversations/${convId}/read`);
            setConversations(prev => prev.map(c => c._id === convId ? { ...c, unreadByAdmin: 0 } : c));
            socketRef.current?.emit('chat:read', { convId });
        } catch (e) {
            console.error('openConversation', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Send message ──────────────────────────────────────────────────────────
    const sendMessage = useCallback((content) => {
        if (!content?.trim() || !socketRef.current) return;
        socketRef.current.emit('chat:send', {
            convId:  activeConv?._id,
            content: content.trim(),
        });
    }, [activeConv]);

    // ── Typing emit ───────────────────────────────────────────────────────────
    const emitTyping = useCallback((isTypingNow) => {
        socketRef.current?.emit('chat:typing', { convId: activeConv?._id, isTyping: isTypingNow });
    }, [activeConv]);

    // ── Mark read by user ─────────────────────────────────────────────────────
    const markReadByUser = useCallback(async () => {
        if (!activeConv?._id) return;
        try {
            await apiClient.post('/chat/conversation/read');
            setUnreadCount(0);
            socketRef.current?.emit('chat:read', { convId: activeConv._id });
        } catch { /* silent */ }
    }, [activeConv]);

    return {
        connected, loading, isTyping,
        // user
        activeConv, unreadCount,
        loadUserConversation, sendMessage, emitTyping, markReadByUser,
        // admin
        conversations, openConversation, loadConversations,
        setActiveConv,
    };
}