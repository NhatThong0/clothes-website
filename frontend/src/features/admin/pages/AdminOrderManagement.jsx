import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAdmin } from '@features/admin/hooks/useAdmin';
import { Link } from 'react-router-dom';
import apiClient from '@features/shared/services/apiClient';

const STATUSES = ['pending','confirmed','shipped','delivered','return_requested','returned','cancelled'];

const STATUS_CFG = {
  pending:          { label: 'Chờ xác nhận',   dot: '#F59E0B', bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  confirmed:        { label: 'Đã xác nhận',    dot: '#3B82F6', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  shipped:          { label: 'Đang giao',      dot: '#06B6D4', bg: '#ECFEFF', text: '#164E63', border: '#A5F3FC' },
  delivered:        { label: 'Đã giao',        dot: '#10B981', bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  return_requested: { label: 'Yêu cầu HT',    dot: '#F97316', bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA' },
  returned:         { label: 'Hoàn trả xong',  dot: '#6B7280', bg: '#F9FAFB', text: '#374151', border: '#E5E7EB' },
  cancelled:        { label: 'Đã hủy',         dot: '#EF4444', bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
};
const sc  = s => STATUS_CFG[s] || { label: s, dot: '#94A3B8', bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' };
const fmt = v => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);

// ── Inline action button config (list view — compact) ────────────────────────
const INLINE_ACTION = {
  pending: {
    label: '✓ Xác nhận',
    nextStatus: 'confirmed',
    color: 'bg-blue-600 hover:bg-blue-700 text-white',
    confirmMsg: 'Xác nhận đơn hàng này?',
  },
  confirmed: {
    label: '🚚 Giao hàng',
    nextStatus: 'shipped',
    color: 'bg-cyan-600 hover:bg-cyan-700 text-white',
    confirmMsg: 'Bắt đầu giao hàng?',
  },
  shipped: {
    label: '✅ Hoàn thành',
    nextStatus: 'delivered',
    color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    confirmMsg: 'Xác nhận giao hàng thành công?',
  },
  return_requested: {
    label: '↩️ Xác nhận HT',
    color: 'bg-orange-500 hover:bg-orange-600 text-white',
    confirmMsg: 'Xác nhận đã nhận hàng hoàn trả?',
    useConfirmReturnApi: true,
  },
};

const PRESETS = [
  { label: 'Hôm nay',   days: 0  },
  { label: '7 ngày',    days: 7  },
  { label: '30 ngày',   days: 30 },
  { label: 'Tháng này', days: -1 },
  { label: 'Năm nay',   days: -2 },
];

function getPresetDates(days) {
  const now = new Date();
  let start = new Date(now);
  if      (days === 0)  { start.setHours(0,0,0,0); }
  else if (days === -1) { start = new Date(now.getFullYear(), now.getMonth(), 1); }
  else if (days === -2) { start = new Date(now.getFullYear(), 0, 1); }
  else                  { start.setDate(now.getDate() - days); start.setHours(0,0,0,0); }
  return {
    from: start.toISOString().slice(0,10),
    to:   now.toISOString().slice(0,10),
  };
}

function StatusBadge({ status }) {
  const c = sc(status);
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }}/>
      {c.label}
    </span>
  );
}

// ── Inline quick-action button ────────────────────────────────────────────────
function QuickActionBtn({ order, onDone }) {
  const action = INLINE_ACTION[order.status];
  const [busy, setBusy] = useState(false);
  const { updateOrderStatus } = useAdmin ? useAdmin() : {};

  if (!action) return null;

  const handle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(action.confirmMsg)) return;
    setBusy(true);
    try {
      if (action.useConfirmReturnApi) {
        await apiClient.put(`/admin/orders/${order._id}/confirm-return`);
      } else {
        await updateOrderStatus(order._id, { status: action.nextStatus });
      }
      onDone?.();
    } catch (err) {
      alert(err?.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handle}
      disabled={busy}
      className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap ${action.color}`}
    >
      {busy
        ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>
        : action.label}
    </button>
  );
}

const AdminOrderManagement = () => {
  const { fetchAdminOrders, updateOrderStatus, loading } = useAdmin();

  const [orders,       setOrders]       = useState([]);
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalOrders,  setTotalOrders]  = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput,  setSearchInput]  = useState('');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [activePreset, setActivePreset] = useState(null);

  const loadOrders = useCallback(async (overrides = {}) => {
    const params = { page: overrides.page ?? page, limit: 10 };
    const s  = overrides.status   !== undefined ? overrides.status   : statusFilter;
    const q  = overrides.search   !== undefined ? overrides.search   : searchQuery;
    const df = overrides.dateFrom !== undefined ? overrides.dateFrom : dateFrom;
    const dt = overrides.dateTo   !== undefined ? overrides.dateTo   : dateTo;
    if (s)  params.status   = s;
    if (q)  params.search   = q;
    if (df) params.dateFrom = df;
    if (dt) params.dateTo   = dt;
    const data = await fetchAdminOrders(params);
    if (data) {
      setOrders(data.orders || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalOrders(data.pagination?.total || 0);
    }
  }, [page, statusFilter, searchQuery, dateFrom, dateTo, fetchAdminOrders]);

  useEffect(() => { loadOrders(); }, [page]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
      loadOrders({ search: searchInput, page: 1 });
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleStatusFilter = (s) => { setStatusFilter(s); setPage(1); loadOrders({ status: s, page: 1 }); };
  const applyPreset = (preset) => {
    const { from, to } = getPresetDates(preset.days);
    setActivePreset(preset.days); setDateFrom(from); setDateTo(to); setPage(1);
    loadOrders({ dateFrom: from, dateTo: to, page: 1 });
  };
  const handleDateFrom = (v) => { setDateFrom(v); setActivePreset(null); setPage(1); loadOrders({ dateFrom: v, page: 1 }); };
  const handleDateTo   = (v) => { setDateTo(v);   setActivePreset(null); setPage(1); loadOrders({ dateTo: v,   page: 1 }); };
  const clearAll = () => {
    setStatusFilter(''); setSearchInput(''); setSearchQuery('');
    setDateFrom(''); setDateTo(''); setActivePreset(null); setPage(1);
    loadOrders({ status: '', search: '', dateFrom: '', dateTo: '', page: 1 });
  };

  const hasFilters = statusFilter || searchQuery || dateFrom || dateTo;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Quản lý Đơn hàng</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {hasFilters ? `${totalOrders} kết quả` : `${totalOrders} đơn hàng`}
            </p>
          </div>

          {/* Status pills — desktop */}
          <div className="hidden xl:flex items-center gap-1.5 flex-wrap">
            <button onClick={() => handleStatusFilter('')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                statusFilter === ''
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
              }`}>Tất cả</button>
            {STATUSES.map(s => {
              const c = sc(s); const active = statusFilter === s;
              return (
                <button key={s} onClick={() => handleStatusFilter(s)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border"
                  style={active
                    ? { background: c.dot, color: '#fff', borderColor: c.dot }
                    : { background: '#fff', color: c.text, borderColor: c.border }
                  }>{c.label}</button>
              );
            })}
          </div>

          {/* Status — mobile */}
          <select value={statusFilter} onChange={e => handleStatusFilter(e.target.value)}
            className="xl:hidden px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tất cả trạng thái</option>
            {STATUSES.map(s => <option key={s} value={s}>{sc(s).label}</option>)}
          </select>
        </div>

        {/* Search + Date */}
        <div className="mt-3 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Tên khách, email, mã đơn..."
              className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"/>
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearchQuery(''); loadOrders({ search: '', page: 1 }); setPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESETS.map(p => (
              <button key={p.days} onClick={() => applyPreset(p)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  activePreset === p.days
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                }`}>{p.label}</button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => handleDateFrom(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"/>
            <span className="text-slate-400 text-xs font-bold">→</span>
            <input type="date" value={dateTo} onChange={e => handleDateTo(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"/>
          </div>

          {hasFilters && (
            <button onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold hover:bg-rose-100 transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
              </svg>
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Mã đơn','Khách hàng','Sản phẩm','Tổng tiền','Trạng thái','Ngày đặt','Ngày giao','Thao tác'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading && orders.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                      <span className="text-sm">Đang tải...</span>
                    </div>
                  </td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-5xl">🔍</span>
                      <p className="text-sm font-semibold text-slate-400">Không tìm thấy đơn hàng</p>
                      {hasFilters && <p className="text-xs text-slate-400">Thử thay đổi bộ lọc</p>}
                    </div>
                  </td></tr>
                ) : orders.map(order => (
                  <tr key={order._id}
                    className={`hover:bg-slate-50/80 transition-colors group ${order.status === 'return_requested' ? 'bg-orange-50/40' : ''}`}>

                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                        #{order._id.substring(0,8).toUpperCase()}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {(order.userId?.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate max-w-[130px]">{order.userId?.name || '—'}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[130px]">{order.userId?.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="text-xs text-slate-500">{order.items?.length || 0} sản phẩm</span>
                    </td>

                    <td className="px-5 py-4">
                      <span className={`font-bold ${order.status === 'returned' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {fmt(order.total || order.totalPrice)}
                      </span>
                      {order.status === 'returned' && (
                        <p className="text-[10px] text-slate-400 mt-0.5">Không tính DT</p>
                      )}
                    </td>

                    {/* ✅ Status + quick action badge stacked */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <StatusBadge status={order.status}/>
                        <QuickActionBtn order={order} onDone={loadOrders}/>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div>
                        <p className="text-xs text-slate-600 font-medium">
                          {new Date(order.createdAt).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' })}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' })}
                        </p>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {order.deliveredAt ? (
                        <div>
                          <p className="text-xs text-emerald-700 font-semibold">
                            {new Date(order.deliveredAt).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' })}
                          </p>
                          <p className="text-[10px] text-emerald-500">
                            {new Date(order.deliveredAt).toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300 italic">—</span>
                      )}
                    </td>

                    {/* ✅ Chi tiết link only — no status dropdown in list */}
                    <td className="px-5 py-4">
                      <Link to={`/admin/orders/${order._id}`}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap opacity-0 group-hover:opacity-100">
                        Chi tiết →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-400">Trang {page} / {totalPages} · {totalOrders} đơn</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 font-medium">← Trước</button>
                {Array.from({length: Math.min(5, totalPages)}, (_,i) => {
                  const start = Math.max(1, Math.min(page-2, totalPages-4));
                  return start + i;
                }).filter(p => p >= 1 && p <= totalPages).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium border ${page===p?'bg-blue-600 text-white border-blue-600':'border-slate-200 hover:bg-white'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 font-medium">Sau →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOrderManagement;
