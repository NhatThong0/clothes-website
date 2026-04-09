import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@features/auth/hooks/useAuth';
import apiClient from '@features/shared/services/apiClient';
import { getSocket } from '@features/chat/hooks/useChat';

const NAV_SECTIONS = [
  {
    title: 'Tổng quan',
    items: [
      { label: 'Dashboard', icon: 'dashboard', path: '/admin' },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      { label: 'Sản phẩm', icon: 'product', path: '/admin/products' },
      { label: 'Danh mục', icon: 'category', path: '/admin/categories' },
      { label: 'Đơn hàng', icon: 'order', path: '/admin/orders' },
      { label: 'Người dùng', icon: 'user', path: '/admin/users' },
      { label: 'Đánh giá', icon: 'review', path: '/admin/reviews' },
      { label: 'Voucher', icon: 'voucher', path: '/admin/vouchers' },
      { label: 'Banner', icon: 'banner', path: '/admin/banners' },
      { label: 'Kho hàng', icon: 'inventory', path: '/admin/inventory' },
    ],
  },
  {
    title: 'Hỗ trợ',
    items: [
      { label: 'Chat', icon: 'chat', path: '/admin/chat' },
      { label: 'Chatbot AI', icon: 'chatbot', path: '/admin/ai-chat' },
    ],
  },
];

function NavIcon({ name, active }) {
  const iconClassName = active ? 'text-blue-700' : 'text-slate-400 group-hover:text-slate-700';

  switch (name) {
    case 'dashboard':
      return (
        <svg className={`h-[18px] w-[18px] ${iconClassName}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.75 4.75h6.5v6.5h-6.5zm8.5 0h6v4.5h-6zm0 6.5h6v8h-6zm-8.5 2h6v6h-6z" />
        </svg>
      );
    case 'product':
      return (
        <svg className={`h-[18px] w-[18px] ${iconClassName}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3.75l7 3.5-7 3.5-7-3.5 7-3.5zm7 3.5v9.5l-7 3.5-7-3.5v-9.5m7 3.5v9.5" />
        </svg>
      );
    case 'category':
      return (
        <svg className={`h-[18px] w-[18px] ${iconClassName}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 6.5h14M5 12h14M5 17.5h14M3.75 6.5h.01M3.75 12h.01M3.75 17.5h.01" />
        </svg>
      );
    case 'order':
      return (
        <svg className={`h-[18px] w-[18px] ${iconClassName}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7.25h10.25M8 12h10.25M8 16.75h6.25M5.75 7.25h.01M5.75 12h.01M5.75 16.75h.01" />
        </svg>
      );
    case 'user':
      return (
        <svg className={`h-[18px] w-[18px] ${iconClassName}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.5 7.75a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0zM4.75 18a6.25 6.25 0 0112.5 0" />
        </svg>
      );
    case 'review':
      return (
        <svg className={`h-[18px] w-[18px] ${iconClassName}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.75l1.93 3.92 4.32.63-3.13 3.05.74 4.31L12 14.63l-3.86 2.03.74-4.31-3.13-3.05 4.32-.63L12 4.75z" />
        </svg>
      );
    case 'voucher':
      return (
        <svg className={`h-[18px] w-[18px] ${iconClassName}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 6.75h8.75a2 2 0 012 2V11a1.75 1.75 0 010 3.5v2.25a2 2 0 01-2 2H8a2 2 0 01-2-2V14.5a1.75 1.75 0 010-3.5V8.75a2 2 0 012-2zm3-1.5l2 14" />
        </svg>
      );
    case 'banner':
      return (
        <svg className={`h-[18px] w-[18px] ${iconClassName}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5.75 6.75h12.5v10.5H5.75zm3 3.25h6.5m-6.5 3h4.5" />
        </svg>
      );
    case 'inventory':
      return (
        <svg className={`h-[18px] w-[18px] ${iconClassName}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.75 7.25l7.25-3.5 7.25 3.5v9.5L12 20.25l-7.25-3.5zm0 0L12 10.5l7.25-3.25M12 10.5v9.75" />
        </svg>
      );
    case 'chat':
      return (
        <svg className={`h-[18px] w-[18px] ${iconClassName}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6.75 7.75h10.5a2.5 2.5 0 012.5 2.5v4a2.5 2.5 0 01-2.5 2.5h-6l-3.5 2v-2H6.75a2.5 2.5 0 01-2.5-2.5v-4a2.5 2.5 0 012.5-2.5z" />
        </svg>
      );
    case 'chatbot':
      return (
        <svg className={`h-[18px] w-[18px] ${iconClassName}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.25v2.5m-4.75 4.5A2.25 2.25 0 019.5 9h5a2.25 2.25 0 012.25 2.25v4.5A2.25 2.25 0 0114.5 18h-5a2.25 2.25 0 01-2.25-2.25zm1.75.25h6.5M9.5 12.5h.01M14.5 12.5h.01M7.25 9.75H5.5m13 0h-1.75" />
        </svg>
      );
    default:
      return null;
  }
}

const AdminLayout = () => {
  const { adminUser, logout, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifShake, setNotifShake] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const notifDropdownRef = useRef(null);
  const socketRef = useRef(null);

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
    if (!adminUser) return undefined;
    fetchNotifications();

    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) return undefined;

    const socket = getSocket(adminToken);
    socketRef.current = socket;

    if (socket.connected) setIsSocketConnected(true);

    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);

    const handleAdminNotification = (notif) => {
      setNotifications((prev) => [notif, ...prev].slice(0, 30));
      setUnreadCount((prev) => prev + 1);
      setNotifShake(true);
      setTimeout(() => setNotifShake(false), 700);
      try {
        new Audio('/notification-sound.mp3').play().catch(() => {});
      } catch {
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('admin:notification', handleAdminNotification);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('admin:notification', handleAdminNotification);
    };
  }, [adminUser, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markNotifAsRead = async (id) => {
    try {
      await apiClient.put(`/notifications/admin/${id}/read`);
      setNotifications((prev) => prev.map((notification) => (
        notification._id === id ? { ...notification, isRead: true } : notification
      )));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
    }
  };

  const markAllNotifsAsRead = async () => {
    try {
      await apiClient.put('/notifications/admin/read-all');
      setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));
      setUnreadCount(0);
    } catch {
    }
  };

  const handleNotifClick = (notif) => {
    if (!notif.isRead) markNotifAsRead(notif._id);
    if (notif.link) {
      navigate(notif.link);
      setIsNotifOpen(false);
    }
  };

  const deleteNotif = async (event, id) => {
    event.stopPropagation();
    try {
      await apiClient.delete(`/notifications/admin/${id}`);
      setNotifications((prev) => prev.filter((notification) => notification._id !== id));
      if (!notifications.find((notification) => notification._id === id)?.isRead) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    } catch {
    }
  };

  const deleteAllNotifs = async () => {
    try {
      await apiClient.delete('/notifications/admin');
      setNotifications([]);
      setUnreadCount(0);
    } catch {
    }
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

    notifs.forEach((notification) => {
      const group = new Date(notification.createdAt).toDateString() === today ? 'Hôm nay' : 'Trước đó';
      groups[group].push(notification);
    });

    return Object.fromEntries(Object.entries(groups).filter(([, items]) => items.length > 0));
  };

  const NOTIF_COLORS = {
    blue: { bg: 'bg-blue-50 text-blue-600', dot: 'bg-blue-600' },
    green: { bg: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-600' },
    orange: { bg: 'bg-orange-50 text-orange-600', dot: 'bg-orange-600' },
    red: { bg: 'bg-rose-50 text-rose-600', dot: 'bg-rose-600' },
    purple: { bg: 'bg-purple-50 text-purple-600', dot: 'bg-purple-600' },
    slate: { bg: 'bg-slate-50 text-slate-600', dot: 'bg-slate-600' },
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" />
          <p className="text-sm font-medium tracking-wide text-slate-400">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!adminUser || adminUser.role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = () => {
    logout('admin');
    navigate('/admin/login');
  };

  const isActive = (path) => (
    path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path)
  );

  const initials = adminUser?.name
    ? adminUser.name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase()
    : 'AD';

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-white">
      <div className={`flex h-16 flex-shrink-0 items-center border-b border-slate-100 px-5 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#0f172a_0%,#1e3a8a_100%)] shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
          <span className="text-sm font-black tracking-tight text-white">F</span>
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-black leading-none tracking-tight text-slate-900">DaClothes</p>
            <p className="mt-0.5 text-[10px] font-bold leading-none tracking-[0.24em] text-blue-600">ADMIN</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : undefined}
                    className={`group relative flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-all duration-150 ${
                      active
                        ? 'bg-[linear-gradient(180deg,#eff6ff_0%,#e0ecff_100%)] text-blue-900 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.22),0_10px_24px_rgba(37,99,235,0.08)]'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <span className="flex-shrink-0">
                      <NavIcon name={item.icon} active={active} />
                    </span>
                    {!collapsed && (
                      <span className="truncate text-sm font-semibold">{item.label}</span>
                    )}
                    {active && !collapsed && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-blue-700 shadow-[0_0_0_4px_rgba(59,130,246,0.12)]" />
                    )}
                    {collapsed && (
                      <div className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-xl bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                        {item.label}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mx-3 border-t border-slate-100" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside
        className={`fixed z-40 hidden h-full flex-col border-r border-slate-100 bg-white shadow-sm transition-all duration-300 lg:flex ${
          collapsed ? 'w-[76px]' : 'w-60'
        }`}
      >
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 z-50 flex h-full w-60 flex-col border-r border-slate-100 bg-white shadow-xl lg:hidden">
            <SidebarContent />
          </aside>
        </>
      )}

      <main className={`flex flex-1 flex-col transition-all duration-300 ${collapsed ? 'lg:ml-[76px]' : 'lg:ml-60'}`}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-slate-100 bg-white px-4 shadow-sm lg:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 lg:hidden"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <button
            onClick={() => setCollapsed((value) => !value)}
            className="hidden rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 lg:flex"
            title={collapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            <svg
              className={`h-4 w-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex-1">
            <nav className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="font-medium text-blue-600">Admin</span>
              <span>/</span>
              <span className="capitalize font-semibold text-slate-700">
                {NAV_SECTIONS.flatMap((section) => section.items).find((item) => isActive(item.path))?.label || 'Dashboard'}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative" ref={notifDropdownRef}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`relative rounded-xl p-2.5 text-slate-600 transition-all hover:bg-blue-50 hover:text-blue-600 ${notifShake ? 'animate-[shake_.5s_ease]' : ''}`}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black leading-none text-white shadow-sm">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div
                  className="absolute right-0 z-50 mt-2 flex max-h-[80vh] w-[360px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
                  style={{ animation: 'dropDown .18s ease' }}
                >
                  <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">Thông báo</h3>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                          {unreadCount}
                        </span>
                      )}
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSocketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`}
                        title={isSocketConnected ? 'Đang kết nối thời gian thực' : 'Ngoại tuyến'}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button onClick={markAllNotifsAsRead} className="rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700">
                          Đọc tất cả
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button onClick={deleteAllNotifs} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500">
                          Xóa tất cả
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-4 py-12">
                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">🔔</div>
                        <p className="text-sm font-semibold text-slate-500">Chưa có thông báo nào</p>
                        <p className="mt-1 text-center text-xs text-slate-400">Các tin về đơn hàng và người dùng mới sẽ xuất hiện ở đây</p>
                      </div>
                    ) : (
                      Object.entries(groupNotifications(notifications)).map(([group, items]) => (
                        <div key={group}>
                          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{group}</p>
                          </div>
                          {items.map((notif) => {
                            const color = NOTIF_COLORS[notif.color] || NOTIF_COLORS.blue;

                            return (
                              <div
                                key={notif._id}
                                onClick={() => handleNotifClick(notif)}
                                className={`group relative flex cursor-pointer gap-3 border-b border-slate-50 px-4 py-3.5 transition-colors ${
                                  notif.isRead ? 'hover:bg-slate-50' : 'bg-blue-50/40 hover:bg-blue-50/70'
                                }`}
                              >
                                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-lg shadow-sm ${color.bg}`}>
                                  {notif.icon || '🔔'}
                                </div>
                                <div className="min-w-0 flex-1 pr-6">
                                  <p className={`text-xs font-bold leading-snug ${notif.isRead ? 'text-slate-700' : 'text-slate-900'}`}>{notif.title}</p>
                                  <p className={`mt-0.5 text-[11px] leading-relaxed ${notif.isRead ? 'text-slate-400' : 'text-slate-600'}`}>{notif.message}</p>
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <span className="text-[10px] font-medium text-slate-400">{timeAgo(notif.createdAt)}</span>
                                    {!notif.isRead && <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${color.dot}`} />}
                                  </div>
                                </div>
                                {!notif.isRead && <div className={`absolute right-9 top-4 h-2 w-2 rounded-full ${color.dot} shadow-[0_0_8px_rgba(37,99,235,0.4)]`} />}
                                <button
                                  onClick={(event) => deleteNotif(event, notif._id)}
                                  className="absolute right-3 top-3.5 flex h-6 w-6 items-center justify-center rounded-full text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border-t border-slate-100 bg-slate-50/50 p-2">
                    <button
                      onClick={() => {
                        navigate('/admin/orders');
                        setIsNotifOpen(false);
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 text-[11px] font-bold text-slate-500 shadow-sm transition-colors hover:bg-slate-100"
                    >
                      Xem tất cả đơn hàng
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-l border-slate-100 pl-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-xs font-bold text-white">
                {initials}
              </div>
              <div className="hidden min-w-0 flex-col leading-tight md:flex">
                <span className="max-w-[220px] truncate text-sm font-semibold text-slate-700">{adminUser?.name}</span>
                <span className="max-w-[220px] truncate text-[11px] text-slate-400">{adminUser?.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="ml-1 rounded-xl border border-transparent px-3 py-1.5 text-xs font-semibold text-rose-500 transition-colors hover:border-rose-200 hover:bg-rose-50"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <Outlet />
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
