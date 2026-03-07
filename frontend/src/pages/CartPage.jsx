import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@hooks/useCart';
import Empty from '@components/Empty';
import { formatPrice } from '@utils/helpers';

export default function CartPage() {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart, getTotalPrice } = useCart();
  const [selectedIds, setSelectedIds] = useState([]);

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === cartItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(cartItems.map(item => item.id));
    }
  };

  const selectedItems = cartItems.filter(item => selectedIds.includes(item.id));
  const selectedTotal = selectedItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleCheckout = () => {
    if (selectedItems.length === 0) {
      alert('Vui lòng chọn ít nhất một sản phẩm');
      return;
    }
    // Lưu selectedItems vào sessionStorage để CheckoutPage dùng
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
                checked={selectedIds.length === cartItems.length && cartItems.length > 0}
                onChange={toggleSelectAll}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
              <span className="font-semibold text-dark">
                Chọn tất cả ({cartItems.length} sản phẩm)
              </span>
            </div>

            <div className="bg-white rounded-lg shadow-sm-blue overflow-hidden">
              {cartItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex gap-4 p-6 ${index !== cartItems.length - 1 ? 'border-b' : ''} ${selectedIds.includes(item.id) ? 'bg-blue-50' : ''}`}
                >
                  {/* Checkbox */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="w-5 h-5 accent-primary cursor-pointer"
                    />
                  </div>

                  {/* Image */}
                  <img
                    src={item.image || 'https://via.placeholder.com/100x100?text=Product'}
                    alt={item.name}
                    className="w-24 h-24 object-cover rounded-lg bg-light"
                  />

                  {/* Details */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-dark mb-1">{item.name}</h3>
                    <p className="text-primary font-bold">{formatPrice(item.price)}</p>
                  </div>

                  {/* Quantity and Total */}
                  <div className="text-right">
                    <div className="flex items-center border border-gray-300 rounded-lg w-fit mb-2">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 py-1 text-dark hover:bg-light">−</button>
                      <span className="px-3 py-1 font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 py-1 text-dark hover:bg-light">+</button>
                    </div>
                    <p className="font-bold text-dark mb-2">{formatPrice(item.price * item.quantity)}</p>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-500 text-sm hover:text-red-700 transition-all">Xóa</button>
                  </div>
                </div>
              ))}
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