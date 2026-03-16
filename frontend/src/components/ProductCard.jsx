import { Link } from 'react-router-dom';
import { formatPrice } from '@utils/helpers';

export default function ProductCard({ product, onAddToCart }) {
  const outOfStock = product.stock === 0;

  return (
    <Link to={`/products/${product.id}`} className="group">
      <div className="bg-white rounded-xl overflow-hidden shadow-sm-blue hover:shadow-md-blue transition-all duration-300 h-full">

        {/* Image */}
        <div className="relative bg-light overflow-hidden h-80 sm:h-64">
          <img
            src={product.image || 'https://placehold.co/300x400?text=Product'}
            alt={product.name}
            className={`w-full h-full object-cover transition-transform duration-300 ${outOfStock ? 'grayscale opacity-60' : 'group-hover:scale-110'}`}
          />
          {outOfStock && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="bg-white text-red-600 font-bold text-sm px-4 py-1.5 rounded-full shadow">Hết hàng</span>
            </div>
          )}
          {product.discount > 0 && !outOfStock && (
            <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
              -{product.discount}%
            </div>
          )}
          <div className="absolute top-4 left-4 bg-primary text-white px-3 py-1 rounded-full text-xs font-semibold">
            {product.category}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5">
          <h3 className="font-semibold text-dark text-base sm:text-lg mb-2 line-clamp-2 group-hover:text-primary transition-all">
            {product.name}
          </h3>

          {product.rating > 0 && (
            <div className="flex items-center mb-2">
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className={`w-4 h-4 ${i < product.rating ? 'fill-current' : 'fill-gray-300'}`} viewBox="0 0 20 20">
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>
              <span className="ml-2 text-xs text-gray-500">({product.reviews || 0})</span>
            </div>
          )}

          <div className="flex items-baseline space-x-2 mb-3">
            <span className="font-bold text-lg sm:text-xl text-primary">
              {formatPrice(product.discountedPrice || product.price)}
            </span>
            {product.discount > 0 && (
              <span className="text-sm text-gray-400 line-through">{formatPrice(product.price)}</span>
            )}
          </div>

          <div className="mb-3">
            {outOfStock
              ? <span className="text-xs text-red-600 font-semibold">✗ Hết hàng</span>
              : <span className="text-xs text-green-600 font-semibold">✓ Có sẵn ({product.stock})</span>
            }
          </div>

          {product.soldCount > 0 && (
            <div className="mb-3">
              <span className="text-xs text-orange-500 font-semibold">🔥 Đã bán {product.soldCount}</span>
            </div>
          )}

          {/* ✅ Chỉ hiện nút khi có onAddToCart prop */}
          {onAddToCart && (
            <button
              onClick={(e) => {
                e.preventDefault();
                if (outOfStock) return;
                onAddToCart();
              }}
              disabled={outOfStock}
              className={`w-full py-2 rounded-lg font-medium transition-all ${
                outOfStock
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-secondary group-hover:shadow-md-blue'
              }`}
            >
              {outOfStock ? 'Hết hàng' : 'Thêm vào giỏ'}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}