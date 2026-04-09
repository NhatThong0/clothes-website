import { Link } from 'react-router-dom';
import { formatPrice } from '@utils/helpers';

export default function ProductCard({ product, onAddToCart }) {
  const outOfStock = product.stock === 0;
  const hasFlashSale = !!product.flashSale;
  const hasDiscount = !hasFlashSale && product.discount > 0;
  const flashSaleActive = hasFlashSale && !product.flashSale?.isSoldOut;

  return (
    <Link to={`/products/${product.id}`} className="group block h-full">
      <article className="editorial-card h-full overflow-hidden rounded-[28px] transition duration-500 hover:-translate-y-1.5 hover:border-black/20 hover:shadow-[0_24px_60px_rgba(12,12,12,0.14)]">
        <div className="relative overflow-hidden bg-[#f1f1ed]">
          <img
            src={product.image || 'https://placehold.co/300x400?text=Product'}
            alt={product.name}
            className={`h-80 w-full object-cover transition duration-700 sm:h-72 ${outOfStock ? 'grayscale opacity-60' : 'group-hover:scale-[1.04]'}`}
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/18 to-transparent" />

          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            {product.category && (
              <span className="rounded-full border border-black/10 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700 backdrop-blur">
                {product.category}
              </span>
            )}
            {hasFlashSale && !outOfStock && (
              <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                {flashSaleActive ? '⚡ Flash Sale' : 'Đã hết'}
              </span>
            )}
            {hasDiscount && !outOfStock && (
              <span className="rounded-full bg-black px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                -{product.discount}%
              </span>
            )}
          </div>

          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-black shadow-lg">
                Hết hàng
              </span>
            </div>
          )}
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Lựa chọn nổi bật
            </p>
            <h3 className="line-clamp-2 text-base font-semibold leading-7 text-[#101010] transition-colors group-hover:text-black sm:text-lg">
              {product.name}
            </h3>
          </div>

          {product.rating > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="flex text-black">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`h-4 w-4 ${i < Math.round(product.rating) ? 'fill-current' : 'fill-slate-300'}`}
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>
              <span>({product.reviews || 0} đánh giá)</span>
            </div>
          )}

          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xl font-extrabold tracking-tight text-black sm:text-2xl">
                {formatPrice(product.discountedPrice || product.price)}
              </span>
              {(hasDiscount || flashSaleActive) && (
                <span className="text-sm text-slate-400 line-through">{formatPrice(product.price)}</span>
              )}
            </div>
            {product.soldCount > 0 && (
              <div className="rounded-2xl border border-black/8 bg-[#f7f7f4] px-3 py-2 text-right shadow-[0_10px_24px_rgba(15,15,15,0.04)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Độ phổ biến</p>
                <p className="mt-1 text-sm font-bold text-black">{product.soldCount} đã bán</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-black/6 pt-4">
            <span
              className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                outOfStock ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {outOfStock ? 'Không khả dụng' : `Còn hàng ${product.stock}`}
            </span>

            {!onAddToCart && (
              <span className="text-sm font-semibold text-black transition-transform group-hover:translate-x-1">
                Xem chi tiết
              </span>
            )}
          </div>

          {onAddToCart && (
            <button
              onClick={(e) => {
                e.preventDefault();
                if (outOfStock) return;
                onAddToCart();
              }}
              disabled={outOfStock}
              className={`w-full rounded-full px-5 py-3 text-sm font-semibold transition ${
                outOfStock
                  ? 'cursor-not-allowed bg-[#e7e7e3] text-slate-400'
                  : 'bg-black text-white hover:bg-[#242424]'
              }`}
            >
              {outOfStock ? 'Hết hàng' : 'Thêm vào giỏ'}
            </button>
          )}
        </div>
      </article>
    </Link>
  );
}
