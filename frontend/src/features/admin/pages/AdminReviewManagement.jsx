import React, { useEffect, useState } from 'react';
import { useAdmin } from '@features/admin/hooks/useAdmin';

const fmtDate = d => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} className={`w-3.5 h-3.5 ${i <= rating ? 'text-amber-400' : 'text-slate-200'}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
      <span className="ml-1 text-xs font-bold text-slate-600">{rating}.0</span>
    </div>
  );
}

function VisibilityBadge({ visible }) {
  return visible
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>Hiển thị
      </span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"/>Đã ẩn
      </span>;
}

const RATING_COLORS = { 5:'text-emerald-600', 4:'text-blue-600', 3:'text-amber-500', 2:'text-orange-500', 1:'text-rose-500' };

const AdminReviewManagement = () => {
  const { fetchReviews, deleteReview, toggleReviewVisibility } = useAdmin();

  const [reviews,      setReviews]      = useState([]);
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);
  const [previewImg,   setPreviewImg]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { productId, reviewId, comment }
  const [filter,       setFilter]       = useState('all'); // all | visible | hidden
  const [ratingFilter, setRatingFilter] = useState(0);
  const [detailReview, setDetailReview] = useState(null);

  useEffect(() => { loadReviews(); }, [page, filter, ratingFilter]);

  const loadReviews = async () => {
    const params = { page, limit: 10 };
    if (filter === 'visible') params.isVisible = true;
    if (filter === 'hidden')  params.isVisible = false;
    if (ratingFilter > 0)     params.rating = ratingFilter;
    const data = await fetchReviews(params);
    if (data) {
      setReviews(data.reviews || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalReviews(data.pagination?.total || 0);
    }
  };

  const handleToggle = async (productId, reviewId) => {
    try { await toggleReviewVisibility(productId, reviewId); loadReviews(); }
    catch { /* handled */ }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteReview(deleteTarget.productId, deleteTarget.reviewId); loadReviews(); }
    catch { /* handled */ }
    finally { setDeleteTarget(null); }
  };

  // Stats
  const visibleCount = reviews.filter(r => r.isVisible).length;
  const hiddenCount  = reviews.filter(r => !r.isVisible).length;
  const avgRating    = reviews.length
    ? (reviews.reduce((s,r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  return (
    <div className="admin-page min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white/92 backdrop-blur-xl border-b border-slate-200/70 px-6 py-4 sticky top-0 z-20 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Quản lý Đánh giá</h1>
            <p className="text-sm text-slate-400 mt-0.5">{totalReviews} đánh giá</p>
          </div>
          {/* Visibility filter */}
          <div className="flex items-center gap-1.5">
            {[['all','Tất cả'],['visible','Hiển thị'],['hidden','Đã ẩn']].map(([v,l]) => (
              <button key={v} onClick={() => { setFilter(v); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  filter === v
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                }`}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label:'Tổng đánh giá', value: totalReviews, icon:'💬', color:'#3B82F6' },
            { label:'Đang hiển thị', value: visibleCount, icon:'👁️',  color:'#10B981' },
            { label:'Đã ẩn',         value: hiddenCount,  icon:'🙈', color:'#6B7280' },
            { label:'Điểm TB trang', value: avgRating,    icon:'⭐', color:'#F59E0B' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3"
              style={{ borderTop: `3px solid ${k.color}` }}>
              <span className="text-2xl">{k.icon}</span>
              <div>
                <p className="text-xs text-slate-400 font-medium">{k.label}</p>
                <p className="text-xl font-black text-slate-900">{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Rating filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lọc sao:</span>
          {[0,5,4,3,2,1].map(r => (
            <button key={r} onClick={() => { setRatingFilter(r); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                ratingFilter === r
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300'
              }`}>
              {r === 0 ? 'Tất cả' : `${'★'.repeat(r)} ${r} sao`}
            </button>
          ))}
        </div>

        {/* Review cards */}
        {reviews.length === 0 ? (
          <div className="bg-white rounded-[28px] border border-slate-200/70 shadow-[0_12px_40px_rgba(15,23,42,0.04)] py-16 flex flex-col items-center gap-3 text-slate-400">
            <span className="text-5xl">💬</span>
            <span className="text-sm font-medium">Không tìm thấy đánh giá nào</span>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map(review => (
              <div key={`${review.productId}-${review._id}`}
                className={`bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md group ${
                  review.isVisible ? 'border-slate-100' : 'border-slate-200 opacity-60'
                }`}>
                <div className="p-5">
                  <div className="flex items-start gap-4">

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                      {(review.userId?.name || '?')[0].toUpperCase()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-800 text-sm">{review.userId?.name || 'Ẩn danh'}</p>
                            <VisibilityBadge visible={review.isVisible}/>
                            <span className={`text-xs font-bold ${RATING_COLORS[review.rating]}`}>
                              {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-slate-400">{fmtDate(review.createdAt)}</span>
                            <span className="text-slate-200">•</span>
                            <span className="text-xs font-semibold text-blue-600 truncate max-w-[200px]">
                              {review.productName}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setDetailReview(review)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 text-xs font-semibold rounded-lg transition-colors">
                            Xem
                          </button>
                          <button onClick={() => handleToggle(review.productId, review._id)}
                            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                              review.isVisible
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-700'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                            }`}>
                            {review.isVisible ? '🙈 Ẩn' : '👁 Hiện'}
                          </button>
                          <button onClick={() => setDeleteTarget({ productId: review.productId, reviewId: review._id, comment: review.comment })}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-lg transition-colors">
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Comment */}
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed line-clamp-2">{review.comment}</p>

                      {/* Images */}
                      {review.images?.length > 0 && (
                        <div className="mt-3 flex gap-2 flex-wrap">
                          {review.images.map((img, i) => (
                            <button key={i} onClick={() => setPreviewImg(img)}
                              className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 hover:border-blue-400 transition-colors hover:scale-105 transform">
                              <img src={img} alt="" className="w-full h-full object-cover"/>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1">
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
              className="px-3 py-1.5 text-xs border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 font-medium">← Trước</button>
            {Array.from({length: Math.min(5,totalPages)}, (_,i) => {
              const s = Math.max(1, Math.min(page-2, totalPages-4)); return s+i;
            }).filter(p => p>=1&&p<=totalPages).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium border ${page===p?'bg-blue-600 text-white border-blue-600':'bg-white border-slate-200 hover:bg-slate-50'}`}>{p}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
              className="px-3 py-1.5 text-xs border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 font-medium">Sau →</button>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {detailReview && (
        <div className="fixed inset-0 z-50 flex">
          <div className="admin-overlay flex-1" onClick={() => setDetailReview(null)}/>
          <div className="admin-drawer-shell w-full max-w-md flex flex-col h-full" style={{animation:'slideIn .25s cubic-bezier(.4,0,.2,1)'}}>
            <div className="admin-panel-header sticky top-0 flex items-center justify-between px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">Chi tiết đánh giá</h2>
              <button onClick={() => setDetailReview(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* User + product */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 font-bold text-lg flex items-center justify-center">
                  {(detailReview.userId?.name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{detailReview.userId?.name || 'Ẩn danh'}</p>
                  <p className="text-xs text-slate-400">{detailReview.userId?.email}</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs text-blue-500 font-semibold mb-0.5">Sản phẩm</p>
                <p className="text-sm font-bold text-blue-800">{detailReview.productName}</p>
              </div>

              <div className="flex items-center justify-between">
                <StarRating rating={detailReview.rating}/>
                <div className="flex items-center gap-2">
                  <VisibilityBadge visible={detailReview.isVisible}/>
                  <span className="text-xs text-slate-400">{fmtDate(detailReview.createdAt)}</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nhận xét</p>
                <p className="text-sm text-slate-700 leading-relaxed">{detailReview.comment}</p>
              </div>

              {detailReview.images?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Hình ảnh</p>
                  <div className="grid grid-cols-3 gap-2">
                    {detailReview.images.map((img, i) => (
                      <button key={i} onClick={() => setPreviewImg(img)}
                        className="aspect-square rounded-xl overflow-hidden border border-slate-200 hover:border-blue-400 transition-colors">
                        <img src={img} alt="" className="w-full h-full object-cover"/>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button onClick={() => { handleToggle(detailReview.productId, detailReview._id); setDetailReview(null); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    detailReview.isVisible
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}>
                  {detailReview.isVisible ? '🙈 Ẩn đánh giá' : '👁 Hiện đánh giá'}
                </button>
                <button
                  onClick={() => {
                    setDeleteTarget({ productId: detailReview.productId, reviewId: detailReview._id, comment: detailReview.comment });
                    setDetailReview(null);
                  }}
                  className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-sm font-semibold border border-rose-200 transition-colors">
                  🗑️ Xóa đánh giá
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="admin-overlay absolute inset-0" onClick={() => setDeleteTarget(null)}/>
          <div className="admin-modal-shell relative p-6 w-full max-w-sm">
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">🗑️</div>
              <h3 className="text-lg font-bold text-slate-900">Xóa đánh giá?</h3>
              {deleteTarget.comment && (
                <p className="text-xs text-slate-400 mt-2 line-clamp-2 italic">"{deleteTarget.comment}"</p>
              )}
              <p className="text-sm text-slate-500 mt-2">Hành động này không thể hoàn tác.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50">Hủy</button>
              <button onClick={confirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold">Xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* Image preview */}
      {previewImg && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90"
          onClick={() => setPreviewImg(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
          <img src={previewImg} alt="Preview" className="admin-preview-stage w-full object-contain max-h-[80vh]"/>
            <button onClick={() => setPreviewImg(null)}
              className="absolute -top-4 -right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-lg font-bold text-lg">
              ✕
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
};

export default AdminReviewManagement;
