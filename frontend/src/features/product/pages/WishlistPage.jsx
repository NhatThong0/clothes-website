import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { recommendationAPI } from '@features/shared/services/api';
import { useWishlist } from '@context/WishlistContext';
import ProductCard from '@features/product/components/ProductCard';

export default function WishlistPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isInWishlist } = useWishlist();

  useEffect(() => {
    recommendationAPI.getWishlist()
      .then(res => setItems(res.data?.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  // Đồng bộ danh sách hiển thị với context (khi user bấm xóa qua ProductCard)
  const visibleItems = items.filter(p => isInWishlist(String(p._id)));

  const toCardFormat = (p) => ({
    id: p._id,
    name: p.name,
    price: p.price,
    discount: p.discount || 0,
    discountedPrice: p.discount > 0 ? Math.round(p.price * (1 - p.discount / 100)) : null,
    image: p.images?.[0],
    rating: p.averageRating || 0,
    reviews: p.reviews?.length || 0,
    stock: p.stock,
    soldCount: p.soldCount || 0,
    category: typeof p.category === 'object' ? p.category?.name : p.category,
  });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-400">Cá nhân</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-black">
          Sản phẩm yêu thích
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {visibleItems.length > 0 ? `${visibleItems.length} sản phẩm đã lưu` : 'Chưa có sản phẩm nào'}
        </p>
      </div>

      {/* Empty state */}
      {visibleItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[28px] border border-black/8 bg-[#f7f7f4] py-28 gap-4">
          <span className="text-6xl text-slate-300">♡</span>
          <p className="text-lg font-semibold text-slate-500">Chưa có sản phẩm yêu thích</p>
          <p className="text-sm text-slate-400">Nhấn ♡ trên sản phẩm để lưu vào đây</p>
          <Link
            to="/products"
            className="mt-4 rounded-full bg-black px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#242424]"
          >
            Khám phá sản phẩm
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:gap-6">
          {visibleItems.map(p => (
            <ProductCard
              key={p._id}
              product={toCardFormat(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
