import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@features/auth/hooks/useAuth';
import apiClient from '@features/shared/services/apiClient';

// ─── Constants ────────────────────────────────────────────────────────────────
const LABELS     = ['Nhà riêng', 'Văn phòng', 'Khác'];
const LABEL_ICON = { 'Nhà riêng': '🏠', 'Văn phòng': '🏢', 'Khác': '📍' };
const STATUS_MAP = {
  delivered:  { label: 'Đã giao',      color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  processing: { label: 'Đang xử lý',   color: 'bg-amber-100 text-amber-700 border border-amber-200'       },
  confirmed:  { label: 'Đã xác nhận',  color: 'bg-blue-100 text-blue-700 border border-blue-200'           },
  shipped:    { label: 'Đang giao',     color: 'bg-sky-100 text-sky-700 border border-sky-200'              },
  pending:    { label: 'Chờ xác nhận', color: 'bg-slate-100 text-slate-600 border border-slate-200'        },
  cancelled:  { label: 'Đã hủy',       color: 'bg-rose-100 text-rose-600 border border-rose-200'           },
};
const EMPTY_ADDR = {
  label: 'Nhà riêng', fullName: '', phone: '',
  address: '', ward: '', district: '', city: '', isDefault: false,
};
const cls = {
  input: 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition',
};
const fmtPrice = v => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v ?? 0);
const fmtDate  = d => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// ─── Small Components ─────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${s.color}`}>{s.label}</span>;
}

function FieldLabel({ children, required }) {
  return (
    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
      {children}{required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
  );
}

function Spinner({ size = 4, color = 'border-blue-500' }) {
  return <div className={`w-${size} h-${size} border-2 ${color} border-t-transparent rounded-full animate-spin`}/>;
}

// ─── Address Modal ────────────────────────────────────────────────────────────
function AddressModal({ initial, onClose, onSave }) {
  const [form,   setForm]   = useState(initial || EMPTY_ADDR);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.fullName || !form.phone || !form.address || !form.city) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc'); return;
    }
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-slate-900">
            {initial?._id ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ mới'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Type buttons */}
          <div>
            <FieldLabel>Loại địa chỉ</FieldLabel>
            <div className="flex gap-2">
              {LABELS.map(l => (
                <button key={l} type="button" onClick={() => set('label', l)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                    form.label === l ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-blue-300'
                  }`}>
                  <span>{LABEL_ICON[l]}</span> {l}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Họ và tên</FieldLabel>
              <input className={cls.input} value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="Nguyễn Văn A"/>
            </div>
            <div>
              <FieldLabel required>Số điện thoại</FieldLabel>
              <input className={cls.input} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0901 234 567"/>
            </div>
          </div>

          <div>
            <FieldLabel required>Địa chỉ</FieldLabel>
            <input className={cls.input} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Số nhà, tên đường"/>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <FieldLabel>Phường / Xã</FieldLabel>
              <input className={cls.input} value={form.ward} onChange={e => set('ward', e.target.value)} placeholder="P. Bến Nghé"/>
            </div>
            <div>
              <FieldLabel>Quận / Huyện</FieldLabel>
              <input className={cls.input} value={form.district} onChange={e => set('district', e.target.value)} placeholder="Q. 1"/>
            </div>
            <div>
              <FieldLabel required>Tỉnh / Thành</FieldLabel>
              <input className={cls.input} value={form.city} onChange={e => set('city', e.target.value)} placeholder="TP. HCM"/>
            </div>
          </div>

          <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
            form.isDefault ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
          }`}>
            <input type="checkbox" checked={form.isDefault} onChange={e => set('isDefault', e.target.checked)} className="w-4 h-4 accent-blue-600"/>
            <div>
              <p className="text-sm font-semibold text-slate-700">Đặt làm địa chỉ mặc định</p>
              <p className="text-xs text-slate-400">Tự động điền khi thanh toán</p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Hủy
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Spinner size={4} color="border-white"/>}
            {saving ? 'Đang lưu...' : initial?._id ? 'Cập nhật' : 'Thêm địa chỉ'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order Detail Panel ───────────────────────────────────────────────────────
function OrderDetail({ order, onCancel }) {
  if (!order) return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-300">
      <span className="text-5xl mb-3">📋</span>
      <p className="text-sm font-medium">Chọn đơn hàng để xem chi tiết</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Order ID + status */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Mã đơn hàng</p>
          <p className="font-black text-slate-800 font-mono mt-0.5">#{order.id.slice(-8).toUpperCase()}</p>
          <p className="text-xs text-slate-400 mt-1">{fmtDate(order.date)}</p>
        </div>
        <StatusBadge status={order.status}/>
      </div>

      {/* Items */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sản phẩm</p>
        <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
          {order.items?.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                {item.productId?.images?.[0]
                  ? <img src={item.productId.images[0]} alt={item.name} className="w-full h-full object-cover"/>
                  : <div className="w-full h-full flex items-center justify-center text-slate-300 text-base">👕</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                <p className="text-xs text-slate-400">× {item.quantity}</p>
              </div>
              <p className="text-sm font-bold text-slate-700 flex-shrink-0">{fmtPrice(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Shipping */}
      {order.shippingAddress && (
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Địa chỉ giao hàng</p>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-sm space-y-0.5">
            <p className="font-semibold text-slate-800">{order.shippingAddress.fullName}</p>
            <p className="text-slate-500">{order.shippingAddress.phone}</p>
            <p className="text-slate-500">
              {[order.shippingAddress.address, order.shippingAddress.ward, order.shippingAddress.district, order.shippingAddress.city].filter(Boolean).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Payment summary */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Thanh toán</p>
        <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
          {order.paymentMethod && (
            <div className="flex justify-between items-center px-3 py-2.5 text-sm">
              <span className="text-slate-500">Phương thức</span>
              <span className="font-medium text-slate-700">{order.paymentMethod}</span>
            </div>
          )}
          <div className="flex justify-between items-center px-3 py-2.5 text-sm">
            <span className="text-slate-500">Trạng thái</span>
            <span className={`font-semibold ${order.paymentStatus === 'completed' ? 'text-emerald-600' : 'text-amber-500'}`}>
              {order.paymentStatus === 'completed' ? '✓ Đã thanh toán' : '⏳ Chờ thanh toán'}
            </span>
          </div>
          <div className="flex justify-between items-center px-3 py-3 bg-slate-50">
            <span className="font-bold text-slate-800 text-sm">Tổng cộng</span>
            <span className="font-black text-blue-600 text-base">{fmtPrice(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Cancel action */}
      {order.status === 'pending' && (
        <button onClick={() => onCancel(order.id)}
          className="w-full py-2.5 text-sm font-semibold text-rose-500 border-2 border-rose-200 rounded-xl hover:bg-rose-50 transition-colors">
          Hủy đơn hàng
        </button>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const avatarInputRef = useRef(null);

  const [tab,       setTab]       = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [saving,    setSaving]    = useState(false);

  // avatar
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [avatarSaving,  setAvatarSaving]  = useState(false);

  // profile form
  const [formData, setFormData] = useState({
    fullName: user?.name  || '',
    phone:    user?.phone || '',
  });

  // addresses
  const [addresses,   setAddresses]   = useState([]);
  const [addrLoading, setAddrLoading] = useState(true);
  const [addrModal,   setAddrModal]   = useState(null);
  const [deleteId,    setDeleteId]    = useState(null);

  // orders
  const [orders,        setOrders]        = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [ordersLoaded,  setOrdersLoaded]  = useState(false);

  useEffect(() => { fetchAddresses(); }, []);

  useEffect(() => {
    if (tab === 'orders' && !ordersLoaded) fetchOrders();
  }, [tab]);

  // ── Addresses ─────────────────────────────────────────────────────────────
  const fetchAddresses = async () => {
    try {
      setAddrLoading(true);
      const res = await apiClient.get('/user/addresses');
      setAddresses(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e) {
      console.error('Fetch addresses error:', e);
    } finally {
      setAddrLoading(false);
    }
  };

  const handleSaveAddress = async (form) => {
    if (addrModal?._id) await apiClient.put(`/user/addresses/${addrModal._id}`, form);
    else                  await apiClient.post('/user/addresses', form);
    await fetchAddresses();
    setAddrModal(null);
  };

  const handleDeleteAddress = async () => {
    if (!deleteId) return;
    try {
      await apiClient.delete(`/user/addresses/${deleteId}`);
      setDeleteId(null);
      fetchAddresses();
    } catch (e) { alert(e.response?.data?.message || 'Lỗi khi xóa địa chỉ'); }
  };

  const handleSetDefault = async (id) => {
    try {
      await apiClient.put(`/user/addresses/${id}/set-default`);
      fetchAddresses();
    } catch { alert('Lỗi khi đặt mặc định'); }
  };

  // ── Orders ────────────────────────────────────────────────────────────────
  const fetchOrders = async () => {
    try {
      setOrdersLoading(true);
      const res  = await apiClient.get('/user/orders');
      const raw  = res.data?.data || res.data || [];
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw.orders) ? raw.orders : []);
      const norm = list.map(o => ({
        id:             o._id || o.id,
        date:           o.createdAt,
        items:          o.items || [],
        total:          o.totalPrice || o.finalAmount || o.total || 0,
        status:         o.status || 'pending',
        shippingAddress: o.shippingAddress,
        paymentMethod:  o.paymentMethod,
        paymentStatus:  o.paymentStatus,
        trackingNumber: o.trackingNumber,
      }));
      setOrders(norm);
      setSelectedOrder(norm[0] || null);
      setOrdersLoaded(true);
    } catch (e) {
      console.error('Fetch orders error:', e);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Bạn có chắc muốn hủy đơn hàng này không?')) return;
    try {
      await apiClient.put(`/user/orders/${orderId}/cancel`);
      fetchOrders();
    } catch (e) { alert(e.response?.data?.message || 'Không thể hủy đơn hàng'); }
  };

  // ── Profile ───────────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await apiClient.put('/user/profile', { name: formData.fullName, phone: formData.phone });
      updateProfile?.({ ...user, name: formData.fullName, phone: formData.phone });
      setIsEditing(false);
    } catch (e) {
      alert(e.response?.data?.message || 'Lỗi khi cập nhật');
    } finally {
      setSaving(false);
    }
  };

  // ── Avatar ────────────────────────────────────────────────────────────────
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // local preview ngay
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);

    try {
      setAvatarSaving(true);
      const fd = new FormData();
      fd.append('avatar', file);
      const up = await apiClient.post('/upload/avatar', fd);
      const url = up.data?.data;
      if (url) {
        // backend đã tự lưu vào DB, chỉ cần update context
        updateProfile?.({ ...user, avatar: url });
        setAvatarPreview(url);
      }
    } catch (e) {
      console.error('Avatar upload error:', e);
      alert('Lỗi khi tải ảnh lên. Vui lòng thử lại.');
      setAvatarPreview(user?.avatar || null);
    } finally {
      setAvatarSaving(false);
      e.target.value = '';
    }
  };

  const displayOrders = statusFilter === 'all'
    ? orders
    : orders.filter(o => o.status === statusFilter);

  const initials = user?.name?.charAt(0)?.toUpperCase() || 'U';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex gap-5">

        {/* ─── Sidebar ─────────────────────────────────────────────────────── */}
        <div className="w-52 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sticky top-6">

            {/* Avatar */}
            <div className="flex flex-col items-center mb-5">
              <div className="relative mb-3">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-slate-200 bg-gradient-to-br from-blue-400 to-blue-600 flex-shrink-0">
                  {avatarPreview
                    ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover"/>
                    : <div className="w-full h-full flex items-center justify-center text-white text-3xl font-black">{initials}</div>}
                </div>

                {/* Camera button */}
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarSaving}
                  className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center border-2 border-white shadow-md transition-colors disabled:opacity-60"
                  title="Thay đổi ảnh đại diện">
                  {avatarSaving
                    ? <Spinner size={3} color="border-white"/>
                    : <span className="text-xs leading-none">📷</span>}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange}/>
              </div>

              <p className="font-bold text-slate-800 text-sm text-center leading-tight">{user?.name}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 text-center truncate w-full">{user?.email}</p>
              <p className="text-[10px] text-slate-400 mt-1 hover:text-blue-500 cursor-pointer transition-colors"
                onClick={() => avatarInputRef.current?.click()}>
                Đổi ảnh đại diện
              </p>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <nav className="space-y-1">
                {[
                  { id: 'profile',   icon: '👤', label: 'Thông tin'   },
                  { id: 'addresses', icon: '📍', label: 'Địa chỉ'     },
                  { id: 'orders',    icon: '📦', label: 'Đơn hàng',
                    badge: orders.length > 0 ? orders.length : null },
                  { id: 'security',  icon: '🔐', label: 'Bảo mật'    },
                ].map(item => (
                  <button key={item.id} onClick={() => setTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left group ${
                      tab === item.id
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}>
                    <span className="text-base">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === item.id ? 'bg-blue-200 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* ─── Main content ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* ── Profile Tab ──────────────────────────────────────────────── */}
          {tab === 'profile' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Thông tin cá nhân</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Quản lý thông tin hồ sơ của bạn</p>
                </div>
                {!isEditing
                  ? <button onClick={() => setIsEditing(true)}
                      className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                      ✏️ Chỉnh sửa
                    </button>
                  : <div className="flex gap-2">
                      <button onClick={() => setIsEditing(false)}
                        className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-sm font-semibold hover:bg-slate-50">
                        Hủy
                      </button>
                      <button onClick={handleSaveProfile} disabled={saving}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                        {saving && <Spinner size={3} color="border-white"/>}
                        Lưu thay đổi
                      </button>
                    </div>
                }
              </div>

              {/* Avatar upload row */}
              <div className="flex items-center gap-5 p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-sm bg-gradient-to-br from-blue-400 to-blue-600">
                    {avatarPreview
                      ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover"/>
                      : <div className="w-full h-full flex items-center justify-center text-white text-3xl font-black">{initials}</div>}
                  </div>
                  {avatarSaving && (
                    <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
                      <Spinner size={5} color="border-white"/>
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm mb-0.5">Ảnh đại diện</p>
                  <p className="text-xs text-slate-400 mb-3">Định dạng JPG, PNG, WEBP · Tối đa 5MB</p>
                  <button onClick={() => avatarInputRef.current?.click()} disabled={avatarSaving}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-2">
                    {avatarSaving ? <><Spinner size={3} color="border-slate-400"/> Đang tải...</> : '📷 Thay đổi ảnh'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <FieldLabel>Họ và tên</FieldLabel>
                  <input type="text" value={formData.fullName} disabled={!isEditing}
                    onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))}
                    className={`${cls.input} ${!isEditing ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}/>
                </div>
                <div>
                  <FieldLabel>Email</FieldLabel>
                  <input type="email" value={user?.email || ''} disabled
                    className={`${cls.input} bg-slate-50 text-slate-400 cursor-not-allowed`}/>
                  <p className="text-xs text-slate-400 mt-1">Email không thể thay đổi</p>
                </div>
                <div>
                  <FieldLabel>Số điện thoại</FieldLabel>
                  <input type="tel" value={formData.phone} disabled={!isEditing}
                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    placeholder="Chưa cập nhật"
                    className={`${cls.input} ${!isEditing ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}/>
                </div>
              </div>
            </div>
          )}

          {/* ── Addresses Tab ────────────────────────────────────────────── */}
          {tab === 'addresses' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Địa chỉ giao hàng</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{addresses.length} địa chỉ đã lưu</p>
                </div>
                <button onClick={() => setAddrModal(EMPTY_ADDR)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors">
                  + Thêm địa chỉ
                </button>
              </div>

              {addrLoading ? (
                <div className="py-12 flex justify-center"><Spinner/></div>
              ) : addresses.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="text-5xl mb-3">📍</div>
                  <p className="text-slate-400 text-sm mb-4">Chưa có địa chỉ nào được lưu</p>
                  <button onClick={() => setAddrModal(EMPTY_ADDR)}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
                    + Thêm địa chỉ đầu tiên
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map(addr => (
                    <div key={addr._id}
                      className={`border-2 rounded-2xl p-4 transition-all ${addr.isDefault ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
                            {LABEL_ICON[addr.label]} {addr.label}
                          </span>
                          {addr.isDefault && (
                            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold border border-blue-200">
                              ✓ Mặc định
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!addr.isDefault && (
                            <button onClick={() => handleSetDefault(addr._id)}
                              className="px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg font-medium">
                              Đặt mặc định
                            </button>
                          )}
                          <button onClick={() => setAddrModal(addr)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 text-sm">✏️</button>
                          <button onClick={() => setDeleteId(addr._id)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-400 text-sm">🗑️</button>
                        </div>
                      </div>
                      <p className="font-semibold text-slate-800 text-sm">{addr.fullName}</p>
                      <p className="text-sm text-slate-500">{addr.phone}</p>
                      <p className="text-sm text-slate-600 mt-1">
                        {[addr.address, addr.ward, addr.district, addr.city].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Orders Tab — Split Panel ──────────────────────────────────── */}
          {tab === 'orders' && (
            <div className="flex gap-4 h-[calc(100vh-12rem)]">

              {/* Left: list */}
              <div className="w-64 flex-shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">

                {/* Header */}
                <div className="px-4 py-3.5 border-b border-slate-100 flex-shrink-0">
                  <h2 className="font-bold text-slate-900">Đơn hàng</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">{orders.length} đơn hàng</p>
                </div>

                {/* Filter tabs */}
                <div className="px-3 py-2 border-b border-slate-100 flex-shrink-0">
                  <div className="flex gap-1 flex-wrap">
                    {[['all', 'Tất cả'], ...Object.entries(STATUS_MAP).map(([k, v]) => [k, v.label])].map(([key, label]) => {
                      const count = key === 'all' ? orders.length : orders.filter(o => o.status === key).length;
                      if (key !== 'all' && count === 0) return null;
                      return (
                        <button key={key} onClick={() => {
                          setStatusFilter(key);
                          const list = key === 'all' ? orders : orders.filter(o => o.status === key);
                          if (list.length > 0) setSelectedOrder(list[0]);
                        }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                            statusFilter === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}>
                          {label}{count > 0 && ` (${count})`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Order list */}
                <div className="flex-1 overflow-y-auto">
                  {ordersLoading ? (
                    <div className="flex justify-center py-10"><Spinner/></div>
                  ) : displayOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                      <span className="text-4xl mb-2">📦</span>
                      <p className="text-xs text-center">Chưa có đơn hàng</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {displayOrders.map(order => (
                        <button key={order.id} onClick={() => setSelectedOrder(order)}
                          className={`w-full text-left px-4 py-3.5 transition-all hover:bg-slate-50 flex-shrink-0 ${
                            selectedOrder?.id === order.id
                              ? 'bg-blue-50 border-l-[3px] border-l-blue-500'
                              : 'border-l-[3px] border-l-transparent'
                          }`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 font-mono">
                                #{order.id.slice(-8).toUpperCase()}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(order.date)}</p>
                              <p className="text-xs font-bold text-blue-600 mt-1">{fmtPrice(order.total)}</p>
                            </div>
                            <StatusBadge status={order.status}/>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: detail */}
              <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-y-auto p-5">
                <OrderDetail order={selectedOrder} onCancel={handleCancelOrder}/>
              </div>
            </div>
          )}

          {/* ── Security Tab ──────────────────────────────────────────────── */}
          {tab === 'security' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-lg mx-auto">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">Đổi mật khẩu</h2>
                <p className="text-xs text-slate-400 mt-1">Sử dụng mật khẩu mạnh để bảo vệ tài khoản</p>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const cur = e.target.cur.value;
                const n1  = e.target.n1.value;
                const n2  = e.target.n2.value;
                if (!cur || !n1) return alert('Vui lòng nhập đầy đủ thông tin');
                if (n1 !== n2)     return alert('Mật khẩu mới không khớp');
                if (n1.length < 6) return alert('Mật khẩu mới phải từ 6 ký tự');
                
                setSaving(true);
                try {
                  await apiClient.put('/user/change-password', { currentPassword: cur, newPassword: n1 });
                  alert('Đổi mật khẩu thành công!');
                  e.target.reset();
                } catch (e) {
                  alert(e.response?.data?.message || 'Lỗi khi đổi mật khẩu');
                } finally { setSaving(false); }
              }} className="space-y-4">
                <div>
                  <FieldLabel required>Mật khẩu hiện tại</FieldLabel>
                  <input name="cur" type="password" required className={cls.input}/>
                </div>
                <div>
                  <FieldLabel required>Mật khẩu mới</FieldLabel>
                  <input name="n1" type="password" required className={cls.input} placeholder="Tối thiểu 6 ký tự"/>
                </div>
                <div>
                  <FieldLabel required>Xác nhận mật khẩu mới</FieldLabel>
                  <input name="n2" type="password" required className={cls.input}/>
                </div>
                <div className="pt-2">
                  <button type="submit" disabled={saving}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving && <Spinner size={4} color="border-white"/>}
                    {saving ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* ─── Modals ──────────────────────────────────────────────────────────── */}
      {addrModal && (
        <AddressModal initial={addrModal} onClose={() => setAddrModal(null)} onSave={handleSaveAddress}/>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteId(null)}/>
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="text-5xl mb-3">🗑️</div>
            <h3 className="text-lg font-bold text-slate-900">Xóa địa chỉ?</h3>
            <p className="text-sm text-slate-500 mt-1 mb-5">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50">Hủy</button>
              <button onClick={handleDeleteAddress}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
