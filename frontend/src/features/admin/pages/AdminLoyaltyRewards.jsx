import { useEffect, useState } from 'react';
import apiClient from '@features/shared/services/apiClient';

const TIERS = [
  { value: 'bronze',   label: '🥉 Đồng' },
  { value: 'silver',   label: '🥈 Bạc' },
  { value: 'gold',     label: '🥇 Vàng' },
  { value: 'platinum', label: '💎 Kim Cương' },
];

const TIER_COLOR = {
  bronze:   'bg-amber-50 text-amber-700 border-amber-200',
  silver:   'bg-slate-100 text-slate-600 border-slate-300',
  gold:     'bg-yellow-50 text-yellow-700 border-yellow-300',
  platinum: 'bg-sky-50 text-sky-600 border-sky-300',
};

const TIER_LABEL = { bronze: '🥉 Đồng', silver: '🥈 Bạc', gold: '🥇 Vàng', platinum: '💎 Kim Cương' };

const fmt = v => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v ?? 0);

const DEFAULT_FORM = {
  name: '', description: '', pointsRequired: '', requiredTier: 'bronze',
  discountType: 'percentage', discountValue: '', maxDiscountAmount: '',
  minPurchaseAmount: '', voucherValidDays: '30', maxRedeemCount: '',
};

export default function AdminLoyaltyRewards() {
  const [rewards, setRewards]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId,  setEditId]    = useState(null);
  const [form,    setForm]      = useState(DEFAULT_FORM);
  const [error,   setError]     = useState('');
  const [success, setSuccess]   = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/loyalty-rewards');
      setRewards(res.data.data || []);
    } catch {
      setError('Không tải được danh sách phần thưởng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(DEFAULT_FORM);
    setError('');
    setShowForm(true);
  };

  const openEdit = (r) => {
    setEditId(r._id);
    setForm({
      name:              r.name,
      description:       r.description || '',
      pointsRequired:    String(r.pointsRequired),
      requiredTier:      r.requiredTier,
      discountType:      r.discountType,
      discountValue:     String(r.discountValue),
      maxDiscountAmount: r.maxDiscountAmount != null ? String(r.maxDiscountAmount) : '',
      minPurchaseAmount: r.minPurchaseAmount != null ? String(r.minPurchaseAmount) : '',
      voucherValidDays:  String(r.voucherValidDays ?? 30),
      maxRedeemCount:    r.maxRedeemCount != null ? String(r.maxRedeemCount) : '',
    });
    setError('');
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditId(null); setError(''); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.pointsRequired || !form.discountValue) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc (*).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name:              form.name.trim(),
        description:       form.description.trim(),
        pointsRequired:    Number(form.pointsRequired),
        requiredTier:      form.requiredTier,
        discountType:      form.discountType,
        discountValue:     Number(form.discountValue),
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
        minPurchaseAmount: form.minPurchaseAmount ? Number(form.minPurchaseAmount) : 0,
        voucherValidDays:  Number(form.voucherValidDays) || 30,
        maxRedeemCount:    form.maxRedeemCount ? Number(form.maxRedeemCount) : null,
      };
      if (editId) {
        await apiClient.put(`/admin/loyalty-rewards/${editId}`, payload);
        setSuccess('Đã cập nhật phần thưởng.');
      } else {
        await apiClient.post('/admin/loyalty-rewards', payload);
        setSuccess('Đã tạo phần thưởng mới.');
      }
      closeForm();
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Lưu thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (r) => {
    try {
      await apiClient.put(`/admin/loyalty-rewards/${r._id}`, { isActive: !r.isActive });
      load();
    } catch { /* silent */ }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Xóa phần thưởng "${r.name}"?`)) return;
    try {
      await apiClient.delete(`/admin/loyalty-rewards/${r._id}`);
      setSuccess('Đã xóa phần thưởng.');
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Xóa thất bại.');
    }
  };

  const F = ({ label, required, children }) => (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-600">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  );

  const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100';
  const sel = inp + ' bg-white';

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Phần thưởng điểm</h1>
          <p className="text-sm text-slate-500 mt-0.5">Quản lý các phần thưởng người dùng có thể đổi bằng điểm tích lũy</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
          </svg>
          Thêm phần thưởng
        </button>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 font-medium">{success}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rewards.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">🎁</div>
            <p className="font-semibold text-slate-600">Chưa có phần thưởng nào</p>
            <p className="text-sm text-slate-400 mt-1">Nhấn "Thêm phần thưởng" để tạo mới</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Tên phần thưởng</th>
                <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Điểm cần</th>
                <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Hạng tối thiểu</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Ưu đãi</th>
                <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Hiệu lực</th>
                <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Đã đổi</th>
                <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rewards.map(r => (
                <tr key={r._id} className={`hover:bg-slate-50 transition-colors ${!r.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{r.name}</p>
                    {r.description && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{r.description}</p>}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-bold text-blue-600">{r.pointsRequired.toLocaleString()}</span>
                    <span className="text-xs text-slate-400 ml-0.5">đ</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${TIER_COLOR[r.requiredTier] || ''}`}>
                      {TIER_LABEL[r.requiredTier]}+
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-700 font-medium">
                    {r.discountType === 'percentage'
                      ? `Giảm ${r.discountValue}%${r.maxDiscountAmount ? ` (tối đa ${fmt(r.maxDiscountAmount)})` : ''}`
                      : `Giảm ${fmt(r.discountValue)}`}
                  </td>
                  <td className="px-4 py-4 text-center text-slate-500">{r.voucherValidDays} ngày</td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-semibold text-slate-700">{r.redeemedCount}</span>
                    {r.maxRedeemCount && <span className="text-slate-400">/{r.maxRedeemCount}</span>}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => handleToggle(r)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${r.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${r.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(r)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900">
                {editId ? 'Chỉnh sửa phần thưởng' : 'Thêm phần thưởng mới'}
              </h2>
              <button onClick={closeForm} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500">✕</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-2.5">{error}</div>
              )}

              <F label="Tên phần thưởng" required>
                <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ví dụ: Phiếu giảm 10%" />
              </F>
              <F label="Mô tả">
                <input className={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả ngắn (tuỳ chọn)" />
              </F>

              <div className="grid grid-cols-2 gap-3">
                <F label="Điểm cần đổi" required>
                  <input type="number" min="1" className={inp} value={form.pointsRequired} onChange={e => setForm(f => ({ ...f, pointsRequired: e.target.value }))} placeholder="500" />
                </F>
                <F label="Hạng tối thiểu" required>
                  <select className={sel} value={form.requiredTier} onChange={e => setForm(f => ({ ...f, requiredTier: e.target.value }))}>
                    {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </F>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <F label="Loại giảm giá" required>
                  <select className={sel} value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value }))}>
                    <option value="percentage">Phần trăm (%)</option>
                    <option value="fixed">Số tiền cố định</option>
                  </select>
                </F>
                <F label={form.discountType === 'percentage' ? 'Giảm (%)' : 'Giảm (VND)'} required>
                  <input type="number" min="1" className={inp} value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))} placeholder={form.discountType === 'percentage' ? '10' : '50000'} />
                </F>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {form.discountType === 'percentage' && (
                  <F label="Giảm tối đa (VND)">
                    <input type="number" min="0" className={inp} value={form.maxDiscountAmount} onChange={e => setForm(f => ({ ...f, maxDiscountAmount: e.target.value }))} placeholder="200000 (để trống = không giới hạn)" />
                  </F>
                )}
                <F label="Đơn tối thiểu (VND)">
                  <input type="number" min="0" className={inp} value={form.minPurchaseAmount} onChange={e => setForm(f => ({ ...f, minPurchaseAmount: e.target.value }))} placeholder="0" />
                </F>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <F label="Hiệu lực voucher (ngày)" required>
                  <input type="number" min="1" className={inp} value={form.voucherValidDays} onChange={e => setForm(f => ({ ...f, voucherValidDays: e.target.value }))} placeholder="30" />
                </F>
                <F label="Giới hạn lượt đổi">
                  <input type="number" min="1" className={inp} value={form.maxRedeemCount} onChange={e => setForm(f => ({ ...f, maxRedeemCount: e.target.value }))} placeholder="(để trống = không giới hạn)" />
                </F>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={closeForm} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Huỷ
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Đang lưu...' : editId ? 'Cập nhật' : 'Tạo phần thưởng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
