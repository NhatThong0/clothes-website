import React, { useEffect, useState } from 'react';
import apiClient from '@features/shared/services/apiClient';

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPES = [
  { value: 'coupon',     label: 'Mã Coupon',         icon: '🎟️', color: 'blue'   },
  { value: 'discount',   label: 'Giảm giá SP/Đơn',   icon: '💰', color: 'emerald'},
  { value: 'flash_sale', label: 'Flash Sale',         icon: '⚡', color: 'amber'  },
  { value: 'holiday',    label: 'Dịp lễ',             icon: '🎉', color: 'rose'   },
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
const toInput  = d => d ? new Date(d).toISOString().split('T')[0] : '';

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
  holidayName:'', autoApply:false,
  loyaltyTier:'all', pointsRequired:'0', pointsReward:'0',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminPromotionManagement() {
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

  useEffect(() => { load(); }, [page, typeFilter]);

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
    setForm({
      type:              p.type,
      name:              p.name,
      description:       p.description || '',
      isActive:          p.isActive,
      startDate:         toInput(p.startDate),
      endDate:           toInput(p.endDate),
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

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-20">
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
                        {p.discountType === 'freeship' ? '🚚 Miễn ship'
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
                      <div><span className="text-slate-400">Bắt đầu:</span> <span className="font-medium text-slate-700">{fmtDate(p.startDate)}</span></div>
                      <div><span className="text-slate-400">Kết thúc:</span> <span className="font-medium text-slate-700">{fmtDate(p.endDate)}</span></div>
                      {p.type === 'flash_sale' && (
                        <>
                          <div><span className="text-slate-400">Giờ:</span> <span className="font-medium">{p.flashSaleHour?.start}–{p.flashSaleHour?.end}</span></div>
                          <div><span className="text-slate-400">Còn lại:</span> <span className="font-bold text-amber-600">{p.flashSaleRemaining ?? '∞'}</span></div>
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
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={closeDrawer}/>
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col h-full" style={{animation:'slideIn .25s cubic-bezier(.4,0,.2,1)'}}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
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
                      <input type="date" required value={form.startDate} onChange={e=>f('startDate',e.target.value)} className={inputCls}/>
                    </Field>
                    <Field label="Ngày kết thúc" required>
                      <input type="date" required value={form.endDate} onChange={e=>f('endDate',e.target.value)} className={inputCls}/>
                    </Field>
                  </div>
                </section>

                <hr className="border-slate-100"/>

                {/* Discount config */}
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
                    <Field label="Số slot flash sale" hint="Số lượng người có thể mua với giá flash sale">
                      <input type="number" min={1} value={form.flashSaleStock} onChange={e=>f('flashSaleStock',e.target.value)} placeholder="VD: 50" className={inputCls}/>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Giờ bắt đầu (HH:mm)">
                        <input type="time" value={form.flashSaleHour.start}
                          onChange={e=>f('flashSaleHour',{...form.flashSaleHour,start:e.target.value})} className={inputCls}/>
                      </Field>
                      <Field label="Giờ kết thúc (HH:mm)">
                        <input type="time" value={form.flashSaleHour.end}
                          onChange={e=>f('flashSaleHour',{...form.flashSaleHour,end:e.target.value})} className={inputCls}/>
                      </Field>
                    </div>
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

              <div className="sticky bottom-0 px-6 py-4 bg-white border-t border-slate-100 flex gap-3">
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
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={()=>setDeleteId(null)}/>
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
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

      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
}
