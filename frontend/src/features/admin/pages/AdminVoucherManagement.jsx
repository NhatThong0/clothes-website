import React, { useEffect, useState } from 'react';
import apiClient from '@features/shared/services/apiClient';

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPES = [
  { value: 'coupon',     label: 'Mã Coupon',         icon: '🎟️', color: 'blue'   },
  { value: 'flash_sale', label: 'Flash Sale',         icon: '⚡', color: 'amber'  },
];
const TYPE_COLOR = {
  coupon:     'bg-blue-50 text-blue-700 border-blue-200',
  discount:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  flash_sale: 'bg-amber-50 text-amber-700 border-amber-200',
  holiday:    'bg-rose-50 text-rose-700 border-rose-200',
  loyalty:    'bg-violet-50 text-violet-700 border-violet-200',
};
const LOYALTY_TIERS = ['all','bronze','silver','gold','platinum'];
const TIER_LABEL    = { all:'Tất cả', bronze:'Đồng', silver:'Bạc', gold:'Vàng', platinum:'Kim Cương' };

const fmtPrice = v => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(v);
const fmtDate  = d => new Date(d).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});
const fmtDateTime = d => new Date(d).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const toDateTimeLocal = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition';

function Field({ label, required, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

const FLASH_DURATIONS = [
  { value: 1,  label: '1 giờ' },
  { value: 2,  label: '2 giờ' },
  { value: 3,  label: '3 giờ' },
  { value: 6,  label: '6 giờ' },
  { value: 12, label: '12 giờ' },
  { value: 24, label: '1 ngày' },
];

const emptyForm = {
  type:'coupon', name:'', description:'', isActive:true,
  startDate:'', endDate:'', flashSaleDuration: 1,
  discountType:'percentage', discountValue:'', maxDiscountAmount:'', minOrderAmount:'0', minQuantity:'0',
  applyTo:'all', productIds:[], categoryIds:[],
  userScope:'all', allowedUsers:[],
  code:'', maxUsageCount:'', maxUsagePerUser:'1',
  flashSaleStock:'', flashSaleHour:{ start:'', end:'' },
  flashSaleItems:[],
  holidayName:'', autoApply:false,
  loyaltyTier:'all', pointsRequired:'0', pointsReward:'0',
};

const DEFAULT_REWARD_FORM = {
  name: '', description: '', pointsRequired: '', requiredTier: 'bronze',
  discountType: 'percentage', discountValue: '', maxDiscountAmount: '',
  minPurchaseAmount: '', voucherValidDays: '30', maxRedeemCount: '', maxRedeemPerUser: '',
};
const REWARD_TIERS = [
  { value: 'bronze',   label: '🥉 Đồng (và cao hơn)' },
  { value: 'silver',   label: '🥈 Bạc (và cao hơn)' },
  { value: 'gold',     label: '🥇 Vàng (và cao hơn)' },
  { value: 'platinum', label: '💎 Kim Cương' },
];
const REWARD_TIER_COLOR = {
  bronze:   'bg-amber-50 text-amber-700 border-amber-200',
  silver:   'bg-slate-100 text-slate-600 border-slate-300',
  gold:     'bg-yellow-50 text-yellow-700 border-yellow-300',
  platinum: 'bg-sky-50 text-sky-600 border-sky-300',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminVoucherManagement() {
  const [promos,      setPromos]      = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [typeFilter,  setTypeFilter]  = useState('');
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [form,        setForm]        = useState(emptyForm);
  const [saving,      setSaving]      = useState(false);
  const [deleteId,    setDeleteId]    = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [products,    setProducts]    = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [flashAddProductId,  setFlashAddProductId]  = useState('');
  const [addPromoProductId,  setAddPromoProductId]  = useState('');
  const [userSearch,         setUserSearch]         = useState('');
  const [userSearchResults,  setUserSearchResults]  = useState([]);
  const [userSearchLoading,  setUserSearchLoading]  = useState(false);

  // Rewards tab state
  const [activeSection,  setActiveSection]  = useState('promos');
  const [rewards,        setRewards]        = useState([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editRewardId,   setEditRewardId]   = useState(null);
  const [rewardForm,     setRewardForm]     = useState(DEFAULT_REWARD_FORM);
  const [savingReward,   setSavingReward]   = useState(false);
  const [rewardError,    setRewardError]    = useState('');
  const [rewardSuccess,  setRewardSuccess]  = useState('');

  useEffect(() => { load(); }, [page, typeFilter]);

  useEffect(() => {
    apiClient.get('/admin/products?limit=200')
      .then(r => setProducts(r.data?.data?.products || []))
      .catch(() => setProducts([]));
    apiClient.get('/admin/categories?limit=200')
      .then(r => setCategories(r.data?.data?.categories || r.data?.data || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (activeSection === 'rewards') loadRewards();
  }, [activeSection]);

  useEffect(() => {
    if (!userSearch.trim()) { setUserSearchResults([]); return; }
    setUserSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get(`/admin/users?search=${encodeURIComponent(userSearch)}&limit=10`);
        setUserSearchResults(res.data?.data?.users || []);
      } catch { setUserSearchResults([]); }
      finally { setUserSearchLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [userSearch]);

  const loadRewards = async () => {
    setRewardsLoading(true);
    try {
      const res = await apiClient.get('/admin/loyalty-rewards');
      setRewards(res.data.data || []);
    } catch { /* silent */ }
    finally { setRewardsLoading(false); }
  };

  const openCreateReward = () => {
    setEditRewardId(null);
    setRewardForm(DEFAULT_REWARD_FORM);
    setRewardError('');
    setShowRewardForm(true);
  };
  const openEditReward = (r) => {
    setEditRewardId(r._id);
    setRewardForm({
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
      maxRedeemPerUser:  r.maxRedeemPerUser != null ? String(r.maxRedeemPerUser) : '',
    });
    setRewardError('');
    setShowRewardForm(true);
  };
  const closeRewardForm = () => { setShowRewardForm(false); setEditRewardId(null); setRewardError(''); };

  const handleSaveReward = async () => {
    if (!rewardForm.name.trim() || !rewardForm.pointsRequired || !rewardForm.discountValue) {
      setRewardError('Vui lòng điền đầy đủ các trường bắt buộc (*).');
      return;
    }
    setSavingReward(true);
    setRewardError('');
    try {
      const payload = {
        name:              rewardForm.name.trim(),
        description:       rewardForm.description.trim(),
        pointsRequired:    Number(rewardForm.pointsRequired),
        requiredTier:      rewardForm.requiredTier,
        discountType:      rewardForm.discountType,
        discountValue:     Number(rewardForm.discountValue),
        maxDiscountAmount: rewardForm.maxDiscountAmount ? Number(rewardForm.maxDiscountAmount) : null,
        minPurchaseAmount: rewardForm.minPurchaseAmount ? Number(rewardForm.minPurchaseAmount) : 0,
        voucherValidDays:  Number(rewardForm.voucherValidDays) || 30,
        maxRedeemCount:    rewardForm.maxRedeemCount ? Number(rewardForm.maxRedeemCount) : null,
        maxRedeemPerUser:  rewardForm.maxRedeemPerUser ? Number(rewardForm.maxRedeemPerUser) : null,
      };
      if (editRewardId) {
        await apiClient.put(`/admin/loyalty-rewards/${editRewardId}`, payload);
        setRewardSuccess('Đã cập nhật phần thưởng.');
      } else {
        await apiClient.post('/admin/loyalty-rewards', payload);
        setRewardSuccess('Đã tạo phần thưởng mới.');
      }
      closeRewardForm();
      loadRewards();
      setTimeout(() => setRewardSuccess(''), 3000);
    } catch (err) {
      setRewardError(err.response?.data?.message || 'Lưu thất bại.');
    } finally {
      setSavingReward(false);
    }
  };

  const handleToggleReward = async (r) => {
    try {
      await apiClient.put(`/admin/loyalty-rewards/${r._id}`, { isActive: !r.isActive });
      loadRewards();
    } catch { /* silent */ }
  };

  const handleDeleteReward = async (r) => {
    if (!window.confirm(`Xóa phần thưởng "${r.name}"?`)) return;
    try {
      await apiClient.delete(`/admin/loyalty-rewards/${r._id}`);
      setRewardSuccess('Đã xóa phần thưởng.');
      loadRewards();
      setTimeout(() => setRewardSuccess(''), 3000);
    } catch { setRewardError('Xóa thất bại.'); }
  };

  const rF = (k, v) => setRewardForm(p => ({ ...p, [k]: v }));

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (typeFilter) params.append('type', typeFilter);
      const res = await apiClient.get(`/promotions?${params}`);
      setPromos(res.data?.data?.promotions || []);
      setTotal(res.data?.data?.pagination?.total || 0);
      setTotalPages(res.data?.data?.pagination?.pages || 1);
    } catch { /* handled */ }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDrawerOpen(true); };
  const openEdit   = p  => {
    setEditing(p);
    const flashItems = Array.isArray(p.flashSaleItems) && p.flashSaleItems.length > 0
      ? p.flashSaleItems.map(it => ({ productId: it.productId, price: (it.price ?? '').toString() }))
      : (p.productIds || []).map(pid => ({ productId: pid, price: (p.flashSalePrice ?? p.discountValue ?? '').toString() }));

    setForm({
      type:              p.type,
      name:              p.name,
      description:       p.description || '',
      isActive:          p.isActive,
      startDate:         toDateTimeLocal(p.startDate),
      endDate:           toDateTimeLocal(p.endDate),
      discountType:      p.discountType || 'percentage',
      discountValue:     p.discountValue?.toString() || '',
      maxDiscountAmount: p.maxDiscountAmount?.toString() || '',
      minOrderAmount:    p.minOrderAmount?.toString() || '0',
      minQuantity:       p.minQuantity?.toString() || '0',
      applyTo:           p.applyTo || 'all',
      productIds:        (p.productIds || []).map(String),
      categoryIds:       (p.categoryIds || []).map(String),
      userScope:         p.userScope || 'all',
      allowedUsers:      Array.isArray(p.allowedUsers) ? p.allowedUsers.map(u => typeof u === 'object' ? { _id: String(u._id), name: u.name || '', email: u.email || '' } : { _id: String(u), name: '', email: '' }) : [],
      code:              p.code || '',
      maxUsageCount:     p.maxUsageCount?.toString() || '',
      maxUsagePerUser:   p.maxUsagePerUser?.toString() || '1',
      flashSaleStock:    p.flashSaleStock?.toString() || '',
      flashSaleHour:     p.flashSaleHour || { start:'', end:'' },
      flashSaleItems:    flashItems,
      flashSaleDuration: p.type === 'flash_sale' && p.startDate && p.endDate
        ? Math.max(1, Math.round((new Date(p.endDate) - new Date(p.startDate)) / 3600000))
        : 1,
      holidayName:       p.holidayName || '',
      autoApply:         p.autoApply || false,
      loyaltyTier:       p.loyaltyTier || 'all',
      pointsRequired:    p.pointsRequired?.toString() || '0',
      pointsReward:      p.pointsReward?.toString() || '0',
    });
    setDrawerOpen(true);
  };
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        discountValue:     parseFloat(form.discountValue) || 0,
        maxDiscountAmount: form.maxDiscountAmount ? parseFloat(form.maxDiscountAmount) : null,
        minOrderAmount:    parseFloat(form.minOrderAmount) || 0,
        minQuantity:       parseInt(form.minQuantity) || 0,
        maxUsageCount:     form.maxUsageCount ? parseInt(form.maxUsageCount) : null,
        maxUsagePerUser:   parseInt(form.maxUsagePerUser) || 1,
        flashSaleStock:    form.flashSaleStock ? parseInt(form.flashSaleStock) : null,
        pointsRequired:    parseInt(form.pointsRequired) || 0,
        pointsReward:      parseInt(form.pointsReward) || 0,
      };

      if (form.type === 'flash_sale') {
        const items = (form.flashSaleItems || [])
          .filter(it => it?.productId)
          .map(it => ({ productId: it.productId, price: parseFloat(it.price) }))
          .filter(it => Number.isFinite(it.price) && it.price > 0);
        payload.flashSaleItems = items;
        payload.productIds = items.map(it => it.productId);
        payload.flashSalePrice = null;
        // Tính endDate = startDate + duration (giờ)
        if (form.startDate) {
          const end = new Date(new Date(form.startDate).getTime() + Number(form.flashSaleDuration) * 3600000);
          payload.endDate = end.toISOString();
        }
      } else {
        // applyTo scope
        payload.productIds  = form.applyTo === 'specific_products' ? (form.productIds || []) : [];
        payload.categoryIds = [];
      }
      // User scope
      payload.userScope    = form.userScope || 'all';
      payload.allowedUsers = form.userScope === 'specific' ? (form.allowedUsers || []).map(u => u._id) : [];
      if (editing) await apiClient.put(`/promotions/${editing._id}`, payload);
      else          await apiClient.post('/promotions', payload);
      closeDrawer();
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi lưu');
    } finally { setSaving(false); }
  };

  const toggle = async p => {
    try { await apiClient.patch(`/promotions/${p._id}/toggle`); load(); } catch { /* handled */ }
  };

  const confirmDelete = async () => {
    try { await apiClient.delete(`/promotions/${deleteId}`); load(); } catch { /* handled */ }
    finally { setDeleteId(null); }
  };

  const now = new Date();
  const getStatus = p => {
    if (!p.isActive) return { label:'Tắt', cls:'bg-slate-100 text-slate-500' };
    if (now < new Date(p.startDate)) return { label:'Sắp diễn ra', cls:'bg-sky-50 text-sky-600 border border-sky-200' };
    if (now > new Date(p.endDate))   return { label:'Hết hạn', cls:'bg-rose-50 text-rose-600 border border-rose-200' };
    return { label:'Đang chạy', cls:'bg-emerald-50 text-emerald-700 border border-emerald-200' };
  };

  const t = TYPES.find(t => t.value === form.type);
  const productNameById  = (id) => products.find((p) => String(p._id) === String(id))?.name  || String(id || '').slice(-6);
  const categoryNameById = (id) => categories.find((c) => String(c._id) === String(id))?.name || String(id || '').slice(-6);
  const productById = (id) => products.find((p) => String(p._id) === String(id)) || null;
  const getSellingPriceInfo = (id) => {
    const p = productById(id);
    if (!p) return null;
    const basePrice = Number(p.price) || 0;
    const discount = Number(p.discount) || 0;
    const sellingPrice = discount > 0 ? Math.round(basePrice * (1 - discount / 100)) : basePrice;
    return { basePrice, discount, sellingPrice };
  };

  return (
    <div className="admin-page min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white/92 backdrop-blur-xl border-b border-slate-200/70 px-6 py-4 sticky top-0 z-20 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Quản lý Khuyến mãi</h1>
            {activeSection === 'promos'
              ? <p className="text-sm text-slate-400 mt-0.5">{total} chương trình</p>
              : <p className="text-sm text-slate-400 mt-0.5">{rewards.length} phần thưởng điểm</p>
            }
          </div>
          {activeSection === 'promos'
            ? <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">+ Tạo khuyến mãi</button>
            : <button onClick={openCreateReward} className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">+ Thêm phần thưởng</button>
          }
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <button onClick={() => setActiveSection('promos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${activeSection === 'promos' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>
            🎟️ Khuyến mãi
          </button>
          <button onClick={() => setActiveSection('rewards')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${activeSection === 'rewards' ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300'}`}>
            ⭐ Phần thưởng đổi điểm
          </button>

          {/* Type filter pills — only when in promos section */}
          {activeSection === 'promos' && (
            <>
              <span className="text-slate-200 text-sm mx-1">|</span>
              {[{value:'',label:'Tất cả',icon:'📋'}, ...TYPES].map(t => (
                <button key={t.value} onClick={() => { setTypeFilter(t.value); setPage(1); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    typeFilter === t.value
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                  }`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* ── Rewards section ── */}
        {activeSection === 'rewards' && (
          <div className="space-y-4">
            {rewardSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 font-medium">{rewardSuccess}</div>
            )}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {rewardsLoading ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"/></div>
              ) : rewards.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-5xl mb-3">⭐</div>
                  <p className="font-semibold text-slate-600">Chưa có phần thưởng nào</p>
                  <p className="text-sm text-slate-400 mt-1">Nhấn "Thêm phần thưởng" để tạo phần thưởng đổi điểm</p>
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
                          <span className="font-bold text-violet-600">{r.pointsRequired.toLocaleString()}</span>
                          <span className="text-xs text-slate-400 ml-0.5">đ</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${REWARD_TIER_COLOR[r.requiredTier] || ''}`}>
                            {REWARD_TIERS.find(t => t.value === r.requiredTier)?.label.split(' ')[0]}+
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-700 font-medium">
                          {r.discountType === 'percentage'
                            ? `Giảm ${r.discountValue}%${r.maxDiscountAmount ? ` (tối đa ${fmtPrice(r.maxDiscountAmount)})` : ''}`
                            : `Giảm ${fmtPrice(r.discountValue)}`}
                        </td>
                        <td className="px-4 py-4 text-center text-slate-500">{r.voucherValidDays} ngày</td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-semibold text-slate-700">{r.redeemedCount}</span>
                          {r.maxRedeemCount && <span className="text-slate-400">/{r.maxRedeemCount}</span>}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button onClick={() => handleToggleReward(r)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${r.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${r.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openEditReward(r)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors">Sửa</button>
                            <button onClick={() => handleDeleteReward(r)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors">Xóa</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Promotions section ── */}
        {activeSection === 'promos' && (loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>
        ) : promos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 flex flex-col items-center gap-3 text-slate-400">
            <span className="text-5xl">🎁</span>
            <span className="text-sm font-medium">Chưa có khuyến mãi nào</span>
            <button onClick={openCreate} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
              Tạo khuyến mãi đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {promos.map(p => {
              const typeInfo = TYPES.find(t => t.value === p.type) || TYPES[0];
              const status   = getStatus(p);
              const flashItems = p.type === 'flash_sale'
                ? (Array.isArray(p.flashSaleItems) && p.flashSaleItems.length > 0
                  ? p.flashSaleItems
                  : (p.productIds || []).map(pid => ({ productId: pid, price: (p.flashSalePrice ?? p.discountValue) }))
                )
                : [];
              const flashMinPrice = flashItems.length > 0
                ? Math.min(...flashItems.map(it => Number(it.price) || Infinity))
                : null;
              return (
                <div key={p._id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all group overflow-hidden ${!p.isActive ? 'opacity-60' : 'border-slate-100'}`}>
                  {/* Color top bar */}
                  <div className={`h-1 w-full ${
                    p.type==='coupon'?'bg-blue-500':p.type==='discount'?'bg-emerald-500':
                    p.type==='flash_sale'?'bg-amber-500':p.type==='holiday'?'bg-rose-500':'bg-violet-500'
                  }`}/>
                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{typeInfo.icon}</span>
                        <div>
                          <p className="font-bold text-slate-800 text-sm leading-tight">{p.name}</p>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLOR[p.type]}`}>
                            {typeInfo.label}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${status.cls}`}>
                        {status.label}
                      </span>
                    </div>

                    {/* Discount value */}
                    <div className="bg-slate-50 rounded-xl p-3 mb-3">
                      <p className="text-2xl font-black text-slate-900">
                        {p.type === 'flash_sale'
                          ? (flashItems.length <= 1
                            ? fmtPrice(Number(flashItems?.[0]?.price) || 0)
                            : `Từ ${fmtPrice(flashMinPrice)}`)
                          : p.discountType === 'freeship' ? '🚚 Miễn ship'
                            : p.discountType === 'percentage' ? `${p.discountValue}%`
                              : fmtPrice(p.discountValue)}
                      </p>
                      {p.minOrderAmount > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">Đơn tối thiểu {fmtPrice(p.minOrderAmount)}</p>
                      )}
                      {p.type === 'coupon' && p.code && (
                        <p className="font-mono text-xs font-bold text-blue-600 mt-1 tracking-widest bg-blue-50 px-2 py-1 rounded-lg inline-block">
                          {p.code}
                        </p>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mb-3">
                      <div><span className="text-slate-400">Bắt đầu:</span> <span className="font-medium text-slate-700">{fmtDateTime(p.startDate)}</span></div>
                      <div><span className="text-slate-400">Kết thúc:</span> <span className="font-medium text-slate-700">{fmtDateTime(p.endDate)}</span></div>
                      {p.type === 'flash_sale' && (
                        <>
                          <div><span className="text-slate-400">Slot:</span> <span className="font-bold text-amber-600">{p.flashSaleRemaining ?? '∞'}</span></div>
                          <div><span className="text-slate-400">Sản phẩm:</span> <span className="font-medium text-slate-700">{flashItems.length} item</span></div>
                          <div className="col-span-2 space-y-1">
                            {flashItems.slice(0, 4).map((it, idx) => (
                              <div key={idx} className="flex items-center justify-between rounded-lg bg-white px-2 py-1 border border-slate-100">
                                <div className="min-w-0 pr-2">
                                  <span className="block truncate text-slate-600">{productNameById(it.productId)}</span>
                                  {(() => {
                                    const selling = getSellingPriceInfo(it.productId);
                                    if (!selling) return null;
                                    return (
                                      <span className="block text-[11px] text-slate-400">
                                        Đang bán: <span className="line-through">{fmtPrice(selling.sellingPrice)}</span>
                                      </span>
                                    );
                                  })()}
                                </div>
                                <span className="font-semibold text-slate-800">{fmtPrice(Number(it.price) || 0)}</span>
                              </div>
                            ))}
                            {flashItems.length > 4 && (
                              <div className="text-[11px] text-slate-400">+{flashItems.length - 4} sản phẩm khác</div>
                            )}
                          </div>
                        </>
                      )}
                      {p.maxUsageCount && (
                        <div className="col-span-2">
                          <div className="flex justify-between mb-1">
                            <span className="text-slate-400">Đã dùng</span>
                            <span className="font-semibold">{p.usageCount||0}/{p.maxUsageCount}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full"
                              style={{ width:`${Math.min(((p.usageCount||0)/p.maxUsageCount)*100,100)}%` }}/>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Scope badge */}
                    {p.type !== 'flash_sale' && p.applyTo && p.applyTo !== 'all' && (
                      <div className="col-span-2 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Áp dụng:</span>
                        {p.applyTo === 'specific_categories' && (
                          (p.categoryIds || []).slice(0, 3).map(id => (
                            <span key={id} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 font-semibold">
                              📂 {categoryNameById(id)}
                            </span>
                          ))
                        )}
                        {p.applyTo === 'specific_products' && (
                          (p.productIds || []).slice(0, 3).map(id => (
                            <span key={id} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-semibold">
                              📦 {productNameById(id)}
                            </span>
                          ))
                        )}
                        {((p.applyTo === 'specific_categories' && (p.categoryIds||[]).length > 3) ||
                          (p.applyTo === 'specific_products'   && (p.productIds||[]).length > 3)) && (
                          <span className="text-[11px] text-slate-400">
                            +{p.applyTo === 'specific_categories' ? (p.categoryIds.length - 3) : (p.productIds.length - 3)} khác
                          </span>
                        )}
                      </div>
                    )}

                    {/* User scope badge */}
                    {p.userScope === 'specific' && (
                      <div className="flex items-center gap-1 mb-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Người dùng:</span>
                        {(p.allowedUsers || []).length === 0
                          ? <span className="text-[11px] text-amber-600">Chưa chỉ định</span>
                          : <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-200 font-semibold">🎯 {(p.allowedUsers||[]).length} người</span>
                        }
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-50">
                      <button onClick={() => toggle(p)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                          p.isActive
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}>
                        {p.isActive ? '⏸ Tắt' : '▶ Bật'}
                      </button>
                      <button onClick={() => openEdit(p)}
                        className="flex-1 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-colors">
                        ✏️ Sửa
                      </button>
                      <button onClick={() => setDeleteId(p._id)}
                        className="p-1.5 hover:bg-rose-50 text-rose-400 rounded-lg transition-colors">🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-1">
            <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1}
              className="px-3 py-1.5 text-xs border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 font-medium">← Trước</button>
            {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
              <button key={p} onClick={()=>setPage(p)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium border ${page===p?'bg-blue-600 text-white border-blue-600':'bg-white border-slate-200 hover:bg-slate-50'}`}>{p}</button>
            ))}
            <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
              className="px-3 py-1.5 text-xs border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 font-medium">Sau →</button>
          </div>
        )}
      </div>

      {/* ── Drawer ── */}
      {drawerOpen && (
        <div className="admin-overlay fixed inset-0 z-50 p-3 sm:p-6" onClick={closeDrawer}>
          <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-shell w-full flex max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex-col overflow-hidden" style={{animation:'popIn .22s cubic-bezier(.2,.8,.2,1)'}}>
            <div className="admin-panel-header sticky top-0 z-10 flex items-center justify-between px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">
                {editing ? '✏️ Chỉnh sửa' : '🎁 Tạo khuyến mãi mới'}
              </h2>
              <button onClick={closeDrawer} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="px-6 py-5 space-y-5">

                {/* Type selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Loại khuyến mãi <span className="text-rose-500">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    {TYPES.map(type => (
                      <button key={type.value} type="button"
                        onClick={() => f('type', type.value)}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                          form.type === type.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-500 hover:border-blue-300'
                        }`}>
                        <span className="text-xl">{type.icon}</span>
                        <span className="text-center leading-tight">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <hr className="border-slate-100"/>

                {/* Basic info */}
                <section className="space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thông tin chung</h3>
                  <Field label="Tên chương trình" required>
                    <input type="text" required value={form.name} onChange={e=>f('name',e.target.value)}
                      placeholder={`VD: ${t?.label} tháng 6`} className={inputCls}/>
                  </Field>
                  <Field label="Mô tả">
                    <textarea rows={2} value={form.description} onChange={e=>f('description',e.target.value)}
                      placeholder="Mô tả ngắn..." className={inputCls+' resize-none'}/>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Ngày bắt đầu" required>
                      <input type="datetime-local" required value={form.startDate} onChange={e=>f('startDate',e.target.value)} className={inputCls}/>
                    </Field>
                    {form.type === 'flash_sale' ? (
                      <Field label="Thời lượng sự kiện" required>
                        <div className="grid grid-cols-3 gap-1.5">
                          {FLASH_DURATIONS.map(d => (
                            <button key={d.value} type="button"
                              onClick={() => f('flashSaleDuration', d.value)}
                              className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                form.flashSaleDuration === d.value
                                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                                  : 'border-slate-200 text-slate-500 hover:border-amber-300'
                              }`}>
                              {d.label}
                            </button>
                          ))}
                        </div>
                        {form.startDate && (
                          <p className="text-[11px] text-amber-600 font-semibold mt-1.5">
                            ⏰ Kết thúc: {new Date(new Date(form.startDate).getTime() + form.flashSaleDuration * 3600000).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                          </p>
                        )}
                      </Field>
                    ) : (
                      <Field label="Ngày kết thúc" required>
                        <input type="datetime-local" required value={form.endDate} onChange={e=>f('endDate',e.target.value)} className={inputCls}/>
                      </Field>
                    )}
                  </div>
                </section>

                <hr className="border-slate-100"/>

                {/* Discount config */}
                {form.type !== 'flash_sale' && (
                <section className="space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cấu hình giảm giá</h3>
                  <Field label="Kiểu giảm" required>
                    <select value={form.discountType} onChange={e=>f('discountType',e.target.value)} className={inputCls}>
                      <option value="percentage">Phần trăm (%)</option>
                      <option value="fixed">Số tiền cố định (₫)</option>
                      <option value="freeship">Miễn phí vận chuyển</option>
                    </select>
                  </Field>
                  {form.discountType !== 'freeship' && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={form.discountType==='percentage'?'Giá trị (%)':'Số tiền (₫)'} required>
                        <input type="number" required min={0} max={form.discountType==='percentage'?100:undefined}
                          value={form.discountValue} onChange={e=>f('discountValue',e.target.value)} className={inputCls}/>
                      </Field>
                      {form.discountType==='percentage' && (
                        <Field label="Giảm tối đa (₫)" hint="Để trống = không giới hạn">
                          <input type="number" min={0} value={form.maxDiscountAmount} onChange={e=>f('maxDiscountAmount',e.target.value)} className={inputCls}/>
                        </Field>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Đơn tối thiểu (₫)">
                      <input type="number" min={0} value={form.minOrderAmount} onChange={e=>f('minOrderAmount',e.target.value)} className={inputCls}/>
                    </Field>
                    <Field label="Số SP tối thiểu" hint="0 = không yêu cầu">
                      <input type="number" min={0} value={form.minQuantity} onChange={e=>f('minQuantity',e.target.value)} className={inputCls}/>
                    </Field>
                  </div>
                </section>
                )}

                {/* Apply-to scope — not for flash_sale (it has its own product section) */}
                {form.type !== 'flash_sale' && (
                <>
                  <hr className="border-slate-100"/>
                  <section className="space-y-3">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phạm vi sản phẩm áp dụng</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'all',               label: 'Tất cả SP',      icon: '🌐' },
                        { value: 'specific_products', label: 'Chọn SP cụ thể', icon: '📦' },
                      ].map(opt => (
                        <button key={opt.value} type="button"
                          onClick={() => { f('applyTo', opt.value); f('productIds', []); }}
                          className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                            form.applyTo === opt.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-slate-200 text-slate-500 hover:border-blue-300'
                          }`}>
                          <span className="text-xl">{opt.icon}</span>
                          <span className="text-center leading-tight">{opt.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Product picker — grouped by category */}
                    {form.applyTo === 'specific_products' && (() => {
                      const getCatId = p => String(p.category?._id || p.category || '');
                      const selectedIds = form.productIds || [];
                      const q = addPromoProductId.toLowerCase();

                      const toggleProduct = (p) => {
                        const pid = String(p._id);
                        f('productIds', selectedIds.includes(pid)
                          ? selectedIds.filter(id => id !== pid)
                          : [...selectedIds, pid]);
                      };

                      const toggleCategory = (items) => {
                        const pids = items.map(p => String(p._id));
                        const allSel = pids.every(pid => selectedIds.includes(pid));
                        f('productIds', allSel
                          ? selectedIds.filter(id => !pids.includes(id))
                          : [...new Set([...selectedIds, ...pids])]);
                      };

                      // Build groups: categories + uncategorized at end
                      const groups = [
                        ...categories.map(cat => ({
                          id: String(cat._id),
                          name: cat.name,
                          items: products.filter(p => getCatId(p) === String(cat._id)),
                        })),
                        {
                          id: '__none__',
                          name: 'Chưa phân loại',
                          items: products.filter(p => !categories.some(c => String(c._id) === getCatId(p))),
                        },
                      ].filter(g => g.items.length > 0);

                      // When searching: flat filtered list across all groups
                      const isSearching = q.length > 0;
                      const flatFiltered = isSearching
                        ? products.filter(p => p.name.toLowerCase().includes(q))
                        : [];

                      return (
                        <div className="space-y-2">
                          {/* Search */}
                          <input type="text" value={addPromoProductId}
                            onChange={e => setAddPromoProductId(e.target.value)}
                            placeholder="🔍 Tìm sản phẩm theo tên..."
                            className={inputCls}/>

                          {/* Summary bar */}
                          <div className="flex items-center justify-between px-1">
                            {selectedIds.length > 0
                              ? <p className="text-[11px] text-blue-600 font-semibold">✓ Đã chọn {selectedIds.length} sản phẩm</p>
                              : <p className="text-[11px] text-slate-400">Chưa chọn sản phẩm nào</p>}
                            {selectedIds.length > 0 && (
                              <button type="button" onClick={() => f('productIds', [])}
                                className="text-[11px] text-rose-400 hover:text-rose-600 font-semibold">Bỏ chọn tất cả</button>
                            )}
                          </div>

                          {/* List */}
                          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                            {isSearching ? (
                              /* Flat search results */
                              flatFiltered.length === 0
                                ? <p className="text-xs text-slate-400 text-center py-5">Không tìm thấy sản phẩm</p>
                                : flatFiltered.map(p => {
                                    const sel = selectedIds.includes(String(p._id));
                                    const cat = categories.find(c => String(c._id) === getCatId(p));
                                    return (
                                      <label key={p._id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-100 last:border-0 transition-colors ${sel ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                                        <input type="checkbox" checked={sel} onChange={() => toggleProduct(p)}
                                          className="accent-blue-600 w-4 h-4 flex-shrink-0"/>
                                        <span className="text-sm text-slate-700 flex-1 truncate">{p.name}</span>
                                        {cat && <span className="text-[10px] text-slate-400 flex-shrink-0">{cat.name}</span>}
                                        {sel && <span className="text-blue-500 text-xs ml-1">✓</span>}
                                      </label>
                                    );
                                  })
                            ) : (
                              /* Grouped by category */
                              groups.map(group => {
                                const selCount = group.items.filter(p => selectedIds.includes(String(p._id))).length;
                                const allSel   = selCount === group.items.length;
                                const someSel  = selCount > 0 && !allSel;
                                return (
                                  <div key={group.id}>
                                    {/* Category header row */}
                                    <label className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-200 transition-colors sticky top-0 z-10 ${
                                      allSel ? 'bg-blue-600' : someSel ? 'bg-blue-50' : 'bg-slate-50'
                                    }`}>
                                      <input
                                        type="checkbox"
                                        checked={allSel}
                                        ref={el => { if (el) el.indeterminate = someSel; }}
                                        onChange={() => toggleCategory(group.items)}
                                        className="accent-blue-600 w-4 h-4 flex-shrink-0"/>
                                      <span className={`text-xs font-bold flex-1 uppercase tracking-wide ${allSel ? 'text-white' : 'text-slate-600'}`}>
                                        📂 {group.name}
                                      </span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        allSel  ? 'bg-white/25 text-white' :
                                        someSel ? 'bg-blue-100 text-blue-600' :
                                                  'bg-slate-200 text-slate-500'
                                      }`}>{selCount}/{group.items.length}</span>
                                    </label>
                                    {/* Products under this category */}
                                    {group.items.map(p => {
                                      const sel = selectedIds.includes(String(p._id));
                                      return (
                                        <label key={p._id} className={`flex items-center gap-3 pl-10 pr-4 py-2.5 cursor-pointer border-b border-slate-100 last:border-0 transition-colors ${sel ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                                          <input type="checkbox" checked={sel} onChange={() => toggleProduct(p)}
                                            className="accent-blue-600 w-4 h-4 flex-shrink-0"/>
                                          <span className="text-sm text-slate-700 flex-1 truncate">{p.name}</span>
                                          {sel && <span className="text-blue-500 text-xs">✓</span>}
                                        </label>
                                      );
                                    })}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </section>
                </>
                )}

                <hr className="border-slate-100"/>

                {/* Type-specific fields */}

                {/* COUPON */}
                {form.type === 'coupon' && (
                  <section className="space-y-3">
                    <h3 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">🎟️ Cấu hình Coupon</h3>
                    <Field label="Mã coupon" hint="Để trống để hệ thống tự tạo mã ngẫu nhiên">
                      <input type="text" value={form.code}
                        onChange={e=>f('code',e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}
                        disabled={!!editing} placeholder="Để trống → tự sinh mã (VD: SUMMER25)"
                        className={inputCls+(editing?' bg-slate-50 text-slate-400':'')}/>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Tổng lượt dùng" hint="Để trống = không giới hạn">
                        <input type="number" min={1} value={form.maxUsageCount} onChange={e=>f('maxUsageCount',e.target.value)} placeholder="∞" className={inputCls}/>
                      </Field>
                      <Field label="Lượt/người">
                        <input type="number" min={1} value={form.maxUsagePerUser} onChange={e=>f('maxUsagePerUser',e.target.value)} className={inputCls}/>
                      </Field>
                    </div>
                  </section>
                )}

                {/* FLASH SALE */}
                {form.type === 'flash_sale' && (
                  <section className="space-y-3">
                    <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">⚡ Cấu hình Flash Sale</h3>

                    {/* Product picker — grouped by category */}
                    {(() => {
                      const getCatId   = p => String(p.category?._id || p.category || '');
                      const selectedIds = (form.flashSaleItems || []).map(it => String(it.productId));
                      const q = flashAddProductId.toLowerCase();

                      const toggleProduct = (p) => {
                        const pid = String(p._id);
                        if (selectedIds.includes(pid)) {
                          f('flashSaleItems', (form.flashSaleItems || []).filter(it => String(it.productId) !== pid));
                        } else {
                          f('flashSaleItems', [...(form.flashSaleItems || []), { productId: pid, price: '' }]);
                        }
                      };

                      const toggleCategory = (items) => {
                        const pids   = items.map(p => String(p._id));
                        const allSel = pids.every(pid => selectedIds.includes(pid));
                        if (allSel) {
                          f('flashSaleItems', (form.flashSaleItems || []).filter(it => !pids.includes(String(it.productId))));
                        } else {
                          const toAdd = items
                            .filter(p => !selectedIds.includes(String(p._id)))
                            .map(p => ({ productId: String(p._id), price: '' }));
                          f('flashSaleItems', [...(form.flashSaleItems || []), ...toAdd]);
                        }
                      };

                      const groups = [
                        ...categories.map(cat => ({
                          id: String(cat._id), name: cat.name,
                          items: products.filter(p => getCatId(p) === String(cat._id)),
                        })),
                        {
                          id: '__none__', name: 'Chưa phân loại',
                          items: products.filter(p => !categories.some(c => String(c._id) === getCatId(p))),
                        },
                      ].filter(g => g.items.length > 0);

                      const isSearching  = q.length > 0;
                      const flatFiltered = isSearching ? products.filter(p => p.name.toLowerCase().includes(q)) : [];

                      return (
                        <div className="space-y-2">
                          <input type="text" value={flashAddProductId}
                            onChange={e => setFlashAddProductId(e.target.value)}
                            placeholder="🔍 Tìm sản phẩm theo tên..."
                            className={inputCls}/>

                          <div className="flex items-center justify-between px-1">
                            {selectedIds.length > 0
                              ? <p className="text-[11px] text-amber-600 font-semibold">✓ Đã chọn {selectedIds.length} sản phẩm</p>
                              : <p className="text-[11px] text-slate-400">Chưa chọn sản phẩm nào</p>}
                            {selectedIds.length > 0 && (
                              <button type="button" onClick={() => f('flashSaleItems', [])}
                                className="text-[11px] text-rose-400 hover:text-rose-600 font-semibold">Bỏ chọn tất cả</button>
                            )}
                          </div>

                          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                            {isSearching ? (
                              flatFiltered.length === 0
                                ? <p className="text-xs text-slate-400 text-center py-5">Không tìm thấy sản phẩm</p>
                                : flatFiltered.map(p => {
                                    const sel = selectedIds.includes(String(p._id));
                                    const cat = categories.find(c => String(c._id) === getCatId(p));
                                    return (
                                      <label key={p._id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-100 last:border-0 transition-colors ${sel ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                                        <input type="checkbox" checked={sel} onChange={() => toggleProduct(p)} className="accent-amber-500 w-4 h-4 flex-shrink-0"/>
                                        <span className="text-sm text-slate-700 flex-1 truncate">{p.name}</span>
                                        {cat && <span className="text-[10px] text-slate-400 flex-shrink-0">{cat.name}</span>}
                                      </label>
                                    );
                                  })
                            ) : (
                              groups.map(group => {
                                const selCount = group.items.filter(p => selectedIds.includes(String(p._id))).length;
                                const allSel   = selCount === group.items.length;
                                const someSel  = selCount > 0 && !allSel;
                                return (
                                  <div key={group.id}>
                                    <label className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-200 sticky top-0 z-10 transition-colors ${
                                      allSel ? 'bg-amber-500' : someSel ? 'bg-amber-50' : 'bg-slate-50'
                                    }`}>
                                      <input type="checkbox" checked={allSel}
                                        ref={el => { if (el) el.indeterminate = someSel; }}
                                        onChange={() => toggleCategory(group.items)}
                                        className="accent-amber-500 w-4 h-4 flex-shrink-0"/>
                                      <span className={`text-xs font-bold flex-1 uppercase tracking-wide ${allSel ? 'text-white' : 'text-slate-600'}`}>
                                        📂 {group.name}
                                      </span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        allSel  ? 'bg-white/25 text-white' :
                                        someSel ? 'bg-amber-100 text-amber-600' :
                                                  'bg-slate-200 text-slate-500'
                                      }`}>{selCount}/{group.items.length}</span>
                                    </label>
                                    {group.items.map(p => {
                                      const sel = selectedIds.includes(String(p._id));
                                      return (
                                        <label key={p._id} className={`flex items-center gap-3 pl-10 pr-4 py-2.5 cursor-pointer border-b border-slate-100 last:border-0 transition-colors ${sel ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                                          <input type="checkbox" checked={sel} onChange={() => toggleProduct(p)} className="accent-amber-500 w-4 h-4 flex-shrink-0"/>
                                          <span className="text-sm text-slate-700 flex-1 truncate">{p.name}</span>
                                          {sel && <span className="text-amber-500 text-xs">✓</span>}
                                        </label>
                                      );
                                    })}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Price cards for selected products */}
                    <div className="space-y-2">
                      {(form.flashSaleItems || []).length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-400">
                          Chưa chọn sản phẩm nào
                        </div>
                      ) : (
                        (form.flashSaleItems || []).map((it) => {
                          const selling = getSellingPriceInfo(it.productId);
                          return (
                            <div key={it.productId} className="rounded-2xl border border-amber-100 bg-white px-3 py-3 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-800">{productNameById(it.productId)}</p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                    {selling ? (
                                      <>
                                        <span>Giá đang bán:</span>
                                        <span className="font-semibold text-slate-700">{fmtPrice(selling.sellingPrice)}</span>
                                        {selling.discount > 0 && (
                                          <span className="text-slate-400 line-through">{fmtPrice(selling.basePrice)}</span>
                                        )}
                                        {selling.discount > 0 && (
                                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 border border-emerald-200">
                                            -{selling.discount}%
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-slate-400">{String(it.productId).slice(-8)}</span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => f('flashSaleItems', (form.flashSaleItems || []).filter(x => String(x.productId) !== String(it.productId)))}
                                  className="px-3 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-600"
                                >
                                  Xóa
                                </button>
                              </div>

                              <div className="space-y-1">
                                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">Giá flash sale (₫)</p>
                                <input
                                  type="number"
                                  min={0}
                                  placeholder="VD: 199000"
                                  value={it.price}
                                  onChange={(e) => {
                                    f('flashSaleItems', (form.flashSaleItems || []).map(x =>
                                      String(x.productId) === String(it.productId) ? { ...x, price: e.target.value } : x
                                    ));
                                  }}
                                  className={inputCls}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <Field label="Số slot flash sale" hint="Số lượng người có thể mua với giá flash sale">
                      <input type="number" min={1} value={form.flashSaleStock} onChange={e=>f('flashSaleStock',e.target.value)} placeholder="VD: 50" className={inputCls}/>
                    </Field>
                  </section>
                )}

                {/* HOLIDAY */}
                {form.type === 'holiday' && (
                  <section className="space-y-3">
                    <h3 className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">🎉 Cấu hình Dịp lễ</h3>
                    <Field label="Tên dịp lễ">
                      <input type="text" value={form.holidayName} onChange={e=>f('holidayName',e.target.value)}
                        placeholder="VD: Tết Nguyên Đán, 8/3, Black Friday..." className={inputCls}/>
                    </Field>
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <p className="text-sm font-bold text-slate-700">Tự động áp dụng</p>
                        <p className="text-xs text-slate-400">Không cần nhập mã</p>
                      </div>
                      <button type="button" onClick={()=>f('autoApply',!form.autoApply)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${form.autoApply?'bg-blue-600':'bg-slate-300'}`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.autoApply?'translate-x-6':'translate-x-0.5'}`}/>
                      </button>
                    </div>
                  </section>
                )}

                <hr className="border-slate-100"/>

                {/* User scope */}
                <section className="space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đối tượng người dùng</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'all',      label: 'Tất cả người dùng', icon: '👥' },
                      { value: 'specific', label: 'Chỉ định người dùng', icon: '🎯' },
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => { f('userScope', opt.value); f('allowedUsers', []); setUserSearch(''); setUserSearchResults([]); }}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                          form.userScope === opt.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-500 hover:border-blue-300'
                        }`}>
                        <span className="text-xl">{opt.icon}</span>
                        <span className="text-center leading-tight">{opt.label}</span>
                      </button>
                    ))}
                  </div>

                  {form.userScope === 'specific' && (() => {
                    const addUser = (u) => {
                      if ((form.allowedUsers || []).some(x => x._id === String(u._id))) return;
                      f('allowedUsers', [...(form.allowedUsers || []), { _id: String(u._id), name: u.name || u.email, email: u.email }]);
                      setUserSearch('');
                      setUserSearchResults([]);
                    };
                    const removeUser = (id) => f('allowedUsers', (form.allowedUsers || []).filter(u => u._id !== id));

                    return (
                      <div className="space-y-2">
                        {/* Selected users */}
                        {(form.allowedUsers || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {form.allowedUsers.map(u => (
                              <span key={u._id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">
                                <span>👤 {u.name || u.email}</span>
                                <button type="button" onClick={() => removeUser(u._id)} className="text-blue-400 hover:text-rose-500 leading-none">✕</button>
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Search input */}
                        <div className="relative">
                          <input type="text" value={userSearch}
                            onChange={e => setUserSearch(e.target.value)}
                            placeholder="🔍 Tìm người dùng theo tên hoặc email..."
                            className={inputCls}/>
                          {userSearchLoading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                          )}
                        </div>
                        {userSearchResults.length > 0 && (
                          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm max-h-48 overflow-y-auto">
                            {userSearchResults
                              .filter(u => !(form.allowedUsers || []).some(x => x._id === String(u._id)))
                              .map(u => (
                                <button key={u._id} type="button"
                                  onClick={() => addUser(u)}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left border-b border-slate-100 last:border-0 transition-colors">
                                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                                    {(u.name || u.email || '?')[0].toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 truncate">{u.name || '(Chưa đặt tên)'}</p>
                                    <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                                  </div>
                                  <span className="text-blue-500 text-xs ml-auto flex-shrink-0">+ Thêm</span>
                                </button>
                              ))}
                          </div>
                        )}
                        {(form.allowedUsers || []).length === 0 && (
                          <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            Cần thêm ít nhất 1 người dùng khi chọn "Chỉ định"
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </section>

                <hr className="border-slate-100"/>

                {/* Active toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 group hover:border-blue-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-700">Trạng thái hoạt động</p>
                      <p className="text-[11px] text-slate-400 font-medium uppercase tracking-tight">
                        {form.isActive ? 'Đang kích hoạt' : 'Đang tạm dừng'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => f('isActive', !form.isActive)}
                    className={`
                      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                      transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2
                      ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}
                    `}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                        transition duration-200 ease-in-out
                        ${form.isActive ? 'translate-x-5' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </div>
              </div>

          <div className="admin-panel-footer sticky bottom-0 flex gap-3 px-6 py-4">
                <button type="button" onClick={closeDrawer}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Hủy</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                  {saving ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Tạo khuyến mãi'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>
      )}

      {/* ── Reward Form Modal ── */}
      {showRewardForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900">
                {editRewardId ? '✏️ Chỉnh sửa phần thưởng' : '⭐ Thêm phần thưởng đổi điểm'}
              </h2>
              <button onClick={closeRewardForm} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {rewardError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-2.5">{rewardError}</div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tên phần thưởng <span className="text-rose-500">*</span></label>
                <input className={inputCls} value={rewardForm.name} onChange={e => rF('name', e.target.value)} placeholder="Ví dụ: Phiếu giảm 10%" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mô tả</label>
                <input className={inputCls} value={rewardForm.description} onChange={e => rF('description', e.target.value)} placeholder="Mô tả ngắn (tuỳ chọn)" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Điểm cần đổi <span className="text-rose-500">*</span></label>
                  <input type="number" min="1" className={inputCls} value={rewardForm.pointsRequired} onChange={e => rF('pointsRequired', e.target.value)} placeholder="500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hạng tối thiểu <span className="text-rose-500">*</span></label>
                  <select className={inputCls} value={rewardForm.requiredTier} onChange={e => rF('requiredTier', e.target.value)}>
                    {REWARD_TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Loại giảm giá <span className="text-rose-500">*</span></label>
                  <select className={inputCls} value={rewardForm.discountType} onChange={e => rF('discountType', e.target.value)}>
                    <option value="percentage">Phần trăm (%)</option>
                    <option value="fixed">Số tiền cố định</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {rewardForm.discountType === 'percentage' ? 'Giảm (%)' : 'Giảm (VND)'} <span className="text-rose-500">*</span>
                  </label>
                  <input type="number" min="1" className={inputCls} value={rewardForm.discountValue} onChange={e => rF('discountValue', e.target.value)} placeholder={rewardForm.discountType === 'percentage' ? '10' : '50000'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {rewardForm.discountType === 'percentage' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Giảm tối đa (VND)</label>
                    <input type="number" min="0" className={inputCls} value={rewardForm.maxDiscountAmount} onChange={e => rF('maxDiscountAmount', e.target.value)} placeholder="Để trống = không giới hạn" />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Đơn tối thiểu (VND)</label>
                  <input type="number" min="0" className={inputCls} value={rewardForm.minPurchaseAmount} onChange={e => rF('minPurchaseAmount', e.target.value)} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hiệu lực voucher (ngày) <span className="text-rose-500">*</span></label>
                  <input type="number" min="1" className={inputCls} value={rewardForm.voucherValidDays} onChange={e => rF('voucherValidDays', e.target.value)} placeholder="30" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Giới hạn lượt đổi (tổng)</label>
                  <input type="number" min="1" className={inputCls} value={rewardForm.maxRedeemCount} onChange={e => rF('maxRedeemCount', e.target.value)} placeholder="Để trống = không giới hạn" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Giới hạn lượt đổi / người</label>
                <input type="number" min="1" className={inputCls} value={rewardForm.maxRedeemPerUser} onChange={e => rF('maxRedeemPerUser', e.target.value)} placeholder="Để trống = không giới hạn" />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={closeRewardForm} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Huỷ</button>
              <button onClick={handleSaveReward} disabled={savingReward}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {savingReward && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                {savingReward ? 'Đang lưu...' : editRewardId ? 'Cập nhật' : 'Tạo phần thưởng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="admin-overlay absolute inset-0" onClick={()=>setDeleteId(null)}/>
          <div className="admin-modal-shell relative p-6 w-full max-w-sm">
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">🗑️</div>
              <h3 className="text-lg font-bold text-slate-900">Xóa khuyến mãi?</h3>
              <p className="text-sm text-slate-500 mt-1">Hành động này không thể hoàn tác.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteId(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50">Hủy</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold">Xóa</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes popIn{from{transform:translateY(12px) scale(.98);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}`}</style>
    </div>
  );
}
