import React, { useEffect, useState } from 'react';
import { useAdmin } from '@features/admin/hooks/useAdmin';

const fmtDate = d => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} className={`w-3.5 h-3.5 ${i <= rating ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
      <span className="ml-1 text-xs font-bold text-slate-600">{rating}.0</span>
    </div>
  );
}

const STATUS_MAP = {
  approved:   { label: 'Đã duyệt',    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  rejected:   { label: 'Từ chối',     bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500' },
  pending:    { label: 'Chờ duyệt',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  processing: { label: 'Đang xử lý',  bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500 animate-pulse' },
};

const SOURCE_MAP = {
  ai:     { icon: '🤖', label: 'AI', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  hybrid: { icon: '🔀', label: 'Hybrid', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  rule:   { icon: '📏', label: 'Rule', color: 'text-slate-600 bg-slate-100 border-slate-200' },
  skip:   { icon: '⚡', label: 'Skip', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  manual: { icon: '👤', label: 'Thủ công', color: 'text-blue-600 bg-blue-50 border-blue-200' },
};

function ModerationBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.processing;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>
      {s.label}
    </span>
  );
}

function SourceChip({ source }) {
  const s = SOURCE_MAP[source] || SOURCE_MAP.rule;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.color}`}>
      {s.icon} {s.label}
    </span>
  );
}

function ScoreBar({ score }) {
  if (score == null) return null;
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }}/>
      </div>
      <span className={`text-[11px] font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{pct}%</span>
    </div>
  );
}

const RATING_COLORS = { 5:'text-emerald-600', 4:'text-blue-600', 3:'text-amber-500', 2:'text-orange-500', 1:'text-rose-500' };

const AdminReviewManagement = () => {
  const { fetchReviews, deleteReview, toggleReviewVisibility, moderateReview } = useAdmin();

  const [reviews,      setReviews]      = useState([]);
  const [stats,        setStats]        = useState({ total:0, approved:0, pending:0, rejected:0, processing:0 });
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [previewImg,   setPreviewImg]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filter,       setFilter]       = useState('all');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [detailReview, setDetailReview] = useState(null);

  useEffect(() => { loadReviews(); }, [page, filter, ratingFilter]);

  const loadReviews = async () => {
    const params = { page, limit: 10 };
    if (filter === 'visible')    params.isVisible = true;
    if (filter === 'hidden')     params.isVisible = false;
    if (filter === 'pending')    params.needsReview = true;
    if (filter === 'processing') params.moderationStatus = 'processing';
    if (filter === 'approved')   params.moderationStatus = 'approved';
    if (filter === 'rejected')   params.moderationStatus = 'rejected';
    if (ratingFilter > 0)        params.rating = ratingFilter;
    const data = await fetchReviews(params);
    if (data) {
      setReviews(data.reviews || []);
      setStats(data.stats || { total:0, approved:0, pending:0, rejected:0, processing:0 });
      setTotalPages(data.pagination?.pages || 1);
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

  const handleManualModeration = async (review, decision) => {
    try { await moderateReview(review.productId, review._id, { decision }); loadReviews(); }
    catch { /* handled */ }
  };

  const FILTERS = [
    { v: 'all',        l: 'Tất cả',      count: stats.total },
    { v: 'processing', l: '🔄 Xử lý',    count: stats.processing },
    { v: 'pending',    l: '⏳ Chờ duyệt', count: stats.pending },
    { v: 'approved',   l: '✅ Duyệt',     count: stats.approved },
    { v: 'rejected',   l: '❌ Từ chối',   count: stats.rejected },
    { v: 'hidden',     l: '🙈 Ẩn',        count: null },
  ];

  const needsManual = r => r.moderationStatus === 'pending';

  return (
    <div className="admin-page min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white/92 backdrop-blur-xl border-b border-slate-200/70 px-6 py-4 sticky top-0 z-20 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Kiểm duyệt Đánh giá <span className="text-sm font-normal text-slate-400 ml-1">AI tự động</span></h1>
            <p className="text-sm text-slate-400 mt-0.5">{stats.total} đánh giá tổng cộng</p>
          </div>
          {/* Filter tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {FILTERS.map(({ v, l, count }) => (
              <button key={v} onClick={() => { setFilter(v); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  filter === v
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                }`}>
                {l}{count != null && count > 0 ? <span className={`ml-1 ${filter===v?'opacity-70':'text-slate-400'}`}>({count})</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label:'Tổng',       value: stats.total,      icon:'💬', color:'#3B82F6' },
            { label:'AI xử lý',   value: stats.processing, icon:'🔄', color:'#8B5CF6' },
            { label:'Chờ duyệt',  value: stats.pending,    icon:'⏳', color:'#F59E0B' },
            { label:'Đã duyệt',   value: stats.approved,   icon:'✅', color:'#10B981' },
            { label:'Từ chối',    value: stats.rejected,   icon:'❌', color:'#EF4444' },
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
          <div className="bg-white rounded-[28px] border border-slate-200/70 shadow-sm py-16 flex flex-col items-center gap-3 text-slate-400">
            <span className="text-5xl">💬</span>
            <span className="text-sm font-medium">Không tìm thấy đánh giá nào</span>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map(review => (
              <div key={`${review.productId}-${review._id}`}
                className={`bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md group ${
                  review.moderationStatus === 'processing' ? 'border-blue-100 bg-blue-50/20'
                  : review.moderationStatus === 'pending'  ? 'border-amber-100'
                  : review.moderationStatus === 'rejected' ? 'border-rose-100 opacity-75'
                  : 'border-slate-100'
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
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-800 text-sm">{review.userId?.name || 'Ẩn danh'}</p>
                            <ModerationBadge status={review.moderationStatus}/>
                            <SourceChip source={review.moderationSource}/>
                            <span className={`text-xs font-bold ${RATING_COLORS[review.rating]}`}>
                              {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-slate-400">{fmtDate(review.createdAt)}</span>
                            <span className="text-slate-200">•</span>
                            <span className="text-xs font-semibold text-blue-600 truncate max-w-[200px]">{review.productName}</span>
                          </div>
                          {/* AI Score */}
                          {review.moderationScore != null && (
                            <div className="flex items-center gap-2 max-w-[180px]">
                              <span className="text-[10px] text-slate-400 whitespace-nowrap">An toàn</span>
                              <ScoreBar score={review.moderationScore}/>
                            </div>
                          )}
                          {/* Flags */}
                          {review.moderationFlags && (
                            <div className="flex flex-wrap gap-1">
                              {review.moderationFlags.toxic      && <span className="px-1.5 py-0.5 bg-rose-50   text-rose-600   rounded text-[10px] font-semibold border border-rose-200">🤬 Độc hại</span>}
                              {review.moderationFlags.advertising && <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-[10px] font-semibold border border-orange-200">📢 Quảng cáo</span>}
                              {review.moderationFlags.spam        && <span className="px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded text-[10px] font-semibold border border-yellow-200">🔁 Spam</span>}
                              {review.moderationFlags.shortTrusted && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-semibold border border-emerald-200">⚡ Tin cậy</span>}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setDetailReview(review)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 text-xs font-semibold rounded-lg transition-colors">
                            Chi tiết
                          </button>
                          {needsManual(review) && (
                            <>
                              <button onClick={() => handleManualModeration(review, 'approve')}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition-colors">
                                Duyệt
                              </button>
                              <button onClick={() => handleManualModeration(review, 'reject')}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition-colors">
                                Từ chối
                              </button>
                            </>
                          )}
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

                      <p className="mt-2.5 text-sm text-slate-600 leading-relaxed line-clamp-2">{review.comment}</p>

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

                      {/* Moderation summary */}
                      {review.moderationSummary && review.moderationStatus !== 'processing' && (
                        <p className="mt-2 text-[11px] text-slate-400 italic">
                          AI: {review.moderationSummary}
                        </p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="admin-overlay absolute inset-0" onClick={() => setDetailReview(null)}/>
          <div className="admin-modal-shell relative w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="admin-panel-header sticky top-0 flex items-center justify-between px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">Chi tiết đánh giá</h2>
              <button onClick={() => setDetailReview(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* User */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 font-bold text-lg flex items-center justify-center">
                  {(detailReview.userId?.name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{detailReview.userId?.name || 'Ẩn danh'}</p>
                  <p className="text-xs text-slate-400">{detailReview.userId?.email}</p>
                </div>
              </div>

              {/* Product */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs text-blue-500 font-semibold mb-0.5">Sản phẩm</p>
                <p className="text-sm font-bold text-blue-800">{detailReview.productName}</p>
              </div>

              {/* Rating + status */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <StarRating rating={detailReview.rating}/>
                <div className="flex items-center gap-2 flex-wrap">
                  <ModerationBadge status={detailReview.moderationStatus}/>
                  <SourceChip source={detailReview.moderationSource}/>
                  <span className="text-xs text-slate-400">{fmtDate(detailReview.createdAt)}</span>
                </div>
              </div>

              {/* Comment */}
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nhận xét</p>
                <p className="text-sm text-slate-700 leading-relaxed">{detailReview.comment}</p>
              </div>

              {/* Images */}
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

              {/* AI Moderation result */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
                  <span className="text-base">🤖</span>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Kết quả kiểm duyệt AI</p>
                </div>
                <div className="p-4 space-y-3">
                  {/* Score */}
                  {detailReview.moderationScore != null ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-500">Điểm an toàn</span>
                        <span className="text-xs font-bold text-slate-700">{Math.round(detailReview.moderationScore * 100)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${detailReview.moderationScore >= 0.8 ? 'bg-emerald-500' : detailReview.moderationScore >= 0.5 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${detailReview.moderationScore * 100}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Chưa có điểm số — đang xử lý hoặc bỏ qua</p>
                  )}

                  {/* Flags */}
                  {detailReview.moderationFlags && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1.5">Phát hiện</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key:'toxic',       icon:'🤬', label:'Ngôn từ độc hại' },
                          { key:'advertising', icon:'📢', label:'Quảng cáo / link ngoài' },
                          { key:'spam',        icon:'🔁', label:'Spam / lặp nội dung' },
                          { key:'suspicious',  icon:'⚠️', label:'Đáng ngờ' },
                          { key:'shortTrusted',icon:'⚡', label:'Review ngắn tin cậy' },
                        ].map(({ key, icon, label }) => (
                          <span key={key} className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${
                            detailReview.moderationFlags[key]
                              ? key === 'shortTrusted'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-50 text-slate-300 border-slate-100'
                          }`}>
                            {icon} {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reasons */}
                  {detailReview.moderationReasons?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1.5">Lý do</p>
                      <ul className="space-y-1">
                        {detailReview.moderationReasons.map((r, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                            <span className="text-slate-400 mt-0.5">•</span>{r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Summary */}
                  {detailReview.moderationSummary && (
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-500 italic">{detailReview.moderationSummary}</p>
                    </div>
                  )}

                  {/* Processed at */}
                  {detailReview.moderationProcessedAt && (
                    <p className="text-[11px] text-slate-300">Xử lý lúc: {fmtDate(detailReview.moderationProcessedAt)}</p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                {needsManual(detailReview) && (
                  <>
                    <button onClick={() => { handleManualModeration(detailReview, 'approve'); setDetailReview(null); }}
                      className="flex-1 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-sm font-semibold border border-emerald-200 transition-colors">
                      ✅ Duyệt
                    </button>
                    <button onClick={() => { handleManualModeration(detailReview, 'reject'); setDetailReview(null); }}
                      className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-sm font-semibold border border-rose-200 transition-colors">
                      ❌ Từ chối
                    </button>
                  </>
                )}
                <button onClick={() => { handleToggle(detailReview.productId, detailReview._id); setDetailReview(null); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    detailReview.isVisible
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}>
                  {detailReview.isVisible ? '🙈 Ẩn' : '👁 Hiện'}
                </button>
                <button onClick={() => { setDeleteTarget({ productId: detailReview.productId, reviewId: detailReview._id, comment: detailReview.comment }); setDetailReview(null); }}
                  className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-sm font-semibold border border-rose-200 transition-colors">
                  🗑️ Xóa
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
              {deleteTarget.comment && <p className="text-xs text-slate-400 mt-2 line-clamp-2 italic">"{deleteTarget.comment}"</p>}
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90" onClick={() => setPreviewImg(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <img src={previewImg} alt="Preview" className="admin-preview-stage w-full object-contain max-h-[80vh]"/>
            <button onClick={() => setPreviewImg(null)}
              className="absolute -top-4 -right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-lg font-bold text-lg">✕</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminReviewManagement;
