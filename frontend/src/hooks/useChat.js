import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import apiClient from '@services/apiClient';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

// ── Singleton socket instance ─────────────────────────────────────────────────
let socketInstance = null;
let currentToken   = null;

export function getSocket(token) {
    // Nếu token thay đổi hoặc socket bị ngắt, ta khởi tạo lại
    if (socketInstance?.connected && token === currentToken) {
        return socketInstance;
    }

    if (socketInstance) {
        console.log('[Socket] Token changed or disconnected, re-initializing...');
        socketInstance.disconnect();
    }

    currentToken = token;
    socketInstance = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
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

        // ✅ Quan trọng: Nếu socket đã connect trước đó (Singleton), ta set true luôn 
        if (socket.connected) {
            setConnected(true);
        }

        const onConnect    = () => setConnected(true);
        const onDisconnect = () => setConnected(false);

        socket.on('connect',    onConnect);
        socket.on('disconnect', onDisconnect);

        const handleMessage = ({ convId, message }) => {
            setActiveConv(prev => {
                if (!prev || prev._id !== convId) return prev;
                if (prev.messages.some(m => m._id === message._id)) return prev;
                return { ...prev, messages: [...prev.messages, message] };
            });
            setConversations(prev => prev.map(c =>
                c._id === convId ? { ...c, lastMessage: message.content, lastMessageAt: message.createdAt } : c
            ));
            if (!isAdmin && message.senderRole === 'admin') setUnreadCount(n => n + 1);
        };

        const handleTyping = ({ isTyping: t }) => {
            setIsTyping(t);
            if (t) {
                clearTimeout(typingTimeout.current);
                typingTimeout.current = setTimeout(() => setIsTyping(false), 3000);
            }
        };

        const handleUnreadUpdate = ({ convId, unreadByAdmin, lastMessage, lastMessageAt }) => {
            setConversations(prev => prev.map(c =>
                c._id === convId ? { ...c, unreadByAdmin, lastMessage, lastMessageAt } : c
            ));
        };

        const handleReadAck = ({ convId }) => {
            setActiveConv(prev => prev?._id === convId ? { ...prev, unreadByUser: 0 } : prev);
        };

        socket.on('chat:message', handleMessage);
        socket.on('chat:typing',  handleTyping);
        socket.on('chat:unread_update', handleUnreadUpdate);
        socket.on('chat:read_ack', handleReadAck);

        return () => {
            socket.off('connect',     onConnect);
            socket.off('disconnect',  onDisconnect);
            socket.off('chat:message', handleMessage);
            socket.off('chat:typing',  handleTyping);
            socket.off('chat:unread_update', handleUnreadUpdate);
            socket.off('chat:read_ack', handleReadAck);
        };
    }, [token, isAdmin]);

    // ── Load user conversation ────────────────────────────────────────────────
    const loadUserConversation = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/chat/my');
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
            await apiClient.post('/chat/my/read');
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