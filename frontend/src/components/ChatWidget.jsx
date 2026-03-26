import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import apiClient from '@services/apiClient';
import { useAuth } from '@hooks/useAuth';
import { useChat } from '@hooks/useChat';

const fmtTime = d => new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export default function ChatWidget() {
    const { user } = useAuth();
    const location = useLocation();
    const isAdmin  = location.pathname.startsWith('/admin');
    const token    = localStorage.getItem('token');

    const { 
        connected, 
        loading,
        activeConv, 
        unreadCount, 
        isTyping,
        loadUserConversation, 
        sendMessage: sendSocketMessage, 
        emitTyping, 
        markReadByUser 
    } = useChat({ token });

    const [open,      setOpen]      = useState(false);
    const [messages,  setMessages]  = useState([]);
    const [input,     setInput]     = useState('');
    const [sending,   setSending]   = useState(false);

    const bottomRef   = useRef(null);
    const inputRef    = useRef(null);

    // Đồng bộ tin nhắn từ Hook vào local state
    useEffect(() => {
        if (activeConv) {
            setMessages(activeConv.messages || []);
        }
    }, [activeConv]);

    // Khi mở widget: load lại + reset unread
    useEffect(() => {
        if (open && user) {
            loadUserConversation();
            markReadByUser();
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [open, user, loadUserConversation, markReadByUser]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // ── Gửi tin ──────────────────────────────────────────────────────────────
    const sendMessage = async () => {
        const text = input.trim();
        if (!text || sending) return;
        setSending(true);
        setInput('');
        
        // Gửi qua REST để lưu DB
        try {
            const res = await apiClient.post('/chat/my/send', { content: text });
            // Hook useChat sẽ nhận được tin qua socket và update UI
            // Nếu muốn nhanh hơn có thể update optimistic ở đây
            setMessages(prev => [...prev, res.data.data]);
        } catch (err) {
            setInput(text);
        } finally { setSending(false); }
    };

    const handleKey = e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const handleTyping = e => {
        const val = e.target.value;
        setInput(val);
        emitTyping(val.length > 0);
    };

    // ✅ Guard sau tất cả hooks
    if (!user || isAdmin) return null;

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
                .cw-root { font-family:'DM Sans',sans-serif; }
                .cw-window { animation: cwUp .25s cubic-bezier(.4,0,.2,1); transform-origin: bottom right; }
                @keyframes cwUp { from{opacity:0;transform:scale(.93) translateY(10px)} to{opacity:1;transform:none} }
                .cw-bubble { transition: all .25s cubic-bezier(.4,0,.2,1); }
                .cw-bubble:hover { transform: scale(1.08); }
                .cw-scroll::-webkit-scrollbar { width: 4px; }
                .cw-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
                .cw-dot span { display:inline-block; width:6px; height:6px; border-radius:50%; background:#94A3B8; animation: cwDot 1.2s infinite; }
                .cw-dot span:nth-child(2){animation-delay:.2s} .cw-dot span:nth-child(3){animation-delay:.4s}
                @keyframes cwDot{0%,80%,100%{transform:scale(.8);opacity:.5}40%{transform:scale(1.1);opacity:1}}
            `}</style>

            <div className="cw-root fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3">

                {open && (
                    <div className="cw-window flex flex-col rounded-2xl overflow-hidden bg-white"
                        style={{ width:360, height:520, boxShadow:'0 24px 64px rgba(0,0,0,.18)', border:'1px solid rgba(0,0,0,.08)' }}>

                        {/* Header */}
                        <div className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0"
                            style={{ background:'linear-gradient(135deg,#1D4ED8,#2563EB)' }}>
                            <div className="relative flex-shrink-0">
                                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">🛍️</div>
                                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-blue-700 ${connected ? 'bg-emerald-400' : 'bg-slate-400'}`}/>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-semibold text-sm">Fashion Hub Support</p>
                                <p className="text-blue-200 text-[11px]">{connected ? 'Đang trực tuyến' : 'Đang kết nối...'}</p>
                            </div>
                            <button onClick={() => setOpen(false)}
                                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                                </svg>
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="cw-scroll flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background:'#F8FAFC' }}>
                            {loading && !messages.length ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-3xl">👋</div>
                                    <div>
                                        <p className="font-semibold text-slate-700 text-sm">Xin chào {user.name?.split(' ').pop()}!</p>
                                        <p className="text-slate-400 text-xs mt-1 leading-relaxed">Chúng tôi luôn sẵn sàng hỗ trợ.<br/>Hãy gửi tin nhắn để bắt đầu.</p>
                                    </div>
                                </div>
                            ) : messages.map((msg, i) => {
                                const isMe   = msg.senderRole === 'customer';
                                const prev   = messages[i - 1];
                                const newDay = !prev || new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
                                return (
                                    <div key={msg._id || i}>
                                        {newDay && (
                                            <div className="flex items-center gap-2 my-2">
                                                <div className="flex-1 h-px bg-slate-200"/>
                                                <span className="text-[10px] text-slate-400">{new Date(msg.createdAt).toLocaleDateString('vi-VN')}</span>
                                                <div className="flex-1 h-px bg-slate-200"/>
                                            </div>
                                        )}
                                        <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                            {!isMe && (
                                                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">A</div>
                                            )}
                                            <div className="max-w-[75%]">
                                                <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? 'text-white rounded-br-sm' : 'text-slate-800 rounded-bl-sm bg-white border border-slate-200'}`}
                                                    style={isMe ? { background:'linear-gradient(135deg,#2563EB,#1D4ED8)' } : {}}>
                                                    {msg.content}
                                                </div>
                                                <p className={`text-[10px] text-slate-400 mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                                                    {fmtTime(msg.createdAt)}
                                                    {isMe && <span className="ml-1">{msg.readAt ? ' ✓✓' : ' ✓'}</span>}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {isTyping && (
                                <div className="flex items-end gap-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">A</div>
                                    <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-white border border-slate-200">
                                        <div className="cw-dot flex items-center gap-1 h-4"><span/><span/><span/></div>
                                    </div>
                                </div>
                            )}
                            <div ref={bottomRef}/>
                        </div>

                        {/* Input */}
                        <div className="px-3 py-3 border-t border-slate-100 flex-shrink-0 bg-white">
                            <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-blue-400 focus-within:bg-white transition-all">
                                <textarea ref={inputRef} value={input} onChange={handleTyping} onKeyDown={handleKey}
                                    placeholder="Nhập tin nhắn..." rows={1}
                                    className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none"
                                    style={{ maxHeight:80, lineHeight:'1.5' }}
                                    onInput={e => { e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'; }}/>
                                <button onClick={sendMessage} disabled={!input.trim() || sending}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
                                    style={{ background: input.trim() ? 'linear-gradient(135deg,#2563EB,#1D4ED8)' : '#E2E8F0' }}>
                                    {sending
                                        ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                                        : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={input.trim()?'#fff':'#94A3B8'} strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
                                          </svg>}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-300 text-center mt-1.5">Enter để gửi · Shift+Enter xuống dòng</p>
                        </div>
                    </div>
                )}

                {/* Bubble */}
                <button onClick={() => setOpen(o => !o)}
                    className="cw-bubble w-14 h-14 rounded-2xl flex items-center justify-center relative"
                    style={{ background: open ? '#1E293B' : 'linear-gradient(135deg,#2563EB,#1D4ED8)', boxShadow:'0 8px 24px rgba(37,99,235,.4)' }}>
                    {open
                        ? <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/>
                          </svg>
                        : <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                          </svg>}
                    {!open && unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center"
                            style={{ boxShadow:'0 2px 8px rgba(239,68,68,.5)' }}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
            </div>
        </>
    );
}