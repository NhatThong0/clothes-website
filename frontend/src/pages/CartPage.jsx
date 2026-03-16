import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@hooks/useCart';
import Empty from '@components/Empty';
import { formatPrice } from '@utils/helpers';

export default function CartPage() {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart, minQtyAlert } = useCart();
  const [selectedKeys, setSelectedKeys] = useState([]);

  // ✅ Key duy nhất: id + color + size
  const getItemKey = (item) =>
    `${item.id}__${item.color || ''}__${item.size || ''}`;

  const toggleSelect = (key) =>
    setSelectedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const toggleSelectAll = () => {
    const allKeys = cartItems.map(getItemKey);
    setSelectedKeys(selectedKeys.length === cartItems.length ? [] : allKeys);
  };

  const selectedItems = cartItems.filter(item => selectedKeys.includes(getItemKey(item)));
  const selectedTotal = selectedItems.reduce(
    (acc, item) => acc + (item.discountedPrice || item.price) * item.quantity, 0
  );

  const handleCheckout = () => {
    if (selectedItems.length === 0) {
      alert('Vui lòng chọn ít nhất một sản phẩm');
      return;
    }
    sessionStorage.setItem('checkoutItems', JSON.stringify(selectedItems));
    navigate('/checkout');
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-dark mb-8">Giỏ hàng</h1>

      {cartItems.length === 0 ? (
        <Empty
          message="Giỏ hàng của bạn trống"
          action={
            <Link to="/products" className="inline-block px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-all">
              Tiếp tục mua sắm
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">

            {/* Select all */}
            <div className="flex items-center gap-3 mb-4 p-4 bg-white rounded-lg shadow-sm-blue">
              <input
                type="checkbox"
                checked={selectedKeys.length === cartItems.length && cartItems.length > 0}
                onChange={toggleSelectAll}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
              <span className="font-semibold text-dark">
                Chọn tất cả ({cartItems.length} sản phẩm)
              </span>
            </div>

            <div className="bg-white rounded-lg shadow-sm-blue overflow-hidden">
              {cartItems.map((item, index) => {
                const key = getItemKey(item);
                return (
                  <div
                    key={key}
                    className={`flex gap-4 p-6 ${index !== cartItems.length - 1 ? 'border-b' : ''} ${selectedKeys.includes(key) ? 'bg-blue-50' : ''}`}
                  >
                    {/* Checkbox */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedKeys.includes(key)}
                        onChange={() => toggleSelect(key)}
                        className="w-5 h-5 accent-primary cursor-pointer"
                      />
                    </div>

                    {/* Image */}
                    <img
                      src={item.image || 'https://placehold.co/80x80?text=SP'}
                      alt={item.name}
                      onError={e => { e.target.onerror = null; e.target.src = 'https://placehold.co/80x80?text=SP'; }}
                      className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                    />

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-dark mb-1 line-clamp-2">{item.name}</h3>

                      {/* Màu + size */}
                      {(item.color || item.size) && (
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          {item.color && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium border border-blue-100">
                              {item.color}
                            </span>
                          )}
                          {item.size && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium border border-slate-200">
                              {item.size}
                            </span>
                          )}
                        </div>
                      )}

                      <p className="text-primary font-bold">
                        {formatPrice(item.discountedPrice || item.price)}
                      </p>
                      {item.discount > 0 && (
                        <p className="text-xs text-gray-400 line-through">{formatPrice(item.price)}</p>
                      )}
                    </div>

                    {/* Quantity + Total */}
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center border border-gray-300 rounded-lg w-fit mb-1">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1, item.color, item.size)}
                          className="px-2 py-1 text-dark hover:bg-light"
                        >−</button>
                        <span className="px-3 py-1 font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1, item.color, item.size)}
                          className="px-2 py-1 text-dark hover:bg-light"
                        >+</button>
                      </div>

                      {minQtyAlert === key && (
                        <p className="text-xs text-amber-500 font-medium mb-1 animate-pulse">Tối thiểu 1</p>
                      )}

                      <p className="font-bold text-dark mb-2">
                        {formatPrice((item.discountedPrice || item.price) * item.quantity)}
                      </p>

                      {/* ✅ Xóa theo key (id + color + size) */}
                      <button
                        onClick={() => removeFromCart(item.id, item.color, item.size)}
                        className="text-red-500 text-sm hover:text-red-700 transition-all"
                      >Xóa</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Link to="/products" className="inline-block mt-6 text-primary hover:text-secondary transition-all font-medium">
              ← Tiếp tục mua sắm
            </Link>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-light rounded-lg p-6 sticky top-20">
              <h2 className="text-xl font-bold text-dark mb-6">Tóm tắt đơn hàng</h2>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Đã chọn:</span>
                  <span>{selectedItems.length} sản phẩm</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tạm tính:</span>
                  <span>{formatPrice(selectedTotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Phí vận chuyển:</span>
                  <span className="text-green-600">Miễn phí</span>
                </div>
              </div>
              <div className="border-t border-gray-300 pt-4 mb-6">
                <div className="flex justify-between font-bold text-dark text-lg">
                  <span>Tổng cộng:</span>
                  <span className="text-primary">{formatPrice(selectedTotal)}</span>
                </div>
              </div>
              <button
                onClick={handleCheckout}
                disabled={selectedItems.length === 0}
                className="w-full block text-center px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition-all shadow-md-blue disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Thanh toán ({selectedItems.length})
              </button>
              <button
                onClick={clearCart}
                className="w-full mt-3 px-6 py-2 border-2 border-red-500 text-red-500 rounded-lg hover:bg-red-50 transition-all"
              >
                Xóa giỏ hàng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}