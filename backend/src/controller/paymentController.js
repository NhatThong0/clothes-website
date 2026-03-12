const Order = require('../model/Order');
const { createPaymentUrl, verifyReturn } = require('../utils/vnpayHelper');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ── POST /api/payment/vnpay-create ───────────────────────────────────────────
exports.createVnpayPayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId)
            return res.status(400).json({ status: 'error', message: 'Thiếu orderId' });

        const order = await Order.findById(orderId);
        if (!order)
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng' });
        if (order.paymentStatus === 'completed')
            return res.status(400).json({ status: 'error', message: 'Đơn hàng đã được thanh toán' });

        const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1')
            .replace('::ffff:', '').replace('::1', '127.0.0.1').split(',')[0].trim();

        const { paymentUrl, txnRef } = createPaymentUrl({
            orderId:   order._id.toString(),
            amount:    order.total,
            orderInfo: `Thanh toan don hang ${order._id.toString().slice(-6).toUpperCase()}`,
            clientIp,
        });

        // Lưu txnRef gốc (trước khi encode) để tìm lại sau
        await Order.findByIdAndUpdate(orderId, { vnpayTxnRef: txnRef });
        res.json({ status: 'success', data: { paymentUrl } });
    } catch (e) {
        console.error('[VNPay] create error:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
};

// ── GET /api/payment/vnpay-return — VNPay redirect user về đây ───────────────
exports.vnpayReturn = async (req, res) => {
    try {
        console.log('[VNPay Return] query:', JSON.stringify(req.query));
        const { isValid, responseCode, txnRef } = verifyReturn(req.query);

        if (!isValid) {
            console.error('[VNPay Return] Chữ ký không hợp lệ');
            return res.redirect(`${CLIENT_URL}/payment-result?status=error&message=invalid_signature`);
        }

        // txnRef từ req.query là raw (Express đã decode) → tìm thẳng
        const order   = await Order.findOne({ vnpayTxnRef: txnRef });
        const orderId = order?._id?.toString() || '';

        if (responseCode === '00') {
            if (order) await Order.findByIdAndUpdate(order._id, { paymentStatus: 'completed' });
            return res.redirect(`${CLIENT_URL}/payment-result?status=success&orderId=${orderId}`);
        } else {
            if (order) await Order.findByIdAndUpdate(order._id, { paymentStatus: 'failed' });
            return res.redirect(`${CLIENT_URL}/payment-result?status=failed&orderId=${orderId}&code=${responseCode}`);
        }
    } catch (e) {
        console.error('[VNPay Return] error:', e.message);
        res.redirect(`${CLIENT_URL}/payment-result?status=error&message=${encodeURIComponent(e.message)}`);
    }
};

// ── GET /api/payment/vnpay-ipn — VNPay server gọi server-to-server ───────────
exports.vnpayIpn = async (req, res) => {
    try {
        const { isValid, responseCode, txnRef } = verifyReturn(req.query);
        if (!isValid) return res.json({ RspCode: '97', Message: 'Invalid signature' });

        const order = await Order.findOne({ vnpayTxnRef: txnRef });
        if (!order)  return res.json({ RspCode: '01', Message: 'Order not found' });

        const vnpAmount = Number(req.query.vnp_Amount) / 100;
        if (vnpAmount !== order.total)          return res.json({ RspCode: '04', Message: 'Invalid amount' });
        if (order.paymentStatus === 'completed') return res.json({ RspCode: '02', Message: 'Already confirmed' });

        if (responseCode === '00') {
            await Order.findByIdAndUpdate(order._id, { paymentStatus: 'completed' });
        } else {
            await Order.findByIdAndUpdate(order._id, { paymentStatus: 'failed' });
        }
        return res.json({ RspCode: '00', Message: 'Confirm Success' });
    } catch (e) {
        res.json({ RspCode: '99', Message: e.message });
    }
};