import React, { useEffect, useState } from 'react';
import { useAdmin } from '@hooks/useAdmin';
import { Link } from 'react-router-dom';

// ── Config ─────────────────────────────────────────────────────────────────────
const STATUSES = ['pending','confirmed','processing','shipped','delivered','cancelled'];

const STATUS_CFG = {
  pending:    { label: 'Chờ xác nhận', dot: '#F59E0B', bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  confirmed:  { label: 'Đã xác nhận',  dot: '#3B82F6', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  processing: { label: 'Đang xử lý',   dot: '#8B5CF6', bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE' },
  shipped:    { label: 'Đang giao',    dot: '#06B6D4', bg: '#ECFEFF', text: '#164E63', border: '#A5F3FC' },
  delivered:  { label: 'Đã giao',      dot: '#10B981', bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  cancelled:  { label: 'Đã hủy',       dot: '#EF4444', bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
};
const sc = s => STATUS_CFG[s] || { label: s, dot: '#6B7280', bg: '#F9FAFB', text: '#374151', border: '#E5E7EB' };

const fmt = v => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

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

// ── Main ───────────────────────────────────────────────────────────────────────
const AdminOrderManagement = () => {
  const { fetchAdminOrders, updateOrderStatus, loading } = useAdmin();
  const [orders,       setOrders]       = useState([]);
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalOrders,  setTotalOrders]  = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { loadOrders(); }, [page, statusFilter]);

  const loadOrders = async () => {
    const data = await fetchAdminOrders({ page, limit: 10, status: statusFilter || undefined });
    if (data) {
      setOrders(data.orders || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalOrders(data.pagination?.total || 0);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try { await updateOrderStatus(orderId, { status: newStatus }); loadOrders(); }
    catch { /* handled by context */ }
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Quản lý Đơn hàng</h1>
            <p className="text-sm text-slate-400 mt-0.5">{totalOrders} đơn hàng tổng cộng</p>
          </div>
          {/* Status filter pills */}
          <div className="hidden lg:flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => { setStatusFilter(''); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                statusFilter === ''
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >Tất cả</button>
            {STATUSES.map(s => {
              const c = sc(s);
              const active = statusFilter === s;
              return (
                <button key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border"
                  style={active
                    ? { background: c.dot, color: '#fff', borderColor: c.dot }
                    : { background: '#fff', color: c.text, borderColor: c.border }
                  }
                >{c.label}</button>
              );
            })}
          </div>
          {/* Mobile filter */}
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="lg:hidden px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Tất cả</option>
            {STATUSES.map(s => <option key={s} value={s}>{sc(s).label}</option>)}
          </select>
        </div>
      </div>

      <div className="p-6">
        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Mã đơn','Khách hàng','Sản phẩm','Tổng tiền','Trạng thái','Ngày đặt',''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading && orders.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                      <span className="text-sm">Đang tải...</span>
                    </div>
                  </td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <span className="text-4xl">📋</span>
                      <span className="text-sm font-medium">Không tìm thấy đơn hàng nào</span>
                    </div>
                  </td></tr>
                ) : orders.map(order => (
                  <tr key={order._id} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Order ID */}
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                        #{order._id.substring(0,8).toUpperCase()}
                      </span>
                    </td>

                    {/* Customer */}
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

                    {/* Items count */}
                    <td className="px-5 py-4">
                      <span className="text-xs text-slate-500">
                        {order.items?.length || 0} sản phẩm
                      </span>
                    </td>

                    {/* Total */}
                    <td className="px-5 py-4">
                      <span className="font-bold text-slate-800">{fmt(order.total || order.totalPrice || 0)}</span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <StatusBadge status={order.status}/>
                    </td>

                    {/* Date */}
                    <td className="px-5 py-4">
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' })}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link to={`/admin/orders/${order._id}`}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap">
                          Chi tiết
                        </Link>
                        <select
                          value={order.status}
                          onChange={e => handleStatusChange(order._id, e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-600 cursor-pointer"
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{sc(s).label}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-400">Trang {page} / {totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 font-medium">← Trước</button>
                {Array.from({length: Math.min(5, totalPages)}, (_,i) => {
                  const start = Math.max(1, Math.min(page-2, totalPages-4));
                  return start + i;
                }).filter(p => p >= 1 && p <= totalPages).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium border ${page===p ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 hover:bg-white'}`}>
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