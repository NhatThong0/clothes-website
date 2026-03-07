import { Link } from 'react-router-dom';
import { formatPrice } from '@utils/helpers';

export default function ProductCard({ product, onAddToCart }) {
  return (
    <Link to={`/products/${product.id}`} className="group">
      <div className="bg-white rounded-xl overflow-hidden shadow-sm-blue hover:shadow-md-blue transition-all duration-300 h-full">
        {/* Image container */}
        <div className="relative bg-light overflow-hidden h-80 sm:h-64">
          <img
            src={product.image || 'https://placehold.co/300x400?text=Product'}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />

          {/* Sale badge */}
          {product.discount > 0 && (
            <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
              -{product.discount}%
            </div>
          )}

          {/* Category badge */}
          <div className="absolute top-4 left-4 bg-primary text-white px-3 py-1 rounded-full text-xs font-semibold">
            {product.category}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5">
          {/* Name */}
          <h3 className="font-semibold text-dark text-base sm:text-lg mb-2 line-clamp-2 group-hover:text-primary transition-all">
            {product.name}
          </h3>

          {/* Rating */}
          {product.rating && (
            <div className="flex items-center mb-2">
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`w-4 h-4 ${i < product.rating ? 'fill-current' : 'fill-gray-300'}`}
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>
              <span className="ml-2 text-xs text-gray-500">({product.reviews || 0})</span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline space-x-2 mb-4">
            <span className="font-bold text-lg sm:text-xl text-primary">
              {formatPrice(product.discountedPrice || product.price)}
            </span>
            {product.discount > 0 && (
              <span className="text-sm text-gray-400 line-through">
                {formatPrice(product.price)}
              </span>
            )}
          </div>

          {/* Stock status */}
          <div className="mb-4">
            {product.stock > 0 ? (
              <span className="text-xs text-green-600 font-semibold">Có sẵn ({product.stock})</span>
            ) : (
              <span className="text-xs text-red-600 font-semibold">Hết hàng</span>
            )}
          </div>
            {product.soldCount > 0 && (
          <div className="mb-3">
            <span className="text-xs text-orange-500 font-semibold">
              🔥 Đã bán {product.soldCount}
            </span>
          </div>
        )}

          {/* Add to cart button */}
          <button
    onClick={(e) => {
      e.preventDefault();
      onAddToCart && onAddToCart(); // ✅
    }}
    className="w-full py-2 bg-primary text-white rounded-lg font-medium hover:bg-secondary transition-all group-hover:shadow-md-blue"
  >
    Thêm vào giỏ
  </button>
        </div>
      </div>
    </Link>
  );
}
