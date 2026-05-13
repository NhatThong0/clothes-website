const crypto = require('crypto');
const moment = require('moment');

const TMN_CODE    = process.env.VNPAY_TMN_CODE    || '';
const HASH_SECRET = process.env.VNPAY_HASH_SECRET || '';
const VNPAY_URL   = process.env.VNPAY_URL         || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const RETURN_URL  = process.env.VNPAY_RETURN_URL  || 'http://localhost:5000/api/payment/vnpay-return';

function createPaymentUrl({ orderId, amount, orderInfo, clientIp }) {
    if (!TMN_CODE || !HASH_SECRET)
        throw new Error('Thiếu VNPAY_TMN_CODE hoặc VNPAY_HASH_SECRET trong .env');

    process.env.TZ = 'Asia/Ho_Chi_Minh';

    const createDate = moment().format('YYYYMMDDHHmmss');
    const amountInt  = Math.round(Number(amount)) * 100;
    const txnRef     = `${orderId.toString().slice(-8)}${Date.now()}`;

    const safeInfo = removeAccents(orderInfo || `Thanh toan ${orderId}`)
        .replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 255);

    const ip = (clientIp || '127.0.0.1')
        .replace('::ffff:', '').replace('::1', '127.0.0.1')
        .split(',')[0].trim();

    const rawParams = {
        vnp_Amount:     amountInt,
        vnp_Command:    'pay',
        vnp_CreateDate: createDate,
        vnp_CurrCode:   'VND',
        vnp_IpAddr:     ip,
        vnp_Locale:     'vn',
        vnp_OrderInfo:  safeInfo,
        vnp_OrderType:  'other',
        vnp_ReturnUrl:  RETURN_URL,
        vnp_TmnCode:    TMN_CODE,
        vnp_TxnRef:     txnRef,
        vnp_Version:    '2.1.0',
    };

    // ✅ signData: sort key, dùng giá trị RAW (không encode)
    const signData = Object.keys(rawParams)
        .sort()
        .map(k => `${k}=${rawParams[k]}`)
        .join('&');

    const signed = crypto.createHmac('sha512', HASH_SECRET)
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

    // ✅ URL: encode từng value để truyền tải an toàn
    const queryString = Object.keys(rawParams)
        .sort()
        .map(k => `${k}=${encodeURIComponent(rawParams[k])}`)
        .join('&');

    const paymentUrl = `${VNPAY_URL}?${queryString}&vnp_SecureHash=${signed}`;

    console.log('[VNPay] txnRef    :', txnRef);
    console.log('[VNPay] signData  :', signData);
    console.log('[VNPay] signed    :', signed, '| len:', signed.length);
    console.log('[VNPay] paymentUrl:', paymentUrl);

    return { paymentUrl, txnRef };
}

function verifyReturn(query) {
    let vnp_Params   = { ...query };
    const secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    // ✅ Express đã decode sẵn → dùng giá trị RAW luôn
    const signData = Object.keys(vnp_Params)
        .sort()
        .map(k => `${k}=${vnp_Params[k]}`)
        .join('&');

    const signed = crypto.createHmac('sha512', HASH_SECRET)
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

    console.log('[VNPay Return] signData:', signData);
    console.log('[VNPay Return] signed  :', signed);
    console.log('[VNPay Return] received:', secureHash);
    console.log('[VNPay Return] isValid :', secureHash === signed);

    return {
        isValid:      secureHash === signed,
        responseCode: query.vnp_ResponseCode || '',
        txnRef:       query.vnp_TxnRef       || '',
        amount:       Number(query.vnp_Amount || 0) / 100,
    };
}

function removeAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

module.exports = { createPaymentUrl, verifyReturn };