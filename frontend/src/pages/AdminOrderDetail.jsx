import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdmin } from '@hooks/useAdmin';
import apiClient from '@services/apiClient';

const STATUSES = ['pending','confirmed','processing','shipped','delivered','return_requested','returned','cancelled'];

const STATUS_CFG = {
  pending:          { label: 'Chờ xác nhận',   dot: '#F59E0B', bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  confirmed:        { label: 'Đã xác nhận',    dot: '#3B82F6', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  processing:       { label: 'Đang xử lý',     dot: '#8B5CF6', bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE' },
  shipped:          { label: 'Đang giao',      dot: '#06B6D4', bg: '#ECFEFF', text: '#164E63', border: '#A5F3FC' },
  delivered:        { label: 'Đã giao',        dot: '#10B981', bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  return_requested: { label: 'Yêu cầu HT',    dot: '#F97316', bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA' },
  returned:         { label: 'Hoàn trả xong',  dot: '#6B7280', bg: '#F9FAFB', text: '#374151', border: '#E5E7EB' },
  cancelled:        { label: 'Đã hủy',         dot: '#EF4444', bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
};
const sc   = s => STATUS_CFG[s] || { label: s, dot:'#6B7280', bg:'#F9FAFB', text:'#374151', border:'#E5E7EB' };
const fmt  = v => new Intl.NumberFormat('vi-VN', { style:'currency', currency:'VND' }).format(v || 0);
const fmtD = d => new Date(d).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

function StatusBadge({ status }) {
  const c = sc(status);
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.dot }}/>
      {c.label}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400 font-medium w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-800 font-semibold flex-1">{value || '—'}</span>
    </div>
  );
}

const TIMELINE = ['pending','confirmed','processing','shipped','delivered'];

function OrderTimeline({ currentStatus }) {
  if (currentStatus === 'cancelled') return (
    <div className="flex items-center gap-2 p-3 bg-rose-50 rounded-xl border border-rose-200">
      <span className="text-rose-500 text-lg">✕</span>
      <span className="text-sm font-semibold text-rose-700">Đơn hàng đã bị hủy</span>
    </div>
  );
  if (currentStatus === 'return_requested' || currentStatus === 'returned') {
    const c = sc(currentStatus);
    return (
      <div className="flex items-center gap-3 p-3.5 rounded-xl border"
        style={{ background: c.bg, borderColor: c.border }}>
        <span className="text-xl">{currentStatus === 'return_requested' ? '↩️' : '✔️'}</span>
        <div>
          <p className="font-semibold text-sm" style={{ color: c.text }}>{c.label}</p>
          <p className="text-xs mt-0.5 text-slate-500">
            {currentStatus === 'return_requested'
              ? 'Khách hàng đã gửi yêu cầu hoàn trả, đang chờ xác nhận.'
              : 'Hoàn trả thành công. Kho hàng đã được cập nhật.'}
          </p>
        </div>
      </div>
    );
  }
  const currentIdx = TIMELINE.indexOf(currentStatus);
  return (
    <div className="relative">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-100 z-0"/>
        <div className="absolute top-4 left-0 h-0.5 bg-blue-500 z-0 transition-all duration-500"
          style={{ width: `${Math.min((currentIdx / (TIMELINE.length - 1)) * 100, 100)}%` }}/>
        {TIMELINE.map((step, i) => {
          const done    = i < currentIdx;
          const active  = i === currentIdx;
          const pending = i > currentIdx;
          const c = sc(step);
          return (
            <div key={step} className="flex flex-col items-center gap-2 z-10 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${done   ? 'bg-blue-600 border-blue-600 text-white' : ''}
                ${active ? 'bg-white border-blue-600 text-blue-600 shadow-md scale-110' : ''}
                ${pending? 'bg-white border-slate-200 text-slate-300' : ''}
              `}>{done ? '✓' : i + 1}</div>
              <span className={`text-[10px] font-semibold text-center leading-tight max-w-[56px] ${
                active ? 'text-blue-600' : done ? 'text-slate-600' : 'text-slate-300'
              }`}>{c.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const AdminOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getOrderDetails, updateOrderStatus, loading } = useAdmin();

  const [order,     setOrder]     = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [updating,  setUpdating]  = useState(false);
  const [success,   setSuccess]   = useState(false);

  useEffect(() => { if (id) loadOrder(); }, [id]);

  const loadOrder = async () => {
    const data = await getOrderDetails(id);
    if (data) { setOrder(data); setNewStatus(data.status); }
  };

  const handleUpdate = async () => {
    if (newStatus === order.status) return;
    setUpdating(true);
    try {
      await updateOrderStatus(id, { status: newStatus });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      loadOrder();
    } catch { /* handled */ }
    finally { setUpdating(false); }
  };

  // ✅ Admin xác nhận hoàn trả
  const handleConfirmReturn = async () => {
    if (!window.confirm('Xác nhận hoàn trả? Kho hàng sẽ được cập nhật lại.')) return;
    setUpdating(true);
    try {
      await apiClient.put(`/admin/orders/${id}/confirm-return`);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      loadOrder();
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể xác nhận hoàn trả');
    } finally { setUpdating(false); }
  };

  if (!order) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin"/>
        <p className="text-sm text-slate-400">Đang tải đơn hàng...</p>
      </div>
    </div>
  );

  const paymentMethodLabel = {
    cod: 'Thanh toán khi nhận hàng (COD)',
    banking: 'Chuyển khoản ngân hàng',
    bank_transfer: 'Chuyển khoản ngân hàng',
    card: 'Thẻ tín dụng / Ghi nợ',
    momo: 'Ví MoMo',
  };
  const paymentStatusLabel = {
    pending: 'Chờ thanh toán',
    completed: 'Đã thanh toán',
    failed: 'Thất bại',
    refunded: 'Đã hoàn tiền',
  };

  const isReturnFlow = ['return_requested','returned'].includes(order.status);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-4 flex-wrap">
          <button onClick={() => navigate('/admin/orders')}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Đơn hàng
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-bold text-slate-800 font-mono">
            #{order._id.substring(0,8).toUpperCase()}
          </span>
          <StatusBadge status={order.status}/>
          <span className="ml-auto text-xs text-slate-400">{fmtD(order.createdAt)}</span>
        </div>
      </div>

      <div className="p-6 max-w-screen-xl mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* ── Left column ──────────────────────────────────────────── */}
          <div className="xl:col-span-2 space-y-5">

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-5">Tiến trình đơn hàng</h2>
              <OrderTimeline currentStatus={order.status}/>

              {/* ✅ Hiển thị thời gian giao hàng khi delivered/return/returned */}
              {order.deliveredAt && (
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-base flex-shrink-0">
                    📦
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Thời gian giao hàng thành công</p>
                    <p className="text-sm font-bold text-emerald-700">{fmtD(order.deliveredAt)}</p>
                  </div>
                </div>
              )}

              {/* ✅ Thời gian yêu cầu hoàn trả */}
              {order.returnRequestedAt && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-base flex-shrink-0">
                    ↩️
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Thời gian yêu cầu hoàn trả</p>
                    <p className="text-sm font-bold text-orange-600">{fmtD(order.returnRequestedAt)}</p>
                    {order.returnReason && (
                      <p className="text-xs text-slate-500 mt-0.5">Lý do: {order.returnReason}</p>
                    )}
                  </div>
                </div>
              )}

              {/* ✅ Thời gian hoàn trả thành công */}
              {order.returnedAt && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-base flex-shrink-0">
                    ✔️
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Xác nhận hoàn trả</p>
                    <p className="text-sm font-bold text-slate-600">{fmtD(order.returnedAt)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Order items */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-50">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                  Sản phẩm đặt hàng
                  <span className="ml-2 text-blue-600 normal-case font-normal tracking-normal">
                    ({order.items?.length || 0} sản phẩm)
                  </span>
                </h2>
              </div>
              <div className="divide-y divide-slate-50">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                    <div className="w-14 h-14 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                      {item.image
                        ? <img src={item.image} alt={item.name} className="w-full h-full object-cover"/>
                        : <div className="w-full h-full flex items-center justify-center text-slate-400 text-xl">👗</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {item.color && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">{item.color}</span>}
                        {item.size  && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">Size {item.size}</span>}
                        <span className="text-xs text-slate-400">x{item.quantity}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold ${order.status === 'returned' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {fmt(item.price * item.quantity)}
                      </p>
                      <p className="text-xs text-slate-400">{fmt(item.price)} / cái</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* Totals */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 space-y-2">
                {order.subtotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tạm tính</span>
                    <span className="font-medium text-slate-700">{fmt(order.subtotal)}</span>
                  </div>
                )}
                {order.shippingFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Phí vận chuyển</span>
                    <span className="font-medium text-slate-700">{fmt(order.shippingFee)}</span>
                  </div>
                )}
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Giảm giá</span>
                    <span className="font-medium text-emerald-600">−{fmt(order.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-sm font-bold text-slate-800">Tổng cộng</span>
                  <span className={`text-lg font-black ${order.status === 'returned' ? 'text-slate-400 line-through' : 'text-blue-600'}`}>
                    {fmt(order.total || order.totalPrice || 0)}
                  </span>
                </div>
                {order.status === 'returned' && (
                  <p className="text-xs text-slate-400 italic text-right">Đơn hoàn trả — không tính doanh thu</p>
                )}
              </div>
            </div>

            {/* Customer + Shipping */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Khách hàng</h2>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {(order.userId?.name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{order.userId?.name || '—'}</p>
                    <p className="text-xs text-slate-400">{order.userId?.email}</p>
                  </div>
                </div>
                <InfoRow label="Số điện thoại" value={order.userId?.phone}/>
                <InfoRow label="Ngày đặt"      value={fmtD(order.createdAt)}/>
                {order.deliveredAt && (
                  <InfoRow label="Ngày giao"   value={fmtD(order.deliveredAt)}/>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Địa chỉ giao hàng</h2>
                <InfoRow label="Người nhận" value={order.shippingAddress?.fullName}/>
                <InfoRow label="Địa chỉ"   value={order.shippingAddress?.address}/>
                <InfoRow label="Quận/Huyện" value={order.shippingAddress?.district}/>
                <InfoRow label="Tỉnh/TP"   value={order.shippingAddress?.city || order.shippingAddress?.province}/>
                <InfoRow label="SĐT"        value={order.shippingAddress?.phone}/>
              </div>
            </div>
          </div>

          {/* ── Right column ─────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Status update */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Cập nhật trạng thái</h2>

              <div className="mb-3">
                <p className="text-xs text-slate-400 mb-1.5">Trạng thái hiện tại</p>
                <StatusBadge status={order.status}/>
              </div>

              {/* ✅ Nút xác nhận hoàn trả nổi bật — hiện khi return_requested */}
              {order.status === 'return_requested' ? (
                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                  <p className="text-xs font-bold text-orange-700 mb-1">⚠️ Khách hàng yêu cầu hoàn trả</p>
                  <p className="text-xs text-orange-600 mb-3">
                    Yêu cầu lúc: {order.returnRequestedAt ? fmtD(order.returnRequestedAt) : '—'}
                  </p>
                  {order.returnReason && (
                    <p className="text-xs text-slate-600 italic mb-3">"{order.returnReason}"</p>
                  )}
                  <button onClick={handleConfirmReturn} disabled={updating}
                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
                    {updating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                    ✓ Xác nhận hoàn trả
                  </button>
                </div>
              ) : order.status !== 'returned' ? (
                <>
                  <div className="mb-4">
                    <p className="text-xs text-slate-400 mb-1.5">Chuyển sang</p>
                    <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-700">
                      {STATUSES.filter(s => s !== 'return_requested' && s !== 'returned').map(s => (
                        <option key={s} value={s}>{sc(s).label}</option>
                      ))}
                    </select>
                  </div>

                  <button onClick={handleUpdate} disabled={newStatus === order.status || updating}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm">
                    {updating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                    {updating ? 'Đang cập nhật...' : 'Xác nhận cập nhật'}
                  </button>
                </>
              ) : (
                <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-xs text-slate-400">Đơn đã hoàn trả — không thể thay đổi trạng thái</p>
                </div>
              )}

              {success && order.status !== 'return_requested' && (
                <div className="mt-3 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-emerald-500">✓</span>
                  <span className="text-xs font-semibold text-emerald-700">Cập nhật thành công!</span>
                </div>
              )}
            </div>

            {/* Payment */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Thanh toán</h2>
              <InfoRow label="Phương thức"
                value={paymentMethodLabel[order.paymentMethod] || order.paymentMethod}/>
              <div className="flex items-start gap-3 py-2.5 border-b border-slate-50">
                <span className="text-xs text-slate-400 font-medium w-32 flex-shrink-0 pt-0.5">Trạng thái</span>
                <span className={`text-sm font-bold ${
                  order.paymentStatus === 'completed' ? 'text-emerald-600' :
                  order.paymentStatus === 'failed'    ? 'text-rose-500'    : 'text-amber-600'
                }`}>
                  {paymentStatusLabel[order.paymentStatus] || order.paymentStatus}
                </span>
              </div>
              {order.voucherCode && (
                <InfoRow label="Voucher" value={order.voucherCode}/>
              )}
              {order.discountAmount > 0 && (
                <InfoRow label="Đã giảm" value={`−${fmt(order.discountAmount)}`}/>
              )}
            </div>

            {/* Tracking */}
            {order.trackingNumber && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Mã vận đơn</h2>
                <p className="font-mono text-sm bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-slate-800 font-bold tracking-wider">
                  {order.trackingNumber}
                </p>
              </div>
            )}

            {/* Notes */}
            {order.notes && (
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
                <h2 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">📝 Ghi chú</h2>
                <p className="text-sm text-amber-800 leading-relaxed">{order.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetail;