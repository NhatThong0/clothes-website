// npm install socket.io-client  (nếu chưa có)
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@features/auth/hooks/useAuth';
import { useCart } from '@features/cart/hooks/useCart';
import { productAPI } from '@features/shared/services/api';
import apiClient from '@features/shared/services/apiClient';
import { useChat, getSocket } from '@features/chat/hooks/useChat';

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const NAV_LINKS = [
  { label: 'Trang chủ',  href: '/' },
  { label: 'Sản phẩm',   href: '/products' },
  { label: 'Khuyến mãi', href: '/products?type=sale', badge: { label: 'HOT', cls: 'bg-rose-500' } },
];

const NOTIF_COLORS = {
  blue:   { bg:'bg-blue-50',   text:'text-blue-600',   dot:'bg-blue-500',   border:'border-blue-100'   },
  green:  { bg:'bg-emerald-50',text:'text-emerald-600',dot:'bg-emerald-500',border:'border-emerald-100'},
  sky:    { bg:'bg-sky-50',    text:'text-sky-600',    dot:'bg-sky-500',    border:'border-sky-100'    },
  orange: { bg:'bg-orange-50', text:'text-orange-600', dot:'bg-orange-500', border:'border-orange-100' },
  red:    { bg:'bg-rose-50',   text:'text-rose-600',   dot:'bg-rose-500',   border:'border-rose-100'   },
  purple: { bg:'bg-violet-50', text:'text-violet-600', dot:'bg-violet-500', border:'border-violet-100' },
  slate:  { bg:'bg-slate-50',  text:'text-slate-600',  dot:'bg-slate-400',  border:'border-slate-100'  },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function UserAvatar({ user, size = 7, textSize = 'text-xs' }) {
  const [imgError, setImgError] = useState(false);
  const initials = (user?.name || user?.email || 'U')[0].toUpperCase();
  if (user?.avatar && !imgError) {
    return (
      <img src={user.avatar} alt={user.name || 'avatar'} onError={() => setImgError(true)}
        className={`w-${size} h-${size} rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0`} />
    );
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white ${textSize} font-black flex-shrink-0`}>
      {initials}
    </div>
  );
}

function SearchBox({ onClose }) {
  const navigate    = useNavigate();
  const inputRef    = useRef(null);
  const dropdownRef = useRef(null);
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [open,      setOpen]      = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debouncedQuery = useDebounce(query, 320);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2) { setResults([]); setOpen(false); return; }
    const fetchData = async () => {
      setLoading(true);
      try {
        const res  = await productAPI.getAllProducts({ search: debouncedQuery, limit: 6 });
        const data = res.data?.data || res.data || [];
        const list = Array.isArray(data) ? data : (data.products || []);
        setResults(list.slice(0, 6)); setOpen(true); setActiveIdx(-1);
      } catch { setResults([]); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [debouncedQuery]);

  const goToSearch  = (q = query) => { if (!q.trim()) return; navigate(`/products?search=${encodeURIComponent(q.trim())}`); setQuery(''); setOpen(false); onClose?.(); };
  const goToProduct = (id) => { navigate(`/products/${id}`); setQuery(''); setOpen(false); onClose?.(); };

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) { if (e.key === 'Enter') goToSearch(); return; }
    if      (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i+1, results.length-1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i-1, -1)); }
    else if (e.key === 'Enter')     { e.preventDefault(); if (activeIdx >= 0) goToProduct(results[activeIdx]._id||results[activeIdx].id); else goToSearch(); }
    else if (e.key === 'Escape')    { setOpen(false); }
  };

  useEffect(() => {
    const handler = e => { if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const highlight = (text, q) => {
    if (!q.trim()) return text;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 text-slate-900 rounded">$1</mark>');
  };
  const fmtPrice = v => new Intl.NumberFormat('vi-VN', { style:'currency', currency:'VND' }).format(v);

  return (
    <div className="relative w-full">
      <div className={`flex items-center gap-2 px-4 py-2.5 border-2 rounded-2xl bg-white transition-all ${open?'border-blue-500 shadow-lg shadow-blue-100':'border-slate-200'}`}>
        {loading
          ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
          : <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>}
        <input ref={inputRef} type="text" value={query}
          onChange={e=>{ setQuery(e.target.value); if (!e.target.value.trim()){ setOpen(false); setResults([]); } }}
          onKeyDown={handleKeyDown} onFocus={()=>results.length>0&&setOpen(true)}
          placeholder="Tìm tên sản phẩm..."
          className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400"/>
        {query && (
          <button onClick={()=>{ setQuery(''); setOpen(false); setResults([]); inputRef.current?.focus(); }}
            className="p-0.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        )}
        <button onClick={()=>goToSearch()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex-shrink-0">Tìm</button>
      </div>
      {open && (
        <div ref={dropdownRef} className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50" style={{animation:'dropDown .15s ease'}}>
          {results.length===0&&!loading ? (
            <div className="px-5 py-4 text-sm text-slate-400 text-center">Không tìm thấy sản phẩm nào cho "<span className="font-semibold text-slate-600">{query}</span>"</div>
          ) : (
            <>
              <div className="px-4 py-2 border-b border-slate-50"><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Gợi ý sản phẩm</p></div>
              <ul>
                {results.map((product,idx) => {
                  const pid=product._id||product.id, price=product.discount>0?Math.round(product.price*(1-product.discount/100)):product.price;
                  const img=product.images?.[0]||'https://placehold.co/80x80?text=?', active=idx===activeIdx;
                  return (
                    <li key={pid}>
                      <button onMouseDown={()=>goToProduct(pid)} onMouseEnter={()=>setActiveIdx(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${active?'bg-blue-50':'hover:bg-slate-50'}`}>
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                          <img src={img} alt={product.name} className="w-full h-full object-cover"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate" dangerouslySetInnerHTML={{__html:highlight(product.name,query)}}/>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm font-bold text-blue-600">{fmtPrice(price)}</span>
                            {product.discount>0&&(<><span className="text-xs text-slate-400 line-through">{fmtPrice(product.price)}</span><span className="text-[10px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded-full">−{product.discount}%</span></>)}
                          </div>
                          {product.category?.name&&<p className="text-[11px] text-slate-400 mt-0.5">{product.category.name}</p>}
                        </div>
                        <svg className={`w-4 h-4 flex-shrink-0 ${active?'text-blue-500':'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button onMouseDown={()=>goToSearch()} className="w-full flex items-center justify-center gap-2 px-4 py-3 border-t border-slate-100 text-sm font-semibold text-blue-600 hover:bg-blue-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                Xem tất cả kết quả cho "<span className="font-bold">{query}</span>"
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const LOGO_SRC = '/Daclothes.png';
function Logo() {
  const [logoError, setLogoError] = useState(false);
  return (
    <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
      <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
        {!logoError
          ? <img src={LOGO_SRC} alt="DaClothes Logo" onError={()=>setLogoError(true)} className="w-full h-full object-cover"/>
          : <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center"><span className="text-white font-black text-base">DC</span></div>}
      </div>
      <span className="hidden sm:inline font-black text-lg text-slate-800 tracking-tight">DaClothes</span>
    </Link>
  );
}

// ── NotificationBell — Socket.io real-time ────────────────────────────────────
function NotificationBell({ user }) {
  const navigate    = useNavigate();
  const bellRef     = useRef(null);
  const dropdownRef = useRef(null);
  const socketRef   = useRef(null); // ← socket instance

  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [hasFetched,    setHasFetched]    = useState(false);
  const [shake,         setShake]         = useState(false);

  // ── Socket.io: lắng nghe thông báo qua socket singleton ───────────────────
  useEffect(() => {
    const uid = user?._id || user?.id;
    if (!uid) return;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    // Dùng chung singleton socket (cùng kết nối với useChat)
    const socket = getSocket(token);
    socketRef.current = socket;

    const handleNotification = (notif) => {
      console.log('🔥 Nhận thông báo:', notif);
      setNotifications(prev => {
        if (prev.find(n => n._id === notif._id)) return prev; // tránh duplicate
        return [notif, ...prev];
      });
      setUnreadCount(c => c + 1);
      setShake(true);
      setTimeout(() => setShake(false), 700);
    };

    socket.on('notification', handleNotification);

    // Cleanup: chỉ tắt listener, KHÔNG disconnect (để useChat vẫn dùng được)
    return () => {
      socket.off('notification', handleNotification);
    };
  }, [user?._id]); // CHỈ phụ thuộc vào ID


  // ── Load initial unread count (1 lần khi mount) ────────────────────────────
  useEffect(() => {
    if (!user) return;
    apiClient.get('/notifications/unread-count')
      .then(res => setUnreadCount(res.data?.data?.unreadCount ?? 0))
      .catch(() => {});
  }, [user]);

  // ── Load full list khi mở dropdown ─────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await apiClient.get('/notifications?limit=30');
      const data = res.data?.data;
      setNotifications(data?.notifications || []);
      setUnreadCount(data?.unreadCount ?? 0);
      setHasFetched(true);
    } catch {}
    finally { setLoading(false); }
  }, []);

  const handleOpen = () => {
    if (!open) fetchNotifications();
    setOpen(v => !v);
  };

  useEffect(() => {
    const handler = e => {
      if (!bellRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkRead = async (id) => {
    setNotifications(p => p.map(n => n._id===id ? {...n,isRead:true} : n));
    setUnreadCount(c => Math.max(0, c-1));
    try { await apiClient.put(`/notifications/${id}/read`); } catch {}
  };

  const handleMarkAllRead = async () => {
    setNotifications(p => p.map(n => ({...n,isRead:true})));
    setUnreadCount(0);
    try { await apiClient.put('/notifications/read-all'); } catch {}
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    setNotifications(p => {
      const notif = p.find(n => n._id===id);
      if (notif && !notif.isRead) setUnreadCount(c => Math.max(0, c-1));
      return p.filter(n => n._id!==id);
    });
    try { await apiClient.delete(`/notifications/${id}`); } catch {}
  };

  const handleDeleteAll = async () => {
    setNotifications([]); setUnreadCount(0);
    try { await apiClient.delete('/notifications'); } catch {}
  };

  const handleClick = (notif) => {
    if (!notif.isRead) handleMarkRead(notif._id);
    if (notif.link) { navigate(notif.link); setOpen(false); }
  };

  const grouped = notifications.reduce((acc, n) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const nDate = new Date(n.createdAt); nDate.setHours(0,0,0,0);
    const diff  = Math.floor((today-nDate)/86400000);
    const key   = diff===0?'Hôm nay':diff===1?'Hôm qua':'Trước đó';
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});

  if (!user) return null;

  return (
    <div className="relative">
      <button ref={bellRef} onClick={handleOpen}
        className={`relative p-2.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all ${shake?'animate-[shake_.5s_ease]':''}`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount>99?'99+':unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div ref={dropdownRef}
          className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 flex flex-col overflow-hidden"
          style={{animation:'dropDown .18s ease', maxHeight:'80vh'}}>

          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">Thông báo</h3>
              {unreadCount>0&&<span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full">{unreadCount}</span>}
              {/* ✅ Socket status indicator */}
              <span className={`w-1.5 h-1.5 rounded-full ${socketRef.current?.connected?'bg-emerald-400':'bg-slate-300'}`} title={socketRef.current?.connected?'Real-time':'Offline'}/>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount>0&&<button onClick={handleMarkAllRead} className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg">Đọc tất cả</button>}
              {notifications.length>0&&<button onClick={handleDeleteAll} className="text-xs font-semibold text-slate-400 hover:text-rose-500 hover:bg-rose-50 px-2 py-1 rounded-lg">Xóa tất cả</button>}
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading&&!hasFetched ? (
              <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>
            ) : notifications.length===0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-3 text-2xl">🔔</div>
                <p className="text-sm font-semibold text-slate-500">Chưa có thông báo nào</p>
                <p className="text-xs text-slate-400 mt-1 text-center">Thông báo về đơn hàng, voucher sẽ xuất hiện ở đây</p>
              </div>
            ) : (
              Object.entries(grouped).map(([group, items]) => (
                <div key={group}>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{group}</p>
                  </div>
                  {items.map(notif => {
                    const c = NOTIF_COLORS[notif.color] || NOTIF_COLORS.blue;
                    return (
                      <div key={notif._id} onClick={()=>handleClick(notif)}
                        className={`group relative flex gap-3 px-4 py-3.5 border-b border-slate-50 cursor-pointer transition-colors ${notif.isRead?'hover:bg-slate-50':'bg-blue-50/40 hover:bg-blue-50/70'}`}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${c.bg}`}>{notif.icon}</div>
                        <div className="flex-1 min-w-0 pr-6">
                          <p className={`text-xs font-bold leading-snug ${notif.isRead?'text-slate-700':'text-slate-900'}`}>{notif.title}</p>
                          <p className={`text-xs mt-0.5 leading-relaxed ${notif.isRead?'text-slate-400':'text-slate-600'}`}>{notif.message}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-slate-400">{timeAgo(notif.createdAt)}</span>
                            {!notif.isRead&&<span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`}/>}
                          </div>
                        </div>
                        {!notif.isRead&&<div className={`absolute right-9 top-4 w-2 h-2 rounded-full ${c.dot}`}/>}
                        <button onClick={e=>handleDelete(e,notif._id)}
                          className="absolute right-3 top-3.5 w-5 h-5 flex items-center justify-center text-slate-300 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all rounded-full hover:bg-rose-50">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout }  = useAuth();
  const { getTotalItems } = useCart();

  const [isMenuOpen,     setIsMenuOpen]     = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [mobileSearch,   setMobileSearch]   = useState(false);

  const handleLogout = () => { logout('user'); navigate('/'); setIsUserMenuOpen(false); };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Logo />
          <div className="hidden md:flex flex-1 max-w-md mx-4"><SearchBox /></div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={()=>setMobileSearch(v=>!v)} className="md:hidden p-2.5 text-slate-600 hover:bg-slate-50 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </button>

            {/* 🔔 Notification Bell với Socket.io */}
            {user && <NotificationBell user={user} />}

            {/* Cart */}
            <Link to="/cart" className="relative p-2.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
              {getTotalItems()>0&&<span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-blue-600 text-white text-[10px] font-black rounded-full flex items-center justify-center">{getTotalItems()>9?'9+':getTotalItems()}</span>}
            </Link>

            {/* User menu */}
            {user ? (
              <div className="relative">
                <button onClick={()=>setIsUserMenuOpen(v=>!v)} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-xl">
                  <UserAvatar user={user} size={8} textSize="text-xs"/>
                  <span className="hidden sm:inline text-sm font-semibold text-slate-700 max-w-[80px] truncate">{user.name||user.email}</span>
                  <svg className={`w-3.5 h-3.5 text-slate-400 hidden sm:block transition-transform ${isUserMenuOpen?'rotate-180':''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                </button>
                {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={()=>setIsUserMenuOpen(false)}/>
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-20" style={{animation:'dropDown .15s ease'}}>
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                        <UserAvatar user={user} size={10} textSize="text-sm"/>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{user.name||user.email}</p>
                          {user.role==='admin'?<p className="text-xs text-blue-600 font-semibold mt-0.5">👑 Quản trị viên</p>:<p className="text-xs text-slate-400 mt-0.5 truncate">{user.email}</p>}
                        </div>
                      </div>
                      {user.role==='admin'&&(<><Link to="/admin" className="flex items-center gap-2 px-4 py-2.5 text-blue-600 hover:bg-blue-50 text-sm font-semibold" onClick={()=>setIsUserMenuOpen(false)}><span>⚙️</span> Admin Portal</Link><div className="border-t border-slate-100 my-1"/></>)}
                      <Link to="/profile" className="flex items-center gap-2 px-4 py-2.5 text-slate-700 hover:bg-slate-50 text-sm" onClick={()=>setIsUserMenuOpen(false)}><span>👤</span> Tài khoản của tôi</Link>
                      <Link to="/orders" className="flex items-center gap-2 px-4 py-2.5 text-slate-700 hover:bg-slate-50 text-sm" onClick={()=>setIsUserMenuOpen(false)}><span>📦</span> Đơn hàng</Link>
                      <div className="border-t border-slate-100 my-1"/>
                      <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2.5 text-rose-500 hover:bg-rose-50 text-sm font-semibold"><span>🚪</span> Đăng xuất</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link to="/auth/login" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold">Đăng nhập</Link>
            )}

            <button onClick={()=>setIsMenuOpen(v=>!v)} className="md:hidden p-2.5 text-slate-600 hover:bg-slate-50 rounded-xl">
              {isMenuOpen
                ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>}
            </button>
          </div>
        </div>

        {mobileSearch && (
          <div className="md:hidden pb-3 px-1" style={{animation:'dropDown .15s ease'}}>
            <SearchBox onClose={()=>setMobileSearch(false)}/>
          </div>
        )}

        <nav className="hidden md:flex border-t border-slate-100 gap-1">
          {NAV_LINKS.map(link => {
            const active = link.href==='/' ? location.pathname==='/' : location.pathname+location.search===link.href||(link.href.includes('?')&&location.search===`?${link.href.split('?')[1]}`);
            return (
              <Link key={link.href} to={link.href} className={`relative flex items-center gap-1.5 py-3.5 px-4 text-sm font-semibold transition-colors ${active?'text-blue-600':'text-slate-600 hover:text-blue-600'}`}>
                {link.label}
                {link.badge&&<span className={`text-[10px] font-black text-white px-1.5 py-0.5 rounded-full ${link.badge.cls}`}>{link.badge.label}</span>}
                {active&&<span className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-600 rounded-full"/>}
              </Link>
            );
          })}
        </nav>

        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-100 py-3 space-y-0.5" style={{animation:'dropDown .15s ease'}}>
            {NAV_LINKS.map(link=>(
              <Link key={link.href} to={link.href} className="flex items-center justify-between px-4 py-2.5 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium" onClick={()=>setIsMenuOpen(false)}>
                <span>{link.label}</span>
                {link.badge&&<span className={`text-[10px] font-black text-white px-1.5 py-0.5 rounded-full ${link.badge.cls}`}>{link.badge.label}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes dropDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shake { 0%,100%{transform:rotate(0deg)} 20%{transform:rotate(-15deg)} 40%{transform:rotate(15deg)} 60%{transform:rotate(-10deg)} 80%{transform:rotate(8deg)} }
      `}</style>
    </header>
  );
}
