const Order = require('../../model/Order');
const { createPaymentUrl, verifyReturn } = require('../../utils/vnpayHelper');
const { createPayosPayment, verifyWebhook } = require('../../utils/payosHelper');

const CLIENT_URL  = process.env.CLIENT_URL        || 'http://localhost:5173';
const NGROK_BASE  = process.env.PAYOS_NGROK_BASE  || 'http://localhost:5000';

// ─── VNPay ────────────────────────────────────────────────────────────────────

exports.createVnpayPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ status: 'error', message: 'Thieu orderId' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ status: 'error', message: 'Khong tim thay don hang' });
    if (order.paymentStatus === 'completed')
      return res.status(400).json({ status: 'error', message: 'Don hang da duoc thanh toan' });

    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1')
      .replace('::ffff:', '').replace('::1', '127.0.0.1').split(',')[0].trim();

    const { paymentUrl, txnRef } = createPaymentUrl({
      orderId:   order._id.toString(),
      amount:    order.total,
      orderInfo: `Thanh toan don hang ${order._id.toString().slice(-6).toUpperCase()}`,
      clientIp,
    });

    await Order.findByIdAndUpdate(orderId, { vnpayTxnRef: txnRef });
    res.json({ status: 'success', data: { paymentUrl } });
  } catch (error) {
    console.error('[VNPay] create error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.vnpayReturn = async (req, res) => {
  try {
    const { isValid, responseCode, txnRef } = verifyReturn(req.query);
    if (!isValid)
      return res.redirect(`${CLIENT_URL}/payment-result?status=error&message=invalid_signature&method=vnpay`);

    const order   = await Order.findOne({ vnpayTxnRef: txnRef });
    const orderId = order?._id?.toString() || '';

    if (responseCode === '00') {
      if (order) await Order.findByIdAndUpdate(order._id, { paymentStatus: 'completed' });
      return res.redirect(`${CLIENT_URL}/payment-result?status=success&orderId=${orderId}&method=vnpay`);
    }

    if (order) await Order.findByIdAndUpdate(order._id, { paymentStatus: 'failed' });
    return res.redirect(`${CLIENT_URL}/payment-result?status=failed&orderId=${orderId}&code=${responseCode}&method=vnpay`);
  } catch (error) {
    res.redirect(`${CLIENT_URL}/payment-result?status=error&message=${encodeURIComponent(error.message)}`);
  }
};

exports.vnpayIpn = async (req, res) => {
  try {
    const { isValid, responseCode, txnRef } = verifyReturn(req.query);
    if (!isValid) return res.json({ RspCode: '97', Message: 'Invalid signature' });

    const order = await Order.findOne({ vnpayTxnRef: txnRef });
    if (!order) return res.json({ RspCode: '01', Message: 'Order not found' });

    const vnpAmount = Number(req.query.vnp_Amount) / 100;
    if (vnpAmount !== order.total) return res.json({ RspCode: '04', Message: 'Invalid amount' });
    if (order.paymentStatus === 'completed') return res.json({ RspCode: '02', Message: 'Already confirmed' });

    await Order.findByIdAndUpdate(order._id, { paymentStatus: responseCode === '00' ? 'completed' : 'failed' });
    return res.json({ RspCode: '00', Message: 'Confirm Success' });
  } catch (error) {
    res.json({ RspCode: '99', Message: error.message });
  }
};

// ─── PayOS ────────────────────────────────────────────────────────────────────

exports.createPayosPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ status: 'error', message: 'Thiếu orderId' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng' });
    if (order.paymentStatus === 'completed')
      return res.status(400).json({ status: 'error', message: 'Đơn hàng đã được thanh toán' });

    const orderCode = Date.now();
    const returnUrl = `${NGROK_BASE}/api/payment/payos-return`;
    const cancelUrl = `${NGROK_BASE}/api/payment/payos-return`;

    const { checkoutUrl } = await createPayosPayment({
      orderCode,
      amount:      order.total,
      description: `DH ${order._id.toString().slice(-8).toUpperCase()}`,
      returnUrl,
      cancelUrl,
      buyerName:  order.shippingAddress?.fullName  || '',
      buyerEmail: order.shippingAddress?.email     || '',
      buyerPhone: order.shippingAddress?.phone     || '',
    });

    await Order.findByIdAndUpdate(orderId, { payosOrderCode: orderCode });
    res.json({ status: 'success', data: { paymentUrl: checkoutUrl } });
  } catch (error) {
    console.error('[PayOS] create error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.payosReturn = async (req, res) => {
  try {
    const { code, orderCode, status, cancel } = req.query;
    console.log('[PayOS Return]', req.query);

    const order   = orderCode ? await Order.findOne({ payosOrderCode: Number(orderCode) }) : null;
    const orderId = order?._id?.toString() || '';

    if (code === '00' && status === 'PAID' && cancel !== 'true') {
      if (order) await Order.findByIdAndUpdate(order._id, { paymentStatus: 'completed' });
      return res.redirect(`${CLIENT_URL}/payment-result?status=success&orderId=${orderId}&method=payos`);
    }

    if (order) await Order.findByIdAndUpdate(order._id, { paymentStatus: 'failed' });
    const reason = cancel === 'true' ? 'cancelled' : (code || 'failed');
    return res.redirect(`${CLIENT_URL}/payment-result?status=failed&orderId=${orderId}&code=${reason}&method=payos`);
  } catch (error) {
    console.error('[PayOS Return] error:', error.message);
    res.redirect(`${CLIENT_URL}/payment-result?status=error&message=${encodeURIComponent(error.message)}&method=payos`);
  }
};

exports.payosWebhook = async (req, res) => {
  try {
    const { isValid, orderCode, success } = verifyWebhook(req.body);
    if (!isValid) return res.status(400).json({ message: 'Invalid signature' });

    const order = orderCode ? await Order.findOne({ payosOrderCode: orderCode }) : null;
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.paymentStatus === 'completed') return res.status(200).json({ message: 'Already confirmed' });

    await Order.findByIdAndUpdate(order._id, { paymentStatus: success ? 'completed' : 'failed' });
    return res.status(200).json({ message: 'Confirm Success' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
