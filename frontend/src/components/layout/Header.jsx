import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@features/auth/hooks/useAuth';
import { useCart } from '@features/cart/hooks/useCart';
import { productAPI } from '@features/shared/services/api';
import apiClient from '@features/shared/services/apiClient';
import { getSocket } from '@features/chat/hooks/useChat';
import TierImageBadge from '@components/common/TierImageBadge';

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}

const NAV_LINKS = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Cửa hàng', href: '/products' },
  { label: 'Khuyến mãi', href: '/products?type=sale' },
];

const NOTIF_COLORS = {
  blue: 'bg-slate-100 text-slate-700',
  green: 'bg-[#eef3eb] text-slate-700',
  sky: 'bg-[#eff3f4] text-slate-700',
  orange: 'bg-[#f5efe8] text-slate-700',
  red: 'bg-[#f5ebeb] text-slate-700',
  purple: 'bg-[#f1eef4] text-slate-700',
  slate: 'bg-slate-100 text-slate-700',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function UserAvatar({ user, size = 36, textSize = 13 }) {
  const [imgError, setImgError] = useState(false);
  const initials = (user?.name || user?.email || 'U')[0].toUpperCase();

  if (user?.avatar && !imgError) {
    return (
      <img
        src={user.avatar}
        alt={user.name || 'avatar'}
        onError={() => setImgError(true)}
        className="rounded-full object-cover border border-black/10"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full border border-black/10 bg-black text-white"
      style={{ width: size, height: size, fontSize: textSize }}
    >
      <span className="font-bold">{initials}</span>
    </div>
  );
}

function UserTierLine({ user }) {
  const tier = user?.loyalty?.tier;
  if (!tier?.name) {
    return <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Thành viên</p>;
  }

  return (
    <div className="mt-1">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Hạng thành viên</p>
      <p className="font-bold text-slate-700">{tier.name}</p>
      

    </div>
  );
}

function UserTierIcon({ user }) {
  const tier = user?.loyalty?.tier;
  if (!tier?.name) return null;

  return (
    <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-full border border-black/8 bg-[linear-gradient(135deg,#ffffff_0%,#f7f4ef_100%)] shadow-[0_12px_26px_rgba(15,23,42,0.08)]">
      <TierImageBadge tier={tier} size="md" showLabel={false} variant="icon" />
    </div>
  );
}

function SearchBox({ onClose, compact = false }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 320);

  useEffect(() => {
    if (compact) {
      inputRef.current?.focus();
    }
  }, [compact]);

  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await productAPI.getAllProducts({ search: debouncedQuery, limit: 6 });
        const data = response.data?.data || response.data || [];
        const list = Array.isArray(data) ? data : data.products || [];
        setResults(list.slice(0, 6));
        setOpen(true);
        setActiveIndex(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!dropdownRef.current?.contains(event.target) && !inputRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goToSearch = (value = query) => {
    if (!value.trim()) return;
    navigate(`/products?search=${encodeURIComponent(value.trim())}`);
    setOpen(false);
    setQuery('');
    onClose?.();
  };

  const goToProduct = (id) => {
    navigate(`/products/${id}`);
    setOpen(false);
    setQuery('');
    onClose?.();
  };

  const handleKeyDown = (event) => {
    if (!open || results.length === 0) {
      if (event.key === 'Enter') goToSearch();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0) {
        goToProduct(results[activeIndex]._id || results[activeIndex].id);
      } else {
        goToSearch();
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const formatPrice = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

  return (
    <div className="relative w-full">
      <div className="editorial-panel flex items-center gap-3 rounded-full px-4 py-2.5">
        {loading ? (
          <div className="h-4 w-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
        ) : (
          <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35m1.35-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!event.target.value.trim()) {
              setOpen(false);
              setResults([]);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Tìm kiếm sản phẩm, danh mục, phong cách..."
          className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />

        {query && (
          <button
            onClick={() => {
              setQuery('');
              setOpen(false);
              setResults([]);
              inputRef.current?.focus();
            }}
            className="rounded-full p-1 text-slate-400 transition hover:bg-black/5 hover:text-black"
            aria-label="Xóa từ khóa tìm kiếm"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <button
          onClick={() => goToSearch()}
          className="rounded-full bg-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white transition hover:bg-[#242424]"
        >
          Tìm
        </button>
      </div>

      {open && (
        <div ref={dropdownRef} className="editorial-card absolute inset-x-0 top-full z-50 mt-3 overflow-hidden rounded-[28px]">
          {results.length === 0 && !loading ? (
            <div className="px-6 py-6 text-center text-sm text-slate-500">
              Không tìm thấy sản phẩm cho <span className="font-semibold text-black">&quot;{query}&quot;</span>
            </div>
          ) : (
            <>
              <div className="border-b border-black/6 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Gợi ý nhanh
              </div>

              <ul>
                {results.map((product, index) => {
                  const id = product._id || product.id;
                  const currentPrice = product.discount > 0 ? Math.round(product.price * (1 - product.discount / 100)) : product.price;
                  const image = product.images?.[0] || 'https://placehold.co/80x80?text=?';
                  const active = index === activeIndex;

                  return (
                    <li key={id}>
                      <button
                        onMouseDown={() => goToProduct(id)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={`flex w-full items-center gap-4 px-5 py-4 text-left transition ${active ? 'bg-black text-white' : 'hover:bg-[#f4f4f1]'}`}
                      >
                        <div className="h-14 w-14 overflow-hidden rounded-2xl bg-[#efefea]">
                          <img src={image} alt={product.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-semibold ${active ? 'text-white' : 'text-slate-800'}`}>
                            {product.name}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className={`text-sm font-bold ${active ? 'text-white' : 'text-black'}`}>
                              {formatPrice(currentPrice)}
                            </span>
                            {product.discount > 0 && (
                              <span className={`text-xs ${active ? 'text-white/70' : 'text-slate-400 line-through'}`}>
                                {formatPrice(product.price)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-400'}`}>Xem</span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <button
                onMouseDown={() => goToSearch()}
                className="flex w-full items-center justify-center gap-2 border-t border-black/6 px-5 py-4 text-sm font-semibold text-black transition hover:bg-[#f4f4f1]"
              >
                Xem tất cả kết quả cho &quot;{query}&quot;
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
    <Link to="/" className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-[#f2f2ef]">
        {!logoError ? (
          <img src={LOGO_SRC} alt="DaClothes Logo" onError={() => setLogoError(true)} className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-extrabold tracking-[0.2em] text-black">DC</span>
        )}
      </div>
      <div className="hidden sm:block">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Thời trang</p>
        <p className="text-lg font-extrabold tracking-[-0.03em] text-black">DaClothes</p>
      </div>
    </Link>
  );
}

function NotificationBell({ user }) {
  const navigate = useNavigate();
  const bellRef = useRef(null);
  const dropdownRef = useRef(null);
  const socketRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    const uid = user?._id || user?.id;
    if (!uid) return undefined;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return undefined;

    const socket = getSocket(token);
    socketRef.current = socket;

    const handleNotification = (notification) => {
      setNotifications((previous) => {
        if (previous.find((item) => item._id === notification._id)) return previous;
        return [notification, ...previous];
      });
      setUnreadCount((count) => count + 1);
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [user?._id]);

  useEffect(() => {
    if (!user) return;
    apiClient
      .get('/notifications/unread-count')
      .then((response) => setUnreadCount(response.data?.data?.unreadCount ?? 0))
      .catch(() => {});
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/notifications?limit=30');
      const data = response.data?.data;
      setNotifications(data?.notifications || []);
      setUnreadCount(data?.unreadCount ?? 0);
      setHasFetched(true);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!bellRef.current?.contains(event.target) && !dropdownRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openMenu = () => {
    if (!open) fetchNotifications();
    setOpen((value) => !value);
  };

  const handleMarkRead = async (id) => {
    setNotifications((previous) => previous.map((item) => (item._id === id ? { ...item, isRead: true } : item)));
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await apiClient.put(`/notifications/${id}/read`);
    } catch {}
  };

  const handleMarkAllRead = async () => {
    setNotifications((previous) => previous.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    try {
      await apiClient.put('/notifications/read-all');
    } catch {}
  };

  const handleClick = (notification) => {
    if (!notification.isRead) handleMarkRead(notification._id);
    if (notification.link) {
      navigate(notification.link);
      setOpen(false);
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={openMenu}
        className="relative rounded-full border border-black/8 bg-white p-3 text-slate-700 transition hover:border-black/15 hover:bg-[#f4f4f1]"
        aria-label="Thông báo"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.4-1.4a2.03 2.03 0 01-.6-1.44V11a6 6 0 10-12 0v3.16c0 .54-.21 1.06-.59 1.44L4 17h5m6 0a3 3 0 11-6 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-[20px] items-center justify-center rounded-full bg-black px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div ref={dropdownRef} className="editorial-card absolute right-0 z-50 mt-3 flex max-h-[78vh] w-[360px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[28px]">
          <div className="flex items-center justify-between border-b border-black/6 px-5 py-4">
            <div>
              <p className="text-sm font-bold text-black">Thông báo</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">
                {socketRef.current?.connected ? 'Đang kết nối trực tiếp' : 'Đồng bộ ngoại tuyến'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs font-semibold text-slate-500 transition hover:text-black">
                Đọc tất cả
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && !hasFetched ? (
              <div className="flex items-center justify-center py-14">
                <div className="h-6 w-6 rounded-full border-2 border-black border-t-transparent animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-sm font-semibold text-slate-600">Chưa có thông báo nào</p>
                <p className="mt-2 text-sm text-slate-400">Đơn hàng, voucher và cập nhật hệ thống sẽ hiển thị tại đây.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification._id}
                  onClick={() => handleClick(notification)}
                  className={`flex w-full items-start gap-4 border-b border-black/6 px-5 py-4 text-left transition hover:bg-[#f4f4f1] ${
                    notification.isRead ? 'bg-white' : 'bg-[#f8f8f5]'
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm ${NOTIF_COLORS[notification.color] || NOTIF_COLORS.slate}`}>
                    {notification.icon || '•'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-black">{notification.title}</p>
                      {!notification.isRead && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-black" />}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{notification.message}</p>
                    <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                      {timeAgo(notification.createdAt)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { getTotalItems } = useCart();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);

  const handleLogout = () => {
    logout('user');
    navigate('/');
    setIsUserMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-black/6 bg-[rgba(255,255,255,0.92)] backdrop-blur-xl">
      <div className="border-b border-black/6 bg-[#f4f4f1]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 sm:px-6 lg:px-8">
          <span>Thời trang Daclothes</span>
          
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[82px] items-center justify-between gap-4">
          <div className="flex items-center gap-6 lg:gap-10">
            <Logo />
            <nav className="hidden items-center gap-2 lg:flex">
              {NAV_LINKS.map((link) => {
                const active =
                  link.href === '/'
                    ? location.pathname === '/'
                    : location.pathname + location.search === link.href ||
                      (link.href.includes('?') && location.pathname === link.href.split('?')[0] && location.search === `?${link.href.split('?')[1]}`);

                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                      active ? 'bg-black text-white' : 'text-slate-600 hover:bg-[#f4f4f1] hover:text-black'
                    }`}
                  >
                    <span>{link.label}</span>
                    {link.badge && (
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${active ? 'bg-white/12 text-white' : 'bg-black text-white'}`}>
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="hidden max-w-xl flex-1 lg:block">
            <SearchBox />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileSearch((value) => !value)}
              className="rounded-full border border-black/8 bg-white p-3 text-slate-700 transition hover:border-black/15 hover:bg-[#f4f4f1] lg:hidden"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35m1.35-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {user && <NotificationBell user={user} />}

            <Link
              to="/cart"
              className="relative rounded-full border border-black/8 bg-white p-3 text-slate-700 transition hover:border-black/15 hover:bg-[#f4f4f1]"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.29 2.29a1 1 0 00.71 1.71H17m0 0a2 2 0 110 4 2 2 0 010-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {getTotalItems() > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-white/25 bg-black/95 px-1 text-[10px] font-bold text-white shadow-[0_10px_24px_rgba(0,0,0,0.28)] [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]">
                  {getTotalItems() > 9 ? '9+' : getTotalItems()}
                </span>
              )}
            </Link>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen((value) => !value)}
                  className="flex items-center gap-3 rounded-full border border-black/8 bg-white px-2.5 py-2 transition hover:border-black/15 hover:bg-[#f4f4f1]"
                >
                  <UserAvatar user={user} />
                  <div className="hidden text-left sm:block">
                    <p className="max-w-[110px] truncate text-sm font-semibold text-black">{user.name || user.email}</p>
                    {user.role === 'admin' ? (
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Admin</p>
                    ) : (
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Thành viên</p>
                    )}
                  </div>
                  {user.role !== 'admin' && <UserTierIcon user={user} />}
                </button>

                {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)} />
                    <div className="editorial-card absolute right-0 z-20 mt-3 w-64 overflow-hidden rounded-[28px]">
                      <div className="border-b border-black/6 px-5 py-4">
                        <p className="truncate text-sm font-semibold text-black">{user.name || user.email}</p>
                        {user.role === 'admin' ? (
                          <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-400">Quyền admin</p>
                        ) : (
                          <div className="mt-2">
                            <UserTierLine user={user} />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        {user.role === 'admin' && (
                          <Link to="/admin" onClick={() => setIsUserMenuOpen(false)} className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-[#f4f4f1] hover:text-black">
                            Quản trị
                          </Link>
                        )}
                        <Link to="/profile" onClick={() => setIsUserMenuOpen(false)} className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-[#f4f4f1] hover:text-black">
                          Tài khoản của tôi
                        </Link>
                        <Link to="/orders" onClick={() => setIsUserMenuOpen(false)} className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-[#f4f4f1] hover:text-black">
                          Đơn hàng
                        </Link>
                        <button onClick={handleLogout} className="mt-1 block w-full rounded-2xl px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-[#f4f4f1] hover:text-black">
                          Đăng xuất
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link to="/auth/login" className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#242424]">
                Đăng nhập
              </Link>
            )}

            <button
              onClick={() => setIsMenuOpen((value) => !value)}
              className="rounded-full border border-black/8 bg-white p-3 text-slate-700 transition hover:border-black/15 hover:bg-[#f4f4f1] lg:hidden"
            >
              {isMenuOpen ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {mobileSearch && (
          <div className="border-t border-black/6 pb-4 pt-2 lg:hidden">
            <SearchBox compact onClose={() => setMobileSearch(false)} />
          </div>
        )}

        {isMenuOpen && (
          <div className="border-t border-black/6 pb-4 pt-3 lg:hidden">
            <div className="grid gap-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-[#f4f4f1] hover:text-black"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
