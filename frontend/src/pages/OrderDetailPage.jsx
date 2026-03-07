import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Loading from '@components/Loading';
import { formatPrice, formatDate } from '@utils/helpers';
import { orderAPI } from '@services/api';

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const res = await orderAPI.getOrderById(id);
      const data = res.data?.data || res.data;
      setOrder(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Không tìm thấy đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
    try {
      await orderAPI.cancelOrder(id);
      fetchOrder();
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể hủy đơn hàng');
    }
  };

  const statusLabel = {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    processing: 'Đang xử lý',
    shipped: 'Đang giao',
    delivered: 'Đã giao',
    cancelled: 'Đã hủy',
  };

  const statusColor = {
    pending: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-purple-100 text-purple-800',
    processing: 'bg-yellow-100 text-yellow-800',
    shipped: 'bg-orange-100 text-orange-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  if (loading) return <Loading />;
  if (error) return (
    <div className="text-center py-12">
      <p className="text-red-500 mb-4">{error}</p>
      <Link to="/orders" className="text-primary hover:text-secondary">← Quay lại đơn hàng</Link>
    </div>
  );
  if (!order) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-dark">Chi tiết đơn hàng</h1>
        <Link to="/orders" className="text-primary hover:text-secondary font-medium">
          ← Quay lại
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status */}
          <div className="bg-white rounded-lg shadow-sm-blue p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Mã đơn hàng</p>
                <p className="font-bold text-lg">{order._id}</p>
              </div>
              <span className={`px-4 py-2 rounded-full font-semibold text-sm ${statusColor[order.status] || statusColor.pending}`}>
                {statusLabel[order.status] || order.status}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-2">Đặt ngày {formatDate(order.createdAt)}</p>
            {order.trackingNumber && (
              <p className="text-gray-500 text-sm mt-1">Mã vận đơn: <span className="font-mono font-semibold">{order.trackingNumber}</span></p>
            )}
          </div>

          {/* Products */}
          <div className="bg-white rounded-lg shadow-sm-blue p-6">
            <h2 className="font-bold text-lg mb-4">Sản phẩm</h2>
            <div className="space-y-4">
              {order.items?.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-semibold text-dark">{item.name}</p>
                    <p className="text-sm text-gray-500">Số lượng: {item.quantity}</p>
                    {item.color && <p className="text-sm text-gray-500">Màu: {item.color}</p>}
                    {item.size && <p className="text-sm text-gray-500">Size: {item.size}</p>}
                  </div>
                  <p className="font-semibold text-primary">{formatPrice(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping address */}
          <div className="bg-white rounded-lg shadow-sm-blue p-6">
            <h2 className="font-bold text-lg mb-4">Địa chỉ giao hàng</h2>
            <p className="font-semibold">{order.shippingAddress?.fullName}</p>
            <p className="text-gray-600">{order.shippingAddress?.address}</p>
            <p className="text-gray-600">{order.shippingAddress?.phone}</p>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm-blue p-6">
            <h2 className="font-bold text-lg mb-4">Tóm tắt</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Tạm tính</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              {order.shippingFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Phí vận chuyển</span>
                  <span>{formatPrice(order.shippingFee)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Thanh toán</span>
                <span className="font-semibold">{order.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Trạng thái TT</span>
                <span className={order.paymentStatus === 'completed' ? 'text-green-600 font-semibold' : 'text-yellow-600 font-semibold'}>
                  {order.paymentStatus === 'completed' ? 'Đã thanh toán' : 'Chờ thanh toán'}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between font-bold text-lg">
                <span>Tổng cộng</span>
                <span className="text-primary">{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {['pending', 'confirmed'].includes(order.status) && (
            <button
              onClick={handleCancel}
              className="w-full px-6 py-3 border-2 border-red-500 text-red-500 rounded-lg font-semibold hover:bg-red-50 transition-all"
            >
              Hủy đơn hàng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}