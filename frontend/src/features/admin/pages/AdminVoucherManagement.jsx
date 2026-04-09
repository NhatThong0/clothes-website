import React, { useEffect, useState } from 'react';
import apiClient from '@features/shared/services/apiClient';

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPES = [
  { value: 'coupon',     label: 'Mã Coupon',         icon: '🎟️', color: 'blue'   },
  { value: 'flash_sale', label: 'Flash Sale',         icon: '⚡', color: 'amber'  },
  { value: 'loyalty',    label: 'Loyalty',            icon: '👑', color: 'violet' },
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

const emptyForm = {
  type:'coupon', name:'', description:'', isActive:true,
  startDate:'', endDate:'',
  discountType:'percentage', discountValue:'', maxDiscountAmount:'', minOrderAmount:'0', minQuantity:'0',
  applyTo:'all',
  code:'', maxUsageCount:'', maxUsagePerUser:'1',
  flashSaleStock:'', flashSaleHour:{ start:'', end:'' },
  flashSaleItems:[],
  holidayName:'', autoApply:false,
  loyaltyTier:'all', pointsRequired:'0', pointsReward:'0',
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
  const [flashAddProductId, setFlashAddProductId] = useState('');

  useEffect(() => { load(); }, [page, typeFilter]);

  useEffect(() => {
    apiClient.get('/admin/products?limit=200')
      .then(r => setProducts(r.data?.data?.products || []))
      .catch(() => setProducts([]));
  }, []);

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
      code:              p.code || '',
      maxUsageCount:     p.maxUsageCount?.toString() || '',
      maxUsagePerUser:   p.maxUsagePerUser?.toString() || '1',
      flashSaleStock:    p.flashSaleStock?.toString() || '',
      flashSaleHour:     p.flashSaleHour || { start:'', end:'' },
      flashSaleItems:    flashItems,
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
      }
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
  const productNameById = (id) =>
    products.find((p) => String(p._id) === String(id))?.name || String(id || '').slice(-6);
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
            <p className="text-sm text-slate-400 mt-0.5">{total} chương trình</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">
            + Tạo khuyến mãi
          </button>
        </div>

        {/* Type filter pills */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
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
        </div>
      </div>

      <div className="p-6">
        {loading ? (
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
        )}

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
                    <Field label="Ngày kết thúc" required>
                      <input type="datetime-local" required value={form.endDate} onChange={e=>f('endDate',e.target.value)} className={inputCls}/>
                    </Field>
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
                      {form.type!=='loyalty' && <option value="freeship">Miễn phí vận chuyển</option>}
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

                <hr className="border-slate-100"/>

                {/* Type-specific fields */}

                {/* COUPON */}
                {form.type === 'coupon' && (
                  <section className="space-y-3">
                    <h3 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">🎟️ Cấu hình Coupon</h3>
                    <Field label="Mã coupon" required hint="Chỉ chữ hoa và số, không dấu">
                      <input type="text" required value={form.code}
                        onChange={e=>f('code',e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}
                        disabled={!!editing} placeholder="VD: SUMMER25"
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
                    <Field label="Sản phẩm" required hint="Chọn nhiều sản phẩm và nhập giá flash sale cho từng sản phẩm.">
                      <div className="flex gap-2">
                        <select
                          value={flashAddProductId}
                          onChange={(e) => setFlashAddProductId(e.target.value)}
                          className={inputCls}
                        >
                          <option value="">-- Chọn sản phẩm --</option>
                          {products
                            .filter((p) => !(form.flashSaleItems || []).some((it) => String(it.productId) === String(p._id)))
                            .map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (!flashAddProductId) return;
                            f('flashSaleItems', [...(form.flashSaleItems || []), { productId: flashAddProductId, price: '' }]);
                            setFlashAddProductId('');
                          }}
                          className="px-3 py-2.5 rounded-xl text-sm font-semibold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        >
                          + Thêm
                        </button>
                      </div>
                    </Field>

                    <div className="space-y-2">
                      {(form.flashSaleItems || []).length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-400">
                          Chưa chọn sản phẩm nào
                        </div>
                      ) : (
                        (form.flashSaleItems || []).map((it, idx) => {
                          const selling = getSellingPriceInfo(it.productId);
                          return (
                            <div key={`${it.productId}-${idx}`} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 space-y-2">
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
                                  onClick={() => {
                                    const next = (form.flashSaleItems || []).filter((_, i) => i !== idx);
                                    f('flashSaleItems', next);
                                  }}
                                  className="px-3 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-600"
                                >
                                  Xóa
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Giá flash sale (₫)</p>
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="VD: 199000"
                                    value={it.price}
                                    onChange={(e) => {
                                      const next = [...(form.flashSaleItems || [])];
                                      next[idx] = { ...next[idx], price: e.target.value };
                                      f('flashSaleItems', next);
                                    }}
                                    className={inputCls}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <Field label="Số slot flash sale" hint="Số lượng người có thể mua với giá flash sale">
                      <input type="number" min={1} value={form.flashSaleStock} onChange={e=>f('flashSaleStock',e.target.value)} placeholder="VD: 50" className={inputCls}/>
                    </Field>
                    <p className="text-[11px] text-slate-400">Thời gian chạy lấy theo Bắt đầu/Kết thúc ở phần thông tin chung.</p>
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

                {/* LOYALTY */}
                {form.type === 'loyalty' && (
                  <section className="space-y-3">
                    <h3 className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">👑 Cấu hình Loyalty</h3>
                    <Field label="Áp dụng cho hạng">
                      <select value={form.loyaltyTier} onChange={e=>f('loyaltyTier',e.target.value)} className={inputCls}>
                        {LOYALTY_TIERS.map(t=>(
                          <option key={t} value={t}>{TIER_LABEL[t]}</option>
                        ))}
                      </select>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Điểm cần để dùng" hint="0 = không cần điểm">
                        <input type="number" min={0} value={form.pointsRequired} onChange={e=>f('pointsRequired',e.target.value)} className={inputCls}/>
                      </Field>
                      <Field label="Điểm thưởng" hint="Điểm tặng khi dùng KM này">
                        <input type="number" min={0} value={form.pointsReward} onChange={e=>f('pointsReward',e.target.value)} className={inputCls}/>
                      </Field>
                    </div>
                    <div className="flex items-center justify-between p-3.5 bg-violet-50 rounded-xl border border-violet-200">
                      <div>
                        <p className="text-sm font-bold text-violet-700">Tự động áp dụng theo hạng</p>
                        <p className="text-xs text-violet-400">Không cần nhập mã</p>
                      </div>
                      <button type="button" onClick={()=>f('autoApply',!form.autoApply)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${form.autoApply?'bg-violet-600':'bg-slate-300'}`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.autoApply?'translate-x-6':'translate-x-0.5'}`}/>
                      </button>
                    </div>
                  </section>
                )}

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
