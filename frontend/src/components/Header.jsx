import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { useCart } from '@hooks/useCart';
import { productAPI } from '@services/api';


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
  { label: 'Khuyến mãi', href: '/products?type=sale', badge: { label:'HOT', cls:'bg-rose-500'    } },
];

// ── Avatar component ──────────────────────────────────────────────────────────
function UserAvatar({ user, size = 7, textSize = 'text-xs' }) {
  const [imgError, setImgError] = useState(false);
  const initials = (user?.name || user?.email || 'U')[0].toUpperCase();

  if (user?.avatar && !imgError) {
    return (
      <img
        src={user.avatar}
        alt={user.name || 'avatar'}
        onError={() => setImgError(true)}
        className={`w-${size} h-${size} rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0`}
      />
    );
  }

  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white ${textSize} font-black flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ── SearchBox component ───────────────────────────────────────────────────────
function SearchBox({ onClose }) {
  const navigate          = useNavigate();
  const inputRef          = useRef(null);
  const dropdownRef       = useRef(null);
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [open,      setOpen]      = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debouncedQuery = useDebounce(query, 320);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
      setResults([]); setOpen(false); return;
    }
    const fetch = async () => {
      setLoading(true);
      try {
        const res  = await productAPI.getAllProducts({ search: debouncedQuery, limit: 6 });
        const data = res.data?.data || res.data || [];
        const list = Array.isArray(data) ? data : (data.products || []);
        setResults(list.slice(0, 6));
        setOpen(true);
        setActiveIdx(-1);
      } catch { setResults([]); }
      finally { setLoading(false); }
    };
    fetch();
  }, [debouncedQuery]);

  const goToSearch = (q = query) => {
    if (!q.trim()) return;
    navigate(`/products?search=${encodeURIComponent(q.trim())}`);
    setQuery(''); setOpen(false);
    onClose?.();
  };

  const goToProduct = (id) => {
    navigate(`/products/${id}`);
    setQuery(''); setOpen(false);
    onClose?.();
  };

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) {
      if (e.key === 'Enter') goToSearch();
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIdx >= 0) goToProduct(results[activeIdx]._id || results[activeIdx].id); else goToSearch(); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  useEffect(() => {
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const highlight = (text, q) => {
    if (!q.trim()) return text;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 text-slate-900 rounded">$1</mark>');
  };

  const fmtPrice = v => new Intl.NumberFormat('vi-VN', { style:'currency', currency:'VND' }).format(v);

  return (
    <div className="relative w-full">
      <div className={`flex items-center gap-2 px-4 py-2.5 border-2 rounded-2xl bg-white transition-all ${
        open ? 'border-blue-500 shadow-lg shadow-blue-100' : 'border-slate-200'
      }`}>
        {loading
          ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
          : <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
        }
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); if (!e.target.value.trim()) { setOpen(false); setResults([]); } }}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Tìm tên sản phẩm..."
          className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); setResults([]); inputRef.current?.focus(); }}
            className="p-0.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        )}
        <button onClick={() => goToSearch()}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex-shrink-0">
          Tìm
        </button>
      </div>

      {open && (
        <div ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50"
          style={{ animation: 'dropDown .15s ease' }}>
          {results.length === 0 && !loading ? (
            <div className="px-5 py-4 text-sm text-slate-400 text-center">
              Không tìm thấy sản phẩm nào cho "<span className="font-semibold text-slate-600">{query}</span>"
            </div>
          ) : (
            <>
              <div className="px-4 py-2 border-b border-slate-50">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Gợi ý sản phẩm</p>
              </div>
              <ul>
                {results.map((product, idx) => {
                  const pid    = product._id || product.id;
                  const price  = product.discount > 0 ? Math.round(product.price * (1 - product.discount / 100)) : product.price;
                  const img    = product.images?.[0] || 'https://placehold.co/80x80?text=?';
                  const active = idx === activeIdx;
                  return (
                    <li key={pid}>
                      <button
                        onMouseDown={() => goToProduct(pid)}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${active ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                          <img src={img} alt={product.name} className="w-full h-full object-cover"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate"
                            dangerouslySetInnerHTML={{ __html: highlight(product.name, query) }}/>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm font-bold text-blue-600">{fmtPrice(price)}</span>
                            {product.discount > 0 && (
                              <>
                                <span className="text-xs text-slate-400 line-through">{fmtPrice(product.price)}</span>
                                <span className="text-[10px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded-full">−{product.discount}%</span>
                              </>
                            )}
                          </div>
                          {product.category?.name && <p className="text-[11px] text-slate-400 mt-0.5">{product.category.name}</p>}
                        </div>
                        <svg className={`w-4 h-4 flex-shrink-0 transition-colors ${active ? 'text-blue-500' : 'text-slate-300'}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button onMouseDown={() => goToSearch()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-t border-slate-100 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                Xem tất cả kết quả cho "<span className="font-bold">{query}</span>"
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── LOGO ──────────────────────────────────────────────────────────────────────
// Đặt file logo vào public/logo.png hoặc src/assets/logo.png
// Nếu không có file logo thì sẽ fallback về chữ "F"
const LOGO_SRC = '/Daclothes.png'; // ✅ Thay đường dẫn logo của bạn ở đây

function Logo() {
  const [logoError, setLogoError] = useState(false);

  return (
    <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
      <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
        {!logoError ? (
          <img
            src={LOGO_SRC}
            alt="DaClothes Logo"
            onError={() => setLogoError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Fallback: gradient với chữ F */
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm">
            <span className="text-white font-black text-base">DC</span>
          </div>
        )}
      </div>
      <span className="hidden sm:inline font-black text-lg text-slate-800 tracking-tight">DaClothes</span>
    </Link>
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

  const handleLogout = () => {
    logout('user');
    navigate('/');
    setIsUserMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between h-16 gap-4">

          {/* Logo */}
          <Logo/>

          {/* Search — desktop */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <SearchBox/>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 flex-shrink-0">

            {/* Mobile search toggle */}
            <button onClick={() => setMobileSearch(v => !v)}
              className="md:hidden p-2.5 text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </button>

            {/* Cart */}
            <Link to="/cart" className="relative p-2.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
              {getTotalItems() > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-blue-600 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                  {getTotalItems() > 9 ? '9+' : getTotalItems()}
                </span>
              )}
            </Link>

            {/* User menu */}
            {user ? (
              <div className="relative">
                <button onClick={() => setIsUserMenuOpen(v => !v)}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-xl transition-all">
                  {/* ✅ Avatar ảnh hoặc fallback chữ cái */}
                  <UserAvatar user={user} size={8} textSize="text-xs"/>
                  <span className="hidden sm:inline text-sm font-semibold text-slate-700 max-w-[80px] truncate">
                    {user.name || user.email}
                  </span>
                  <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform hidden sm:block ${isUserMenuOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>

                {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)}/>
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-20"
                      style={{ animation: 'dropDown .15s ease' }}>

                      {/* User info header */}
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                        <UserAvatar user={user} size={10} textSize="text-sm"/>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{user.name || user.email}</p>
                          {user.role === 'admin'
                            ? <p className="text-xs text-blue-600 font-semibold mt-0.5">👑 Quản trị viên</p>
                            : <p className="text-xs text-slate-400 mt-0.5 truncate">{user.email}</p>
                          }
                        </div>
                      </div>

                      {user.role === 'admin' && (
                        <>
                          <Link to="/admin"
                            className="flex items-center gap-2 px-4 py-2.5 text-blue-600 hover:bg-blue-50 text-sm font-semibold transition-colors"
                            onClick={() => setIsUserMenuOpen(false)}>
                            <span>⚙️</span> Admin Portal
                          </Link>
                          <div className="border-t border-slate-100 my-1"/>
                        </>
                      )}

                      <Link to="/profile"
                        className="flex items-center gap-2 px-4 py-2.5 text-slate-700 hover:bg-slate-50 text-sm transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}>
                        <span>👤</span> Tài khoản của tôi
                      </Link>
                      <Link to="/orders"
                        className="flex items-center gap-2 px-4 py-2.5 text-slate-700 hover:bg-slate-50 text-sm transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}>
                        <span>📦</span> Đơn hàng
                      </Link>
                      <div className="border-t border-slate-100 my-1"/>
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-rose-500 hover:bg-rose-50 text-sm font-semibold transition-colors">
                        <span>🚪</span> Đăng xuất
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link to="/auth/login"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors">
                Đăng nhập
              </Link>
            )}

            {/* Mobile hamburger */}
            <button onClick={() => setIsMenuOpen(v => !v)}
              className="md:hidden p-2.5 text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
              {isMenuOpen
                ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
              }
            </button>
          </div>
        </div>

        {/* ── Mobile search bar ── */}
        {mobileSearch && (
          <div className="md:hidden pb-3 px-1" style={{ animation: 'dropDown .15s ease' }}>
            <SearchBox onClose={() => setMobileSearch(false)}/>
          </div>
        )}

        {/* ── Desktop nav ── */}
        <nav className="hidden md:flex border-t border-slate-100 gap-1">
          {NAV_LINKS.map(link => {
            const active = link.href === '/'
              ? location.pathname === '/'
              : location.pathname + location.search === link.href
                || (link.href.includes('?') && location.search === `?${link.href.split('?')[1]}`);
            return (
              <Link key={link.href} to={link.href}
                className={`relative flex items-center gap-1.5 py-3.5 px-4 text-sm font-semibold transition-colors ${
                  active ? 'text-blue-600' : 'text-slate-600 hover:text-blue-600'
                }`}>
                {link.label}
                {link.badge && (
                  <span className={`text-[10px] font-black text-white px-1.5 py-0.5 rounded-full ${link.badge.cls}`}>
                    {link.badge.label}
                  </span>
                )}
                {active && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-600 rounded-full"/>}
              </Link>
            );
          })}
        </nav>

        {/* ── Mobile menu ── */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-100 py-3 space-y-0.5" style={{ animation: 'dropDown .15s ease' }}>
            {NAV_LINKS.map(link => (
              <Link key={link.href} to={link.href}
                className="flex items-center justify-between px-4 py-2.5 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors"
                onClick={() => setIsMenuOpen(false)}>
                <span>{link.label}</span>
                {link.badge && (
                  <span className={`text-[10px] font-black text-white px-1.5 py-0.5 rounded-full ${link.badge.cls}`}>
                    {link.badge.label}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes dropDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </header>
  );
}