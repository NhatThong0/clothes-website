import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ProductCard from '@features/product/components/ProductCard';
import Loading from '@components/common/Loading';
import Empty from '@components/common/Empty';
import { productAPI } from '@features/shared/services/api';
import { useRef } from 'react'

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
    image: product.images?.[0] || 'https://placehold.co/300x400?text=No+Image',
    rating: product.averageRating || product.rating || 0,
    reviews: product.reviewCount || (Array.isArray(product.reviews) ? product.reviews.length : product.reviews) || 0,
    stock: product.stock || 0,
    soldCount: product.soldCount || 0,
  });
};

const PAGE_META = {
  default: {
    eyebrow: 'Tất cả sản phẩm',
    title: 'Danh sách sản phẩm tối giản cho thời trang unisex hiện đại',
    
  },
  sale: {
    eyebrow: 'Khuyến mãi',
    title: 'Những ưu đãi đang được nổi bật',
    
  },
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'price-low', label: 'Giá thấp đến cao' },
  { value: 'price-high', label: 'Giá cao đến thấp' },
  { value: 'discount', label: 'Giảm nhiều nhất' },
];

export default function ProductListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const typeParam = searchParams.get('type') || '';
  const searchParam = searchParams.get('search') || '';
  const meta = PAGE_META[typeParam] || PAGE_META.default;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 12;
  const [categoryOpen, setCategoryOpen] = useState(true);

  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    minPrice: parseInt(searchParams.get('minPrice'), 10) || 0,
    maxPrice: parseInt(searchParams.get('maxPrice'), 10) || 10000000,
    sortBy: searchParams.get('sortBy') || meta.defaultSort,
    search: searchParam,
  });

  const [sortOpen, setSortOpen] = useState(false);
const sortRef = useRef(null);

useEffect(() => {
  const handleClickOutside = (e) => {
    if (sortRef.current && !sortRef.current.contains(e.target)) {
      setSortOpen(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setPage(1);
    setFilters((current) => ({
      ...current,
      search: searchParam,
      sortBy: searchParam ? 'newest' : meta.defaultSort,
    }));
  }, [meta.defaultSort, searchParam, typeParam]);

  useEffect(() => {
    fetchProducts();
  }, [filters, page, typeParam]);

  const fetchCategories = async () => {
    try {
      const response = await productAPI.getCategories();
      const data = response.data?.data || response.data || [];
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (filters.category) params.category = filters.category;
      if (filters.search) params.search = filters.search;
      if (filters.minPrice > 0) params.minPrice = filters.minPrice;
      if (filters.maxPrice < 10000000) params.maxPrice = filters.maxPrice;
      if (typeParam) params.type = typeParam;

      const sortMap = {
        newest: 'newest',
        'price-low': 'price-low',
        'price-high': 'price-high',
        discount: 'discount',
      };
      params.sort = sortMap[filters.sortBy] || 'newest';

      const response = await productAPI.getAllProducts(params);
      const data = response.data?.data || response.data || [];
      const list = Array.isArray(data) ? data : data.products || [];

      setProducts(list.map(normalizeProduct));
      setTotalProducts(response.data?.pagination?.total || list.length);
      setTotalPages(response.data?.pagination?.pages || 1);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));

    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    navigate(`/products?${params.toString()}`, { replace: true });
  };

  const resetFilters = () => {
    setPage(1);
    setFilters({
      category: '',
      minPrice: 0,
      maxPrice: 10000000,
      sortBy: meta.defaultSort,
      search: '',
    });

    const params = new URLSearchParams();
    if (typeParam) params.set('type', typeParam);
    navigate(`/products?${params.toString()}`, { replace: true });
  };

  const summaryText = searchParam ? `Kết quả cho "${searchParam}"` : `${totalProducts} sản phẩm trong danh mục`;

  return (
    <div className="min-h-screen bg-transparent text-[#111111]">
      <section className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <div className="editorial-card editorial-grid overflow-hidden rounded-[36px] bg-white px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-400">{meta.eyebrow}</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-[0.96] tracking-[-0.05em] text-black sm:text-5xl lg:text-6xl">
                {searchParam ? `Tìm kiếm cho "${searchParam}"` : meta.title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base lg:text-lg">
                {searchParam ? 'Kết quả được sắp xếp trong lưới sản phẩm dễ theo dõi hơn, khoảng cách rõ ràng hơn và dễ quét mắt hơn.' : meta.subtitle}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
            <div className="editorial-card rounded-[32px] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Bộ lọc</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-black">Lọc sản phẩm</h2>
                </div>
                <button onClick={resetFilters} className="text-sm font-semibold text-slate-500 transition hover:text-black">
                  Đặt lại
                </button>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <button
                    onClick={() => setCategoryOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Danh mục</p>
                    <svg
                      className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${categoryOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {categoryOpen && (
                    <div className="mt-4 space-y-1">
                      <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-black/6 bg-[#f7f7f4] px-4 py-3 text-sm text-slate-600 mb-2">
                        <span>Tất cả</span>
                        <input type="radio" name="category" checked={filters.category === ''} onChange={() => updateFilter('category', '')} className="accent-black" />
                      </label>
                      {(() => {
                        const topLevel = categories.filter(c => !c.parent);
                        const childrenOf = (pid) => categories.filter(c => (c.parent?._id || c.parent) === pid);
                        return topLevel.map((parent) => {
                          const kids = childrenOf(parent._id);
                          if (kids.length === 0) {
                            return (
                              <label key={parent._id} className="flex cursor-pointer items-center justify-between rounded-2xl border border-black/6 bg-white px-4 py-3 text-sm text-slate-600 transition hover:bg-[#f7f7f4]">
                                <span>{parent.name}</span>
                                <input type="radio" name="category" checked={filters.category === parent._id} onChange={() => updateFilter('category', parent._id)} className="accent-black" />
                              </label>
                            );
                          }
                          return (
                            <div key={parent._id} className="mb-1">
                              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 px-2 pt-3 pb-1">{parent.name}</p>
                              {kids.map(child => (
                                <label key={child._id} className="flex cursor-pointer items-center justify-between rounded-2xl border border-black/6 bg-white px-4 py-2.5 text-sm text-slate-600 transition hover:bg-[#f7f7f4] ml-2">
                                  <span>{child.name}</span>
                                  <input type="radio" name="category" checked={filters.category === child._id} onChange={() => updateFilter('category', child._id)} className="accent-black" />
                                </label>
                              ))}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Khoảng giá</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <label className="block rounded-2xl border border-black/6 bg-[#f7f7f4] px-4 py-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Từ</span>
                      <input
                        type="number"
                        value={filters.minPrice}
                        onChange={(event) => updateFilter('minPrice', event.target.value)}
                        className="mt-2 w-full bg-transparent text-sm text-black outline-none"
                      />
                    </label>
                    <label className="block rounded-2xl border border-black/6 bg-[#f7f7f4] px-4 py-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Đến</span>
                      <input
                        type="number"
                        value={filters.maxPrice === 10000000 ? '' : filters.maxPrice}
                        placeholder="Không giới hạn"
                        onChange={(event) => updateFilter('maxPrice', event.target.value || 10000000)}
                        className="mt-2 w-full bg-transparent text-sm text-black outline-none"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-5">
            <div className="editorial-card flex flex-col gap-4 rounded-[32px] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Sản phẩm</p>
                <p className="mt-2 text-sm text-slate-500">
                  {loading ? 'Đang tải sản phẩm...' : `${totalProducts} sản phẩm.`}
                </p>
              </div>

              <div className="relative" ref={sortRef}>
  <button
    onClick={() => setSortOpen((prev) => !prev)}
    className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold border transition
      ${sortOpen
        ? 'bg-black text-white border-transparent'
        : 'bg-white text-black border-black/10 hover:bg-[#f7f7f4]'
      }`}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/>
    </svg>
    <span>{SORT_OPTIONS.find((o) => o.value === filters.sortBy)?.label || 'Sắp xếp'}</span>
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-150 ${sortOpen ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </button>

  {sortOpen && (
    <div className="absolute right-0 top-[calc(100%+8px)] z-10 min-w-[200px] overflow-hidden rounded-2xl border border-black/10 bg-white">
      {SORT_OPTIONS.filter((o) => typeParam === 'sale' || o.value !== 'discount').map((option) => (
        <button
          key={option.value}
          onClick={() => { updateFilter('sortBy', option.value); setSortOpen(false); }}
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-black hover:bg-[#f7f7f4]"
        >
          <span className={filters.sortBy === option.value ? 'font-semibold' : ''}>{option.label}</span>
          {filters.sortBy === option.value && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </button>
      ))}
    </div>
  )}
</div>
              
            </div>

            {loading ? (
              <Loading />
            ) : products.length === 0 ? (
              <div className="editorial-card rounded-[32px] px-6 py-16 text-center">
                <Empty message="Không tìm thấy sản phẩm phù hợp" />
                <div className="mt-6">
                  <button onClick={resetFilters} className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#242424]">
                    Xóa bộ lọc
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="editorial-card flex flex-wrap items-center justify-center gap-2 rounded-[28px] px-4 py-4 sm:px-6">
                    <button
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1}
                      className="rounded-full border border-black/8 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-[#f4f4f1] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Trước
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, index) => {
                      const pageNumber =
                        totalPages <= 7
                          ? index + 1
                          : page <= 4
                            ? index + 1
                            : page >= totalPages - 3
                              ? totalPages - 6 + index
                              : page - 3 + index;

                      return (
                        <button
                          key={pageNumber}
                          onClick={() => setPage(pageNumber)}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                            page === pageNumber ? 'bg-black text-white' : 'border border-black/8 text-slate-600 hover:bg-[#f4f4f1]'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page === totalPages}
                      className="rounded-full border border-black/8 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-[#f4f4f1] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Sau
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
