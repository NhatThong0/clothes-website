import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Loading from '@components/Loading';
import Error from '@components/Error';
import { useCart } from '@hooks/useCart';
import { formatPrice } from '@utils/helpers';
import { productAPI } from '@services/api';
import { useAuth } from '@context/AuthContext';

// ── Toast nhỏ hiển thị góc màn hình ─────────────────────────────────────────
function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-semibold animate-fade-in-up ${
      type === 'error' ? 'bg-red-500' : 'bg-green-500'
    }`}>
      <span>{type === 'error' ? '✗' : '✓'}</span>
      <span>{message}</span>
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user } = useAuth();

  const [product,        setProduct]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [quantity,       setQuantity]       = useState(1);
  const [selectedImage,  setSelectedImage]  = useState(0);
  const [selectedColor,  setSelectedColor]  = useState('');
  const [selectedSize,   setSelectedSize]   = useState('');
  const [reviews,        setReviews]        = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [myReview,       setMyReview]       = useState(null);
  const [editMode,       setEditMode]       = useState(false);
  const [editForm,       setEditForm]       = useState({ rating: 5, comment: '' });
  const [previewImg,     setPreviewImg]     = useState(null);
  const [starFilter,     setStarFilter]     = useState(0);
  const [toast,          setToast]          = useState(null); // { message, type }

  const showToast = (message, type = 'success') => setToast({ message, type });

  useEffect(() => {
    fetchProduct();
    fetchReviews();
    fetchMyReview();
  }, [id]);

  // ── Fetchers ─────────────────────────────────────────────────────────────────

  const fetchProduct = async () => {
    try {
      setLoading(true);
      setError(null);
      const res  = await productAPI.getProductById(id);
      const data = res.data?.data || res.data;
      if (!data) throw new Error('Không tìm thấy sản phẩm');

      const normalized = {
        id:              data._id || data.id,
        _id:             data._id || data.id,
        name:            data.name,
        description:     data.description || '',
        price:           data.price,
        discountedPrice: data.discount > 0
          ? Math.round(data.price * (1 - data.discount / 100))
          : data.price,
        discount:  data.discount || 0,
        category:  data.category?.name || data.category || '',
        images:    data.images?.length > 0
          ? data.images
          : ['https://placehold.co/500x600?text=No+Image'],
        rating:    data.averageRating || data.rating || 0,
        reviews:   data.reviewCount || (Array.isArray(data.reviews) ? data.reviews.length : 0),
        stock:     data.stock ?? 0,
        colors:    data.colors || [],
        sizes:     data.sizes || [],
        features:  data.features || [],
        isActive:  data.isActive,
        soldCount: data.soldCount || 0,
      };

      setProduct(normalized);
      if (normalized.colors.length > 0) setSelectedColor(normalized.colors[0]);
      if (normalized.sizes.length > 0)  setSelectedSize(normalized.sizes[0]);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Đã có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      setReviewsLoading(true);
      const res  = await productAPI.getReviews(id);
      const data = res.data?.data || [];
      setReviews(data);
    } catch { } finally {
      setReviewsLoading(false);
    }
  };

  const fetchMyReview = async () => {
    try {
      const res = await productAPI.getMyReview(id);
      setMyReview(res.data?.data || null);
    } catch {
      setMyReview(null);
    }
  };

  // ── Review stats ──────────────────────────────────────────────────────────

  const starCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => { if (counts[r.rating] !== undefined) counts[r.rating]++; });
    return counts;
  }, [reviews]);

  const avgRating = useMemo(() => {
    if (!reviews.length) return 0;
    return (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    if (starFilter === 0) return reviews;
    return reviews.filter(r => r.rating === starFilter);
  }, [reviews, starFilter]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleAddToCart = () => {
    if (!product) return;
    if (product.stock === 0) {
      showToast('Sản phẩm đã hết hàng, vui lòng quay lại sau', 'error');
      return;
    }
    addToCart({ ...product, image: product.images[0] }, quantity);
    showToast(`Đã thêm ${quantity} sản phẩm vào giỏ hàng`);
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (product.stock === 0) {
      showToast('Sản phẩm đã hết hàng, vui lòng quay lại sau', 'error');
      return;
    }
    addToCart({ ...product, image: product.images[0] }, quantity);
    navigate('/cart');
  };

  const handleDeleteMyReview = async () => {
    if (!window.confirm('Xóa đánh giá này?')) return;
    try {
      await productAPI.deleteReview(id, myReview._id);
      setMyReview(null);
      fetchReviews();
    } catch (err) {
      showToast(err.response?.data?.message || 'Không thể xóa đánh giá', 'error');
    }
  };

  const handleUpdateReview = async () => {
    try {
      await productAPI.updateReview(id, myReview._id, editForm);
      setMyReview({ ...myReview, ...editForm });
      setEditMode(false);
      fetchReviews();
    } catch (err) {
      showToast(err.response?.data?.message || 'Không thể cập nhật đánh giá', 'error');
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────────

  if (loading)  return <Loading />;
  if (error)    return <Error message={error} onRetry={fetchProduct} />;
  if (!product) return <Error message="Không tìm thấy sản phẩm" />;

  const outOfStock = product.stock === 0;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-lg shadow-sm-blue p-6 md:p-10">

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

        {/* ── Images ──────────────────────────────────────────────────────── */}
        <div>
          <div className="relative">
            <img
              src={product.images[selectedImage]}
              alt={product.name}
              className={`w-full rounded-lg shadow-md mb-4 bg-light object-cover cursor-zoom-in ${outOfStock ? 'grayscale opacity-70' : ''}`}
              style={{ maxHeight: '500px' }}
              onClick={() => setPreviewImg(product.images[selectedImage])}
            />
            {/* Hết hàng overlay trên ảnh chính */}
            {outOfStock && (
              <div className="absolute inset-0 mb-4 rounded-lg flex items-center justify-center bg-black/25">
                <span className="bg-white text-red-600 font-bold text-lg px-6 py-2 rounded-full shadow-lg">
                  Hết hàng
                </span>
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.images.map((img, i) => (
                <img key={i} src={img} alt={`Thumbnail ${i + 1}`}
                  onClick={() => setSelectedImage(i)}
                  className={`w-full rounded-lg cursor-pointer transition-all object-cover h-20 ${
                    selectedImage === i ? 'ring-2 ring-primary opacity-100' : 'hover:opacity-75 opacity-60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Info ────────────────────────────────────────────────────────── */}
        <div>
          <div className="mb-4">
            <span className="inline-block px-3 py-1 bg-primary text-white rounded-full text-sm font-semibold">
              {product.category}
            </span>
          </div>

          <h1 className="text-3xl font-bold text-dark mb-2">{product.name}</h1>

          {product.rating > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className={`w-5 h-5 ${i < Math.round(product.rating) ? 'fill-yellow-400' : 'fill-gray-300'}`} viewBox="0 0 20 20">
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>
              <span className="text-gray-500 text-sm">({product.reviews} đánh giá)</span>
            </div>
          )}

          {product.soldCount > 0 && (
            <p className="text-orange-500 font-semibold text-sm mb-4">
              🔥 Đã bán {product.soldCount} sản phẩm
            </p>
          )}

          <div className="flex items-baseline space-x-3 mb-6">
            <span className="text-4xl font-bold text-primary">{formatPrice(product.discountedPrice)}</span>
            {product.discount > 0 && (
              <>
                <span className="text-xl text-gray-400 line-through">{formatPrice(product.price)}</span>
                <span className="text-lg font-bold text-red-500">-{product.discount}%</span>
              </>
            )}
          </div>

          {product.description && (
            <p className="text-gray-600 mb-6 leading-relaxed">{product.description}</p>
          )}

          {product.colors.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-dark mb-3">Màu sắc</h3>
              <div className="flex flex-wrap gap-3">
                {product.colors.map(color => (
                  <button key={color} onClick={() => !outOfStock && setSelectedColor(color)}
                    disabled={outOfStock}
                    className={`px-4 py-2 border-2 rounded-lg transition-all ${
                      selectedColor === color ? 'border-primary text-primary font-semibold' : 'border-gray-300 hover:border-primary'
                    } ${outOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.sizes.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-dark mb-3">Kích thước</h3>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map(size => (
                  <button key={size} onClick={() => !outOfStock && setSelectedSize(size)}
                    disabled={outOfStock}
                    className={`px-4 py-2 border-2 rounded-lg transition-all ${
                      selectedSize === size ? 'border-primary text-primary font-semibold bg-light' : 'border-gray-300 hover:border-primary'
                    } ${outOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock status */}
          <div className="mb-6">
            {outOfStock ? (
              <p className="text-red-600 font-semibold flex items-center gap-2">
                ✗ Hết hàng
                <span className="text-xs text-gray-400 font-normal">— Sản phẩm sẽ mở lại khi có hàng mới</span>
              </p>
            ) : (
              <p className="text-green-600 font-semibold">✓ Có sẵn ({product.stock} sản phẩm)</p>
            )}
          </div>

          {/* Quantity — ẩn khi hết hàng */}
          {!outOfStock && (
            <div className="flex items-center space-x-4 mb-8">
              <span className="font-semibold text-dark">Số lượng:</span>
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2 text-dark hover:bg-light transition-all">−</button>
                <span className="px-6 py-2 font-semibold">{quantity}</span>
                <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  className="px-4 py-2 text-dark hover:bg-light transition-all">+</button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={handleAddToCart}
              disabled={outOfStock}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                outOfStock
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-secondary shadow-md-blue'
              }`}
            >
              {outOfStock ? 'Hết hàng' : 'Thêm vào giỏ'}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={outOfStock}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all border-2 ${
                outOfStock
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-primary text-primary hover:bg-light'
              }`}
            >
              {outOfStock ? 'Không có sẵn' : 'Mua ngay'}
            </button>
          </div>

          {product.features.length > 0 && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-semibold text-dark mb-3">Đặc điểm</h3>
              <ul className="space-y-2">
                {product.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-gray-600">
                    <span className="w-2 h-2 bg-primary rounded-full mr-3 flex-shrink-0"></span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Reviews ──────────────────────────────────────────────────── */}
          <div className="mt-12 border-t border-gray-200 pt-10">
            <h2 className="text-2xl font-bold text-dark mb-6">
              Đánh giá sản phẩm
              {reviews.length > 0 && (
                <span className="ml-3 text-lg font-normal text-gray-500">({reviews.length} đánh giá)</span>
              )}
            </h2>

            {myReview && (
              <div className="mb-6 p-4 border-2 border-primary rounded-xl bg-blue-50">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold text-primary">⭐ Đánh giá của bạn</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditForm({ rating: myReview.rating, comment: myReview.comment }); setEditMode(true); }}
                      className="text-sm text-blue-600 hover:underline">✏️ Sửa</button>
                    <button onClick={handleDeleteMyReview} className="text-sm text-red-500 hover:underline">🗑️ Xóa</button>
                  </div>
                </div>
                <div className="flex mb-2">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={`text-lg ${i < myReview.rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                  ))}
                </div>
                <p className="text-gray-700">{myReview.comment}</p>
                {myReview.images?.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {myReview.images.map((img, i) => (
                      <img key={i} src={img} alt="" className="w-20 h-20 object-cover rounded-lg border cursor-pointer hover:opacity-80"
                        onClick={() => setPreviewImg(img)} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {reviews.length > 0 && (
              <div className="bg-gray-50 rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="text-center flex-shrink-0">
                    <p className="text-5xl font-black text-dark">{avgRating}</p>
                    <div className="flex justify-center my-1">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={`text-xl ${i < Math.round(avgRating) ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400">{reviews.length} đánh giá</p>
                  </div>
                  <div className="flex-1 min-w-48 space-y-1.5">
                    {[5, 4, 3, 2, 1].map(star => {
                      const count  = starCounts[star] || 0;
                      const pct    = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
                      const active = starFilter === star;
                      return (
                        <button key={star} onClick={() => setStarFilter(active ? 0 : star)}
                          className={`w-full flex items-center gap-2 group rounded-lg px-2 py-1 transition-all ${active ? 'bg-yellow-50 ring-1 ring-yellow-300' : 'hover:bg-gray-100'}`}>
                          <span className={`text-xs font-bold w-5 flex-shrink-0 ${active ? 'text-yellow-500' : 'text-gray-500'}`}>{star}★</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div className={`h-2 rounded-full transition-all duration-300 ${active ? 'bg-yellow-400' : 'bg-yellow-300 group-hover:bg-yellow-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-xs w-6 text-right flex-shrink-0 ${active ? 'text-yellow-600 font-bold' : 'text-gray-400'}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {starFilter > 0 && (
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-500">Đang lọc:</span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold border border-yellow-200">
                      {'★'.repeat(starFilter)} {starFilter} sao
                      <button onClick={() => setStarFilter(0)} className="ml-1 text-yellow-500 hover:text-yellow-700 font-bold leading-none">×</button>
                    </span>
                    <span className="text-sm text-gray-400">({filteredReviews.length} kết quả)</span>
                  </div>
                )}
              </div>
            )}

            {reviewsLoading ? <Loading /> : filteredReviews.length === 0 ? (
              <div className="text-center py-12 bg-light rounded-xl">
                <div className="text-5xl mb-3">{starFilter > 0 ? '🔍' : '💬'}</div>
                <p className="text-gray-500">
                  {starFilter > 0 ? `Không có đánh giá ${starFilter} sao nào.` : 'Chưa có đánh giá nào. Hãy là người đầu tiên!'}
                </p>
                {starFilter > 0 && (
                  <button onClick={() => setStarFilter(0)} className="mt-3 text-sm text-blue-500 hover:underline">Xem tất cả đánh giá</button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {filteredReviews.map((review, index) => (
                  <div key={review._id || index} className="bg-light rounded-xl p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                          {review.userId?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-dark">{review.userId?.name || 'Người dùng'}</p>
                          <p className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString('vi-VN')}</p>
                        </div>
                      </div>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={`text-lg ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-700 leading-relaxed mb-4">{review.comment}</p>
                    {review.images?.length > 0 && (
                      <div className="flex gap-3 flex-wrap">
                        {review.images.map((img, i) => (
                          <img key={i} src={img} alt="" className="w-24 h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-all border border-gray-200"
                            onClick={() => setPreviewImg(img)} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImg && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreviewImg(null)}>
          <div className="relative max-w-3xl w-full">
            <img src={previewImg} alt="Preview" className="w-full rounded-xl object-contain max-h-[85vh]" />
            <button onClick={() => setPreviewImg(null)}
              className="absolute top-3 right-3 bg-white text-black rounded-full w-9 h-9 flex items-center justify-center font-bold text-lg hover:bg-gray-200">✕</button>
          </div>
        </div>
      )}

      {/* Edit Review Modal */}
      {editMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4">Sửa đánh giá</h2>
            <div className="flex gap-2 mb-4">
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => setEditForm(p => ({ ...p, rating: star }))}
                  className={`text-3xl transition-transform hover:scale-110 ${star <= editForm.rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</button>
              ))}
            </div>
            <textarea rows={4} value={editForm.comment}
              onChange={e => setEditForm(p => ({ ...p, comment: e.target.value }))}
              placeholder="Nội dung đánh giá..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none resize-none mb-4 focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <div className="flex gap-3">
              <button onClick={() => setEditMode(false)}
                className="flex-1 py-2.5 border-2 border-gray-300 rounded-lg font-semibold text-gray-600 hover:bg-gray-50">Hủy</button>
              <button onClick={handleUpdateReview}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition-all">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}