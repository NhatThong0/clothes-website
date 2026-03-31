const Order = require('../../model/Order');
const { createPaymentUrl, verifyReturn } = require('../../utils/vnpayHelper');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

exports.createVnpayPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ status: 'error', message: 'Thieu orderId' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Khong tim thay don hang' });
    }

    if (order.paymentStatus === 'completed') {
      return res.status(400).json({ status: 'error', message: 'Don hang da duoc thanh toan' });
    }

    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1')
      .replace('::ffff:', '')
      .replace('::1', '127.0.0.1')
      .split(',')[0]
      .trim();

    const { paymentUrl, txnRef } = createPaymentUrl({
      orderId: order._id.toString(),
      amount: order.total,
      orderInfo: `Thanh toan don hang ${order._id.toString().slice(-6).toUpperCase()}`,
      clientIp,
    });

    // Store the raw txnRef before VNPay encoding so callbacks can find the order again.
    await Order.findByIdAndUpdate(orderId, { vnpayTxnRef: txnRef });
    res.json({ status: 'success', data: { paymentUrl } });
  } catch (error) {
    console.error('[VNPay] create error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.vnpayReturn = async (req, res) => {
  try {
    console.log('[VNPay Return] query:', JSON.stringify(req.query));
    const { isValid, responseCode, txnRef } = verifyReturn(req.query);

    if (!isValid) {
      console.error('[VNPay Return] Invalid signature');
      return res.redirect(`${CLIENT_URL}/payment-result?status=error&message=invalid_signature`);
    }

    // Express has already decoded the query string, so txnRef can be matched directly.
    const order = await Order.findOne({ vnpayTxnRef: txnRef });
    const orderId = order?._id?.toString() || '';

    if (responseCode === '00') {
      if (order) await Order.findByIdAndUpdate(order._id, { paymentStatus: 'completed' });
      return res.redirect(`${CLIENT_URL}/payment-result?status=success&orderId=${orderId}`);
    }

    if (order) await Order.findByIdAndUpdate(order._id, { paymentStatus: 'failed' });
    return res.redirect(
      `${CLIENT_URL}/payment-result?status=failed&orderId=${orderId}&code=${responseCode}`,
    );
  } catch (error) {
    console.error('[VNPay Return] error:', error.message);
    res.redirect(
      `${CLIENT_URL}/payment-result?status=error&message=${encodeURIComponent(error.message)}`,
    );
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
    if (order.paymentStatus === 'completed') {
      return res.json({ RspCode: '02', Message: 'Already confirmed' });
    }

    if (responseCode === '00') {
      await Order.findByIdAndUpdate(order._id, { paymentStatus: 'completed' });
    } else {
      await Order.findByIdAndUpdate(order._id, { paymentStatus: 'failed' });
    }

    return res.json({ RspCode: '00', Message: 'Confirm Success' });
  } catch (error) {
    res.json({ RspCode: '99', Message: error.message });
  }
};
