import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ProductCard from '@components/ProductCard';
import Loading from '@components/Loading';
import Empty from '@components/Empty';
import { useCart } from '@hooks/useCart';
import { productAPI } from '@services/api';

// ── Normalize ─────────────────────────────────────────────────────────────────
const normalizeProduct = (p) => ({
  id:              p._id || p.id,
  _id:             p._id || p.id,
  name:            p.name,
  price:           p.price,
  discountedPrice: p.discount > 0 ? Math.round(p.price * (1 - p.discount / 100)) : p.price,
  discount:        p.discount || 0,
  category:        p.category?.name || p.category || '',
  image:           p.images?.[0] || 'https://placehold.co/300x400?text=No+Image',
  rating:          p.averageRating || p.rating || 0,
  reviews:         p.reviewCount || (Array.isArray(p.reviews) ? p.reviews.length : p.reviews) || 0,
  stock:           p.stock || 0,
  soldCount:       p.soldCount || 0,
});

// ── Page title & description theo type ───────────────────────────────────────
const PAGE_META = {
  sale: {
    title:    'Khuyến mãi',
    subtitle: 'Những sản phẩm đang được giảm giá mạnh mẽ',
    icon:     '🔥',
    badge:    { label: 'HOT', cls: 'bg-rose-500' },
    defaultSort: 'discount',
  },
  new: {
    title:    'Hàng mới về',
    subtitle: 'Những sản phẩm mới nhất vừa được cập bến`',
    icon:     '✨',
    badge:    { label: 'MỚI', cls: 'bg-emerald-500' },
    defaultSort: 'newest',
  },
  default: {
    title:    'Tất cả sản phẩm',
    subtitle: 'Mọi thứ bạn cần, chúng tôi đều có',
    icon:     '🛍️',
    badge:    null,
    defaultSort: 'newest',
  },
};

export default function ProductListPage() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToCart }  = useCart();

  const typeParam   = searchParams.get('type')   || '';
  const searchParam = searchParams.get('search') || '';
  const meta        = PAGE_META[typeParam] || PAGE_META.default;

  const [products,      setProducts]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [categories,    setCategories]    = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);
  const LIMIT = 12;

  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    minPrice: parseInt(searchParams.get('minPrice')) || 0,
    maxPrice: parseInt(searchParams.get('maxPrice')) || 10000000,
    sortBy:   searchParams.get('sortBy') || meta.defaultSort,
    search:   searchParam,
  });

  useEffect(() => { fetchCategories(); }, []);

  // ── Sync filters khi URL thay đổi từ bên ngoài (Header search) ──────────────
  useEffect(() => {
    setPage(1);
    setFilters(f => ({
      ...f,
      search:  searchParam,
      type:    typeParam,
      sortBy:  searchParam ? 'newest' : meta.defaultSort,
    }));
  }, [searchParam, typeParam]);

  useEffect(() => { fetchProducts(); }, [filters, typeParam, page]);

  const fetchCategories = async () => {
    try {
      const res  = await productAPI.getCategories();
      const data = res.data?.data || res.data || [];
      setCategories(data);
    } catch { setCategories([]); }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = { page, limit: LIMIT };
      if (filters.category)        params.category = filters.category;
      if (filters.search)          params.search   = filters.search;
      if (filters.minPrice > 0)    params.minPrice = filters.minPrice;
      if (filters.maxPrice < 10000000) params.maxPrice = filters.maxPrice;
      if (typeParam)               params.type     = typeParam;

      const sortMap = { newest: 'newest', 'price-low': 'price-low', 'price-high': 'price-high', discount: 'discount' };
      params.sort = sortMap[filters.sortBy] || 'newest';

      const res  = await productAPI.getAllProducts(params);
      const data = res.data?.data || res.data || [];
      const list = Array.isArray(data) ? data : (data.products || []);

      setProducts(list.map(normalizeProduct));
      setTotalProducts(res.data?.pagination?.total || list.length);
      setTotalPages(res.data?.pagination?.pages || 1);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters(f => ({ ...f, [key]: value }));
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value); else p.delete(key);
    navigate(`/products?${p.toString()}`, { replace: true });
  };

  const resetFilters = () => {
    setPage(1);
    setFilters({ category:'', minPrice:0, maxPrice:10000000, sortBy: meta.defaultSort, search:'' });
    const p = new URLSearchParams();
    if (typeParam) p.set('type', typeParam);
    navigate(`/products?${p.toString()}`, { replace: true });
  };

  const SORT_OPTIONS = [
    { value:'newest',     label:'Mới nhất' },
    { value:'price-low',  label:'Giá: Thấp → Cao' },
    { value:'price-high', label:'Giá: Cao → Thấp' },
    ...(typeParam === 'sale' ? [{ value:'discount', label:'Giảm nhiều nhất' }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Page hero ── */}
      <div className={`py-8 px-4 md:px-6 ${
        typeParam === 'sale'  ? 'bg-gradient-to-r from-rose-600 to-orange-500'
        : typeParam === 'new' ? 'bg-gradient-to-r from-emerald-600 to-teal-500'
        : searchParam         ? 'bg-gradient-to-r from-slate-700 to-slate-800'
        : 'bg-gradient-to-r from-blue-600 to-blue-500'
      } text-white`}>
        <div className="max-w-7xl mx-auto">
          {searchParam ? (
            <div className="flex items-start gap-3 flex-wrap">
              <span className="text-3xl mt-0.5">🔍</span>
              <div>
                <h1 className="text-2xl font-black">
                  Kết quả cho{' '}
                  <span className="text-yellow-300">"{searchParam}"</span>
                </h1>
                {!loading && (
                  <p className="text-white/80 text-sm mt-1">
                    {totalProducts > 0
                      ? `${totalProducts} sản phẩm được tìm thấy`
                      : 'Không tìm thấy sản phẩm nào phù hợp'}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-3xl">{meta.icon}</span>
              <div>
                <h1 className="text-2xl font-black">{meta.title}</h1>
                {meta.subtitle && <p className="text-white/80 text-sm mt-0.5">{meta.subtitle}</p>}
              </div>
            </div>
          )}
          {!searchParam && totalProducts > 0 && !loading && (
            <p className="text-white/70 text-sm mt-2">{totalProducts} sản phẩm</p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

          {/* ── Sidebar ── */}
          <aside className="md:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sticky top-20 space-y-5">
              <h3 className="font-bold text-slate-800">Lọc sản phẩm</h3>

              {/* Danh mục */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">Danh mục</h4>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="category" checked={filters.category === ''}
                      onChange={() => updateFilter('category', '')}
                      className="w-4 h-4 text-blue-600 accent-blue-600"/>
                    <span className="text-sm text-slate-700">Tất cả</span>
                  </label>
                  {categories.map(cat => {
                    const catId   = cat._id || cat;
                    const catName = cat.name || cat;
                    return (
                      <label key={catId} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="category" checked={filters.category === catId}
                          onChange={() => updateFilter('category', catId)}
                          className="w-4 h-4 text-blue-600 accent-blue-600"/>
                        <span className="text-sm text-slate-700">{catName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Giá */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">Khoảng giá</h4>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Từ</label>
                    <input type="number" value={filters.minPrice}
                      onChange={e => updateFilter('minPrice', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Đến</label>
                    <input type="number" value={filters.maxPrice === 10000000 ? '' : filters.maxPrice}
                      placeholder="Không giới hạn"
                      onChange={e => updateFilter('maxPrice', e.target.value || 10000000)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  </div>
                </div>
              </div>

              {/* Reset */}
              <button onClick={resetFilters}
                className="w-full py-2 border-2 border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 rounded-xl text-sm font-semibold transition-all">
                Xóa bộ lọc
              </button>
            </div>
          </aside>

          {/* ── Products ── */}
          <div className="md:col-span-3">

            {/* Sort bar */}
            <div className="flex items-center justify-between mb-4 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
              <p className="text-sm text-slate-500">
                {loading ? 'Đang tải...' : <><span className="font-bold text-slate-800">{totalProducts}</span> sản phẩm</>}
              </p>
              <select value={filters.sortBy} onChange={e => updateFilter('sortBy', e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Grid */}
            {loading ? (
              <Loading/>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center px-6">
                <span className="text-5xl block mb-3">
                  {searchParam ? '🔍' : meta.icon}
                </span>
                <p className="text-slate-600 font-bold text-base mb-1">
                  {searchParam
                    ? <>Không tìm thấy sản phẩm nào cho &ldquo;<span className="text-blue-600">{searchParam}</span>&rdquo;</>
                    : typeParam === 'sale' ? 'Hiện không có sản phẩm khuyến mãi'
                    : typeParam === 'new'  ? 'Chưa có sản phẩm mới'
                    : 'Không tìm thấy sản phẩm'}
                </p>
                {searchParam && (
                  <p className="text-slate-400 text-sm mb-4">Thử tìm với từ khóa khác hoặc xem tất cả sản phẩm</p>
                )}
                <div className="flex items-center justify-center gap-3 mt-4">
                  {searchParam && (
                    <button onClick={() => navigate('/products')}
                      className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
                      Xem tất cả sản phẩm
                    </button>
                  )}
                  <button onClick={resetFilters}
                    className="px-5 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50">
                    Xóa bộ lọc
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map(product => (
                    <div key={product.id} className="relative"> 
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                      className="px-3 py-2 text-sm border border-slate-200 bg-white rounded-xl hover:bg-slate-50 disabled:opacity-40 font-medium transition-colors">
                      ← Trước
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const p = totalPages <= 7 ? i + 1
                        : page <= 4 ? i + 1
                        : page >= totalPages - 3 ? totalPages - 6 + i
                        : page - 3 + i;
                      return (
                        <button key={p} onClick={() => setPage(p)}
                          className={`px-3 py-2 text-sm rounded-xl font-medium border transition-colors ${
                            page === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}>
                          {p}
                        </button>
                      );
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                      className="px-3 py-2 text-sm border border-slate-200 bg-white rounded-xl hover:bg-slate-50 disabled:opacity-40 font-medium transition-colors">
                      Sau →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}