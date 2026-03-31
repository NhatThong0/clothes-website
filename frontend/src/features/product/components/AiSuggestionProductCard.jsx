import { Link } from 'react-router-dom';
import { formatPrice } from '@utils/helpers';

export default function AiSuggestionProductCard({ product }) {
  const id = product?.productId || product?.id;
  const image = product?.image || product?.images?.[0];
  const name = product?.name || '';
  const price = Number(product?.price ?? 0);
  const discount = Number(product?.discount ?? 0);
  const categoryName = product?.categoryName || product?.category || '';

  return (
    <Link
      to={`/products/${id}`}
      className="block bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow"
    >
      <div className="flex gap-3 p-3 items-center">
        <div className="w-14 h-14 rounded-lg bg-slate-50 overflow-hidden flex-shrink-0 border border-slate-100">
          {image ? (
            <img src={image} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-slate-100 flex items-center justify-center text-xs text-slate-400">
              No image
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {discount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                -{discount}%
              </span>
            )}
            {categoryName && (
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full truncate">
                {categoryName}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-900 truncate mt-1">{name}</p>
          <p className="text-xs text-slate-600 mt-1">{formatPrice(price)} </p>
        </div>
      </div>
      <div className="px-3 pb-3">
        <span className="inline-flex items-center text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-lg">
          Xem sản phẩm
        </span>
      </div>
    </Link>
  );
}

