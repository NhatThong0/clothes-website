import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '@features/shared/services/apiClient';

const PAYOS_MESSAGES = {
    cancelled: 'Bạn đã hủy giao dịch.',
    failed:    'Thanh toán không thành công. Vui lòng thử lại.',
    CANCELLED: 'Bạn đã hủy giao dịch.',
};

export default function PaymentResultPage() {
    const [params]       = useSearchParams();
    const navigate       = useNavigate();
    const [retryLoading, setRetryLoading] = useState(false);

    const status    = params.get('status');
    const orderId   = params.get('orderId');
    const code      = params.get('code');
    const msg       = params.get('message');
    const isSuccess = status === 'success';

    useEffect(() => {
        if (isSuccess && orderId) {
            const t = setTimeout(() => navigate(`/orders/${orderId}`), 4000);
            return () => clearTimeout(t);
        }
    }, [isSuccess, orderId, navigate]);

    const handleRetry = async () => {
        if (!orderId) return;
        setRetryLoading(true);
        try {
            await apiClient.post(`/orders/${orderId}/retry-payment`);
            const payRes     = await apiClient.post('/payment/payos-create', { orderId });
            const paymentUrl = payRes.data?.data?.paymentUrl;
            if (!paymentUrl) throw new Error('Không nhận được URL thanh toán');
            window.location.href = paymentUrl;
        } catch (err) {
            alert(err.response?.data?.message || 'Không thể tạo lại thanh toán');
            setRetryLoading(false);
        }
    };

    const errorMsg = code
        ? (PAYOS_MESSAGES[code] || `Thanh toán không thành công (${code})`)
        : (msg ? decodeURIComponent(msg) : 'Thanh toán không thành công. Vui lòng thử lại.');

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-10 max-w-md w-full text-center"
                style={{ animation: 'fadeUp .45s ease' }}>

                {isSuccess ? (
                    <>
                        <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                            <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full mb-4">
                            <span className="text-xl">💳</span>
                            <span className="text-xs font-bold text-blue-700">PayOS</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">Thanh toán thành công!</h2>
                        <p className="text-slate-500 text-sm leading-relaxed mb-6">
                            Đơn hàng của bạn đã được xác nhận thanh toán qua PayOS.
                        </p>
                        {orderId && (
                            <p className="text-xs text-slate-400 font-mono bg-slate-50 rounded-xl px-4 py-2 mb-6">
                                Mã đơn: #{orderId.slice(-8).toUpperCase()}
                            </p>
                        )}
                        <div className="flex items-center justify-center gap-2 text-slate-400 text-xs mb-4">
                            <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                            Đang chuyển đến trang đơn hàng...
                        </div>
                        {orderId && (
                            <Link to={`/orders/${orderId}`} className="text-sm text-blue-600 hover:underline">
                                Xem ngay →
                            </Link>
                        )}
                    </>
                ) : (
                    <>
                        <div className="w-24 h-24 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-6">
                            <svg className="w-12 h-12 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">Thanh toán thất bại</h2>
                        <p className="text-slate-500 text-sm leading-relaxed mb-6">{errorMsg}</p>

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            {orderId && (
                                <button
                                    onClick={handleRetry}
                                    disabled={retryLoading}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 justify-center"
                                >
                                    {retryLoading
                                        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Đang xử lý...</>
                                        : '🔄 Thử lại thanh toán'
                                    }
                                </button>
                            )}
                            {orderId && (
                                <Link to={`/orders/${orderId}`}
                                    className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                                    Xem đơn hàng
                                </Link>
                            )}
                            <Link to="/"
                                className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                                Về trang chủ
                            </Link>
                        </div>
                    </>
                )}
            </div>
            <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
        </div>
    );
}
