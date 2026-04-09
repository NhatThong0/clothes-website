import React, { useEffect, useState } from 'react';
import { useAdmin } from '@features/admin/hooks/useAdmin';
import apiClient from '@features/shared/services/apiClient';
import TierImageBadge from '@components/common/TierImageBadge';

const LOYALTY_ICON = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💠', diamond: '💎' };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt     = d => d ? new Date(d).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
const fmtTime = d => d ? new Date(d).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Chưa đăng nhập';
const fmtPrice = v => new Intl.NumberFormat('vi-VN', { style:'currency', currency:'VND' }).format(v);

const STATUS_ORDER = { pending:'Chờ xác nhận', confirmed:'Đã xác nhận', processing:'Đang xử lý', shipped:'Đang giao', delivered:'Đã giao', cancelled:'Đã hủy' };
const STATUS_COLOR = { pending:'text-amber-600', confirmed:'text-blue-600', processing:'text-purple-600', shipped:'text-cyan-600', delivered:'text-emerald-600', cancelled:'text-rose-500' };

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition';

function Spinner({ size = 5 }) {
  return <div className={`w-${size} h-${size} border-2 border-blue-500 border-t-transparent rounded-full animate-spin`}/>;
}

function RoleBadge({ role }) {
  return role === 'admin'
    ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white">👑 Admin</span>
    : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">Khách hàng</span>;
}

function StatusBadge({ isActive }) {
  return isActive
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">● Hoạt động</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-600 border border-rose-200">● Bị khóa</span>;
}

// ─── User Form Modal (Create / Edit) ─────────────────────────────────────────
function LoyaltyBadge({ loyalty }) {
  const tier = loyalty?.tier;
  if (!tier?.name) {
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">ChÆ°a cÃ³ háº¡ng</span>;
  }

  const iconKey = String(tier.iconKey || tier.icon_key || '').toLowerCase();
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
      <span>{LOYALTY_ICON[iconKey] || '🏅'}</span>
      <span>{tier.name}</span>
    </span>
  );
}

function UserFormModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial?._id;
  const [form, setForm] = useState({
    name:     initial?.name     || '',
    email:    initial?.email    || '',
    phone:    initial?.phone    || '',
    role:     initial?.role     || 'customer',
    password: '',
    isActive: initial?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name || !form.email) { setError('Vui lòng điền tên và email'); return; }
    if (!isEdit && !form.password) { setError('Vui lòng nhập mật khẩu'); return; }
    setError('');
    setSaving(true);
    try {
      if (isEdit) {
        const payload = { name: form.name, phone: form.phone, role: form.role, isActive: form.isActive };
        if (form.password) payload.password = form.password;
        await apiClient.put(`/admin/users/${initial._id}`, payload);
      } else {
        await apiClient.post('/admin/users', form);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || 'Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="admin-overlay absolute inset-0" onClick={onClose}/>
      <div className="admin-modal-shell relative w-full max-w-md">
        <div className="admin-panel-header flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-600">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Họ tên <span className="text-rose-500">*</span></label>
              <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nguyễn Văn A"/>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Điện thoại</label>
              <input className={inputCls} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0901 234 567"/>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email <span className="text-rose-500">*</span></label>
            <input className={`${inputCls} ${isEdit ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
              type="email" value={form.email} disabled={isEdit}
              onChange={e => set('email', e.target.value)} placeholder="email@example.com"/>
            {isEdit && <p className="text-xs text-slate-400 mt-1">Email không thể thay đổi</p>}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              {isEdit ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu *'}
            </label>
            <input className={inputCls} type="password" value={form.password}
              onChange={e => set('password', e.target.value)} placeholder={isEdit ? '••••••••' : 'Tối thiểu 6 ký tự'}/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Vai trò</label>
              <select className={inputCls} value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="customer">Khách hàng</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Trạng thái</label>
              <select className={inputCls} value={form.isActive ? 'true' : 'false'} onChange={e => set('isActive', e.target.value === 'true')}>
                <option value="true">Hoạt động</option>
                <option value="false">Bị khóa</option>
              </select>
            </div>
          </div>
        </div>

        <div className="admin-panel-footer flex gap-3 px-6 py-4">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Hủy</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Spinner size={4}/>}
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo tài khoản'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const AdminUserManagement = () => {
  const { fetchAdminUsers, updateUserRole, fetchUserOrderHistory, fetchUserLoyalty } = useAdmin();

  const [users,         setUsers]         = useState([]);
  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);
  const [totalUsers,    setTotalUsers]    = useState(0);
  const [search,        setSearch]        = useState('');
  const [roleFilter,    setRoleFilter]    = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');

  // detail drawer
  const [detailUser,    setDetailUser]    = useState(null);
  const [orders,        setOrders]        = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [loyaltyInfo,   setLoyaltyInfo]   = useState(null);
  const [loyaltyLoading,setLoyaltyLoading]= useState(false);

  // modals
  const [formModal,     setFormModal]     = useState(null); // null | {} | user object
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmToggle, setConfirmToggle] = useState(null);
  const [confirmRole,   setConfirmRole]   = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { loadUsers(); }, [page, search, roleFilter, statusFilter]);

  const loadUsers = async () => {
    const data = await fetchAdminUsers({
      page, limit: 10,
      search:   search     || undefined,
      role:     roleFilter || undefined,
      isActive: statusFilter !== '' ? statusFilter : undefined,
    });
    if (data) {
      setUsers(data.users || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalUsers(data.pagination?.total || 0);
    }
  };

  const openDetail = async (user) => {
    setDetailUser(user);
    setOrders([]);
    setLoyaltyInfo(null);
    setOrdersLoading(true);
    setLoyaltyLoading(true);
    try {
      const [orderData, loyaltyData] = await Promise.all([
        fetchUserOrderHistory(user._id, { limit: 5 }),
        fetchUserLoyalty(user._id, { limit: 10 }),
      ]);
      setOrders(orderData?.orders || []);
      setLoyaltyInfo(loyaltyData || null);
      if (loyaltyData?.snapshot) {
        setDetailUser((current) => current ? ({ ...current, loyalty: loyaltyData.snapshot }) : current);
      }
    } catch {
      setOrders([]);
      setLoyaltyInfo(null);
    } finally {
      setOrdersLoading(false);
      setLoyaltyLoading(false);
    }
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const doDelete = async () => {
    if (!confirmDelete) return;
    setActionLoading(true);
    try {
      await apiClient.delete(`/admin/users/${confirmDelete._id}`);
      setConfirmDelete(null);
      if (detailUser?._id === confirmDelete._id) setDetailUser(null);
      loadUsers();
    } catch (e) {
      alert(e.response?.data?.message || 'Lỗi khi xóa');
    } finally {
      setActionLoading(false);
    }
  };

  const doToggleStatus = async () => {
    if (!confirmToggle) return;
    setActionLoading(true);
    try {
      const res = await apiClient.put(`/admin/users/${confirmToggle._id}/toggle-status`);
      setConfirmToggle(null);
      if (detailUser?._id === confirmToggle._id) setDetailUser(res.data.data);
      loadUsers();
    } catch (e) {
      alert(e.response?.data?.message || 'Lỗi khi thay đổi trạng thái');
    } finally {
      setActionLoading(false);
    }
  };

  const doRoleChange = async () => {
    if (!confirmRole) return;
    setActionLoading(true);
    try {
      await updateUserRole(confirmRole.user._id, { role: confirmRole.newRole });
      setConfirmRole(null);
      if (detailUser?._id === confirmRole.user._id) setDetailUser(u => ({ ...u, role: confirmRole.newRole }));
      loadUsers();
    } catch { /* handled */ }
    finally { setActionLoading(false); }
  };

  // ── Avatar cell ───────────────────────────────────────────────────────────
  const UserCell = ({ user }) => (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 border border-slate-200">
        {user.avatar
          ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover"/>
          : <div className={`w-full h-full flex items-center justify-center font-bold text-sm ${user.role === 'admin' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {(user.name || '?')[0].toUpperCase()}
            </div>}
      </div>
      <div>
        <p className="font-semibold text-slate-800 text-sm">{user.name}</p>
        <p className="text-[11px] text-slate-400">{user.email}</p>
      </div>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="admin-page min-h-screen bg-slate-50">

      {/* ── Page Header ── */}
      <div className="bg-white/92 backdrop-blur-xl border-b border-slate-200/70 px-6 py-4 sticky top-0 z-20 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Quản lý Người dùng</h1>
            <p className="text-sm text-slate-400 mt-0.5">{totalUsers} tài khoản</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Role filter */}
            {[['', 'Tất cả'], ['customer', 'Khách hàng'], ['admin', '👑 Admin']].map(([val, label]) => (
              <button key={val} onClick={() => { setRoleFilter(val); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  roleFilter === val ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                }`}>{label}</button>
            ))}
            {/* Status filter */}
            {[['', 'Tất cả TT'], ['true', '● Hoạt động'], ['false', '● Bị khóa']].map(([val, label]) => (
              <button key={val} onClick={() => { setStatusFilter(val); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  statusFilter === val ? 'bg-slate-700 text-white border-slate-700 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}>{label}</button>
            ))}
            <button onClick={() => setFormModal({})}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors">
              + Thêm tài khoản
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">

        {/* ── Search ── */}
        <div className="bg-white rounded-[28px] border border-slate-200/70 shadow-[0_12px_40px_rgba(15,23,42,0.04)] p-4">
          <div className="relative max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input type="text" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm theo tên hoặc email..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-[28px] border border-slate-200/70 shadow-[0_12px_40px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Người dùng', 'Điện thoại','Loyalty', 'Vai trò', 'Trạng thái', 'Đăng nhập gần nhất', 'Ngày tạo', ].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-300">
                      <span className="text-4xl">👥</span>
                      <span className="text-sm">Không tìm thấy người dùng</span>
                    </div>
                  </td></tr>
                ) : users.map(user => (
                  <tr key={user._id} className={`hover:bg-slate-50 transition-colors group ${!user.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3.5"><UserCell user={user}/></td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{user.phone || '—'}</td>
                    <td className="px-5 py-3.5"><LoyaltyBadge loyalty={user.loyalty}/></td>
                    <td className="px-5 py-3.5"><RoleBadge role={user.role}/></td>
                    <td className="px-5 py-3.5"><StatusBadge isActive={user.isActive}/></td>
                    <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">{fmtTime(user.lastLoginAt)}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">{fmt(user.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openDetail(user)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 text-xs font-semibold rounded-lg transition-colors">
                          Chi tiết
                        </button>
                        <button onClick={() => setFormModal(user)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-amber-50 hover:text-amber-600 text-slate-600 text-xs font-semibold rounded-lg transition-colors">
                          Sửa
                        </button>
                        <button onClick={() => setConfirmToggle(user)}
                          className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            user.isActive ? 'bg-orange-50 hover:bg-orange-100 text-orange-600' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                          }`}>
                          {user.isActive ? 'Khóa' : 'Mở khóa'}
                        </button>
                        <button onClick={() => setConfirmDelete(user)}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-lg transition-colors">
                          Xóa
                        </button>
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
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 font-medium">← Trước</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const s = Math.max(1, Math.min(page - 2, totalPages - 4)); return s + i;
                }).filter(p => p >= 1 && p <= totalPages).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium border ${page === p ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 hover:bg-white'}`}>{p}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 font-medium">Sau →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Drawer ── */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex">
          <div className="admin-overlay flex-1" onClick={() => setDetailUser(null)}/>
          <div className="admin-drawer-shell w-full max-w-md flex flex-col h-full">
            <div className="admin-panel-header flex flex-shrink-0 items-center justify-between px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">Chi tiết người dùng</h2>
              <button onClick={() => setDetailUser(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Avatar + name */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-slate-200">
                  {detailUser.avatar
                    ? <img src={detailUser.avatar} alt={detailUser.name} className="w-full h-full object-cover"/>
                    : <div className={`w-full h-full flex items-center justify-center text-2xl font-black ${detailUser.role === 'admin' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {(detailUser.name||'?')[0].toUpperCase()}
                      </div>}
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">{detailUser.name}</p>
                  <p className="text-sm text-slate-400">{detailUser.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <RoleBadge role={detailUser.role}/>
                    <StatusBadge isActive={detailUser.isActive}/>
                    <LoyaltyBadge loyalty={detailUser.loyalty}/>
                  </div>
                </div>
              </div>

              {/* Info grid */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
                {[
                  ['Điện thoại',       detailUser.phone || '—'],
                  ['Ngày tạo',         fmt(detailUser.createdAt)],
                  ['Đăng nhập gần nhất', fmtTime(detailUser.lastLoginAt)],
                  ['Địa chỉ',          detailUser.addresses?.length ? `${detailUser.addresses.length} địa chỉ` : 'Chưa có'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-start gap-4">
                    <span className="text-xs text-slate-400 font-medium flex-shrink-0">{label}</span>
                    <span className="text-sm font-semibold text-slate-700 text-right">{value}</span>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Loyalty</h3>
                {loyaltyLoading ? (
                  <div className="flex justify-center py-6"><Spinner/></div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <LoyaltyBadge loyalty={loyaltyInfo?.snapshot || detailUser.loyalty} />
                        <span className="text-xs text-slate-400">
                          Sync: {loyaltyInfo?.snapshot?.syncedAt ? fmtTime(loyaltyInfo.snapshot.syncedAt) : '—'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white px-3 py-3 border border-slate-100">
                          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Spendable</p>
                          <p className="mt-1 text-lg font-bold text-slate-900">{loyaltyInfo?.snapshot?.spendablePoints ?? detailUser?.loyalty?.spendablePoints ?? 0}</p>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-3 border border-slate-100">
                          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Tier points</p>
                          <p className="mt-1 text-lg font-bold text-slate-900">{loyaltyInfo?.snapshot?.tierPoints ?? detailUser?.loyalty?.tierPoints ?? 0}</p>
                        </div>
                      </div>
                    </div>
                    {(loyaltyInfo?.logs || []).length === 0 ? (
                      <div className="text-center py-4 text-slate-400 text-sm bg-slate-50 rounded-2xl border border-slate-100">Chưa có biến động loyalty</div>
                    ) : (
                      <div className="space-y-2">
                        {loyaltyInfo.logs.map((log) => (
                          <div key={log.id} className="bg-slate-50 rounded-xl border border-slate-100 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{log.action_type}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{fmtTime(log.created_at)}</p>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-bold ${log.delta_spendable >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {log.delta_spendable >= 0 ? '+' : ''}{log.delta_spendable}
                                </p>
                                <p className="text-[11px] text-slate-400">tier {log.delta_tier >= 0 ? '+' : ''}{log.delta_tier}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Orders */}
              <div>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Đơn hàng gần đây</h3>
                {ordersLoading ? (
                  <div className="flex justify-center py-6"><Spinner/></div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm">Chưa có đơn hàng</div>
                ) : (
                  <div className="space-y-2">
                    {orders.map(o => (
                      <div key={o._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <p className="font-mono text-xs font-bold text-slate-600">#{o._id.slice(0,8).toUpperCase()}</p>
                          <p className={`text-xs font-semibold mt-0.5 ${STATUS_COLOR[o.status] || 'text-slate-500'}`}>{STATUS_ORDER[o.status] || o.status}</p>
                        </div>
                        <p className="font-bold text-sm text-slate-800">{fmtPrice(o.total || o.totalPrice || 0)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick actions */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <button onClick={() => { setDetailUser(null); setFormModal(detailUser); }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors">
                  ✏️ Chỉnh sửa thông tin
                </button>
                <button onClick={() => setConfirmToggle(detailUser)}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors border ${
                    detailUser.isActive
                      ? 'bg-orange-50 hover:bg-orange-100 text-orange-600 border-orange-200'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200'
                  }`}>
                  {detailUser.isActive ? '🔒 Khóa tài khoản' : '🔓 Mở khóa tài khoản'}
                </button>
                <button onClick={() => setConfirmRole({ user: detailUser, newRole: detailUser.role === 'admin' ? 'customer' : 'admin' })}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    detailUser.role === 'admin'
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}>
                  {detailUser.role === 'admin' ? '⬇ Hạ xuống Khách hàng' : '⬆ Nâng lên Admin'}
                </button>
                <button onClick={() => setConfirmDelete(detailUser)}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-sm font-semibold border border-rose-200 transition-colors">
                  🗑️ Xóa tài khoản
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Form Modal (Create / Edit) ── */}
      {formModal !== null && (
        <UserFormModal
          initial={formModal?._id ? formModal : null}
          onClose={() => setFormModal(null)}
          onSaved={loadUsers}
        />
      )}

      {/* ── Confirm Delete Modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="admin-overlay absolute inset-0" onClick={() => setConfirmDelete(null)}/>
          <div className="admin-modal-shell relative p-6 w-full max-w-sm text-center">
            <div className="text-5xl mb-3">🗑️</div>
            <h3 className="text-lg font-bold text-slate-900">Xóa tài khoản?</h3>
            <p className="text-sm text-slate-500 mt-1 mb-5">
              Xóa <strong>{confirmDelete.name}</strong>. Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50">Hủy</button>
              <button onClick={doDelete} disabled={actionLoading}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoading && <Spinner size={4}/>} Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Toggle Status Modal ── */}
      {confirmToggle && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="admin-overlay absolute inset-0" onClick={() => setConfirmToggle(null)}/>
          <div className="admin-modal-shell relative p-6 w-full max-w-sm text-center">
            <div className="text-5xl mb-3">{confirmToggle.isActive ? '🔒' : '🔓'}</div>
            <h3 className="text-lg font-bold text-slate-900">{confirmToggle.isActive ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?'}</h3>
            <p className="text-sm text-slate-500 mt-1 mb-5">
              {confirmToggle.isActive
                ? <><strong>{confirmToggle.name}</strong> sẽ không thể đăng nhập.</>
                : <><strong>{confirmToggle.name}</strong> có thể đăng nhập trở lại.</>}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmToggle(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50">Hủy</button>
              <button onClick={doToggleStatus} disabled={actionLoading}
                className={`flex-1 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 ${
                  confirmToggle.isActive ? 'bg-orange-500 hover:bg-orange-600' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}>
                {actionLoading && <Spinner size={4}/>}
                {confirmToggle.isActive ? 'Khóa' : 'Mở khóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Role Change Modal ── */}
      {confirmRole && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="admin-overlay absolute inset-0" onClick={() => setConfirmRole(null)}/>
          <div className="admin-modal-shell relative p-6 w-full max-w-sm text-center">
            <div className="text-5xl mb-3">{confirmRole.newRole === 'admin' ? '👑' : '👤'}</div>
            <h3 className="text-lg font-bold text-slate-900">Xác nhận thay đổi vai trò</h3>
            <p className="text-sm text-slate-500 mt-1 mb-5">
              Đổi <strong>{confirmRole.user.name}</strong> thành <strong>{confirmRole.newRole === 'admin' ? 'Admin' : 'Khách hàng'}</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRole(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50">Hủy</button>
              <button onClick={doRoleChange} disabled={actionLoading}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoading && <Spinner size={4}/>} Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;
