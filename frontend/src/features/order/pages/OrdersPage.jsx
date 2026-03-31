import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@features/cart/hooks/useCart';
import Loading from '@components/common/Loading';
import Empty from '@components/common/Empty';
import { formatPrice, formatDate } from '@utils/helpers';
import { productAPI } from '@features/shared/services/api';
import apiClient from '@features/shared/services/apiClient';

const RETURN_WINDOW_DAYS = 3;
const PAGE_SIZE = 15;

const STATUS_MAP = {
  pending:          { label: 'Chờ xác nhận',          color: 'bg-amber-100  text-amber-800  border border-amber-200',      dot: '#F59E0B' },
  confirmed:        { label: 'Đã xác nhận',            color: 'bg-blue-100   text-blue-800   border border-blue-200',       dot: '#3B82F6' },
  shipped:          { label: 'Đang giao',              color: 'bg-sky-100    text-sky-800    border border-sky-200',        dot: '#06B6D4' },
  delivered:        { label: 'Đã giao',                color: 'bg-emerald-100 text-emerald-800 border border-emerald-200', dot: '#10B981' },
  return_requested: { label: 'Chờ xác nhận hoàn trả', color: 'bg-orange-100 text-orange-800 border border-orange-200',    dot: '#F97316' },
  returned:         { label: 'Hoàn trả xong',          color: 'bg-slate-100  text-slate-600  border border-slate-200',     dot: '#9CA3AF' },
  cancelled:        { label: 'Đã hủy',                 color: 'bg-rose-100   text-rose-700   border border-rose-200',      dot: '#EF4444' },
};

const DATE_FILTERS = [
  { value: 'all',    label: 'Tất cả thời gian' },
  { value: '7d',     label: '7 ngày qua' },
  { value: '30d',    label: '30 ngày qua' },
  { value: '90d',    label: '3 tháng qua' },
  { value: '180d',   label: '6 tháng qua' },
];

async function uploadImage(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error(`Ảnh "${file.name}" quá lớn (tối đa 10MB)`);
  const fd = new FormData(); fd.append('image', file);
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  const res = await fetch('/api/upload/return-image', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `Upload thất bại (${res.status})`);
  return data.url;
}

// ── Return Modal ──────────────────────────────────────────────────────────────
function ReturnModal({ onClose, onSubmit, submitting }) {
  const [reason, setReason] = useState('');
  const [images, setImages] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (files) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 5 - images.length);
    setImages(p => [...p, ...valid.map(f => ({ file: f, preview: URL.createObjectURL(f), url: null, uploading: false, error: null }))]);
  };
  const removeImage = (idx) => setImages(p => { URL.revokeObjectURL(p[idx].preview); return p.filter((_, i) => i !== idx); });

  const handleSubmit = async () => {
    if (!reason.trim()) { alert('Vui lòng nhập lý do hoàn trả.'); return; }
    if (images.length === 0) { alert('Vui lòng đính kèm ít nhất 1 ảnh.'); return; }
    const updated = [...images]; const urls = [];
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], uploading: true }; setImages([...updated]);
      try { const url = await uploadImage(updated[i].file); updated[i] = { ...updated[i], url, uploading: false }; urls.push(url); }
      catch (err) { updated[i] = { ...updated[i], uploading: false, error: 'Lỗi' }; setImages([...updated]); alert(err.message); return; }
      setImages([...updated]);
    }
    onSubmit({ reason, images: urls });
  };
  const anyUploading = images.some(i => i.uploading);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div><h3 className="font-bold text-slate-900 text-base">Yêu cầu hoàn trả</h3><p className="text-xs text-slate-400 mt-0.5">Cung cấp đầy đủ để xử lý nhanh</p></div>
          <button onClick={onClose} disabled={anyUploading || submitting} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors disabled:opacity-40">✕</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Lý do <span className="text-rose-500">*</span></p>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {['Sản phẩm bị lỗi', 'Không đúng mô tả', 'Sai size / màu', 'Hàng giả mạo', 'Hư hỏng vận chuyển', 'Lý do khác'].map(r => (
                <button key={r} onClick={() => setReason(r)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border text-left transition-all ${reason === r ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'}`}>{r}</button>
              ))}
            </div>
            <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Hoặc mô tả chi tiết hơn..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none resize-none placeholder-slate-400 text-slate-700" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Ảnh minh chứng <span className="text-rose-500">*</span><span className="text-slate-400 font-normal normal-case"> ({images.length}/5)</span></p>
            {images.length < 5 && (
              <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                onClick={() => document.getElementById('ret-img').click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${dragOver ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-orange-300 hover:bg-slate-50'}`}>
                <p className="text-2xl mb-1">📷</p><p className="text-xs font-semibold text-slate-500">Kéo thả hoặc nhấn chọn ảnh</p>
                <input id="ret-img" type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
              </div>
            )}
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {images.map((img, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    {img.uploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}
                    {img.url && <div className="absolute top-1 left-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px]">✓</div>}
                    {!img.uploading && <button onClick={() => removeImage(i)} className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-rose-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">×</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2.5 px-5 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} disabled={anyUploading || submitting} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-100 transition-colors disabled:opacity-50">Hủy</button>
          <button onClick={handleSubmit} disabled={anyUploading || submitting}
            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {(anyUploading || submitting) && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {anyUploading ? 'Uploading...' : submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({ modal, form, setForm, images, setImages, loading, onClose, onSubmit }) {
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    Promise.all(files.map(f => new Promise(r => { const rd = new FileReader(); rd.onload = ev => r(ev.target.result); rd.readAsDataURL(f); })))
      .then(results => setImages(p => [...p, ...results].slice(0, 5)));
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Đánh giá sản phẩm</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-xl text-slate-400">✕</button>
        </div>
        {modal.items?.length > 1 && (
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Chọn sản phẩm</label>
            <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={e => { const item = modal.items[e.target.value]; modal.productId = item?.productId?._id || item?.productId; modal.productName = item?.name; }}>
              {modal.items.map((item, i) => <option key={i} value={i}>{item.name}</option>)}
            </select>
          </div>
        )}
        <p className="text-sm text-slate-500 mb-4 font-medium">{modal.productName}</p>
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Số sao</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(star => (
              <button key={star} onClick={() => setForm(p => ({ ...p, rating: star }))}
                className={`text-3xl transition-transform hover:scale-110 ${star <= form.rating ? 'text-yellow-400' : 'text-slate-200'}`}>★</button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Nhận xét</label>
          <textarea rows={4} placeholder="Chia sẻ trải nghiệm..." value={form.comment}
            onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
        </div>
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Hình ảnh (tối đa 5)</label>
          <input type="file" accept="image/*" multiple onChange={handleImageUpload}
            className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 file:font-semibold cursor-pointer" />
          {images.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img} alt="" className="w-14 h-14 object-cover rounded-lg border border-slate-200" />
                  <button onClick={() => setImages(p => p.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border-2 border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50">Hủy</button>
          <button onClick={onSubmit} disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Đang gửi...' : 'Gửi đánh giá'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order Card ────────────────────────────────────────────────────────────────
function OrderCard({ order, onCancel, onReorder, onReview, onOpenReturn, onConfirmDelivery, onNavigate }) {
  const returnable = order.status === 'delivered' && order.userConfirmed &&
    (Date.now() - new Date(order.userConfirmedAt).getTime()) / 86400000 <= RETURN_WINDOW_DAYS;
  const daysLeft = returnable
    ? Math.max(0, RETURN_WINDOW_DAYS - Math.floor((Date.now() - new Date(order.userConfirmedAt)) / 86400000))
    : null;
  const statusDot = STATUS_MAP[order.status]?.dot || '#94A3B8';
  const isReturn = ['return_requested', 'returned'].includes(order.status);

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all overflow-hidden ${order.status === 'return_requested' ? 'border-orange-200' :
      order.status === 'returned' ? 'border-slate-200' :
        order.status === 'cancelled' ? 'border-rose-100' : 'border-slate-100'
      } ${order.status === 'returned' ? 'opacity-75' : ''}`}>

      {/* Clickable header */}
      <div className="px-4 py-3.5 cursor-pointer select-none hover:bg-slate-50/60 transition-colors" onClick={() => onNavigate(order.id)}>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2 flex-shrink-0">
            {order.items.slice(0, 3).map((item, idx) => (
              <div key={idx} className="w-10 h-10 rounded-xl bg-slate-100 border-2 border-white overflow-hidden shadow-sm">
                {item.productId?.images?.[0]
                  ? <img src={item.productId.images[0]} alt={item.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm">👕</div>}
              </div>
            ))}
            {order.items.length > 3 && (
              <div className="w-10 h-10 rounded-xl bg-slate-100 border-2 border-white flex items-center justify-center">
                <span className="text-xs font-bold text-slate-500">+{order.items.length - 3}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm font-mono">#{order.id.slice(-8).toUpperCase()}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${order.statusColor}`}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusDot }} />
                {order.statusLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-slate-400">{formatDate(order.date)}</span>
              <span className="text-xs text-slate-300">·</span>
              <span className={`text-xs font-bold ${isReturn ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{formatPrice(order.total)}</span>
              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${order.paymentStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {order.paymentStatus === 'completed' ? '✓ Đã TT' : '⏳ Chờ TT'}
              </span>
              <span className="text-xs text-slate-400">{order.items.length} SP</span>
            </div>
          </div>
          <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* Items */}
      <div className="border-t border-slate-100 px-4 py-2.5 space-y-2">
        {order.items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-100">
              {item.productId?.images?.[0]
                ? <img src={item.productId.images[0]} alt={item.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">👕</div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">{item.name}</p>
              <div className="flex gap-1.5 text-[11px] text-slate-400 mt-0.5">
                {item.color && <span>{item.color}</span>}
                {item.size && <span>Size {item.size}</span>}
                <span>x{item.quantity}</span>
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-700 flex-shrink-0">{formatPrice(item.price * item.quantity)}</p>
          </div>
        ))}
      </div>

      {/* Status banners */}
      {order.status === 'delivered' && !order.userConfirmed && (
        <div className="mx-4 mb-2.5 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span>📦</span> Xác nhận nhận hàng để mở đánh giá & hoàn trả
        </div>
      )}
      {order.status === 'delivered' && order.userConfirmed && (
        <div className={`mx-4 mb-2.5 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${returnable ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
          <span>⏱</span>
          {returnable ? `Còn ${daysLeft} ngày để hoàn trả` : 'Đã hết hạn hoàn trả (3 ngày)'}
        </div>
      )}
      {order.status === 'return_requested' && (
        <div className="mx-4 mb-2.5 space-y-1.5">
          <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl">
            <div className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-xs font-semibold text-orange-700">Bước 1: Đang chờ Admin xác nhận yêu cầu</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="w-3 h-3 rounded-full border-2 border-slate-300 flex-shrink-0" />
            <p className="text-xs text-slate-400">Bước 2: Sau xác nhận — gửi hàng về & Admin nhận hàng</p>
          </div>
        </div>
      )}
      {order.status === 'returned' && (
        <div className="mx-4 mb-2.5 flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-slate-400 text-sm">✔</span>
          <p className="text-xs font-semibold text-slate-500">Hoàn trả hoàn tất</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center gap-2">
        {order.status === 'pending' && (
          <button onClick={e => { e.stopPropagation(); onCancel(order.id); }}
            className="px-3 py-1.5 text-xs text-rose-500 font-semibold hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors">
            ✕ Hủy đơn
          </button>
        )}

        {/* delivered + chưa confirm */}
        {order.status === 'delivered' && !order.userConfirmed && (
          <button onClick={e => { e.stopPropagation(); onConfirmDelivery(order.id); }}
            className="px-3 py-1.5 text-xs text-emerald-600 font-semibold hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors">
            ✅ Xác nhận đã nhận hàng
          </button>
        )}

        {/* delivered + đã confirm */}
        {order.status === 'delivered' && order.userConfirmed && (
          <>
            <button onClick={e => { e.stopPropagation(); onReview(order); }}
              className="px-3 py-1.5 text-xs text-amber-600 font-semibold hover:bg-amber-50 border border-amber-200 rounded-lg transition-colors">
              ⭐ Đánh giá
            </button>
            <button onClick={e => { e.stopPropagation(); onReorder(order); }}
              className="px-3 py-1.5 text-xs text-slate-600 font-semibold hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors">
              🔄 Mua lại
            </button>
            {returnable && (
              <button onClick={e => { e.stopPropagation(); onOpenReturn(order.id); }}
                className="px-3 py-1.5 text-xs text-orange-600 font-semibold hover:bg-orange-50 border border-orange-200 rounded-lg transition-colors">
                ↩️ Hoàn trả ({daysLeft}d)
              </button>
            )}
          </>
        )}

        {['confirmed', 'returned'].includes(order.status) && (
          <button onClick={e => { e.stopPropagation(); onReorder(order); }}
            className="px-3 py-1.5 text-xs text-slate-600 font-semibold hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors">
            🔄 Mua lại
          </button>
        )}
        {order.status === 'return_requested' && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg text-xs font-semibold">
            <div className="w-2.5 h-2.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            Chờ Admin xác nhận
          </span>
        )}
        {order.status === 'returned' && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs font-semibold">
            ✔ Hoàn trả thành công
          </span>
        )}
      </div>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="flex items-center justify-center gap-1.5 mt-6">
      <button onClick={() => onChange(page - 1)} disabled={page === 1}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      </button>
      {pages.map((p, i) => (
        p === '...'
          ? <span key={i} className="w-8 h-8 flex items-center justify-center text-slate-400 text-sm">…</span>
          : <button key={i} onClick={() => onChange(p)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors ${p === page ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{p}</button>
      ))}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [showReturn, setShowReturn] = useState(false);
  const [returnOrderId, setReturnOrderId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewImages, setReviewImages] = useState([]);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => { fetchOrders(); }, []);

  // Reset page khi filter thay đổi
  useEffect(() => { setPage(1); }, [statusFilter, dateFilter, searchQuery]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // limit=200 để lấy toàn bộ đơn hàng về client xử lý filter/search
      const res = await apiClient.get('/orders', { params: { limit: 200, page: 1 } });
      const raw = res.data?.data || res.data || [];
      const list = Array.isArray(raw) ? raw : Array.isArray(raw.orders) ? raw.orders : [];
      setOrders(list.map(o => ({
        id:             o._id || o.id,
        date:           o.createdAt,
        deliveredAt:    o.deliveredAt || null,
        userConfirmed:  !!o.userConfirmedAt,
        userConfirmedAt: o.userConfirmedAt || null,
        items:          o.items || [],
        total:          o.totalPrice || o.finalAmount || o.total || 0,
        status:         o.status || 'pending',
        paymentStatus:  o.paymentStatus || 'pending',
        returnImages:   o.returnImages || [],
        returnReason:   o.returnReason || '',
        statusLabel:    STATUS_MAP[o.status]?.label || o.status,
        statusColor:    STATUS_MAP[o.status]?.color || STATUS_MAP.pending.color,
      })));
    } catch (err) { console.error('fetchOrders error:', err); }
    finally { setLoading(false); }
  };

  // Search debounce
  const handleSearchChange = (val) => {
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(val.trim().toLowerCase()), 350);
  };

  // Filter logic
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Lọc theo trạng thái
    if (statusFilter !== 'all') result = result.filter(o => o.status === statusFilter);

    // Lọc theo thời gian
    if (dateFilter !== 'all') {
      const days = parseInt(dateFilter);
      const cutoff = Date.now() - days * 86400000;
      result = result.filter(o => new Date(o.date).getTime() >= cutoff);
    }

    // Tìm kiếm: mã đơn + tên sản phẩm
    if (searchQuery) {
      result = result.filter(o =>
        o.id.toLowerCase().includes(searchQuery) ||
        o.id.slice(-8).toLowerCase().includes(searchQuery) ||
        o.items.some(item => item.name?.toLowerCase().includes(searchQuery))
      );
    }

    return result;
  }, [orders, statusFilter, dateFilter, searchQuery]);

  // Phân trang
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, page]);

  const handleCancel = async (orderId) => {
    if (!window.confirm('Bạn có chắc muốn hủy đơn hàng này không?')) return;
    try { await apiClient.post(`/orders/${orderId}/cancel`); fetchOrders(); }
    catch (err) { alert(err.response?.data?.message || 'Không thể hủy đơn hàng'); }
  };

  const handleConfirmDelivery = async (orderId) => {
    if (!window.confirm('Xác nhận bạn đã nhận được hàng?')) return;
    try { await apiClient.post(`/orders/${orderId}/confirm-delivery`); fetchOrders(); }
    catch (err) { alert(err.response?.data?.message || 'Không thể xác nhận nhận hàng'); }
  };

  const handleOpenReturn = (orderId) => { setReturnOrderId(orderId); setShowReturn(true); };

  const handleReturnSubmit = async ({ reason, images }) => {
    setSubmitting(true);
    try {
      await apiClient.post(`/orders/${returnOrderId}/return-request`, { reason, images });
      setShowReturn(false); setReturnOrderId(null); await fetchOrders();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Không thể gửi yêu cầu hoàn trả';
      alert(err.response?.status ? `Lỗi ${err.response.status}: ${msg}` : msg);
    } finally { setSubmitting(false); }
  };

  const handleReorder = async (order) => {
    try {
      for (const item of order.items) {
        const res = await productAPI.getProductById(item.productId?._id || item.productId);
        const product = res.data?.data || res.data;
        if (!product || product.stock < item.quantity) { alert(`Sản phẩm "${item.name}" đã hết hàng`); return; }
        addToCart({ id: product._id, _id: product._id, name: product.name, price: product.price, discountedPrice: product.discount > 0 ? Math.round(product.price * (1 - product.discount / 100)) : product.price, image: product.images?.[0] || '', stock: product.stock }, item.quantity);
      }
      navigate('/checkout');
    } catch { alert('Có lỗi xảy ra'); }
  };

  const handleReview = (order) => {
    setReviewModal({ orderId: order.id, productId: order.items[0]?.productId?._id || order.items[0]?.productId, productName: order.items[0]?.name, items: order.items });
    setReviewForm({ rating: 5, comment: '' }); setReviewImages([]);
  };

  const handleSubmitReview = async () => {
    if (!reviewForm.comment.trim()) { alert('Vui lòng nhập nội dung đánh giá'); return; }
    try {
      setReviewLoading(true);
      await productAPI.addReview(reviewModal.productId, { rating: Number(reviewForm.rating), comment: reviewForm.comment.trim(), images: reviewImages });
      alert('Đánh giá thành công!');
      setReviewModal(null); setReviewForm({ rating: 5, comment: '' }); setReviewImages([]);
    } catch (err) { alert(err.response?.data?.message || 'Không thể gửi đánh giá'); }
    finally { setReviewLoading(false); }
  };

  const clearAllFilters = () => {
    setStatusFilter('all'); setDateFilter('all');
    setSearchInput(''); setSearchQuery(''); setPage(1);
  };
  const hasActiveFilter = statusFilter !== 'all' || dateFilter !== 'all' || searchQuery !== '';

  if (loading) return <Loading />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Đơn hàng của tôi</h1>
          {orders.length > 0 && (
            <p className="text-sm text-slate-400 mt-0.5">
              {orders.length} đơn hàng · hiển thị {filteredOrders.length} kết quả
            </p>
          )}
        </div>
        {hasActiveFilter && (
          <button onClick={clearAllFilters}
            className="text-xs text-slate-500 hover:text-red-500 border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-lg font-semibold transition-colors">
            ✕ Xóa bộ lọc
          </button>
        )}
      </div>

      {orders.length > 0 && (
        <div className="space-y-3 mb-5">
          {/* Search bar */}
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Tìm theo tên sản phẩm hoặc mã đơn hàng..."
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400 transition-all"
            />
            {searchInput && (
              <button onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {/* Filter row */}
          <div className="flex gap-2 flex-wrap items-center">
            {/* Lọc thời gian */}
            <div className="relative">
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                {DATE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>

            {/* Lọc trạng thái */}
            <div className="flex gap-1.5 flex-wrap">
              {[['all', 'Tất cả'], ...Object.entries(STATUS_MAP).map(([k, v]) => [k, v.label])].map(([key, label]) => {
                const count = key === 'all' ? orders.length : orders.filter(o => o.status === key).length;
                if (key !== 'all' && count === 0) return null;
                return (
                  <button key={key} onClick={() => setStatusFilter(key)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${statusFilter === key
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}>
                    {label}
                    {count > 0 && <span className={`ml-1 px-1 py-0.5 rounded text-[10px] ${statusFilter === key ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16">
          {orders.length === 0 ? (
            <>
              <div className="text-5xl mb-4">🛍️</div>
              <p className="text-slate-500 font-medium mb-4">Bạn chưa có đơn hàng nào</p>
              <Link to="/products" className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
                Tiếp tục mua sắm
              </Link>
            </>
          ) : (
            <>
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-slate-500 font-medium mb-2">Không tìm thấy đơn hàng</p>
              <p className="text-sm text-slate-400 mb-4">Thử tìm kiếm khác hoặc bỏ bộ lọc</p>
              <button onClick={clearAllFilters}
                className="px-5 py-2 text-sm text-blue-600 hover:underline font-semibold">
                Xem tất cả đơn hàng
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginatedOrders.map(order => (
              <OrderCard key={order.id} order={order}
                onCancel={handleCancel}
                onOpenReturn={handleOpenReturn}
                onReorder={handleReorder}
                onReview={handleReview}
                onConfirmDelivery={handleConfirmDelivery}
                onNavigate={(id) => navigate(`/orders/${id}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            total={filteredOrders.length}
            pageSize={PAGE_SIZE}
            onChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />

          {/* Summary */}
          {filteredOrders.length > PAGE_SIZE && (
            <p className="text-center text-xs text-slate-400 mt-3">
              Hiển thị {Math.min(page * PAGE_SIZE, filteredOrders.length)}/{filteredOrders.length} đơn hàng
            </p>
          )}
        </>
      )}

      {showReturn && (
        <ReturnModal
          onClose={() => { setShowReturn(false); setReturnOrderId(null); }}
          onSubmit={handleReturnSubmit}
          submitting={submitting}
        />
      )}
      {reviewModal && (
        <ReviewModal
          modal={reviewModal}
          form={reviewForm} setForm={setReviewForm}
          images={reviewImages} setImages={setReviewImages}
          loading={reviewLoading}
          onClose={() => setReviewModal(null)}
          onSubmit={handleSubmitReview}
        />
      )}
    </div>
  );
}
