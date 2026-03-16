import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '@hooks/useCart';
import { useAuth } from '@hooks/useAuth';
import { formatPrice } from '@utils/helpers';
import apiClient from '@services/apiClient';

const inputCls =
  'w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition placeholder:text-slate-400';

function Label({ children, required }) {
  return (
    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
      {children}{required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
  );
}

function SectionCard({ title, icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
      <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h2>
      {children}
    </div>
  );
}

// ✅ Chỉ COD và VNPay
const PAYMENT_METHODS = [
  { id: 'cod',   label: 'Thanh toán khi nhận hàng', icon: '💵', desc: 'Trả tiền mặt khi nhận hàng' },
  { id: 'vnpay', label: 'VNPay',                    icon: '🏦', desc: 'Thanh toán qua VNPay (ATM, QR, Ví VNPay)' },
];

function DiscountTypeBadge({ voucher }) {
  if (!voucher) return null;
  const isPercent = voucher.discountType === 'percentage';
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
      isPercent ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-violet-50 text-violet-600 border-violet-200'
    }`}>
      {isPercent
        ? `Giảm ${voucher.discountValue}%${voucher.maxDiscountAmount ? ` (tối đa ${formatPrice(voucher.maxDiscountAmount)})` : ''}`
        : `Giảm ${formatPrice(voucher.discountValue)}`}
    </span>
  );
}

const ADDR_ICON = { 'Nhà riêng': '🏠', 'Văn phòng': '🏢', 'Khác': '📍' };

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cartItems, removeFromCart } = useCart();
  const { user } = useAuth();

  const [loading,     setLoading]     = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState(null);
  const [useManual,      setUseManual]       = useState(false);

  const [voucherCode,    setVoucherCode]    = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherError,   setVoucherError]   = useState('');
  const [voucherSuccess, setVoucherSuccess] = useState('');

  const [formData, setFormData] = useState({
    fullName:      user?.name  || '',
    email:         user?.email || '',
    phone:         user?.phone || '',
    address:       '',
    city:          '',
    district:      '',
    ward:          '',
    notes:         '',
    paymentMethod: 'cod',
  });

  const checkoutItems = (() => {
    try {
      const saved = sessionStorage.getItem('checkoutItems');
      return saved ? JSON.parse(saved) : cartItems;
    } catch { return cartItems; }
  })();

  const subtotal = checkoutItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const calcDiscount = (voucher, sub) => {
    if (!voucher) return 0;
    let d = voucher.discountType === 'percentage'
      ? (sub * voucher.discountValue) / 100
      : Number(voucher.discountValue);
    if (voucher.maxDiscountAmount) d = Math.min(d, Number(voucher.maxDiscountAmount));
    return Math.min(d, sub);
  };

  const discountAmount = calcDiscount(appliedVoucher, subtotal);
  const total          = subtotal - discountAmount;

  useEffect(() => {
    const load = async () => {
      try {
        const res  = await apiClient.get('/user/addresses');
        const data = res.data?.data || [];
        setSavedAddresses(Array.isArray(data) ? data : []);
        const def = data.find(a => a.isDefault) || data[0];
        if (def) { setSelectedAddrId(def._id); setUseManual(false); }
        else      { setUseManual(true); }
      } catch { setUseManual(true); }
    };
    load();
  }, []);

  useEffect(() => {
    if (!useManual && selectedAddrId) {
      const addr = savedAddresses.find(a => a._id === selectedAddrId);
      if (addr) setFormData(f => ({
        ...f,
        fullName: addr.fullName, phone: addr.phone,
        address:  addr.address,  ward:  addr.ward     || '',
        district: addr.district || '',  city: addr.city,
      }));
    }
  }, [selectedAddrId, useManual, savedAddresses]);

  const handleChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleApplyVoucher = async () => {
    const code = voucherCode.trim().toUpperCase();
    if (!code) return;
    setVoucherError(''); setVoucherSuccess(''); setVoucherLoading(true);
    try {
      const res     = await apiClient.post('/promotions/validate', { code, orderAmount: subtotal, itemCount: checkoutItems.length });
      const voucher = res.data?.data;
      setAppliedVoucher(voucher);
      setVoucherSuccess(`Tiết kiệm ${formatPrice(calcDiscount(voucher, subtotal))}!`);
    } catch (err) {
      setAppliedVoucher(null);
      setVoucherError(err.response?.data?.message || 'Mã không hợp lệ hoặc đã hết hạn.');
    } finally { setVoucherLoading(false); }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null); setVoucherCode('');
    setVoucherError('');     setVoucherSuccess('');
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const items = checkoutItems.map(item => ({
        productId: item._id || item.id,
        name:      item.name,
        quantity:  item.quantity,
        price:     item.discountedPrice || item.price,
        color:     item.color || '',
        size:      item.size  || '',
        discount:  0,
      }));

      const shippingAddress = {
        fullName: formData.fullName,
        email:    formData.email,
        phone:    formData.phone,
        address:  [formData.address, formData.ward, formData.district, formData.city].filter(Boolean).join(', '),
        city:     formData.city,
        district: formData.district,
        ward:     formData.ward,
      };

      // Bước 1: Tạo đơn hàng
      const orderRes     = await apiClient.post('/orders', {
        items,
        shippingAddress,
        paymentMethod:  formData.paymentMethod,
        subtotal,
        total,
        notes:          formData.notes,
        voucherCode:    appliedVoucher?.code || undefined,
        discountAmount: discountAmount,
      });
      const createdOrder = orderRes.data.data;

      // Xoá giỏ hàng
      checkoutItems.forEach(item => removeFromCart(item.id));
      sessionStorage.removeItem('checkoutItems');

      // Bước 2: Xử lý theo phương thức thanh toán
      if (formData.paymentMethod === 'vnpay') {
        // ✅ Gọi API tạo URL VNPay → redirect sang trang thanh toán VNPay
        const payRes     = await apiClient.post('/payment/vnpay-create', { orderId: createdOrder._id });
        const paymentUrl = payRes.data?.data?.paymentUrl;
        if (!paymentUrl) throw new Error('Không nhận được paymentUrl từ server');
        window.location.href = paymentUrl; // rời khỏi SPA → sang VNPay sandbox
        return;
      }

      // COD: hiện màn hình thành công
      setOrderPlaced(true);
      setTimeout(() => navigate(`/orders/${createdOrder._id}`), 2500);
    } catch (err) {
      alert('Lỗi khi tạo đơn hàng: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (cartItems.length === 0 && !orderPlaced) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-slate-400">
        <span className="text-6xl">🛒</span>
        <p className="text-lg font-semibold text-slate-600">Giỏ hàng trống</p>
        <Link to="/products" className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
          Tiếp tục mua sắm
        </Link>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-10 max-w-sm w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Đặt hàng thành công!</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-4">Đơn hàng đã được xác nhận. Chúng tôi sẽ liên hệ bạn sớm nhất.</p>
          <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
            Đang chuyển hướng...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4 md:px-6">

        <div className="flex items-center gap-2 text-xs text-slate-400 mb-6">
          <Link to="/" className="hover:text-blue-600 transition-colors">Trang chủ</Link>
          <span>/</span>
          <Link to="/cart" className="hover:text-blue-600 transition-colors">Giỏ hàng</Link>
          <span>/</span>
          <span className="text-slate-700 font-semibold">Thanh toán</span>
        </div>

        <h1 className="text-2xl font-black text-slate-900 mb-6">Thanh toán</h1>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEFT */}
            <div className="lg:col-span-2 space-y-4">

              {/* Địa chỉ */}
              <SectionCard title="Địa chỉ giao hàng" icon="📦">
                {savedAddresses.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Địa chỉ đã lưu</p>
                    <div className="space-y-2">
                      {savedAddresses.map(addr => (
                        <label key={addr._id} className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                          !useManual && selectedAddrId === addr._id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                        }`}>
                          <input type="radio" name="savedAddr" className="mt-0.5 accent-blue-600"
                            checked={!useManual && selectedAddrId === addr._id}
                            onChange={() => { setSelectedAddrId(addr._id); setUseManual(false); }}/>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-500">{ADDR_ICON[addr.label]} {addr.label}</span>
                              {addr.isDefault && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full">Mặc định</span>}
                            </div>
                            <p className="text-sm font-semibold text-slate-800 mt-0.5">{addr.fullName} · {addr.phone}</p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              {[addr.address, addr.ward, addr.district, addr.city].filter(Boolean).join(', ')}
                            </p>
                          </div>
                        </label>
                      ))}
                      <label className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                        useManual ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                      }`}>
                        <input type="radio" name="savedAddr" className="accent-blue-600"
                          checked={useManual} onChange={() => setUseManual(true)}/>
                        <span className="text-sm font-semibold text-slate-700">✏️ Nhập địa chỉ mới</span>
                      </label>
                    </div>
                    <a href="/profile" target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-1 transition-colors">
                      ⚙️ Quản lý địa chỉ →
                    </a>
                  </div>
                )}
                <div className={`pt-2 space-y-4 ${!useManual && savedAddresses.length > 0 ? 'opacity-70' : ''}`}>
                  {!useManual && savedAddresses.length > 0 && (
                    <p className="text-xs text-slate-400 italic">Thông tin tự động điền từ địa chỉ đã chọn.</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label required>Họ và tên</Label>
                      <input name="fullName" type="text" required value={formData.fullName} onChange={handleChange} placeholder="Nguyễn Văn A" className={inputCls}/></div>
                    <div><Label required>Email</Label>
                      <input name="email" type="email" required value={formData.email} onChange={handleChange} placeholder="example@email.com" className={inputCls}/></div>
                    <div><Label required>Số điện thoại</Label>
                      <input name="phone" type="tel" required value={formData.phone} onChange={handleChange} placeholder="0901 234 567" className={inputCls}/></div>
                    <div><Label required>Địa chỉ</Label>
                      <input name="address" type="text" required value={formData.address} onChange={handleChange} placeholder="Số nhà, tên đường" className={inputCls}/></div>
                    <div><Label required>Tỉnh / Thành phố</Label>
                      <input name="city" type="text" required value={formData.city} onChange={handleChange} placeholder="TP. Hồ Chí Minh" className={inputCls}/></div>
                    <div><Label>Quận / Huyện</Label>
                      <input name="district" type="text" value={formData.district} onChange={handleChange} placeholder="Quận 1" className={inputCls}/></div>
                    <div className="sm:col-span-2"><Label>Phường / Xã</Label>
                      <input name="ward" type="text" value={formData.ward} onChange={handleChange} placeholder="Phường Bến Nghé" className={inputCls}/></div>
                  </div>
                </div>
              </SectionCard>

              {/* Voucher */}
              <SectionCard title="Mã giảm giá" icon="🏷️">
                {appliedVoucher ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-xl flex-shrink-0">🎉</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-emerald-800 font-mono tracking-widest text-sm">{appliedVoucher.code}</p>
                            <DiscountTypeBadge voucher={appliedVoucher}/>
                          </div>
                          <p className="text-xs text-emerald-600 mt-0.5 font-medium">{voucherSuccess}</p>
                        </div>
                      </div>
                      <button type="button" onClick={handleRemoveVoucher}
                        className="p-2 hover:bg-rose-50 rounded-xl transition-colors text-emerald-400 hover:text-rose-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                      <span className="text-sm text-slate-600">Số tiền được giảm</span>
                      <span className="text-base font-black text-emerald-600">− {formatPrice(discountAmount)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-base select-none">🏷️</span>
                        <input type="text" value={voucherCode}
                          onChange={e => { setVoucherCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setVoucherError(''); }}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleApplyVoucher(); }}}
                          placeholder="Nhập mã giảm giá" maxLength={20}
                          className={`${inputCls} pl-10 font-mono tracking-[0.2em] uppercase ${voucherError ? 'border-rose-300' : ''}`}/>
                      </div>
                      <button type="button" onClick={handleApplyVoucher} disabled={voucherLoading || !voucherCode.trim()}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-2 min-w-[100px] justify-center">
                        {voucherLoading ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/> Kiểm tra</> : '→ Áp dụng'}
                      </button>
                    </div>
                    {voucherError && (
                      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-rose-50 border border-rose-200 rounded-xl">
                        <span className="text-rose-500">⚠️</span>
                        <p className="text-xs text-rose-600 font-medium">{voucherError}</p>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>

              {/* Thanh toán */}
              <SectionCard title="Phương thức thanh toán" icon="💳">
                <div className="space-y-2.5">
                  {PAYMENT_METHODS.map(m => (
                    <label key={m.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      formData.paymentMethod === m.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300 bg-white'
                    }`}>
                      <input type="radio" name="paymentMethod" value={m.id}
                        checked={formData.paymentMethod === m.id} onChange={handleChange} className="sr-only"/>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        formData.paymentMethod === m.id ? 'border-blue-500' : 'border-slate-300'
                      }`}>
                        {formData.paymentMethod === m.id && <div className="w-2 h-2 rounded-full bg-blue-500"/>}
                      </div>
                      <span className="text-xl">{m.icon}</span>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${formData.paymentMethod === m.id ? 'text-blue-700' : 'text-slate-700'}`}>{m.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{m.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </SectionCard>

              {/* Ghi chú */}
              <SectionCard title="Ghi chú đơn hàng" icon="📝">
                <div>
                  <Label>Ghi chú (tuỳ chọn)</Label>
                  <textarea name="notes" rows={3} value={formData.notes} onChange={handleChange}
                    placeholder="VD: Giao giờ hành chính, để hàng tại bảo vệ..."
                    className={`${inputCls} resize-none`}/>
                </div>
              </SectionCard>
            </div>

            {/* RIGHT: summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-20 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <h2 className="text-base font-bold text-slate-800 mb-4">
                    Đơn hàng <span className="text-slate-400 font-normal">({checkoutItems.length} sản phẩm)</span>
                  </h2>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                    {checkoutItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                          {item.image
                            ? <img src={item.image} alt={item.name} className="w-full h-full object-cover"/>
                            : <div className="w-full h-full flex items-center justify-center text-slate-300 text-lg">👕</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                          <p className="text-xs text-slate-400">x{item.quantity}</p>
                        </div>
                        <p className="text-sm font-bold text-slate-700 flex-shrink-0">{formatPrice(item.price * item.quantity)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Tạm tính</span>
                    <span className="font-semibold text-slate-800">{formatPrice(subtotal)}</span>
                  </div>
                  {appliedVoucher && discountAmount > 0 && (
                    <div className="flex justify-between text-sm items-center">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-emerald-600">🏷️ Mã giảm giá</span>
                        <span className="text-[11px] font-mono font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md">{appliedVoucher.code}</span>
                      </div>
                      <span className="font-bold text-emerald-600 flex-shrink-0">− {formatPrice(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Phí vận chuyển</span>
                    <span className="font-semibold text-emerald-600">Miễn phí</span>
                  </div>
                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">Tổng cộng</span>
                      <div className="text-right">
                        {appliedVoucher && discountAmount > 0 && (
                          <p className="text-xs text-slate-400 line-through">{formatPrice(subtotal)}</p>
                        )}
                        <span className="text-xl font-black text-blue-600">{formatPrice(total)}</span>
                      </div>
                    </div>
                  </div>
                  {appliedVoucher && discountAmount > 0 && (
                    <div className="flex items-center justify-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-xl py-2.5 text-xs font-bold text-emerald-700">
                      🎉 Bạn tiết kiệm {formatPrice(discountAmount)}
                    </div>
                  )}
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                        {formData.paymentMethod === 'vnpay' ? 'Đang chuyển đến VNPay...' : 'Đang xử lý...'}</>
                    : <><span>{formData.paymentMethod === 'vnpay' ? 'Thanh toán qua VNPay' : 'Đặt hàng ngay'}</span><span className="text-blue-200 text-lg">→</span></>}
                </button>

                <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                  <span>🔒</span> Thông tin được mã hóa an toàn SSL
                </p>
              </div>
            </div>

          </div>
        </form>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }
      `}</style>
    </div>
  );
}