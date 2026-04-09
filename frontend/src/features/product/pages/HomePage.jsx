import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '@features/product/components/ProductCard';
import Loading from '@components/common/Loading';
import Empty from '@components/common/Empty';
import BannerCarousel from '@components/layout/BannerCarousel';
import { productAPI } from '@features/shared/services/api';
import apiClient from '@features/shared/services/apiClient';
import { getSocket } from '@features/chat/hooks/useChat';

const normalizeProduct = (product) => {
  const flashSale = product.flashSale || null;
  const flashSaleActive = flashSale && !flashSale.isSoldOut;
  const discountedPrice = flashSaleActive
    ? flashSale.price
    : product.discount > 0
      ? Math.round(product.price * (1 - product.discount / 100))
      : product.price;

  return ({
    id: product._id || product.id,
    _id: product._id || product.id,
    name: product.name,
    price: product.price,
    discountedPrice,
    discount: product.discount || 0,
    flashSale,
    category: product.category?.name || product.category || '',
    image: product.images?.[0] || 'https://placehold.co/400x500?text=No+Image',
    rating: product.averageRating || product.rating || 0,
    reviews: product.reviewCount || (Array.isArray(product.reviews) ? product.reviews.length : product.reviews) || 0,
    stock: product.stock || 0,
    soldCount: product.soldCount || 0,
  });
};

const FALLBACK_CATEGORIES = [
  { _id: 'unisex', name: 'Đồ unisex' },
  { _id: 'outerwear', name: 'Áo khoác' },
  { _id: 'tops', name: 'Áo mặc hằng ngày' },
  { _id: 'accessories', name: 'Phụ kiện' },
];

const FEATURE_STRIPS = [
  { title: 'Khẳng định khí chất qua từng trang phục.', description: 'Khám phá bộ sưu tập thời trang độc bản, giúp bạn tự tin dẫn đầu mọi xu hướng.' },
  { title: 'Vẻ đẹp đến từ những điều đơn giản nhất', description: 'Trải nghiệm thời trang tối giản với chất liệu cao cấp và phom dáng chuẩn xác cho mọi dịp.' },
  { title: 'Đón đầu những thiết kế mới nhất', description: 'Tủ đồ với những sản phẩm trẻ trung, hiện đại và luôn bắt kịp nhịp sống thời thượng.' },
];

const STATS = [
  { value: '240+', label: 'Sản phẩm mới mỗi tuần' },
  { value: '48h', label: 'Giao nhanh nội thành' },
  { value: '4.9', label: 'Đánh giá trung bình' },
];

const getCategoryDescription = (category) => {
  const adminDescription = category?.description?.trim();
  if (adminDescription) return adminDescription;
  if (category?.productCount) return `${category.productCount} sản phẩm sẵn sàng để khám phá.`;
  return 'Danh mục đang được cập nhật nội dung mô tả.';
};

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [flashSales, setFlashSales] = useState([]);
  const [nowTs, setNowTs] = useState(Date.now());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const loadFlashSales = async () => {
    try {
      const res = await apiClient.get('/flash-sale/active');
      setFlashSales(res.data?.data?.promotions || []);
    } catch {
      setFlashSales([]);
    }
  };

  useEffect(() => {
    loadFlashSales();
    const poll = setInterval(loadFlashSales, 30000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return undefined;

    const socket = getSocket(token);
    if (!socket) return undefined;

    const onUpdate = () => loadFlashSales();
    const onRemaining = ({ promotionId, remaining }) => {
      setFlashSales((prev) =>
        prev.map((p) => (String(p._id) === String(promotionId) ? { ...p, flashSaleRemaining: remaining } : p)),
      );
    };

    socket.on('flash-sale:update', onUpdate);
    socket.on('flash-sale:remaining', onRemaining);

    return () => {
      socket.off('flash-sale:update', onUpdate);
      socket.off('flash-sale:remaining', onRemaining);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsResult, categoriesResult, bannersResult] = await Promise.allSettled([
        productAPI.getFeatured(),
        productAPI.getCategories(),
        apiClient.get('/banners'),
      ]);

      if (productsResult.status === 'fulfilled') {
        const data = productsResult.value.data?.data || productsResult.value.data || [];
        const list = Array.isArray(data) ? data : data.products || [];
        setFeaturedProducts(list.slice(0, 8).map(normalizeProduct));
      } else {
        try {
          const response = await productAPI.getAllProducts({ limit: 8 });
          const data = response.data?.data || response.data || [];
          const list = Array.isArray(data) ? data : data.products || [];
          setFeaturedProducts(list.slice(0, 8).map(normalizeProduct));
        } catch {
          setFeaturedProducts([]);
        }
      }

      if (categoriesResult.status === 'fulfilled') {
        const data = categoriesResult.value.data?.data || categoriesResult.value.data || [];
        const list = Array.isArray(data) ? data : [];
        const featured = list.filter((category) => category.isFeatured);
        setCategories((featured.length > 0 ? featured : list).slice(0, 4));
      }

      if (bannersResult.status === 'fulfilled') {
        const data = bannersResult.value.data?.data || [];
        setBanners(Array.isArray(data) ? data.filter((banner) => banner.isActive !== false) : []);
      }
    } catch (error) {
      console.error('HomePage fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const displayCategories = categories.length > 0 ? categories : FALLBACK_CATEGORIES;
  const activeFlashSale = (flashSales || []).find((p) => p.flashSaleRemaining === null || p.flashSaleRemaining > 0) || flashSales?.[0] || null;
  const flashItem = activeFlashSale?.items?.[0] || null;
  const flashProduct = flashItem?.product || activeFlashSale?.products?.[0] || null;
  const flashPrice = flashItem?.price || activeFlashSale?.flashSalePrice || null;
  const flashItemCount = activeFlashSale?.items?.length || activeFlashSale?.productIds?.length || 0;
  const flashEndsAt = activeFlashSale?.endDate ? new Date(activeFlashSale.endDate).getTime() : null;
  const flashLeftMs = flashEndsAt ? Math.max(0, flashEndsAt - nowTs) : 0;
  const hh = String(Math.floor(flashLeftMs / 3600000)).padStart(2, '0');
  const mm = String(Math.floor((flashLeftMs % 3600000) / 60000)).padStart(2, '0');
  const ss = String(Math.floor((flashLeftMs % 60000) / 1000)).padStart(2, '0');

  return (
    <div className="min-h-screen bg-transparent text-[#111111]">
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-6 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        {activeFlashSale && flashProduct && (
          <Link
            to={`/products/${flashProduct._id}`}
            className="editorial-card flex flex-col gap-3 rounded-[28px] border border-amber-200/70 bg-[linear-gradient(90deg,rgba(251,191,36,0.18)_0%,rgba(255,255,255,0.92)_45%,rgba(255,255,255,1)_100%)] px-6 py-5 shadow-sm transition hover:shadow-md"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white">
                  ⚡ Flash Sale
                </span>
                <p className="text-sm font-semibold text-black">{activeFlashSale.name || flashProduct.name}</p>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                  Còn lại: <span className="font-extrabold text-amber-700">{activeFlashSale.flashSaleRemaining ?? '∞'}</span>
                </span>
                {flashItemCount > 1 && (
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                    {flashItemCount} sản phẩm
                  </span>
                )}
                <span className="rounded-full border border-black/10 bg-white px-3 py-1 font-mono">
                  {hh}:{mm}:{ss}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-baseline gap-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{flashProduct.name}</span>
              {flashPrice && (
                <span className="font-extrabold text-black">
                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(flashPrice)}
                </span>
              )}
              <span className="text-slate-500">Nhấn để mua ngay</span>
            </div>
          </Link>
        )}
        {banners.length > 0 ? (
          <BannerCarousel banners={banners} interval={5000} />
        ) : (
          <section className="editorial-card editorial-grid relative overflow-hidden rounded-[36px] bg-white px-6 py-8 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
            <div className="absolute right-8 top-8 hidden h-40 w-40 rounded-full bg-black/[0.04] blur-3xl lg:block" />
            <div className="grid items-end gap-10 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-7">
                <div className="w-fit rounded-full border border-black/10 bg-[#f4f4f1] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-500">
                  Giao diện theo hướng Dribbble
                </div>
                <div className="space-y-5">
                  <h1 className="max-w-3xl text-4xl font-extrabold leading-[0.95] tracking-[-0.05em] sm:text-5xl lg:text-7xl">
                    Thời trang unisex hiện đại với giao diện sạch và gọn gàng.
                  </h1>
                  <p className="max-w-xl text-sm leading-7 text-slate-500 sm:text-base lg:text-lg">
                    Nền trắng, điểm nhấn đen, bề mặt xám nhạt và kiểu chữ sans-serif thanh lịch giúp cửa hàng trông cao cấp và dễ tập trung hơn ngay từ màn hình đầu tiên.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link to="/products" className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#242424]">
                    Mua sắm ngay
                  </Link>
                  <Link to="/products?type=sale" className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#f4f4f1]">
                    Xem ưu đãi
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                {STATS.map((stat) => (
                  <div key={stat.label} className="editorial-panel rounded-[28px] px-6 py-5">
                    <p className="text-3xl font-extrabold tracking-[-0.04em] text-black">{stat.value}</p>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURE_STRIPS.map((item) => (
            <article key={item.title} className="editorial-panel rounded-[28px] px-6 py-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">TỎA SÁNG PHONG CÁCH RIÊNG</p>
              <h3 className="mt-3 text-xl font-bold tracking-[-0.03em] text-black">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-400">Danh mục nổi bật</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-black sm:text-4xl">Danh mục gọn gàng và dễ khám phá</h2>
          </div>
          <Link to="/products" className="hidden text-sm font-semibold text-slate-500 transition hover:text-black sm:inline-flex">
            Xem tất cả
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {displayCategories.map((category, index) => {
            const categoryId = category._id || category;
            const categoryName = category.name || category;
            const isFeatured = index === 0;

            return (
              <Link
                key={categoryId}
                to={`/products?category=${categoryId}`}
                className={`group relative overflow-hidden rounded-[32px] border border-black/8 bg-white p-6 transition hover:-translate-y-1 hover:border-black/18 hover:shadow-[0_20px_50px_rgba(15,15,15,0.08)] ${
                  isFeatured ? 'md:col-span-2' : ''
                }`}
              >
                {category.image ? (
                  <>
                    <img
                      src={category.image}
                      alt={categoryName}
                      className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.08)_0%,rgba(10,10,10,0.58)_100%)]" />
                  </>
                ) : (
                  <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(0,0,0,0.08),transparent_60%)]" />
                )}
                <div className="relative flex h-full min-h-[220px] flex-col justify-between">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                      category.image
                        ? 'border-white/20 bg-white/12 text-white'
                        : 'border-black/10 bg-[#f4f4f1] text-slate-500'
                    }`}>
                      {isFeatured ? 'Danh mục chính' : 'Danh mục'}
                    </span>
                    <span className={`text-sm font-semibold transition group-hover:translate-x-1 ${
                      category.image ? 'text-white/80 group-hover:text-white' : 'text-slate-400 group-hover:text-black'
                    }`}>Xem thêm</span>
                  </div>
                  <div>
                    <h3 className={`max-w-xs text-2xl font-bold tracking-[-0.04em] sm:text-3xl ${category.image ? 'text-white' : 'text-black'}`}>{categoryName}</h3>
                    <p className={`mt-3 max-w-sm text-sm leading-7 ${category.image ? 'text-white/78' : 'text-slate-500'}`}>
                      {getCategoryDescription(category)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-400">Đang được quan tâm</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-black sm:text-4xl">Sản phẩm nổi bật trong lưới mới</h2>
          </div>
          <Link to="/products" className="hidden text-sm font-semibold text-slate-500 transition hover:text-black sm:inline-flex">
            Xem danh sách
          </Link>
        </div>

        {loading ? (
          <Loading />
        ) : featuredProducts.length === 0 ? (
          <Empty message="Không có sản phẩm" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      
    </div>
  );
}
