import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@hooks/useCart';
import Loading from '@components/Loading';
import Empty from '@components/Empty';
import { formatPrice, formatDate } from '@utils/helpers';
import { productAPI } from '@services/api';
import apiClient from '@services/apiClient';

const STATUS_MAP = {
  delivered:  { label: 'Đã giao',        color: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
  processing: { label: 'Đang xử lý',     color: 'bg-amber-100 text-amber-800 border border-amber-200'       },
  confirmed:  { label: 'Đã xác nhận',    color: 'bg-blue-100 text-blue-800 border border-blue-200'           },
  shipped:    { label: 'Đang giao',       color: 'bg-sky-100 text-sky-800 border border-sky-200'              },
  pending:    { label: 'Chờ xác nhận',   color: 'bg-slate-100 text-slate-700 border border-slate-200'        },
  cancelled:  { label: 'Đã hủy',         color: 'bg-rose-100 text-rose-700 border border-rose-200'           },
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  // ── Review modal state ────────────────────────────────────────────────────
  const [reviewModal,   setReviewModal]   = useState(null);
  const [reviewForm,    setReviewForm]    = useState({ rating: 5, comment: '' });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewImages,  setReviewImages]  = useState([]);

  useEffect(() => { fetchOrders(); }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchOrders = async () => {
    try {
      setLoading(true);
      // ✅ Gọi trực tiếp qua apiClient để kiểm soát endpoint rõ ràng
      const res  = await apiClient.get('/user/orders');
      // ✅ Xử lý nhiều dạng response có thể có từ backend
      const raw  = res.data?.data || res.data || [];
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.orders)
          ? raw.orders
          : [];

      const normalized = list.map(order => ({
        id:          order._id || order.id,
        date:        order.createdAt,
        items:       order.items || [],
        total:       order.totalPrice || order.finalAmount || order.total || 0,
        status:      order.status || 'pending',
        statusLabel: STATUS_MAP[order.status]?.label || order.status,
        statusColor: STATUS_MAP[order.status]?.color  || STATUS_MAP.pending.color,
      }));

      setOrders(normalized);
    } catch (error) {
      console.error('Error fetching orders:', error);
      // ✅ Log rõ để debug
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:',  error.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Reorder ───────────────────────────────────────────────────────────────
  const handleReorder = async (order) => {
    try {
      for (const item of order.items) {
        const res     = await productAPI.getProductById(item.productId?._id || item.productId);
        const product = res.data?.data || res.data;
        if (!product || product.stock < item.quantity) {
          alert(`Sản phẩm "${item.name}" đã hết hàng`);
          return;
        }
        addToCart({
          id:             product._id,
          _id:            product._id,
          name:           product.name,
          price:          product.price,
          discountedPrice: product.discount > 0
            ? Math.round(product.price * (1 - product.discount / 100))
            : product.price,
          image: product.images?.[0] || '',
          stock: product.stock,
        }, item.quantity);
      }

      const selected = order.items.map(item => ({
        id:       item.productId?._id || item.productId,
        _id:      item.productId?._id || item.productId,
        name:     item.name,
        price:    item.price,
        quantity: item.quantity,
        image:    '',
      }));
      sessionStorage.setItem('checkoutItems', JSON.stringify(selected));
      navigate('/checkout');
    } catch {
      alert('Có lỗi xảy ra khi thêm vào giỏ hàng');
    }
  };

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancel = async (orderId) => {
    if (!window.confirm('Bạn có chắc muốn hủy đơn hàng này không?')) return;
    try {
      await apiClient.put(`/user/orders/${orderId}/cancel`);
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể hủy đơn hàng');
    }
  };

  // ── Review ────────────────────────────────────────────────────────────────
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const promises = files.map(f => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = ev => resolve(ev.target.result);
      reader.readAsDataURL(f);
    }));
    Promise.all(promises).then(results => {
      setReviewImages(prev => [...prev, ...results].slice(0, 5));
    });
  };

  const handleSubmitReview = async () => {
    if (!reviewForm.comment.trim()) { alert('Vui lòng nhập nội dung đánh giá'); return; }
    try {
      setReviewLoading(true);
      await productAPI.addReview(reviewModal.productId, {
        rating:  Number(reviewForm.rating),
        comment: reviewForm.comment.trim(),
        images:  reviewImages,
      });
      alert('Đánh giá thành công!');
      setReviewModal(null);
      setReviewForm({ rating: 5, comment: '' });
      setReviewImages([]);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể gửi đánh giá');
    } finally {
      setReviewLoading(false);
    }
  };

  // ── Filter ────────────────────────────────────────────────────────────────
  const displayOrders = statusFilter === 'all'
    ? orders
    : orders.filter(o => o.status === statusFilter);

  if (loading) return <Loading />;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-black text-slate-900 mb-6">Đơn hàng của tôi</h1>

      {/* Status filter tabs */}
      {orders.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-5">
          {[['all', 'Tất cả'], ...Object.entries(STATUS_MAP).map(([k, v]) => [k, v.label])].map(([key, label]) => {
            const count = key === 'all' ? orders.length : orders.filter(o => o.status === key).length;
            if (key !== 'all' && count === 0) return null;
            return (
              <button key={key} onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  statusFilter === key
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                }`}>
                {label} {count > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === key ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Order list */}
      {displayOrders.length === 0 ? (
        <Empty
          message={statusFilter === 'all' ? 'Bạn chưa có đơn hàng nào' : `Không có đơn hàng nào ở trạng thái "${STATUS_MAP[statusFilter]?.label}"`}
          action={
            statusFilter === 'all'
              ? <Link to="/products" className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
                  Tiếp tục mua sắm
                </Link>
              : <button onClick={() => setStatusFilter('all')} className="px-5 py-2 text-sm text-blue-600 hover:underline">Xem tất cả</button>
          }
        />
      ) : (
        <div className="space-y-4">
          {displayOrders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden">

              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Mã đơn hàng</p>
                    <p className="font-bold text-slate-800 text-sm font-mono">#{order.id.slice(-8).toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Ngày đặt</p>
                    <p className="font-semibold text-slate-700 text-sm">{formatDate(order.date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Tổng tiền</p>
                    <p className="font-black text-blue-600 text-sm">{formatPrice(order.total)}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${order.statusColor}`}>
                  {order.statusLabel}
                </span>
              </div>

              {/* Items */}
              <div className="px-5 py-4">
                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                        {item.productId?.images?.[0]
                          ? <img src={item.productId.images[0]} alt={item.name} className="w-full h-full object-cover"/>
                          : <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm">👕</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                        <p className="text-xs text-slate-400">x{item.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-700 flex-shrink-0">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2">
                <Link to={`/orders/${order.id}`}
                  className="px-4 py-1.5 text-sm text-blue-600 font-semibold hover:bg-blue-50 rounded-lg transition-colors">
                  Xem chi tiết →
                </Link>

                {order.status === 'pending' && (
                  <button onClick={() => handleCancel(order.id)}
                    className="px-4 py-1.5 text-sm text-rose-500 font-semibold hover:bg-rose-50 rounded-lg transition-colors">
                    Hủy đơn hàng
                  </button>
                )}

                {['delivered', 'processing', 'confirmed'].includes(order.status) && (
                  <button onClick={() => handleReorder(order)}
                    className="px-4 py-1.5 text-sm text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors">
                    🔄 Mua lại
                  </button>
                )}

                {order.status === 'delivered' && (
                  <button
                    onClick={() => {
                      const first = order.items[0];
                      setReviewModal({
                        orderId:     order.id,
                        productId:   first?.productId?._id || first?.productId,
                        productName: first?.name,
                        items:       order.items,
                      });
                      setReviewForm({ rating: 5, comment: '' });
                      setReviewImages([]);
                    }}
                    className="px-4 py-1.5 text-sm text-amber-600 font-semibold hover:bg-amber-50 rounded-lg transition-colors">
                    ⭐ Đánh giá
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Review modal ─────────────────────────────────────────────────────── */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">Đánh giá sản phẩm</h2>
              <button onClick={() => setReviewModal(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 text-xl">✕</button>
            </div>

            {/* Chọn sản phẩm nếu nhiều item */}
            {reviewModal.items?.length > 1 && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Chọn sản phẩm</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={e => {
                    const item = reviewModal.items[e.target.value];
                    setReviewModal(p => ({ ...p, productId: item?.productId?._id || item?.productId, productName: item?.name }));
                  }}>
                  {reviewModal.items.map((item, i) => <option key={i} value={i}>{item.name}</option>)}
                </select>
              </div>
            )}

            <p className="text-sm text-slate-500 mb-4 font-medium">{reviewModal.productName}</p>

            {/* Stars */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Số sao</label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(star => (
                  <button key={star} onClick={() => setReviewForm(p => ({ ...p, rating: star }))}
                    className={`text-3xl transition-transform hover:scale-110 ${star <= reviewForm.rating ? 'text-yellow-400' : 'text-gray-300'}`}>
                    ★
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1">{reviewForm.rating}/5 sao</p>
            </div>

            {/* Comment */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Nhận xét</label>
              <textarea rows={4} placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm..."
                value={reviewForm.comment}
                onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </div>

            {/* Image upload */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Hình ảnh (tùy chọn, tối đa 5)</label>
              <input type="file" accept="image/*" multiple onChange={handleImageUpload}
                className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 file:font-semibold hover:file:bg-blue-100 cursor-pointer"/>
              {reviewImages.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {reviewImages.map((img, i) => (
                    <div key={i} className="relative">
                      <img src={img} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200"/>
                      <button onClick={() => setReviewImages(p => p.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setReviewModal(null); setReviewForm({ rating: 5, comment: '' }); setReviewImages([]); }}
                className="flex-1 py-2.5 border-2 border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors">
                Hủy
              </button>
              <button onClick={handleSubmitReview} disabled={reviewLoading}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {reviewLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                {reviewLoading ? 'Đang gửi...' : 'Gửi đánh giá'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}