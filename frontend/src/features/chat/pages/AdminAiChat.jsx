import { useEffect, useMemo, useState } from 'react';
import apiClient from '@features/shared/services/apiClient';
import AiSuggestionProductCard from '@features/product/components/AiSuggestionProductCard';

const fmtDate = d => {
  const date = new Date(d);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'Vừa xong';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
  if (diff < 86400000) return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

function Avatar({ name, src, size = 36 }) {
  const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return src ? (
    <img src={src} alt={name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  ) : (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.38 }}
    >
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

export default function AdminAiChat() {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/ai-chat/admin/conversations');
      setConversations(res.data.data.conversations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(c => {
      const name = c.userId?.name?.toLowerCase() || '';
      const email = c.userId?.email?.toLowerCase() || '';
      return name.includes(q) || email.includes(q);
    });
  }, [conversations, search]);

  const openConversation = async (conv) => {
    setSelected(conv);
    try {
      const res = await apiClient.get(`/ai-chat/admin/conversations/${conv._id}`);
      setMessages(res.data.data.messages || []);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .aac-scroll::-webkit-scrollbar{width:4px} .aac-scroll::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:4px}
      `}</style>

      {/* Left list */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col">
        <div className="px-4 pt-5 pb-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 mb-3">Chatbot AI</h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm khách hàng..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto aac-scroll">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <p className="text-xs">Không có hội thoại AI</p>
            </div>
          ) : (
            filtered.map(conv => {
              const isActive = selected?._id === conv._id;
              return (
                <div
                  key={conv._id}
                  className={`px-4 py-3 cursor-pointer border-b border-slate-50 ${isActive ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  onClick={() => openConversation(conv)}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={conv.userId?.name} src={conv.userId?.avatar} size={38} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900 truncate">{conv.userId?.name || 'Khách hàng'}</p>
                        <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">{fmtDate(conv.lastMessageAt)}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{conv.lastMessage || 'Bắt đầu chat AI'}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div className="bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <Avatar name={selected.userId?.name} src={selected.userId?.avatar} size={38} />
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{selected.userId?.name || 'Khách hàng'}</p>
                  <p className="text-xs text-slate-400">{selected.userId?.email}</p>
                </div>
              </div>
              <button
                onClick={loadList}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Làm mới
              </button>
            </div>

            <div className="flex-1 overflow-y-auto aac-scroll px-5 py-4 space-y-3" style={{ background: '#F8FAFC' }}>
              {messages.map((msg, i) => {
                const isAi = msg.senderRole === 'ai';
                const prev = messages[i - 1];
                const showDate = !prev || new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
                return (
                  <div key={msg._id || i}>
                    {showDate && (
                      <div className="flex items-center gap-2 my-3">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2.5 py-1 rounded-full">
                          {new Date(msg.createdAt).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        </span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>
                    )}

                    <div className={`flex items-end gap-2 ${isAi ? 'flex-row' : 'flex-row-reverse'}`}>
                      <div
                        className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isAi ? 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm' : 'text-white rounded-br-sm'
                        }`}
                        style={isAi ? {} : { background: 'linear-gradient(135deg,#2563EB,#1D4ED8)' }}
                      >
                        {msg.content}

                        {isAi && Array.isArray(msg.suggestedProducts) && msg.suggestedProducts.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {msg.suggestedProducts.map((p, idx) => (
                              <AiSuggestionProductCard key={String(p.productId || p.id || idx)} product={p} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center text-slate-400">
              <p className="font-semibold text-slate-600 text-sm">Chọn một hội thoại AI</p>
              <p className="text-xs mt-1">để xem tin nhắn giữa user và chatbot</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

