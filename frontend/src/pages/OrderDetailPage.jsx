import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Loading from '@components/Loading';
import { formatPrice, formatDate } from '@utils/helpers';
import { orderAPI } from '@services/api';
import apiClient from '@services/apiClient';

const STATUS_CFG = {
  pending:          { label:'Chờ xác nhận',        icon:'🕐', dot:'#F59E0B', bg:'#FFFBEB', text:'#92400E', step:1 },
  confirmed:        { label:'Đã xác nhận',          icon:'✅', dot:'#3B82F6', bg:'#EFF6FF', text:'#1D4ED8', step:2 },
  processing:       { label:'Đang xử lý',           icon:'⚙️', dot:'#8B5CF6', bg:'#F5F3FF', text:'#5B21B6', step:3 },
  shipped:          { label:'Đang giao hàng',       icon:'🚚', dot:'#06B6D4', bg:'#ECFEFF', text:'#164E63', step:4 },
  delivered:        { label:'Đã giao thành công',   icon:'📦', dot:'#10B981', bg:'#ECFDF5', text:'#065F46', step:5 },
  return_requested: { label:'Đang hoàn trả',        icon:'↩️', dot:'#F97316', bg:'#FFF7ED', text:'#9A3412', step:5 },
  returned:         { label:'Hoàn trả thành công',  icon:'✔️', dot:'#6B7280', bg:'#F9FAFB', text:'#374151', step:5 },
  cancelled:        { label:'Đã hủy',               icon:'❌', dot:'#EF4444', bg:'#FEF2F2', text:'#991B1B', step:0 },
};
const sc = s => STATUS_CFG[s] || { label:s, icon:'📋', dot:'#94A3B8', bg:'#F8FAFC', text:'#475569', step:0 };
const MAIN_STEPS = ['pending','confirmed','processing','shipped','delivered'];
const RETURN_WINDOW_DAYS = 5;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'ml_default';
const CLOUDINARY_CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

const PAYMENT_LABELS = {
  cod: 'Thanh toán khi nhận (COD)',
  bank_transfer: 'Chuyển khoản',
  momo: 'Ví MoMo',
  credit_card: 'Thẻ tín dụng',
};

// ── Upload ảnh lên Cloudinary ─────────────────────────────────────
async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  fd.append('folder', 'returns');
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: fd }
  );
  if (!res.ok) throw new Error('Upload ảnh thất bại');
  const data = await res.json();
  return data.secure_url;
}

function ReturnCountdown({ deliveredAt }) {
  const deadline  = new Date(new Date(deliveredAt).getTime() + RETURN_WINDOW_DAYS * 86400000);
  const remaining = deadline - Date.now();
  if (remaining <= 0) return <span className="text-slate-400 text-xs italic">Đã hết hạn hoàn trả</span>;
  const days  = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  return (
    <span className="text-orange-600 font-semibold text-sm">
      Còn {days > 0 ? `${days} ngày ${hours} giờ` : `${hours} giờ`} để hoàn trả
    </span>
  );
}

function OrderStepper({ status }) {
  const cfg = sc(status);
  if (status === 'cancelled') return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-100">
      <span className="text-xl">❌</span>
      <p className="font-semibold text-red-700 text-sm">Đơn hàng đã bị hủy</p>
    </div>
  );
  if (status === 'return_requested' || status === 'returned') return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border"
      style={{ background: cfg.bg, borderColor: cfg.dot + '44' }}>
      <span className="text-xl">{cfg.icon}</span>
      <div>
        <p className="font-semibold text-sm" style={{ color: cfg.text }}>{cfg.label}</p>
        <p className="text-xs mt-0.5" style={{ color: cfg.text + '88' }}>
          {status === 'return_requested'
            ? 'Yêu cầu đang được xử lý, chúng tôi sẽ liên hệ trong 1–3 ngày.'
            : 'Hoàn trả thành công. Số lượng kho đã được cập nhật.'}
        </p>
      </div>
    </div>
  );
  return (
    <div className="flex items-start">
      {MAIN_STEPS.map((s, i) => {
        const done   = cfg.step > i + 1;
        const active = cfg.step === i + 1;
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                done   ? 'bg-emerald-500 border-emerald-500 text-white' :
                active ? 'border-blue-500 bg-blue-50 text-blue-600' :
                         'border-slate-200 bg-white text-slate-300'
              }`}>{done ? '✓' : i + 1}</div>
              <span className={`text-[9px] font-semibold text-center leading-tight whitespace-nowrap max-w-[54px] ${
                done ? 'text-emerald-600' : active ? 'text-blue-600' : 'text-slate-300'
              }`}>{sc(s).label}</span>
            </div>
            {i < MAIN_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Return Modal ──────────────────────────────────────────────────
function ReturnModal({ onClose, onSubmit, submitting }) {
  const [reason,   setReason]   = useState('');
  const [images,   setImages]   = useState([]);   // { file, preview, url, uploading, error }
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (files) => {
    const valid = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 5 - images.length);
    const newImgs = valid.map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
      url: null, uploading: false, error: null,
    }));
    setImages(p => [...p, ...newImgs]);
  };

  const removeImage = (idx) => {
    setImages(p => {
      URL.revokeObjectURL(p[idx].preview);
      return p.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async () => {
    if (!reason.trim()) { alert('Vui lòng nhập lý do hoàn trả.'); return; }
    if (images.length === 0) { alert('Vui lòng đính kèm ít nhất 1 ảnh sản phẩm.'); return; }

    // Upload từng ảnh lên Cloudinary
    let uploadedUrls = [];
    const updated = [...images];
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], uploading: true, error: null };
      setImages([...updated]);
      try {
        const url = await uploadToCloudinary(updated[i].file);
        updated[i] = { ...updated[i], url, uploading: false };
        uploadedUrls.push(url);
      } catch {
        updated[i] = { ...updated[i], uploading: false, error: 'Upload thất bại' };
        setImages([...updated]);
        alert(`Không thể upload ảnh "${updated[i].file.name}". Vui lòng thử lại.`);
        return;
      }
      setImages([...updated]);
    }

    onSubmit({ reason, images: uploadedUrls });
  };

  const allUploading = images.some(img => img.uploading);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
      style={{ animation: 'fadeIn .2s ease' }}>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto"
        style={{ animation: 'slideUp .22s ease' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">↩️</span>
            <div>
              <h3 className="font-bold text-slate-900">Yêu cầu hoàn trả</h3>
              <p className="text-xs text-slate-400">Vui lòng cung cấp đầy đủ thông tin</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Lý do */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              Lý do hoàn trả <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {['Sản phẩm bị lỗi', 'Không đúng mô tả', 'Sai size / màu', 'Sản phẩm giả mạo', 'Hư hỏng khi vận chuyển', 'Lý do khác'].map(r => (
                <button key={r} onClick={() => setReason(r)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left transition-all ${
                    reason === r
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:text-orange-600'
                  }`}>{r}</button>
              ))}
            </div>
            <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Mô tả chi tiết lý do hoàn trả..."
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none resize-none placeholder-slate-400"/>
          </div>

          {/* Upload ảnh */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              Ảnh minh chứng <span className="text-rose-500">*</span>
              <span className="ml-1.5 text-slate-400 normal-case font-normal">({images.length}/5 ảnh)</span>
            </label>
            <p className="text-xs text-slate-400 mb-3">Chụp ảnh rõ ràng tình trạng sản phẩm, tem nhãn, lỗi hỏng (nếu có)</p>

            {/* Drop zone */}
            {images.length < 5 && (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                onClick={() => document.getElementById('return-img-input').click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragOver ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-orange-300 hover:bg-orange-50/50'
                }`}>
                <div className="text-3xl mb-2">📷</div>
                <p className="text-sm font-semibold text-slate-600">Kéo thả hoặc nhấn để chọn ảnh</p>
                <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP — tối đa 5 ảnh</p>
                <input id="return-img-input" type="file" accept="image/*" multiple className="hidden"
                  onChange={e => addFiles(e.target.files)}/>
              </div>
            )}

            {/* Preview grid */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {images.map((img, i) => (
                  <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={img.preview} alt="" className="w-full h-full object-cover"/>
                    {/* Uploading overlay */}
                    {img.uploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                      </div>
                    )}
                    {/* Success */}
                    {img.url && !img.uploading && (
                      <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                        </svg>
                      </div>
                    )}
                    {/* Error */}
                    {img.error && (
                      <div className="absolute inset-0 bg-rose-500/80 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{img.error}</span>
                      </div>
                    )}
                    {/* Remove */}
                    {!img.uploading && (
                      <button onClick={() => removeImage(i)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-rose-500 text-white rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notice */}
          <div className="flex gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="text-amber-500 text-sm flex-shrink-0">ℹ️</span>
            <p className="text-xs text-amber-700 leading-relaxed">
              Yêu cầu sẽ được xử lý trong <strong>1–3 ngày làm việc</strong>. Admin sẽ xem xét ảnh và tình trạng sản phẩm trước khi xác nhận.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} disabled={allUploading || submitting}
            className="flex-1 py-2.5 border-2 border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-100 transition-colors disabled:opacity-50">
            Hủy
          </button>
          <button onClick={handleSubmit} disabled={allUploading || submitting}
            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {(allUploading || submitting) && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
            )}
            {allUploading ? 'Đang upload...' : submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function OrderDetailPage() {
  const { id } = useParams();
  const [order,     setOrder]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting,setSubmitting]= useState(false);

  useEffect(() => { fetchOrder(); }, [id]);

  const fetchOrder = async () => {
    try {
      const res = await orderAPI.getOrderById(id);
      setOrder(res.data?.data || res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Không tìm thấy đơn hàng');
    } finally { setLoading(false); }
  };

  const handleCancel = async () => {
    if (!window.confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
    try { await orderAPI.cancelOrder(id); fetchOrder(); }
    catch (err) { alert(err.response?.data?.message || 'Không thể hủy đơn hàng'); }
  };

  const handleReturnSubmit = async ({ reason, images }) => {
    setSubmitting(true);
    try {
      await apiClient.post(`/orders/${id}/return-request`, { reason, images });
      setShowModal(false);
      fetchOrder();
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể gửi yêu cầu hoàn trả');
    } finally { setSubmitting(false); }
  };

  const canReturn = () => {
    if (!order || order.status !== 'delivered') return false;
    const diff = (Date.now() - new Date(order.deliveredAt || order.updatedAt)) / 86400000;
    return diff <= RETURN_WINDOW_DAYS;
  };

  if (loading) return <Loading/>;
  if (error) return (
    <div className="text-center py-12">
      <p className="text-red-500 mb-4">{error}</p>
      <Link to="/orders" className="text-blue-600 hover:underline">← Quay lại đơn hàng</Link>
    </div>
  );
  if (!order) return null;

  const cfg     = sc(order.status);
  const isPaid  = order.paymentStatus === 'completed';
  const isReturn = order.status === 'return_requested' || order.status === 'returned';

  return (
    <div className="max-w-4xl mx-auto" style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .od-card{background:#fff;border-radius:16px;border:1px solid #f1f5f9;box-shadow:0 1px 4px rgba(0,0,0,.05)}
        .od-btn{transition:all .2s} .od-btn:hover:not(:disabled){transform:translateY(-1px)}
      `}</style>

      {/* Return Modal */}
      {showModal && (
        <ReturnModal
          onClose={() => setShowModal(false)}
          onSubmit={handleReturnSubmit}
          submitting={submitting}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chi tiết đơn hàng</h1>
          <p className="text-sm text-slate-400 font-mono mt-0.5">#{order._id.slice(0,8).toUpperCase()}</p>
        </div>
        <Link to="/orders" className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Quay lại
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">

          {/* Status card */}
          <div className="od-card p-6">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Trạng thái</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cfg.icon}</span>
                  <span className="font-bold text-lg" style={{ color: cfg.text }}>{cfg.label}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Đặt ngày {formatDate(order.createdAt)}
                  {order.deliveredAt && ` · Giao ${formatDate(order.deliveredAt)}`}
                </p>
                {order.trackingNumber && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Mã vận đơn: <span className="font-mono font-semibold text-slate-600">{order.trackingNumber}</span>
                  </p>
                )}
              </div>
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-400'}`}/>
                {isPaid ? 'Đã thanh toán' : 'Chờ thanh toán'}
              </span>
            </div>

            <OrderStepper status={order.status}/>

            {/* Return zone */}
            {order.status === 'delivered' && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">⏱</span>
                  <ReturnCountdown deliveredAt={order.deliveredAt || order.updatedAt}/>
                </div>
                {canReturn() && (
                  <button onClick={() => setShowModal(true)}
                    className="od-btn flex items-center gap-1.5 px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 rounded-xl text-xs font-bold">
                    ↩️ Yêu cầu hoàn trả
                  </button>
                )}
              </div>
            )}

            {/* Ảnh hoàn trả đã gửi */}
            {order.returnImages?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Ảnh minh chứng hoàn trả</p>
                <div className="flex gap-2 flex-wrap">
                  {order.returnImages.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity">
                      <img src={url} alt={`return-${i}`} className="w-full h-full object-cover"/>
                    </a>
                  ))}
                </div>
                {order.returnReason && (
                  <p className="text-xs text-slate-500 mt-2 italic">Lý do: {order.returnReason}</p>
                )}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="od-card p-6">
            <h2 className="font-bold text-slate-900 mb-4">Sản phẩm đã đặt</h2>
            <div className="divide-y divide-slate-50">
              {order.items?.map((item, i) => (
                <div key={i} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden">
                    {item.image
                      ? <img src={item.image} alt={item.name} className="w-full h-full object-cover"/>
                      : <div className="w-full h-full flex items-center justify-center text-slate-300 text-xl">📦</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{item.name}</p>
                    <div className="flex items-center gap-2.5 mt-1 flex-wrap text-xs text-slate-400">
                      {item.color && <span>Màu: {item.color}</span>}
                      {item.size  && <span>Size: {item.size}</span>}
                      <span>SL: {item.quantity}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-slate-800 text-sm">{formatPrice(item.price * item.quantity)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatPrice(item.price)} × {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping */}
          <div className="od-card p-6">
            <h2 className="font-bold text-slate-900 mb-4">Địa chỉ giao hàng</h2>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-base flex-shrink-0">📍</div>
              <div>
                <p className="font-semibold text-slate-800">{order.shippingAddress?.fullName}</p>
                <p className="text-sm text-slate-500 mt-0.5">{order.shippingAddress?.address}</p>
                <p className="text-sm text-slate-500">{order.shippingAddress?.phone}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <div className="od-card p-6">
            <h2 className="font-bold text-slate-900 mb-4">Tóm tắt</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Tạm tính</span>
                <span className="font-medium">{formatPrice(order.subtotal)}</span>
              </div>
              {order.shippingFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Vận chuyển</span>
                  <span className="font-medium">{formatPrice(order.shippingFee)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Giảm giá</span>
                  <span className="font-medium text-emerald-600">−{formatPrice(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Thanh toán</span>
                <span className="font-medium text-xs text-right">{PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Trạng thái TT</span>
                <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isPaid ? '✓ Đã TT' : '⏳ Chờ TT'}
                </span>
              </div>
              <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                <span className="font-bold text-slate-900">Tổng cộng</span>
                <span className="font-bold text-lg text-blue-600">{formatPrice(order.total)}</span>
              </div>
              {isReturn && (
                <p className="text-xs text-slate-400 italic border-t border-slate-100 pt-2">
                  ※ Đơn hoàn trả không tính vào doanh thu.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2.5">
            {['pending','confirmed'].includes(order.status) && (
              <button onClick={handleCancel}
                className="od-btn w-full py-3 border-2 border-red-200 text-red-500 hover:bg-red-50 rounded-xl font-semibold text-sm">
                ✕ Hủy đơn hàng
              </button>
            )}
            {order.status === 'delivered' && canReturn() && (
              <button onClick={() => setShowModal(true)}
                className="od-btn w-full py-3 border-2 border-orange-200 text-orange-500 hover:bg-orange-50 rounded-xl font-semibold text-sm">
                ↩️ Yêu cầu hoàn trả
              </button>
            )}
            {order.status === 'delivered' && !canReturn() && (
              <div className="od-card p-3 text-center">
                <p className="text-xs text-slate-400 italic">Đã hết hạn hoàn trả (5 ngày)</p>
              </div>
            )}
            <Link to="/products"
              className="od-btn block w-full py-3 text-center bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-700 transition-colors">
              Mua thêm sản phẩm
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}