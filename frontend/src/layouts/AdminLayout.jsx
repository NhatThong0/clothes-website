import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import apiClient from '@services/apiClient';
import { getSocket } from '@hooks/useChat';

const NAV_ITEMS = [
  { label: 'Dashboard',       icon: '▦',  path: '/admin' },
  { label: 'Sản phẩm',        icon: '◈',  path: '/admin/products' },
  { label: 'Danh mục',        icon: '◉',  path: '/admin/categories' },
  { label: 'Đơn hàng',        icon: '◻',  path: '/admin/orders' },
  { label: 'Người dùng',      icon: '◯',  path: '/admin/users' },
  { label: 'Đánh giá',        icon: '◇',  path: '/admin/reviews' },
  { label: 'Voucher',         icon: '◈',  path: '/admin/vouchers' },
  { label: 'Banner',          icon: '◆', path: '/admin/banners' },
  { label: 'Kho hàng',        icon: '▣',  path: '/admin/inventory' },
  { label: 'Chat',            icon: '💬', path: '/admin/chat' }
];

const AdminLayout = () => {
  const { adminUser, logout, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // ── Notification States ──────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifShake, setNotifShake] = useState(false);
  const notifDropdownRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiClient.get('/notifications/admin?limit=20');
      if (res.data.status === 'success') {
        setNotifications(res.data.data.notifications);
        setUnreadCount(res.data.data.unreadCount);
      }
    } catch (err) {
      console.error('Fetch admin notifications error:', err);
    }
  }, []);

  useEffect(() => {
    if (!adminUser) return;
    fetchNotifications();

    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) return;

    const socket = getSocket(adminToken);
    const handleAdminNotification = (notif) => {
      setNotifications(prev => [notif, ...prev].slice(0, 30));
      setUnreadCount(prev => prev + 1);
      setNotifShake(true);
      setTimeout(() => setNotifShake(false), 700);
      try { new Audio('/notification-sound.mp3').play().catch(() => {}); } catch (e) {}
    };

    socket.on('admin:notification', handleAdminNotification);
    return () => socket.off('admin:notification', handleAdminNotification);
  }, [adminUser, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markNotifAsRead = async (id) => {
    try {
      await apiClient.put(`/notifications/admin/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {}
  };

  const markAllNotifsAsRead = async () => {
    try {
      await apiClient.put('/notifications/admin/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {}
  };

  const handleNotifClick = (notif) => {
    if (!notif.isRead) markNotifAsRead(notif._id);
    if (notif.link) {
      navigate(notif.link);
      setIsNotifOpen(false);
    }
  };

  const deleteNotif = async (e, id) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/notifications/admin/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
      if (!notifications.find(n => n._id === id)?.isRead) setUnreadCount(c => Math.max(0, c - 1));
    } catch (err) {}
  };

  const deleteAllNotifs = async () => {
    try {
      await apiClient.delete('/notifications/admin');
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {}
  };

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Vừa xong';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    return new Date(date).toLocaleDateString('vi-VN');
  };

  const groupNotifications = (notifs) => {
    const today = new Date().toDateString();
    const groups = { 'Hôm nay': [], 'Trước đó': [] };
    notifs.forEach(n => {
      const g = new Date(n.createdAt).toDateString() === today ? 'Hôm nay' : 'Trước đó';
      groups[g].push(n);
    });
    return Object.fromEntries(Object.entries(groups).filter(([_, items]) => items.length > 0));
  };

  const NOTIF_COLORS = {
    blue:   { bg: 'bg-blue-50 text-blue-600',    dot: 'bg-blue-600' },
    green:  { bg: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-600' },
    orange: { bg: 'bg-orange-50 text-orange-600',  dot: 'bg-orange-600' },
    red:    { bg: 'bg-rose-50 text-rose-600',      dot: 'bg-rose-600' },
    purple: { bg: 'bg-purple-50 text-purple-600',  dot: 'bg-purple-600' },
    slate:  { bg: 'bg-slate-50 text-slate-600',    dot: 'bg-slate-600' },
  };
   const socket = getSocket(localStorage.getItem('adminToken'));

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin"/>
          <p className="text-sm text-slate-400 font-medium tracking-wide">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!adminUser || adminUser.role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = () => { logout('admin'); navigate('/admin/login'); };

  const isActive = (path) =>
    path === '/admin'
      ? location.pathname === '/admin'
      : location.pathname.startsWith(path);

  const initials = adminUser?.name
    ? adminUser.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'AD';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className={`flex items-center h-16 border-b border-slate-100 px-5 flex-shrink-0 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-white font-black text-sm tracking-tighter">F</span>
        </div>
        {!collapsed && (
          <div>
            <p className="font-black text-slate-900 text-sm tracking-tight leading-none">DaClothes</p>
            <p className="text-[10px] text-blue-500 font-bold tracking-[0.2em] leading-none mt-0.5">ADMIN</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] px-3 pb-2">Menu</p>
        )}
        {NAV_ITEMS.map(item => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group relative
                ${active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
            >
              <span className={`text-base leading-none flex-shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`}>
                {item.icon}
              </span>
              {!collapsed && (
                <span className="text-sm font-semibold truncate">{item.label}</span>
              )}
              {active && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70"/>
              )}
              {/* Tooltip for collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-slate-100"/>

      

    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-slate-100 fixed h-full z-40 transition-all duration-300 shadow-sm
          ${collapsed ? 'w-[72px]' : 'w-56'}`}
      >
        <SidebarContent/>
      </aside>

      {/* ── Mobile Sidebar overlay ──────────────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed left-0 top-0 h-full w-56 bg-white border-r border-slate-100 z-50 shadow-xl flex flex-col">
            <SidebarContent/>
          </aside>
        </>
      )}

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? 'lg:ml-[72px]' : 'lg:ml-56'}`}>

        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 h-14 flex items-center px-4 lg:px-6 gap-4 sticky top-0 z-30 shadow-sm">

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden lg:flex p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
            title={collapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            <svg className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
            </svg>
          </button>

          {/* Breadcrumb / page title */}
          <div className="flex-1">
            <nav className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="font-medium text-blue-600">Admin</span>
              <span>/</span>
              <span className="font-semibold text-slate-700 capitalize">
                {NAV_ITEMS.find(n => isActive(n.path))?.label || 'Dashboard'}
              </span>
            </nav>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4">
            
            {/* Admin Notification Bell UI Updated */}
            <div className="relative" ref={notifDropdownRef}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`relative p-2.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all ${notifShake ? 'animate-[shake_.5s_ease]' : ''}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none shadow-sm">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div 
                  className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden z-50"
                  style={{ animation: 'dropDown .18s ease', maxHeight: '80vh' }}
                >
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 flex-shrink-0 bg-white">
                    <div className="flex items-center gap-2">
                       <h3 className="font-bold text-slate-900 text-sm">Thông báo</h3>
                       {unreadCount > 0 && <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full">{unreadCount}</span>}
                       {/* Socket status indicator */}
                       <span className={`w-1.5 h-1.5 rounded-full ${socket?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} title={socket?.connected ? 'Real-time online' : 'Offline'}/>
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button onClick={markAllNotifsAsRead} className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors">Đọc tất cả</button>
                      )}
                      {notifications.length > 0 && (
                        <button onClick={deleteAllNotifs} className="text-xs font-semibold text-slate-400 hover:text-rose-500 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors">Xóa tất cả</button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4">
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-3 text-2xl">🔔</div>
                        <p className="text-sm font-semibold text-slate-500">Chưa có thông báo nào</p>
                        <p className="text-xs text-slate-400 mt-1 text-center">Các tin về đơn hàng, người dùng mới sẽ xuất hiện ở đây</p>
                      </div>
                    ) : (
                      Object.entries(groupNotifications(notifications)).map(([group, items]) => (
                        <div key={group}>
                          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{group}</p>
                          </div>
                          {items.map(notif => {
                            const c = NOTIF_COLORS[notif.color] || NOTIF_COLORS.blue;
                            return (
                              <div key={notif._id} onClick={() => handleNotifClick(notif)}
                                className={`group relative flex gap-3 px-4 py-3.5 border-b border-slate-50 cursor-pointer transition-colors ${notif.isRead ? 'hover:bg-slate-50' : 'bg-blue-50/40 hover:bg-blue-50/70'}`}>
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm ${c.bg}`}>
                                  {notif.icon || '🔔'}
                                </div>
                                <div className="flex-1 min-w-0 pr-6">
                                  <p className={`text-xs font-bold leading-snug ${notif.isRead ? 'text-slate-700' : 'text-slate-900'}`}>{notif.title}</p>
                                  <p className={`text-[11px] mt-0.5 leading-relaxed ${notif.isRead ? 'text-slate-400' : 'text-slate-600'}`}>{notif.message}</p>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-[10px] text-slate-400 font-medium">{timeAgo(notif.createdAt)}</span>
                                    {!notif.isRead && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`}/>}
                                  </div>
                                </div>
                                {!notif.isRead && <div className={`absolute right-9 top-4 w-2 h-2 rounded-full ${c.dot} shadow-[0_0_8px_rgba(37,99,235,0.4)]`}/>}
                                <button onClick={(e) => deleteNotif(e, notif._id)}
                                  className="absolute right-3 top-3.5 w-6 h-6 flex items-center justify-center text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all rounded-full hover:bg-rose-50">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                    <button onClick={() => { navigate('/admin/orders'); setIsNotifOpen(false); }} className="w-full py-2 bg-white hover:bg-slate-100 text-slate-500 text-[11px] font-bold rounded-lg border border-slate-200 transition-colors shadow-sm">
                      Xem tất cả đơn hàng
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Avatar + logout */}
            <div className="flex items-center gap-2 pl-4 border-l border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
              <span className="hidden md:block text-sm font-semibold text-slate-700">{adminUser?.name}</span>
              <span className="hidden md:block text-xs text-slate-400">({adminUser?.email})</span>
              <button
                onClick={handleLogout}
                className="ml-1 px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          <Outlet/>
        </div>

      </main>

      <style>{`
        @keyframes dropDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shake { 0%,100%{transform:rotate(0deg)} 20%{transform:rotate(-15deg)} 40%{transform:rotate(15deg)} 60%{transform:rotate(-10deg)} 80%{transform:rotate(8deg)} }
      `}</style>
    </div>
  );
};

export default AdminLayout;