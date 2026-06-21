import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@features/auth/hooks/useAuth';
import apiClient from '@features/shared/services/apiClient';

const TIER_META = {
  bronze:   { label: 'Đồng',      color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: '🥉' },
  silver:   { label: 'Bạc',       color: 'text-slate-600',   bg: 'bg-slate-100',  border: 'border-slate-300',   icon: '🥈' },
  gold:     { label: 'Vàng',      color: 'text-yellow-600',  bg: 'bg-yellow-50',  border: 'border-yellow-300',  icon: '🥇' },
  platinum: { label: 'Kim Cương', color: 'text-sky-600',     bg: 'bg-sky-50',     border: 'border-sky-300',     icon: '💎' },
};

const fmt = v => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v ?? 0);

function TierBadge({ tier }) {
  const m = TIER_META[tier?.toLowerCase()] || TIER_META.bronze;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${m.bg} ${m.color} ${m.border}`}>
      {m.icon} {m.label}
    </span>
  );
}

function RewardCard({ reward, onRedeem, loading }) {
  const canRedeem = reward.canRedeem;
  const discountLabel = reward.discountType === 'percentage'
    ? `Giảm ${reward.discountValue}%${reward.maxDiscountAmount ? ` (tối đa ${fmt(reward.maxDiscountAmount)})` : ''}`
    : `Giảm ${fmt(reward.discountValue)}`;
  const tierMeta = TIER_META[reward.requiredTier] || TIER_META.bronze;

  return (
    <div className={`rounded-2xl border-2 p-5 flex flex-col gap-3 transition-all ${canRedeem ? 'border-blue-200 bg-white shadow-sm hover:shadow-md' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900">{reward.name}</p>
          {reward.description && <p className="text-xs text-slate-500 mt-0.5">{reward.description}</p>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${tierMeta.bg} ${tierMeta.color} ${tierMeta.border} whitespace-nowrap`}>
          {tierMeta.icon} {tierMeta.label}+
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-emerald-700 font-semibold bg-emerald-50 px-3 py-2 rounded-xl">
        🎁 {discountLabel}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Hiệu lực: {reward.voucherValidDays} ngày sau đổi</span>
        {reward.minPurchaseAmount > 0 && <span>Đơn tối thiểu: {fmt(reward.minPurchaseAmount)}</span>}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1">
          <span className="text-lg font-extrabold text-blue-600">{reward.pointsRequired.toLocaleString()}</span>
          <span className="text-xs text-slate-500 font-medium">điểm</span>
        </div>
        <button
          disabled={!canRedeem || loading}
          onClick={() => onRedeem(reward)}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            canRedeem
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {loading ? '...' : canRedeem ? 'Đổi ngay' : 'Không đủ điều kiện'}
        </button>
      </div>
    </div>
  );
}

function ConfirmModal({ reward, userPoints, onConfirm, onCancel, loading }) {
  if (!reward) return null;
  const remaining = userPoints - reward.pointsRequired;
  const discountLabel = reward.discountType === 'percentage'
    ? `Giảm ${reward.discountValue}%`
    : `Giảm ${fmt(reward.discountValue)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="text-center">
          <div className="text-5xl mb-3">🎁</div>
          <h3 className="text-lg font-extrabold text-slate-900">Xác nhận đổi điểm</h3>
          <p className="text-sm text-slate-500 mt-1">Kiểm tra lại thông tin trước khi đổi</p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Phần thưởng</span><span className="font-semibold text-slate-800">{reward.name}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Ưu đãi nhận được</span><span className="font-semibold text-emerald-600">{discountLabel}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Hiệu lực</span><span className="font-semibold text-slate-800">{reward.voucherValidDays} ngày</span></div>
          <hr className="border-slate-200" />
          <div className="flex justify-between"><span className="text-slate-500">Điểm sử dụng</span><span className="font-bold text-red-500">−{reward.pointsRequired.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Điểm còn lại</span><span className="font-bold text-blue-600">{remaining.toLocaleString()}</span></div>
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Huỷ
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
            {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Đang xử lý...' : 'Xác nhận đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({ result, onClose, onViewVouchers }) {
  if (!result) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-5 text-center">
        <div className="text-6xl animate-bounce">🎉</div>
        <h3 className="text-xl font-extrabold text-slate-900">Đổi điểm thành công!</h3>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
          <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">Mã phiếu giảm giá của bạn</p>
          <p className="text-2xl font-extrabold text-blue-700 tracking-widest">{result.voucher?.code}</p>
        </div>

        <div className="text-sm text-slate-500 space-y-1">
          <p>Điểm đã dùng: <span className="font-bold text-red-500">−{result.pointsUsed?.toLocaleString()}</span></p>
          <p>Điểm còn lại: <span className="font-bold text-blue-600">{result.remainingPoints?.toLocaleString()}</span></p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { navigator.clipboard?.writeText(result.voucher?.code); }}
            className="flex-1 px-4 py-2.5 border border-blue-200 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-50">
            Sao chép mã
          </button>
          <button onClick={() => { onClose(); onViewVouchers(); }}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold">
            Xem voucher
          </button>
        </div>
      </div>
    </div>
  );
}

function VoucherCard({ voucher }) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const discountLabel = voucher.discountType === 'percentage'
    ? `Giảm ${voucher.discountValue}%${voucher.maxDiscountAmount ? ` (tối đa ${fmt(voucher.maxDiscountAmount)})` : ''}`
    : `Giảm ${fmt(voucher.discountValue)}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(voucher.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  let statusEl;
  if (voucher.isUsed) {
    statusEl = <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">Đã dùng</span>;
  } else if (voucher.isExpired) {
    statusEl = <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-400 border border-red-100">Hết hạn</span>;
  } else {
    statusEl = <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">Còn hạn</span>;
  }

  const isActive = voucher.isValid;

  return (
    <div className={`rounded-2xl border-2 p-4 flex flex-col gap-3 transition-all ${
      isActive ? 'border-blue-200 bg-white shadow-sm' : 'border-slate-100 bg-slate-50 opacity-60'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] text-slate-400 font-medium">{voucher.description}</p>
          <p className="text-lg font-black text-blue-700 tracking-widest font-mono mt-0.5">{voucher.code}</p>
        </div>
        {statusEl}
      </div>

      <div className="flex items-center gap-2 text-sm text-emerald-700 font-semibold bg-emerald-50 px-3 py-2 rounded-xl">
        🎁 {discountLabel}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>HSD: {new Date(voucher.endDate).toLocaleDateString('vi-VN')}</span>
        {voucher.minPurchaseAmount > 0 && <span>Đơn tối thiểu: {fmt(voucher.minPurchaseAmount)}</span>}
      </div>

      {isActive && (
        <div className="flex gap-2 pt-1 border-t border-slate-100">
          <button onClick={handleCopy}
            className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              copied ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {copied ? '✓ Đã sao chép' : '📋 Sao chép mã'}
          </button>
          <button
            onClick={() => navigate('/checkout')}
            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all">
            Dùng ngay →
          </button>
        </div>
      )}
    </div>
  );
}

export default function LoyaltyPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [activeTab,   setActiveTab]   = useState('redeem');
  const [loyalty,     setLoyalty]     = useState(null);
  const [rewards,     setRewards]     = useState([]);
  const [myVouchers,  setMyVouchers]  = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [confirmReward, setConfirmReward] = useState(null);
  const [redeeming, setRedeeming] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { navigate('/auth/login', { state: { from: '/loyalty' } }); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoadingPage(true);
    try {
      const [loyaltyRes, rewardsRes, vouchersRes] = await Promise.all([
        apiClient.get('/loyalty/me'),
        apiClient.get('/loyalty/rewards'),
        apiClient.get('/loyalty/my-vouchers'),
      ]);
      setLoyalty(loyaltyRes.data.data);
      setRewards(rewardsRes.data.data || []);
      setMyVouchers(vouchersRes.data.data || []);
    } catch {
      setError('Không tải được dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoadingPage(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmReward) return;
    setRedeeming(true);
    setError('');
    try {
      const res = await apiClient.post('/loyalty/redeem', { rewardId: confirmReward._id });
      setSuccessResult(res.data.data);
      setConfirmReward(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Đổi điểm thất bại. Vui lòng thử lại.');
      setConfirmReward(null);
    } finally {
      setRedeeming(false);
    }
  };

  const spendable = loyalty?.spendable_points ?? 0;
  const tierName  = (loyalty?.tier_name || 'bronze').toLowerCase();
  const tierMeta  = TIER_META[tierName] || TIER_META.bronze;

  if (loadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const availableRewards = rewards.filter(r => r.canRedeem);
  const lockedRewards    = rewards.filter(r => !r.canRedeem);
  const validVouchers    = myVouchers.filter(v => v.isValid);
  const usedVouchers     = myVouchers.filter(v => !v.isValid);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500">←</button>
          <h1 className="text-lg font-bold text-slate-900">Điểm thưởng & Ưu đãi</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3">{error}</div>
        )}

        {/* Thẻ điểm */}
        <div className={`rounded-3xl p-6 border-2 ${tierMeta.border} ${tierMeta.bg} space-y-4`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Hạng thành viên</p>
              <TierBadge tier={tierName} />
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Điểm khả dụng</p>
              <p className={`text-3xl font-extrabold ${tierMeta.color}`}>{spendable.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-0.5">điểm</p>
            </div>
          </div>

          {loyalty?.tier_min_points > 0 && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Điểm tích lũy: {(loyalty.tier_points || 0).toLocaleString()}</span>
                <span>Hạng tiếp: {loyalty.tier_min_points.toLocaleString()}</span>
              </div>
              <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${tierMeta.color.replace('text-', 'bg-')}`}
                  style={{ width: `${Math.min(100, ((loyalty.tier_points || 0) / loyalty.tier_min_points) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('redeem')}
            className={`flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'redeem' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ⭐ Đổi điểm
          </button>
          <button
            onClick={() => setActiveTab('myvouchers')}
            className={`flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-all relative ${
              activeTab === 'myvouchers' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            🎫 Voucher của tôi
            {validVouchers.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {validVouchers.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab: Đổi điểm */}
        {activeTab === 'redeem' && (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-sm text-blue-700">
              💡 Mỗi <span className="font-bold">1.000đ</span> mua hàng = <span className="font-bold">1 điểm</span>. Dùng điểm để đổi phiếu giảm giá ngay bên dưới.
            </div>

            {availableRewards.length > 0 && (
              <section>
                <h2 className="text-base font-bold text-slate-800 mb-3">✅ Có thể đổi ngay ({availableRewards.length})</h2>
                <div className="space-y-3">
                  {availableRewards.map(r => (
                    <RewardCard key={r._id} reward={r} onRedeem={setConfirmReward} loading={redeeming} />
                  ))}
                </div>
              </section>
            )}

            {lockedRewards.length > 0 && (
              <section>
                <h2 className="text-base font-bold text-slate-800 mb-3">🔒 Chưa đủ điều kiện ({lockedRewards.length})</h2>
                <div className="space-y-3">
                  {lockedRewards.map(r => (
                    <RewardCard key={r._id} reward={r} onRedeem={() => {}} loading={false} />
                  ))}
                </div>
              </section>
            )}

            {rewards.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <div className="text-5xl mb-3">🎁</div>
                <p className="font-semibold text-slate-600">Chưa có phần thưởng nào</p>
                <p className="text-sm mt-1">Admin chưa thêm phần thưởng vào hệ thống</p>
              </div>
            )}
          </>
        )}

        {/* Tab: Voucher của tôi */}
        {activeTab === 'myvouchers' && (
          <>
            {myVouchers.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="text-5xl mb-3">🎫</div>
                <p className="font-semibold text-slate-600">Chưa có voucher nào</p>
                <p className="text-sm mt-1">Đổi điểm để nhận voucher giảm giá</p>
                <button
                  onClick={() => setActiveTab('redeem')}
                  className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
                  Đổi điểm ngay
                </button>
              </div>
            ) : (
              <>
                {validVouchers.length > 0 && (
                  <section>
                    <h2 className="text-base font-bold text-slate-800 mb-3">✅ Còn hiệu lực ({validVouchers.length})</h2>
                    <div className="space-y-3">
                      {validVouchers.map(v => <VoucherCard key={v._id} voucher={v} />)}
                    </div>
                  </section>
                )}
                {usedVouchers.length > 0 && (
                  <section>
                    <h2 className="text-base font-bold text-slate-800 mb-3">📋 Đã dùng / Hết hạn ({usedVouchers.length})</h2>
                    <div className="space-y-3">
                      {usedVouchers.map(v => <VoucherCard key={v._id} voucher={v} />)}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        reward={confirmReward}
        userPoints={spendable}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmReward(null)}
        loading={redeeming}
      />

      <SuccessModal
        result={successResult}
        onClose={() => setSuccessResult(null)}
        onViewVouchers={() => setActiveTab('myvouchers')}
      />
    </div>
  );
}
