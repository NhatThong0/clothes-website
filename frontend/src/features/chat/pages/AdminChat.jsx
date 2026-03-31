import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import apiClient from '@features/shared/services/apiClient';
import { useAuth } from '@features/auth/hooks/useAuth';

const fmtTime = d => new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const fmtDate = d => {
    const date = new Date(d);
    const now  = new Date();
    const diff = now - date;
    if (diff < 60000)      return 'Vừa xong';
    if (diff < 3600000)    return `${Math.floor(diff/60000)} phút trước`;
    if (diff < 86400000)   return date.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' });
    return date.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' });
};

function Avatar({ name, src, size = 36 }) {
    const colors = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4'];
    const bg     = colors[(name?.charCodeAt(0) || 0) % colors.length];
    return src
        ? <img src={src} alt={name} className="rounded-full object-cover flex-shrink-0" style={{ width:size, height:size }}/>
        : <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
            style={{ width:size, height:size, background:bg, fontSize: size * 0.38 }}>
            {name?.[0]?.toUpperCase() || '?'}
          </div>;
}

export default function AdminChat() {
    const { adminUser } = useAuth();
    // ✅ Đọc từ localStorage — dùng adminUser làm dependency để reactive
    const getToken = () => localStorage.getItem('adminToken');

    const [conversations, setConversations]   = useState([]);
    const [selected,      setSelected]        = useState(null);   // conversation object
    const [messages,      setMessages]        = useState([]);
    const [input,         setInput]           = useState('');
    const [sending,       setSending]         = useState(false);
    const [loading,       setLoading]         = useState(true);
    const [filter,        setFilter]          = useState('open'); // open | closed | all
    const [search,        setSearch]          = useState('');
    const [userTyping,    setUserTyping]       = useState({});     // { convId: bool }
    const [totalUnread,   setTotalUnread]      = useState(0);

    const socketRef   = useRef(null);
    const bottomRef   = useRef(null);
    const typingTimer = useRef(null);
    const inputRef    = useRef(null);

    // ── Load conversations ─────────────────────────────────────────────────────
    const loadConversations = useCallback(async () => {
        try {
            const params = filter === 'all' ? {} : { status: filter };
            const res = await apiClient.get('/chat/admin/conversations', { params });
            setConversations(res.data.data.conversations || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [filter]);

    useEffect(() => { loadConversations(); }, [loadConversations]);

    // ── Unread count ───────────────────────────────────────────────────────────
    useEffect(() => {
        apiClient.get('/chat/admin/unread-count')
            .then(r => setTotalUnread(r.data.data.unread))
            .catch(() => {});
    }, [conversations]);

    // ── Socket.io ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!getToken()) return;
        const socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000', {
            auth: { token: getToken() }, transports: ['websocket'],
        });
        socketRef.current = socket;

        socket.on('connect',    () => console.log('[AdminChat] socket connected'));
        socket.on('disconnect', () => console.log('[AdminChat] socket disconnected'));

        // ✅ Đúng tên event: 'chat:message' 
        socket.on('chat:message', ({ convId: conversationId, message }) => {
            // Cập nhật danh sách conversation
            setConversations(prev => prev.map(c =>
                c._id === conversationId
                    ? { ...c, lastMessage: message.content, lastMessageAt: message.createdAt, unreadByAdmin: (c.unreadByAdmin || 0) + 1 }
                    : c
            ).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)));

            // Nếu đang mở conversation này → thêm tin vào messages
            setSelected(sel => {
                if (sel?._id === conversationId) {
                    setMessages(prev => {
                        if (prev.some(m => m._id === message._id)) return prev;
                        return [...prev, message];
                    });
                    apiClient.post(`/chat/admin/conversations/${conversationId}/read`).catch(() => {});
                    setConversations(prev => prev.map(c =>
                        c._id === conversationId ? { ...c, unreadByAdmin: 0 } : c
                    ));
                }
                return sel;
            });
        });

        // ✅ Đúng tên event: 'chat:typing'
        socket.on('chat:typing', ({ convId: conversationId, isTyping }) => {
            setUserTyping(prev => ({ ...prev, [conversationId]: isTyping }));
            if (isTyping) setTimeout(() => setUserTyping(prev => ({ ...prev, [conversationId]: false })), 3000);
        });

        // ✅ Đúng tên event: 'chat:unread_update'
        socket.on('chat:unread_update', ({ convId: conversationId, unreadByAdmin, lastMessage, lastMessageAt }) => {
            setConversations(prev => prev.map(c =>
                c._id === conversationId ? { ...c, unreadByAdmin, lastMessage, lastMessageAt } : c
            ).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)));
        });

        return () => socket.disconnect();
    }, [adminUser]);

    // ── Select conversation ────────────────────────────────────────────────────
    const selectConversation = async (conv) => {
        setSelected(conv);
        try {
            const res = await apiClient.get(`/chat/admin/conversations/${conv._id}`);
            setMessages(res.data.data.messages || []);
            // Mark read
            await apiClient.post(`/chat/admin/conversations/${conv._id}/read`);
            setConversations(prev => prev.map(c =>
                c._id === conv._id ? { ...c, unreadByAdmin: 0 } : c
            ));
        } catch (e) { console.error(e); }
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    // ── Scroll to bottom ───────────────────────────────────────────────────────
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, userTyping]);

    // ── Send ───────────────────────────────────────────────────────────────────
    const sendMessage = async () => {
        const text = input.trim();
        if (!text || sending || !selected) return;
        setSending(true);
        setInput('');
        const optimistic = { _id:`opt_${Date.now()}`, senderId:'admin', senderRole:'admin', content:text, createdAt:new Date(), isRead:false };
        setMessages(prev => [...prev, optimistic]);
        try {
            const res = await apiClient.post(`/chat/admin/conversations/${selected._id}/send`, { content: text });
            setMessages(prev => prev.map(m => m._id === optimistic._id ? res.data.data : m));
            setConversations(prev => prev.map(c =>
                c._id === selected._id ? { ...c, lastMessage: text, lastMessageAt: new Date() } : c
            ));
        } catch {
            setMessages(prev => prev.filter(m => m._id !== optimistic._id));
            setInput(text);
        } finally { setSending(false); }
    };

    const handleKey = e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const handleTyping = e => {
        setInput(e.target.value);
        if (!socketRef.current || !selected) return;
        socketRef.current.emit('typing_start', { conversationId: selected.userId?._id });
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => {
            socketRef.current?.emit('typing_stop', { conversationId: selected.userId?._id });
        }, 1500);
    };

    const toggleStatus = async () => {
        if (!selected) return;
        try {
            const res = await apiClient.patch(`/chat/admin/conversations/${selected._id}/status`);
            const updated = res.data.data;
            setSelected(s => ({ ...s, status: updated.status }));
            setConversations(prev => prev.map(c => c._id === selected._id ? { ...c, status: updated.status } : c));
        } catch (e) { console.error(e); }
    };

    // ── Filtered conversations ─────────────────────────────────────────────────
    const filteredConvs = conversations.filter(c => {
        if (!search) return true;
        const name  = c.userId?.name?.toLowerCase() || '';
        const email = c.userId?.email?.toLowerCase() || '';
        return name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
    });

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden" style={{ fontFamily:"'DM Sans',sans-serif" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
                .ac-scroll::-webkit-scrollbar{width:4px} .ac-scroll::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:4px}
                .ac-conv-item{transition:background .15s}
                .ac-conv-item:hover{background:#F1F5F9}
                .ac-conv-item.active{background:#EFF6FF}
                .ac-msg-in{animation:acIn .18s ease} @keyframes acIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
                .ac-typing span{animation:acDot 1.2s ease-in-out infinite;display:inline-block}
                .ac-typing span:nth-child(2){animation-delay:.2s} .ac-typing span:nth-child(3){animation-delay:.4s}
                @keyframes acDot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}
                .ac-send-btn{transition:all .2s} .ac-send-btn:hover:not(:disabled){transform:scale(1.05)}
            `}</style>

            {/* ── LEFT: Conversation list ── */}
            <div className="w-80 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col">

                {/* Header */}
                <div className="px-4 pt-5 pb-3 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-bold text-slate-900">
                            Hỗ trợ khách hàng
                            {totalUnread > 0 && (
                                <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                                    {totalUnread}
                                </span>
                            )}
                        </h2>
                    </div>

                    {/* Search */}
                    <div className="relative mb-3">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                        <input type="text" placeholder="Tìm khách hàng..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    </div>

                    {/* Filter tabs */}
                    <div className="flex bg-slate-100 rounded-xl p-0.5">
                        {[['all','Tất cả']].map(([v,l]) => (
                            <button key={v} onClick={() => setFilter(v)}
                                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                                    filter === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                }`}>{l}</button>
                        ))}
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto ac-scroll">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                        </div>
                    ) : filteredConvs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <span className="text-3xl mb-2">💬</span>
                            <p className="text-xs">Không có cuộc hội thoại</p>
                        </div>
                    ) : filteredConvs.map(conv => {
                        const isActive  = selected?._id === conv._id;
                        const isTyping  = userTyping[conv._id];
                        const hasUnread = conv.unreadByAdmin > 0;
                        return (
                            <div key={conv._id}
                                className={`ac-conv-item px-4 py-3 cursor-pointer border-b border-slate-50 ${isActive ? 'active' : ''}`}
                                onClick={() => selectConversation(conv)}>
                                <div className="flex items-start gap-3">
                                    <div className="relative flex-shrink-0">
                                        <Avatar name={conv.userId?.name} src={conv.userId?.avatar} size={38}/>
                                        {conv.status === 'open' && (
                                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white"/>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className={`text-sm truncate ${hasUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                                {conv.userId?.name || 'Khách hàng'}
                                            </p>
                                            <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">
                                                {fmtDate(conv.lastMessageAt)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between mt-0.5">
                                            <p className={`text-xs truncate ${hasUnread ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                                                {isTyping
                                                    ? <span className="text-blue-500 italic">Đang nhập...</span>
                                                    : (conv.lastMessage || 'Bắt đầu trò chuyện')}
                                            </p>
                                            {hasUnread && (
                                                <span className="ml-1 min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                                                    {conv.unreadByAdmin}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── RIGHT: Message pane ── */}
            {selected ? (
                <div className="flex-1 flex flex-col min-w-0">

                    {/* Chat header */}
                    <div className="bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <Avatar name={selected.userId?.name} src={selected.userId?.avatar} size={38}/>
                            <div>
                                <p className="font-semibold text-slate-900 text-sm">{selected.userId?.name || 'Khách hàng'}</p>
                                <p className="text-xs text-slate-400">{selected.userId?.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                selected.status === 'open'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                            }`}>
                                {selected.status === 'open' ? '● Đang mở' : '○ Đã đóng'}
                            </span>
                            <button onClick={toggleStatus}
                                className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
                                {selected.status === 'open' ? 'Đóng' : 'Mở lại'}
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto ac-scroll px-5 py-4 space-y-3"
                        style={{ background:'#F8FAFC' }}>
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <span className="text-4xl mb-3">💬</span>
                                <p className="text-sm font-medium">Chưa có tin nhắn</p>
                                <p className="text-xs mt-1">Hãy bắt đầu trò chuyện với khách hàng</p>
                            </div>
                        )}
                        {messages.map((msg, i) => {
                            const isAdmin = msg.senderRole === 'admin';
                            const prev    = messages[i - 1];
                            const showDate = !prev || new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
                            return (
                                <div key={msg._id || i} className="ac-msg-in">
                                    {showDate && (
                                        <div className="flex items-center gap-2 my-3">
                                            <div className="flex-1 h-px bg-slate-200"/>
                                            <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2.5 py-1 rounded-full">
                                                {new Date(msg.createdAt).toLocaleDateString('vi-VN', { weekday:'short', day:'2-digit', month:'2-digit' })}
                                            </span>
                                            <div className="flex-1 h-px bg-slate-200"/>
                                        </div>
                                    )}
                                    <div className={`flex items-end gap-2 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                                        {!isAdmin && <Avatar name={selected.userId?.name} src={selected.userId?.avatar} size={28}/>}
                                        <div className={`max-w-[65%] ${isAdmin ? 'items-end' : 'items-start'} flex flex-col`}>
                                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                                isAdmin
                                                    ? 'text-white rounded-br-sm'
                                                    : 'text-slate-800 rounded-bl-sm'
                                            }`}
                                                style={isAdmin
                                                    ? { background:'linear-gradient(135deg,#2563EB,#1D4ED8)' }
                                                    : { background:'#fff', border:'1px solid #E2E8F0', boxShadow:'0 1px 3px rgba(0,0,0,.05)' }
                                                }>
                                                {msg.content}
                                            </div>
                                            <p className={`text-[10px] text-slate-400 mt-1 ${isAdmin ? 'text-right' : 'text-left'}`}>
                                                {fmtTime(msg.createdAt)}
                                                {isAdmin && <span className="ml-1">{msg.isRead ? ' ✓✓' : ' ✓'}</span>}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* User typing */}
                        {userTyping[selected._id] && (
                            <div className="flex items-end gap-2">
                                <Avatar name={selected.userId?.name} src={selected.userId?.avatar} size={28}/>
                                <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-white border border-slate-200"
                                    style={{ boxShadow:'0 1px 3px rgba(0,0,0,.05)' }}>
                                    <div className="ac-typing flex items-center gap-1 h-4">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"/>
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"/>
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"/>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef}/>
                    </div>

                    {/* Input */}
                    <div className="bg-white border-t border-slate-100 px-4 py-3 flex-shrink-0">
                        {selected.status === 'closed' && (
                            <div className="mb-2 text-center text-xs text-amber-600 bg-amber-50 rounded-xl py-2 border border-amber-100">
                                Cuộc trò chuyện đã đóng — gửi tin sẽ tự động mở lại
                            </div>
                        )}
                        <div className="flex items-end gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-blue-400 focus-within:bg-white transition-all">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={handleTyping}
                                onKeyDown={handleKey}
                                placeholder={`Trả lời ${selected.userId?.name?.split(' ').pop() || 'khách hàng'}...`}
                                rows={1}
                                className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none"
                                style={{ maxHeight: 100, lineHeight: '1.5' }}
                                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                            />
                            <button onClick={sendMessage} disabled={!input.trim() || sending}
                                className="ac-send-btn w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all"
                                style={{ background: input.trim() ? 'linear-gradient(135deg,#2563EB,#1D4ED8)' : '#E2E8F0' }}>
                                {sending
                                    ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                                    : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#fff' : '#94A3B8'} strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
                                      </svg>}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-300 mt-1.5 text-center">Enter để gửi · Shift+Enter xuống dòng</p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center bg-slate-50">
                    <div className="text-center text-slate-400">
                        <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center text-3xl mx-auto mb-4">💬</div>
                        <p className="font-semibold text-slate-600 text-sm">Chọn một cuộc hội thoại</p>
                        <p className="text-xs mt-1">để xem và trả lời tin nhắn khách hàng</p>
                    </div>
                </div>
            )}
        </div>
    );
}
