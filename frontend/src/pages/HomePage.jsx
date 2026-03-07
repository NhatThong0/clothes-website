import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '@components/ProductCard';
import Loading from '@components/Loading';
import Empty from '@components/Empty';
import BannerCarousel from '@components/BannerCarousel';
import { productAPI } from '@services/api';
import apiClient from '@services/apiClient';

// ── Helpers ───────────────────────────────────────────────────────────────────
const normalizeProduct = (p) => ({
  id:              p._id || p.id,
  _id:             p._id || p.id,
  name:            p.name,
  price:           p.price,
  discountedPrice: p.discount > 0 ? Math.round(p.price * (1 - p.discount / 100)) : p.price,
  discount:        p.discount || 0,
  category:        p.category?.name || p.category || '',
  image:           p.images?.[0] || 'https://placehold.co/400x500?text=No+Image',
  rating:          p.averageRating || p.rating || 0,
  reviews:         p.reviewCount || (Array.isArray(p.reviews) ? p.reviews.length : p.reviews) || 0,
  stock:           p.stock || 0,
  soldCount:       p.soldCount || 0, // ✅ thêm soldCount
});

const CAT_META = {
  'Nam':      { icon: '👔', gradient: 'from-blue-500 to-blue-700' },
  'Nữ':       { icon: '👗', gradient: 'from-rose-400 to-pink-600' },
  'Phụ kiện': { icon: '👜', gradient: 'from-violet-500 to-purple-700' },
  'Unisex':   { icon: '🧥', gradient: 'from-teal-400 to-cyan-600' },
};
const DEFAULT_META = { icon: '🛍️', gradient: 'from-slate-400 to-slate-600' };

const PERKS = [
  { icon: '🚚', title: 'Miễn phí vận chuyển', desc: 'Cho đơn hàng từ 500K' },
  { icon: '↩️', title: 'Đổi trả 30 ngày',     desc: 'Không cần lý do'      },
  { icon: '💯', title: 'Chính hãng 100%',      desc: 'Kiểm định chất lượng' },
  { icon: '🔒', title: 'Thanh toán an toàn',   desc: 'Mã hóa SSL 256-bit'   },
];

const FALLBACK_CATS = [
  { _id: 'nam', name: 'Nam',       image: null },
  { _id: 'nu',  name: 'Nữ',       image: null },
  { _id: 'pk',  name: 'Phụ kiện', image: null },
  { _id: 'uni', name: 'Unisex',   image: null },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories,       setCategories]       = useState([]);
  const [banners,          setBanners]          = useState([]);
  const [loading,          setLoading]          = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, categoriesRes, bannersRes] = await Promise.allSettled([
        productAPI.getFeatured(),
        productAPI.getCategories(),
        apiClient.get('/banners'),
      ]);

      // ── Products ─────────────────────────────────────────────────────────
      if (productsRes.status === 'fulfilled') {
        const data = productsRes.value.data?.data || productsRes.value.data || [];
        const list = Array.isArray(data) ? data : (data.products || []);
        setFeaturedProducts(list.slice(0, 6).map(normalizeProduct));
      } else {
        // Fallback: lấy sản phẩm mới nhất nếu endpoint featured lỗi
        try {
          const res  = await productAPI.getAllProducts({ limit: 6 });
          const data = res.data?.data || res.data || [];
          const list = Array.isArray(data) ? data : (data.products || []);
          setFeaturedProducts(list.slice(0, 6).map(normalizeProduct));
        } catch {
          setFeaturedProducts([]);
        }
      }

      // ── Categories ───────────────────────────────────────────────────────
      if (categoriesRes.status === 'fulfilled') {
        const d       = categoriesRes.value.data?.data || categoriesRes.value.data || [];
        const catList = Array.isArray(d) ? d : [];
        // Chỉ lấy category có isFeatured = true, fallback tất cả nếu chưa set
        const featured = catList.filter(c => c.isFeatured);
        setCategories(featured.length > 0 ? featured : catList);
      }

      // ── Banners ──────────────────────────────────────────────────────────
      if (bannersRes.status === 'fulfilled') {
        const d = bannersRes.value.data?.data || [];
        setBanners(Array.isArray(d) ? d.filter(b => b.isActive !== false) : []);
      }
    } catch (err) {
      console.error('HomePage fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const displayCats = categories.length > 0 ? categories : FALLBACK_CATS;

  return (
    <div className="bg-white min-h-screen">

      {/* ── Banner Carousel ───────────────────────────────────────────────── */}
      {banners.length > 0 ? (
        <div className="w-full px-4 md:px-6 pt-4 max-w-7xl mx-auto">
          <BannerCarousel banners={banners} interval={4500} />
        </div>
      ) : (
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-blue-900 text-white">
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle at 25% 50%,#3B82F6 0%,transparent 50%),radial-gradient(circle at 75% 20%,#60A5FA 0%,transparent 40%)' }}/>
          <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-28 flex flex-col md:flex-row items-center gap-12">
            <div className="md:w-1/2 text-center md:text-left">
              <p className="text-blue-300 text-sm font-bold uppercase tracking-[0.25em] mb-4">
                Bộ sưu tập mới · 2025
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight mb-6">
                Phong cách<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300">
                  định nghĩa bạn
                </span>
              </h1>
              <p className="text-slate-300 text-lg mb-8 max-w-md leading-relaxed">
                Khám phá bộ sưu tập thời trang cao cấp. Chất liệu tốt, thiết kế tinh tế, giao hàng nhanh toàn quốc.
              </p>
              <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start">
                <Link to="/products"
                  className="px-7 py-3.5 bg-blue-500 hover:bg-blue-400 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-blue-500/30 hover:-translate-y-0.5">
                  Mua sắm ngay
                </Link>
                <Link to="/products"
                  className="px-7 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-semibold text-sm border border-white/20 transition-all backdrop-blur-sm">
                  Xem lookbook →
                </Link>
              </div>
            </div>
            <div className="md:w-1/2 flex justify-center">
              <div className="relative">
                <div className="w-72 h-80 md:w-80 md:h-96 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                  <img src="https://placehold.co/400x500/1e3a5f/60a5fa?text=New+Collection"
                    alt="Hero" className="w-full h-full object-cover"/>
                </div>
                <div className="absolute -bottom-4 -left-6 bg-white rounded-2xl px-4 py-3 shadow-xl">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Ưu đãi hôm nay</p>
                  <p className="text-blue-600 font-black text-lg leading-none mt-0.5">Giảm đến 40%</p>
                </div>
                <div className="absolute -top-4 -right-4 bg-blue-500 text-white rounded-2xl px-3 py-2 shadow-xl text-center">
                  <p className="font-black text-xl leading-none">NEW</p>
                  <p className="text-[10px] font-semibold opacity-80 mt-0.5">2025</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Perks strip ──────────────────────────────────────────────────── */}
      <section className="border-y border-slate-100 mt-4">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100">
            {PERKS.map(p => (
              <div key={p.title} className="flex items-center gap-3 py-5 px-4 md:px-6">
                <span className="text-2xl flex-shrink-0">{p.icon}</span>
                <div>
                  <p className="text-sm font-bold text-slate-800">{p.title}</p>
                  <p className="text-xs text-slate-400">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6">

        {/* ── Categories ───────────────────────────────────────────────── */}
        <section className="py-14">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Khám phá</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Danh mục nổi bật</h2>
            </div>
            <Link to="/products" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Tất cả →
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ gridAutoRows: 'minmax(130px,auto)' }}>
            {displayCats.map((cat, idx) => {
              const catId   = cat._id || cat;
              const catName = cat.name  || cat;
              const meta    = CAT_META[catName] || DEFAULT_META;
              const isWide  = idx === 0;
              return (
                <Link key={catId} to={`/products?category=${catId}`}
                  className={`relative overflow-hidden rounded-2xl group cursor-pointer block ${isWide ? 'md:col-span-2 md:row-span-2' : ''}`}
                  style={{ minHeight: isWide ? '280px' : '130px' }}>
                  {cat.image ? (
                    <img src={cat.image} alt={catName}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient}`}/>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"/>
                  <div className="absolute inset-0 flex flex-col justify-end p-5">
                    <p className="text-2xl mb-1">{meta.icon}</p>
                    <h3 className={`font-black text-white leading-tight ${isWide ? 'text-2xl' : 'text-base'}`}>
                      {catName}
                    </h3>
                    <p className="text-white/70 text-xs mt-1 font-medium group-hover:text-white transition-colors">
                      {cat.productCount ? `${cat.productCount} sản phẩm` : `Khám phá ${catName}`} →
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── Featured products ─────────────────────────────────────────── */}
        <section className="pb-14">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Được yêu thích</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Sản phẩm nổi bật</h2>
            </div>
            <Link to="/products" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Xem tất cả →
            </Link>
          </div>

          {loading ? (
            <Loading/>
          ) : featuredProducts.length === 0 ? (
            <Empty message="Không có sản phẩm"/>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {featuredProducts.map(product => (
                <ProductCard key={product.id} product={product}/>
              ))}
            </div>
          )}

          <div className="mt-10 text-center">
            <Link to="/products"
              className="inline-flex items-center gap-2 px-8 py-3.5 border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded-2xl font-bold text-sm transition-all">
              Xem toàn bộ sản phẩm →
            </Link>
          </div>
        </section>

        {/* ── Newsletter ────────────────────────────────────────────────── */}
        <section className="pb-16">
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-500 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6 text-white">
            <div className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ backgroundImage: 'radial-gradient(circle at 80% 50%,white 0%,transparent 60%)' }}/>
            <div className="relative text-center md:text-left">
              <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-2">Ưu đãi đặc biệt</p>
              <h3 className="text-2xl md:text-3xl font-black leading-tight">
                Đăng ký nhận<br/>voucher 10%
              </h3>
              <p className="text-blue-100 text-sm mt-2">Cho đơn hàng đầu tiên của bạn</p>
            </div>
            <div className="relative flex gap-2 w-full md:w-auto">
              <input type="email" placeholder="Email của bạn..."
                className="flex-1 md:w-64 px-4 py-3 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/50"/>
              <button className="px-5 py-3 bg-white text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors whitespace-nowrap shadow-sm">
                Nhận ngay
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}