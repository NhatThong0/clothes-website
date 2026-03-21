import { useState, useEffect, useCallback } from 'react';
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

// ── GHN Dropdown component ────────────────────────────────────────────────────
function GHNAddressDropdowns({ value, onChange }) {
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards,     setWards]     = useState([]);
  const [loadingP,  setLoadingP]  = useState(false);
  const [loadingD,  setLoadingD]  = useState(false);
  const [loadingW,  setLoadingW]  = useState(false);

  // Load tỉnh/thành lần đầu
  useEffect(() => {
    setLoadingP(true);
    apiClient.get('/shipping/provinces')
      .then(res => setProvinces(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoadingP(false));
  }, []);

  // Load quận/huyện khi chọn tỉnh
  useEffect(() => {
    if (!value.provinceId) { setDistricts([]); setWards([]); return; }
    setLoadingD(true);
    setDistricts([]); setWards([]);
    apiClient.get(`/shipping/districts?province_id=${value.provinceId}`)
      .then(res => setDistricts(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoadingD(false));
  }, [value.provinceId]);

  // Load phường/xã khi chọn huyện
  useEffect(() => {
    if (!value.districtId) { setWards([]); return; }
    setLoadingW(true);
    setWards([]);
    apiClient.get(`/shipping/wards?district_id=${value.districtId}`)
      .then(res => setWards(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoadingW(false));
  }, [value.districtId]);

  const handleProvince = (e) => {
    const id   = e.target.value;
    const name = provinces.find(p => String(p.ProvinceID) === id)?.ProvinceName || '';
    onChange({ provinceId: id, provinceName: name, districtId: '', districtName: '', wardCode: '', wardName: '' });
  };

  const handleDistrict = (e) => {
    const id   = e.target.value;
    const name = districts.find(d => String(d.DistrictID) === id)?.DistrictName || '';
    onChange({ ...value, districtId: id, districtName: name, wardCode: '', wardName: '' });
  };

  const handleWard = (e) => {
    const code = e.target.value;
    const name = wards.find(w => w.WardCode === code)?.WardName || '';
    onChange({ ...value, wardCode: code, wardName: name });
  };

  const selectCls = `${inputCls} disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Tỉnh/Thành */}
      <div>
        <Label required>Tỉnh / Thành phố</Label>
        <div className="relative">
          <select value={value.provinceId} onChange={handleProvince}
            disabled={loadingP} className={selectCls} required>
            <option value="">{loadingP ? 'Đang tải...' : 'Chọn tỉnh/thành'}</option>
            {provinces.map(p => (
              <option key={p.ProvinceID} value={p.ProvinceID}>{p.ProvinceName}</option>
            ))}
          </select>
          {loadingP && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>}
        </div>
      </div>

      {/* Quận/Huyện */}
      <div>
        <Label required>Quận / Huyện</Label>
        <div className="relative">
          <select value={value.districtId} onChange={handleDistrict}
            disabled={!value.provinceId || loadingD} className={selectCls} required>
            <option value="">{loadingD ? 'Đang tải...' : 'Chọn quận/huyện'}</option>
            {districts.map(d => (
              <option key={d.DistrictID} value={d.DistrictID}>{d.DistrictName}</option>
            ))}
          </select>
          {loadingD && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>}
        </div>
      </div>

      {/* Phường/Xã */}
      <div>
        <Label required>Phường / Xã</Label>
        <div className="relative">
          <select value={value.wardCode} onChange={handleWard}
            disabled={!value.districtId || loadingW} className={selectCls} required>
            <option value="">{loadingW ? 'Đang tải...' : 'Chọn phường/xã'}</option>
            {wards.map(w => (
              <option key={w.WardCode} value={w.WardCode}>{w.WardName}</option>
            ))}
          </select>
          {loadingW && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>}
        </div>
      </div>
    </div>
  );
}

// ── Shipping fee display ──────────────────────────────────────────────────────
function ShippingFeeRow({ fee, loading, error }) {
  if (loading) return (
    <div className="flex justify-between text-sm text-slate-600">
      <span>Phí vận chuyển</span>
      <span className="flex items-center gap-1.5 text-slate-400">
        <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"/>
        Đang tính...
      </span>
    </div>
  );
  if (error) return (
    <div className="flex justify-between text-sm text-slate-600">
      <span>Phí vận chuyển</span>
      <span className="text-slate-400 text-xs italic">Chọn địa chỉ để tính phí</span>
    </div>
  );
  return (
    <div className="flex justify-between text-sm text-slate-600">
      <div className="flex items-center gap-2">
        <span>Phí vận chuyển</span>
        <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">GHN Express</span>
      </div>
      <span className={`font-semibold ${fee === 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
        {fee === 0 ? 'Miễn phí' : formatPrice(fee)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cartItems, removeFromCart } = useCart();
  const { user } = useAuth();

  const [loading,     setLoading]     = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState(null);
  const [useManual,      setUseManual]       = useState(false);

  // GHN address state
  const [ghnAddr, setGhnAddr] = useState({
    provinceId: '', provinceName: '',
    districtId: '', districtName: '',
    wardCode:   '', wardName:     '',
  });

  // Shipping fee state
  const [shippingFee,        setShippingFee]        = useState(0);
  const [shippingFeeLoading, setShippingFeeLoading] = useState(false);
  const [shippingFeeError,   setShippingFeeError]   = useState(true);
  const [expectedTime,       setExpectedTime]        = useState(null);

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
  const total          = subtotal + shippingFee - discountAmount;

  // Load saved addresses
  useEffect(() => {
    const load = async () => {
      try {
        const res  = await apiClient.get('/addresses');
        const data = res.data?.data || [];
        setSavedAddresses(Array.isArray(data) ? data : []);
        const def = data.find(a => a.isDefault) || data[0];
        if (def) { setSelectedAddrId(def._id); setUseManual(false); }
        else      { setUseManual(true); }
      } catch { setUseManual(true); }
    };
    load();
  }, []);

  // Fill form from saved address (text fields only, GHN IDs need separate handling)
  useEffect(() => {
    if (!useManual && selectedAddrId) {
      const addr = savedAddresses.find(a => a._id === selectedAddrId);
      if (addr) {
        setFormData(f => ({
          ...f,
          fullName: addr.fullName || '',
          phone:    addr.phone    || '',
          address:  addr.address  || addr.street || '',
        }));
        // Nếu địa chỉ lưu có GHN IDs thì tự điền
        if (addr.ghnDistrictId && addr.ghnWardCode) {
          setGhnAddr({
            provinceId:   String(addr.ghnProvinceId  || ''),
            provinceName: addr.provinceName           || addr.province || '',
            districtId:   String(addr.ghnDistrictId),
            districtName: addr.districtName           || addr.district || '',
            wardCode:     addr.ghnWardCode,
            wardName:     addr.wardName               || addr.ward     || '',
          });
        }
      }
    }
  }, [selectedAddrId, useManual, savedAddresses]);

  // Tự động tính phí ship khi chọn đủ quận + phường
  useEffect(() => {
    if (!ghnAddr.districtId || !ghnAddr.wardCode) {
      setShippingFeeError(true);
      setShippingFee(0);
      setExpectedTime(null);
      return;
    }
    const calcFee = async () => {
      setShippingFeeLoading(true);
      setShippingFeeError(false);
      try {
        // Tính tổng trọng lượng ước tính (500g/sản phẩm)
        const totalWeight = checkoutItems.reduce((sum, i) => sum + (i.weight || 500) * i.quantity, 0);
        const res = await apiClient.post('/shipping/fee', {
          to_district_id:  Number(ghnAddr.districtId),
          to_ward_code:    ghnAddr.wardCode,
          weight:          Math.max(totalWeight, 100),
          insurance_value: subtotal,
        });
        setShippingFee(res.data.data.total);
        setExpectedTime(res.data.data.expected_time);
      } catch (err) {
        console.error('[Shipping fee]', err);
        setShippingFeeError(true);
        setShippingFee(0);
      } finally {
        setShippingFeeLoading(false);
      }
    };
    calcFee();
  }, [ghnAddr.districtId, ghnAddr.wardCode]);

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

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault();
    if (!ghnAddr.districtId || !ghnAddr.wardCode) {
      alert('Vui lòng chọn đầy đủ Quận/Huyện và Phường/Xã để tính phí vận chuyển');
      return;
    }
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
        fullName:       formData.fullName,
        email:          formData.email,
        phone:          formData.phone,
        address:        formData.address,
        province:       ghnAddr.provinceName,
        district:       ghnAddr.districtName,
        ward:           ghnAddr.wardName,
        // Lưu GHN IDs để dùng sau (tạo vận đơn)
        ghnProvinceId:  ghnAddr.provinceId,
        ghnDistrictId:  ghnAddr.districtId,
        ghnWardCode:    ghnAddr.wardCode,
      };

      const orderRes = await apiClient.post('/orders', {
        items, shippingAddress,
        paymentMethod:  formData.paymentMethod,
        subtotal,
        shippingFee,
        total,
        notes:          formData.notes,
        voucherCode:    appliedVoucher?.code || undefined,
        discountAmount,
      });
      const createdOrder = orderRes.data.data;

      await Promise.allSettled(
        checkoutItems.map(item =>
          removeFromCart(item._id || item.id, item.color || '', item.size || '')
        )
      );
      sessionStorage.removeItem('checkoutItems');

      if (formData.paymentMethod === 'vnpay') {
        const payRes     = await apiClient.post('/payment/vnpay-create', { orderId: createdOrder._id });
        const paymentUrl = payRes.data?.data?.paymentUrl;
        if (!paymentUrl) throw new Error('Không nhận được paymentUrl từ server');
        window.location.href = paymentUrl;
        return;
      }

      setOrderPlaced(true);
      setTimeout(() => navigate(`/orders/${createdOrder._id}`), 2500);
    } catch (err) {
      alert('Lỗi khi tạo đơn hàng: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // ── Guards ──────────────────────────────────────────────────────────────────
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

            {/* ── LEFT ───────────────────────────────────────────────────── */}
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
                              {[addr.address || addr.street, addr.ward, addr.district, addr.province || addr.city].filter(Boolean).join(', ')}
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
                  </div>
                )}

                <div className="space-y-4 pt-2">
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
                    <div><Label required>Số nhà, tên đường</Label>
                      <input name="address" type="text" required value={formData.address} onChange={handleChange} placeholder="123 Đường ABC" className={inputCls}/></div>
                  </div>

                  {/* GHN Dropdowns */}
                  <GHNAddressDropdowns value={ghnAddr} onChange={setGhnAddr} />

                  {/* Shipping fee preview */}
                  {(ghnAddr.districtId || shippingFeeLoading) && (
                    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm ${
                      shippingFeeError ? 'bg-slate-50 border-slate-200' :
                      shippingFee === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span>🚚</span>
                        <span className="font-medium text-slate-700">Phí vận chuyển GHN</span>
                      </div>
                      {shippingFeeLoading
                        ? <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"/>
                            Đang tính...
                          </div>
                        : shippingFeeError
                          ? <span className="text-slate-400 text-xs">Chọn phường/xã để tính phí</span>
                          : <div className="text-right">
                              <span className={`font-bold ${shippingFee === 0 ? 'text-emerald-600' : 'text-blue-700'}`}>
                                {shippingFee === 0 ? 'Miễn phí' : formatPrice(shippingFee)}
                              </span>
                              {expectedTime && (
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  Dự kiến: {new Date(expectedTime).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                </p>
                              )}
                            </div>
                      }
                    </div>
                  )}
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
                  {PAYMENT_METHODS.map(method => (
                    <label key={method.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      formData.paymentMethod === method.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300 bg-white'
                    }`}>
                      <input type="radio" name="paymentMethod" value={method.id}
                        checked={formData.paymentMethod === method.id} onChange={handleChange} className="sr-only"/>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        formData.paymentMethod === method.id ? 'border-blue-500' : 'border-slate-300'
                      }`}>
                        {formData.paymentMethod === method.id && <div className="w-2 h-2 rounded-full bg-blue-500"/>}
                      </div>
                      <span className="text-xl">{method.icon}</span>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${formData.paymentMethod === method.id ? 'text-blue-700' : 'text-slate-700'}`}>{method.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{method.desc}</p>
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

            {/* ── RIGHT: summary ──────────────────────────────────────────── */}
            <div className="lg:col-span-1">
              <div className="sticky top-20 space-y-4">
                {/* Items */}
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

                {/* Totals */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Tạm tính</span>
                    <span className="font-semibold text-slate-800">{formatPrice(subtotal)}</span>
                  </div>

                  {/* Phí ship */}
                  <ShippingFeeRow
                    fee={shippingFee}
                    loading={shippingFeeLoading}
                    error={shippingFeeError}
                  />

                  {appliedVoucher && discountAmount > 0 && (
                    <div className="flex justify-between text-sm items-center">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-emerald-600">🏷️ Mã giảm giá</span>
                        <span className="text-[11px] font-mono font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md">{appliedVoucher.code}</span>
                      </div>
                      <span className="font-bold text-emerald-600 flex-shrink-0">− {formatPrice(discountAmount)}</span>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">Tổng cộng</span>
                      <div className="text-right">
                        {(appliedVoucher && discountAmount > 0) && (
                          <p className="text-xs text-slate-400 line-through">{formatPrice(subtotal + shippingFee)}</p>
                        )}
                        <span className="text-xl font-black text-blue-600">{formatPrice(total)}</span>
                      </div>
                    </div>
                  </div>

                  {!shippingFeeError && shippingFee > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2.5">
                      <span>🚚</span>
                      <span>Giao bởi GHN Express
                        {expectedTime && ` · Dự kiến ${new Date(expectedTime).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`}
                      </span>
                    </div>
                  )}
                </div>

                <button type="submit" disabled={loading || shippingFeeLoading}
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