import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '@services/apiClient';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt   = v => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v ?? 0);
const fmtN  = v => new Intl.NumberFormat('vi-VN').format(v ?? 0);
const fmtDt = d => d ? new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtD  = d => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const STATUS_RECEIPT = {
  draft:     { label: 'Nháp',       bg: '#FEF9C3', text: '#854D0E', dot: '#EAB308' },
  confirmed: { label: 'Hoàn thành', bg: '#DCFCE7', text: '#166534', dot: '#22C55E' },
  cancelled: { label: 'Đã hủy',     bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' },
};

const ADJUST_REASONS = [
  'Hàng bị hỏng / vỡ',
  'Hàng mất / thất lạc',
  'Quà tặng / khuyến mãi',
  'Kiểm kê lại tồn kho',
  'Hàng trả về nhà cung cấp',
  'Lý do khác',
];

function Badge({ status, map }) {
  const cfg = map[status] || { label: status, bg: '#F1F5F9', text: '#475569', dot: '#94A3B8' };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }}/>
      {cfg.label}
    </span>
  );
}

function Spinner({ size = 5 }) {
  return <div className={`w-${size} h-${size} border-2 border-blue-500 border-t-transparent rounded-full animate-spin`}/>;
}

function StatCard({ label, value, sub, icon, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: color + '18' }}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold text-slate-800 leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition';

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: PHIẾU NHẬP KHO
// ═══════════════════════════════════════════════════════════════════════════════
function TabReceipts() {
  const [receipts,    setReceipts]    = useState([]);
  const [pagination,  setPagination]  = useState({ current: 1, pages: 1, total: 0 });
  const [statusFilter,setStatusFilter]= useState('');
  const [search,      setSearch]      = useState('');
  const [loading,     setLoading]     = useState(true);
  const [formOpen,    setFormOpen]    = useState(false);
  const [editReceipt, setEditReceipt] = useState(null); // null = create
  const [detailId,    setDetailId]    = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (statusFilter) params.append('status', statusFilter);
      if (search)       params.append('search', search);
      const res = await apiClient.get(`/admin/inventory/receipts?${params}`);
      setReceipts(res.data.data.receipts || []);
      setPagination(res.data.data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [statusFilter, search]);

  useEffect(() => { load(1); }, [load]);

  const handleConfirm = async (id) => {
    if (!window.confirm('Xác nhận nhập kho? Hành động này không thể hoàn tác.')) return;
    setActionLoading(id);
    try {
      await apiClient.post(`/admin/inventory/receipts/${id}/confirm`);
      load(pagination.current);
    } catch (e) { alert(e.response?.data?.message || 'Lỗi xác nhận'); }
    finally { setActionLoading(''); }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Hủy phiếu nhập này?')) return;
    setActionLoading(id);
    try {
      await apiClient.post(`/admin/inventory/receipts/${id}/cancel`);
      load(pagination.current);
    } catch (e) { alert(e.response?.data?.message || 'Lỗi hủy phiếu'); }
    finally { setActionLoading(''); }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {[['', 'Tất cả'], ['draft', 'Nháp'], ['confirmed', 'Hoàn thành'], ['cancelled', 'Đã hủy']].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${statusFilter === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm mã phiếu / NCC..."
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"/>
          <button onClick={() => { setEditReceipt(null); setFormOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors">
            + Tạo phiếu nhập
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><Spinner size={8}/></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Mã phiếu', 'Nhà cung cấp', 'Số SP', 'Tổng tiền', 'Trạng thái', 'Ngày tạo', 'Người tạo', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {receipts.length === 0 ? (
                  <tr><td colSpan={8} className="py-14 text-center text-slate-300">
                    <div className="text-4xl mb-2">📋</div><p className="text-sm">Chưa có phiếu nhập</p>
                  </td></tr>
                ) : receipts.map(r => (
                  <tr key={r._id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{r.code}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 font-medium">{r.supplier?.name || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-600">{fmtN(r.totalItems)} đơn vị</td>
                    <td className="px-5 py-3.5 font-bold text-slate-800">{fmt(r.totalAmount)}</td>
                    <td className="px-5 py-3.5"><Badge status={r.status} map={STATUS_RECEIPT}/></td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">{fmtD(r.createdAt)}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{r.createdBy?.name || '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setDetailId(r._id)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 text-xs font-semibold rounded-lg transition-colors">
                          Chi tiết
                        </button>
                        {r.status === 'draft' && (<>
                          <button onClick={() => { setEditReceipt(r); setFormOpen(true); }}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg transition-colors">
                            Sửa
                          </button>
                          <button onClick={() => handleConfirm(r._id)} disabled={actionLoading === r._id}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1">
                            {actionLoading === r._id ? <Spinner size={3}/> : '✓'} Xác nhận
                          </button>
                          <button onClick={() => handleCancel(r._id)} disabled={actionLoading === r._id}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-lg transition-colors">
                            Hủy
                          </button>
                        </>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-400">Trang {pagination.current} / {pagination.pages} ({pagination.total} phiếu)</span>
            <div className="flex gap-1">
              <button onClick={() => load(pagination.current - 1)} disabled={pagination.current <= 1}
                className="px-3 py-1.5 text-xs border rounded-lg hover:bg-white disabled:opacity-40">← Trước</button>
              <button onClick={() => load(pagination.current + 1)} disabled={pagination.current >= pagination.pages}
                className="px-3 py-1.5 text-xs border rounded-lg hover:bg-white disabled:opacity-40">Sau →</button>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {formOpen && <ReceiptFormModal initial={editReceipt} onClose={() => { setFormOpen(false); setEditReceipt(null); }} onSaved={() => load(1)}/>}

      {/* Detail Drawer */}
      {detailId && <ReceiptDetailDrawer id={detailId} onClose={() => setDetailId(null)}/>}
    </div>
  );
}

// ── Receipt Form Modal ────────────────────────────────────────────────────────
function ReceiptFormModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial?._id;
  const [supplier, setSupplier] = useState({ name: initial?.supplier?.name || '', phone: initial?.supplier?.phone || '', note: initial?.supplier?.note || '' });
  const [items, setItems] = useState(initial?.items?.map(i => ({ productId: i.productId?._id || i.productId, productName: i.productName, quantity: i.quantity, costPrice: i.costPrice })) || [{ productId: '', productName: '', quantity: 1, costPrice: 0 }]);
  const [note, setNote] = useState(initial?.note || '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [products, setProducts] = useState([]);
  const [prodSearch, setProdSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get(`/admin/products?limit=100${prodSearch ? `&search=${prodSearch}` : ''}`);
        setProducts(res.data.data?.products || []);
      } catch {}
    };
    load();
  }, [prodSearch]);

  const addItem = () => setItems(p => [...p, { productId: '', productName: '', quantity: 1, costPrice: 0 }]);
  const removeItem = i => setItems(p => p.filter((_, idx) => idx !== i));
  const setItem = (i, key, val) => setItems(p => p.map((item, idx) => idx === i ? { ...item, [key]: val } : item));
  const pickProduct = (i, product) => setItems(p => p.map((item, idx) => idx === i ? { ...item, productId: product._id, productName: product.name, costPrice: product.costPrice || product.avgCost || 0 } : item));

  const total = items.reduce((s, i) => s + (i.quantity || 0) * (i.costPrice || 0), 0);

  const handleSave = async () => {
    if (items.some(i => !i.productId || !i.quantity || !i.costPrice)) { setError('Vui lòng điền đầy đủ thông tin sản phẩm'); return; }
    setError(''); setSaving(true);
    try {
      const payload = { supplier, items, note };
      if (isEdit) await apiClient.put(`/admin/inventory/receipts/${initial._id}`, payload);
      else        await apiClient.post('/admin/inventory/receipts', payload);
      onSaved(); onClose();
    } catch (e) { setError(e.response?.data?.message || 'Lỗi lưu phiếu'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Sửa phiếu nhập' : 'Tạo phiếu nhập kho'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 text-lg">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-600">{error}</div>}

          {/* Nhà cung cấp */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-3">Nhà cung cấp</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Tên NCC</label>
                <input className={inputCls} value={supplier.name} onChange={e => setSupplier(p => ({ ...p, name: e.target.value }))} placeholder="Tên nhà cung cấp"/>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Điện thoại</label>
                <input className={inputCls} type="tel" value={supplier.phone} onChange={e => setSupplier(p => ({ ...p, phone: e.target.value }))} placeholder="0901 234 567"/>
              </div>
            </div>
          </div>

          {/* Sản phẩm */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-slate-700">Danh sách sản phẩm</p>
              <input value={prodSearch} onChange={e => setProdSearch(e.target.value)}
                placeholder="Tìm sản phẩm..."
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"/>
            </div>

            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {/* Product select */}
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Sản phẩm</label>
                    <select className={inputCls} value={item.productId}
                      onChange={e => {
                        const p = products.find(x => x._id === e.target.value);
                        if (p) pickProduct(i, p); else setItem(i, 'productId', e.target.value);
                      }}>
                      <option value="">-- Chọn sản phẩm --</option>
                      {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  </div>
                  {/* Số lượng */}
                  <div className="w-24">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Số lượng</label>
                    <input className={inputCls} type="number" min="1" value={item.quantity}
                      onChange={e => setItem(i, 'quantity', parseInt(e.target.value) || 1)}/>
                  </div>
                  {/* Giá nhập */}
                  <div className="w-36">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Đơn giá (₫)</label>
                    <input className={inputCls} type="number" min="0" value={item.costPrice}
                      onChange={e => setItem(i, 'costPrice', parseFloat(e.target.value) || 0)}/>
                  </div>
                  {/* Thành tiền */}
                  <div className="w-32 text-right">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Thành tiền</label>
                    <p className="py-2.5 text-sm font-bold text-blue-600">{fmt(item.quantity * item.costPrice)}</p>
                  </div>
                  {/* Remove */}
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="mt-6 p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">✕</button>
                  )}
                </div>
              ))}
            </div>

            <button onClick={addItem} className="mt-2 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-semibold py-2 transition-colors">
              + Thêm sản phẩm
            </button>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Ghi chú</label>
            <textarea className={inputCls} rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..."/>
          </div>

          {/* Total */}
          <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-blue-700">Tổng tiền nhập</span>
            <span className="text-xl font-bold text-blue-700">{fmt(total)}</span>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50">Hủy</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Spinner size={4}/>} {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo phiếu nháp'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Receipt Detail Drawer ─────────────────────────────────────────────────────
function ReceiptDetailDrawer({ id, onClose }) {
  const [receipt, setReceipt] = useState(null);
  useEffect(() => {
    apiClient.get(`/admin/inventory/receipts/${id}`).then(r => setReceipt(r.data.data)).catch(() => {});
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-base font-bold text-slate-900">Chi tiết phiếu nhập</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">✕</button>
        </div>
        {!receipt ? (
          <div className="flex-1 flex items-center justify-center"><Spinner size={8}/></div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-lg font-black text-blue-600">{receipt.code}</p>
                <p className="text-xs text-slate-400 mt-0.5">{fmtDt(receipt.createdAt)}</p>
              </div>
              <Badge status={receipt.status} map={STATUS_RECEIPT}/>
            </div>

            {/* Supplier */}
            {receipt.supplier?.name && (
              <div className="bg-slate-50 rounded-xl p-4 space-y-1.5">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Nhà cung cấp</p>
                <p className="text-sm font-semibold text-slate-800">{receipt.supplier.name}</p>
                {receipt.supplier.phone && <p className="text-xs text-slate-500">📞 {receipt.supplier.phone}</p>}
              </div>
            )}

            {/* Items */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Danh sách hàng</p>
              <div className="space-y-2">
                {receipt.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-200 flex-shrink-0">
                      {item.productId?.images?.[0]
                        ? <img src={item.productId.images[0]} alt="" className="w-full h-full object-cover"/>
                        : <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">📦</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.productName || item.productId?.name}</p>
                      <p className="text-xs text-slate-500">Giá nhập: <span className="font-bold text-slate-700">{fmt(item.costPrice)}</span></p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-slate-800">x{fmtN(item.quantity)}</p>
                      <p className="text-xs text-blue-600 font-semibold">{fmt(item.totalCost)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-blue-50 rounded-xl p-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Tổng số lượng</span>
                <span className="font-bold">{fmtN(receipt.totalItems)} đơn vị</span>
              </div>
              <div className="flex justify-between text-sm border-t border-blue-100 pt-1.5 mt-1.5">
                <span className="text-blue-700 font-semibold">Tổng tiền nhập</span>
                <span className="font-black text-blue-700 text-base">{fmt(receipt.totalAmount)}</span>
              </div>
            </div>

            {receipt.note && (
              <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-700">
                <span className="font-semibold">Ghi chú: </span>{receipt.note}
              </div>
            )}

            {/* Audit */}
            <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-100">
              <p>Tạo bởi: <span className="font-semibold text-slate-600">{receipt.createdBy?.name || '—'}</span></p>
              {receipt.confirmedBy && <p>Xác nhận bởi: <span className="font-semibold text-slate-600">{receipt.confirmedBy?.name}</span> lúc {fmtDt(receipt.confirmedAt)}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: TỒN KHO
// ═══════════════════════════════════════════════════════════════════════════════
function TabStockReport() {
  const [products, setProducts] = useState([]);
  const [summary,  setSummary]  = useState({});
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [search,    setSearch]    = useState('');
  const [lowStock,  setLowStock]  = useState(false);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search)  params.append('search', search);
      if (lowStock) params.append('lowStock', 'true');
      const res = await apiClient.get(`/admin/inventory/stock-report?${params}`);
      setProducts(res.data.data.products || []);
      setSummary(res.data.data.summary   || {});
      setPagination(res.data.data.pagination);
    } catch {}
    finally { setLoading(false); }
  }, [search, lowStock]);

  useEffect(() => { load(1); }, [load]);

  const stockColor = stock => stock === 0 ? 'text-rose-600 bg-rose-50' : stock <= 5 ? 'text-orange-600 bg-orange-50' : stock <= 10 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50';

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Tổng sản phẩm" value={fmtN(summary.totalProducts)} icon="📦" color="#3B82F6"/>
        <StatCard label="Tổng tồn kho"  value={fmtN(summary.totalStock)} sub="đơn vị" icon="🏪" color="#8B5CF6"/>
        <StatCard label="Giá trị kho"   value={fmt(summary.totalValue)} icon="💰" color="#10B981"/>
        <StatCard label="Sắp hết hàng"  value={fmtN(summary.lowStockCount)} sub="≤ 10 SP" icon="⚠️" color="#F59E0B"/>
        <StatCard label="Hết hàng"      value={fmtN(summary.outOfStock)} icon="🚫" color="#EF4444"/>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tìm sản phẩm..."
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"/>
        <button onClick={() => setLowStock(!lowStock)}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${lowStock ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300'}`}>
          ⚠️ Sắp hết hàng
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><Spinner size={8}/></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Sản phẩm', 'Danh mục', 'Tồn kho', 'Giá nhập TB', 'Giá bán', 'Biên lợi nhuận', 'Giá trị tồn'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {products.length === 0 ? (
                <tr><td colSpan={7} className="py-14 text-center text-slate-300">Không có dữ liệu</td></tr>
              ) : products.map(p => {
                const margin = p.price > 0 && p.avgCost > 0 ? ((p.price - p.avgCost) / p.price * 100).toFixed(1) : null;
                return (
                  <tr key={p._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                          {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-400">📦</div>}
                        </div>
                        <p className="font-semibold text-slate-800 text-sm">{p.name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{p.category?.name || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${stockColor(p.stock)}`}>
                        {fmtN(p.stock)} SP
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">{p.avgCost ? fmt(p.avgCost) : '—'}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">{fmt(p.price)}</td>
                    <td className="px-5 py-3.5">
                      {margin !== null ? (
                        <span className={`text-sm font-bold ${parseFloat(margin) >= 30 ? 'text-emerald-600' : parseFloat(margin) >= 15 ? 'text-amber-600' : 'text-rose-500'}`}>
                          {margin}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-bold text-slate-800">{p.avgCost ? fmt((p.avgCost || 0) * p.stock) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {pagination.pages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-400">Trang {pagination.current} / {pagination.pages}</span>
            <div className="flex gap-1">
              <button onClick={() => load(pagination.current - 1)} disabled={pagination.current <= 1} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-white disabled:opacity-40">← Trước</button>
              <button onClick={() => load(pagination.current + 1)} disabled={pagination.current >= pagination.pages} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-white disabled:opacity-40">Sau →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: ĐIỀU CHỈNH KHO
// ═══════════════════════════════════════════════════════════════════════════════
function TabAdjustment() {
  const [products, setProducts] = useState([]);
  const [items,    setItems]    = useState([{ productId: '', productName: '', quantity: 0, reason: '', note: '' }]);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState('');
  const [error,    setError]    = useState('');
  const [movements, setMovements] = useState([]);
  const [movLoading, setMovLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/admin/products?limit=200').then(r => setProducts(r.data.data?.products || [])).catch(() => {});
    loadMovements();
  }, []);

  const loadMovements = async () => {
    setMovLoading(true);
    try {
      const res = await apiClient.get('/admin/inventory/movements?type=adjustment&limit=20');
      setMovements(res.data.data?.movements || []);
    } catch {}
    finally { setMovLoading(false); }
  };

  const addItem = () => setItems(p => [...p, { productId: '', productName: '', quantity: 0, reason: '', note: '' }]);
  const removeItem = i => setItems(p => p.filter((_, idx) => idx !== i));
  const setItem = (i, key, val) => setItems(p => p.map((item, idx) => idx === i ? { ...item, [key]: val } : item));
  const pickProduct = (i, product) => setItems(p => p.map((item, idx) => idx === i ? { ...item, productId: product._id, productName: product.name } : item));

  const handleSave = async () => {
    if (items.some(i => !i.productId || i.quantity === 0)) { setError('Vui lòng chọn sản phẩm và nhập số lượng khác 0'); return; }
    setError(''); setSaving(true);
    try {
      await apiClient.post('/admin/inventory/adjustments', { items });
      setSuccess('Điều chỉnh kho thành công!');
      setItems([{ productId: '', productName: '', quantity: 0, reason: '', note: '' }]);
      loadMovements();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.response?.data?.message || 'Lỗi điều chỉnh'); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Form */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-base font-bold text-slate-900 mb-1">Điều chỉnh tồn kho</h3>
        <p className="text-xs text-slate-400 mb-5">Nhập số dương để cộng kho, số âm để trừ kho</p>

        {success && <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">{success}</div>}
        {error   && <div className="mb-4 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-600">{error}</div>}

        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Sản phẩm</label>
                  <select className={inputCls} value={item.productId}
                    onChange={e => { const p = products.find(x => x._id === e.target.value); if (p) pickProduct(i, p); }}>
                    <option value="">-- Chọn sản phẩm --</option>
                    {products.map(p => <option key={p._id} value={p._id}>{p.name} (tồn: {p.stock})</option>)}
                  </select>
                </div>
                <div className="w-28">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Số lượng</label>
                  <input className={`${inputCls} ${item.quantity > 0 ? 'border-emerald-300 bg-emerald-50' : item.quantity < 0 ? 'border-rose-300 bg-rose-50' : ''}`}
                    type="number" value={item.quantity} onChange={e => setItem(i, 'quantity', parseInt(e.target.value) || 0)}
                    placeholder="±0"/>
                </div>
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} className="mt-5 p-2 text-rose-400 hover:text-rose-600 rounded-lg transition-colors">✕</button>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Lý do</label>
                <select className={inputCls} value={item.reason} onChange={e => setItem(i, 'reason', e.target.value)}>
                  <option value="">-- Chọn lý do --</option>
                  {ADJUST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {item.reason === 'Lý do khác' && (
                <input className={inputCls} placeholder="Nhập lý do cụ thể..." value={item.note} onChange={e => setItem(i, 'note', e.target.value)}/>
              )}
            </div>
          ))}
        </div>

        <button onClick={addItem} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-semibold py-1 transition-colors">
          + Thêm sản phẩm
        </button>

        <button onClick={handleSave} disabled={saving}
          className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          {saving && <Spinner size={4}/>} {saving ? 'Đang lưu...' : '💾 Xác nhận điều chỉnh'}
        </button>
      </div>

      {/* Movement log */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">Lịch sử điều chỉnh</h3>
        {movLoading ? <div className="py-8 flex justify-center"><Spinner/></div> : (
          <div className="space-y-2">
            {movements.length === 0 ? (
              <p className="text-center text-slate-300 py-8 text-sm">Chưa có điều chỉnh nào</p>
            ) : movements.map(m => (
              <div key={m._id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${m.quantity > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {m.quantity > 0 ? '+' : ''}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{m.productName || m.productId?.name}</p>
                  <p className="text-xs text-slate-500">{m.reason || m.note || '—'}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{fmtDt(m.createdAt)} · {m.createdBy?.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {m.quantity > 0 ? '+' : ''}{fmtN(m.quantity)}
                  </p>
                  <p className="text-[11px] text-slate-400">→ {fmtN(m.stockAfter)} SP</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: LỊCH SỬ BIẾN ĐỘNG
// ═══════════════════════════════════════════════════════════════════════════════
function TabMovements() {
  const [movements, setMovements] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (typeFilter) params.append('type', typeFilter);
      const res = await apiClient.get(`/admin/inventory/movements?${params}`);
      setMovements(res.data.data?.movements || []);
      setPagination(res.data.data?.pagination);
    } catch {}
    finally { setLoading(false); }
  }, [typeFilter]);

  useEffect(() => { load(1); }, [load]);

  const TYPE_CFG = {
    receipt:    { label: 'Nhập kho',    icon: '📥', bg: '#DCFCE7', text: '#166534' },
    sale:       { label: 'Bán hàng',    icon: '🛒', bg: '#DBEAFE', text: '#1D4ED8' },
    adjustment: { label: 'Điều chỉnh', icon: '🔧', bg: '#FEF3C7', text: '#92400E' },
    return:     { label: 'Trả hàng',   icon: '↩️', bg: '#F3E8FF', text: '#6B21A8' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {[['', 'Tất cả'], ['receipt', '📥 Nhập kho'], ['sale', '🛒 Bán hàng'], ['adjustment', '🔧 Điều chỉnh']].map(([v, l]) => (
          <button key={v} onClick={() => setTypeFilter(v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${typeFilter === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? <div className="py-16 flex justify-center"><Spinner size={8}/></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Loại', 'Sản phẩm', 'Số lượng', 'Tồn sau', 'Giá vốn', 'Giá bán', 'Lợi nhuận', 'Tham chiếu', 'Thời gian', 'Người thực hiện'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {movements.length === 0 ? (
                  <tr><td colSpan={10} className="py-14 text-center text-slate-300">Không có dữ liệu</td></tr>
                ) : movements.map(m => {
                  const tcfg = TYPE_CFG[m.type] || { label: m.type, icon: '📌', bg: '#F1F5F9', text: '#475569' };
                  const profit = m.type === 'sale' ? (m.salePrice - m.costPrice) * Math.abs(m.quantity) : null;
                  return (
                    <tr key={m._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold"
                          style={{ background: tcfg.bg, color: tcfg.text }}>
                          {tcfg.icon} {tcfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 text-xs max-w-[160px] truncate">{m.productName || m.productId?.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {m.quantity > 0 ? '+' : ''}{fmtN(m.quantity)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-medium">{fmtN(m.stockAfter)} SP</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{m.costPrice ? fmt(m.costPrice) : '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{m.salePrice ? fmt(m.salePrice) : '—'}</td>
                      <td className="px-4 py-3">
                        {profit !== null ? (
                          <span className={`text-xs font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{fmt(profit)}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {m.refCode && <span className="font-mono text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{m.refCode}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDt(m.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.createdBy?.name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pagination?.pages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-400">Trang {pagination.current} / {pagination.pages} ({pagination.total} bản ghi)</span>
            <div className="flex gap-1">
              <button onClick={() => load(pagination.current - 1)} disabled={pagination.current <= 1} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-white disabled:opacity-40">← Trước</button>
              <button onClick={() => load(pagination.current + 1)} disabled={pagination.current >= pagination.pages} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-white disabled:opacity-40">Sau →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { key: 'receipts',   label: 'Phiếu nhập kho', icon: '📥' },
  { key: 'stock',      label: 'Tồn kho',         icon: '🏪' },
  { key: 'adjustment', label: 'Điều chỉnh kho',  icon: '🔧' },
  { key: 'movements',  label: 'Lịch sử biến động', icon: '📊' },
];

export default function AdminInventory() {
  const [activeTab, setActiveTab] = useState('receipts');

  return (
    <div className="min-h-screen bg-[#F8FAFC]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Quản lý Nhập/Xuất Kho</h1>
              <p className="text-sm text-slate-400 mt-0.5">Theo dõi hàng hóa, giá vốn và lợi nhuận theo FIFO</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-700 font-semibold">
              📦 FIFO Costing
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-screen-xl mx-auto">
        {activeTab === 'receipts'   && <TabReceipts/>}
        {activeTab === 'stock'      && <TabStockReport/>}
        {activeTab === 'adjustment' && <TabAdjustment/>}
        {activeTab === 'movements'  && <TabMovements/>}
      </div>
    </div>
  );
}