import { useAuth } from '@hooks/useAuth';
import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';

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
];

const AdminLayout = () => {
  const { adminUser, logout, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

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
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-slate-200 hover:border-blue-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
              Trang chủ
            </Link>

            {/* Avatar + logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-100">
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
        * { -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
      `}</style>
    </div>
  );
};

export default AdminLayout;