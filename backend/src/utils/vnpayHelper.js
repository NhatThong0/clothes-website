const crypto = require('crypto');
const qs     = require('qs');
const moment = require('moment');

const TMN_CODE    = process.env.VNPAY_TMN_CODE    || '';
const HASH_SECRET = process.env.VNPAY_HASH_SECRET || '';
const VNPAY_URL   = process.env.VNPAY_URL         || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const RETURN_URL  = process.env.VNPAY_RETURN_URL  || 'http://localhost:5000/api/payment/vnpay-return';

function createPaymentUrl({ orderId, amount, orderInfo, clientIp }) {
    if (!TMN_CODE || !HASH_SECRET)
        throw new Error('Thiếu VNPAY_TMN_CODE hoặc VNPAY_HASH_SECRET trong .env');

    process.env.TZ = 'Asia/Ho_Chi_Minh';

    const createDate = moment(new Date()).format('YYYYMMDDHHmmss');
    const amountInt  = Math.round(Number(amount)) * 100;
    const txnRef     = `${orderId.toString().slice(-8)}${Date.now()}`;

    const safeInfo = removeAccents(orderInfo || `Thanh toan ${orderId}`)
        .replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 255);

    const ip = (clientIp || '127.0.0.1')
        .replace('::ffff:', '').replace('::1', '127.0.0.1')
        .split(',')[0].trim();

    // Params raw — chưa encode
    const rawParams = {
        vnp_Version:    '2.1.0',
        vnp_Command:    'pay',
        vnp_TmnCode:    TMN_CODE,
        vnp_Locale:     'vn',
        vnp_CurrCode:   'VND',
        vnp_TxnRef:     txnRef,
        vnp_OrderInfo:  safeInfo,
        vnp_OrderType:  'other',
        vnp_Amount:     amountInt,
        vnp_ReturnUrl:  RETURN_URL,
        vnp_IpAddr:     ip,
        vnp_CreateDate: createDate,
    };

    // Bước 1: sort key alphabet
    const sortedKeys = Object.keys(rawParams).sort();

    // Bước 2: build signData theo đúng VNPay — dùng sortObject để encode
    const encodedParams = sortObject(rawParams);
    const signData = qs.stringify(encodedParams, { encode: false });

    // Bước 3: HMAC-SHA512
    const signed = crypto.createHmac('sha512', HASH_SECRET)
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

    // Bước 4: build URL — dùng raw params + encodeURIComponent từng value
    // KHÔNG qua sortObject để tránh double encode
    const queryString = sortedKeys
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

    // Express đã decode query string → dùng sortObject để encode lại giống lúc tạo
    const encodedParams = sortObject(vnp_Params);
    const signData = qs.stringify(encodedParams, { encode: false });

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

// sortObject nguyên bản VNPay — CHỈ dùng để tạo signData
function sortObject(obj) {
    let sorted = {};
    let str    = [];
    let key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) {
            str.push(encodeURIComponent(key));
        }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
    }
    return sorted;
}

function removeAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

module.exports = { createPaymentUrl, verifyReturn };