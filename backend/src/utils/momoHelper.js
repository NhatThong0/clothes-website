const crypto = require('crypto');
const axios  = require('axios');

const PARTNER_CODE = process.env.MOMO_PARTNER_CODE || 'MOMO';
const ACCESS_KEY   = process.env.MOMO_ACCESS_KEY   || 'F8BBA842ECF85';
const SECRET_KEY   = process.env.MOMO_SECRET_KEY   || 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
const MOMO_API     = process.env.MOMO_API_URL       || 'https://test-payment.momo.vn/v2/gateway/api/create';
const REDIRECT_URL = process.env.MOMO_REDIRECT_URL  || 'http://localhost:5000/api/payment/momo-return';
const IPN_URL      = process.env.MOMO_IPN_URL       || 'http://localhost:5000/api/payment/momo-ipn';

async function createMomoPayment({ orderId, amount, orderInfo }) {
    const requestId  = `${orderId}-${Date.now()}`;
    const amountInt  = Math.round(Number(amount));
    const safeInfo   = (orderInfo || `Thanh toan don hang ${orderId}`)
        .replace(/[^\w\s]/g, '').trim().slice(0, 255);
    const extraData  = '';
    const requestType = 'captureWallet';

    const rawSignature =
        `accessKey=${ACCESS_KEY}` +
        `&amount=${amountInt}` +
        `&extraData=${extraData}` +
        `&ipnUrl=${IPN_URL}` +
        `&orderId=${orderId}` +
        `&orderInfo=${safeInfo}` +
        `&partnerCode=${PARTNER_CODE}` +
        `&redirectUrl=${REDIRECT_URL}` +
        `&requestId=${requestId}` +
        `&requestType=${requestType}`;

    const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(rawSignature)
        .digest('hex');

    const body = {
        partnerCode: PARTNER_CODE,
        partnerName: 'DaClothes',
        storeId:     'DaClothesStore',
        requestId,
        amount:      amountInt,
        orderId,
        orderInfo:   safeInfo,
        redirectUrl: REDIRECT_URL,
        ipnUrl:      IPN_URL,
        lang:        'vi',
        extraData,
        requestType,
        signature,
    };

    console.log('[MoMo] rawSignature:', rawSignature);
    console.log('[MoMo] signature   :', signature);

    const response = await axios.post(MOMO_API, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
    });

    console.log('[MoMo] response resultCode:', response.data.resultCode, '| message:', response.data.message);

    if (response.data.resultCode !== 0) {
        throw new Error(`MoMo error ${response.data.resultCode}: ${response.data.message}`);
    }

    return { payUrl: response.data.payUrl, requestId };
}

function verifyMomoCallback(params) {
    const {
        accessKey, amount, extraData, message, orderId, orderInfo,
        orderType, partnerCode, payType, requestId, responseTime,
        resultCode, transId, signature: receivedSig,
    } = params;

    const rawSignature =
        `accessKey=${ACCESS_KEY}` +
        `&amount=${amount}` +
        `&extraData=${extraData}` +
        `&message=${message}` +
        `&orderId=${orderId}` +
        `&orderInfo=${orderInfo}` +
        `&orderType=${orderType}` +
        `&partnerCode=${partnerCode}` +
        `&payType=${payType}` +
        `&requestId=${requestId}` +
        `&responseTime=${responseTime}` +
        `&resultCode=${resultCode}` +
        `&transId=${transId}`;

    const computed = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(rawSignature)
        .digest('hex');

    console.log('[MoMo Verify] resultCode:', resultCode);
    console.log('[MoMo Verify] isValid   :', computed === receivedSig);

    return {
        isValid:      computed === receivedSig,
        resultCode:   Number(resultCode),
        orderId:      orderId || '',
        transId:      transId || '',
    };
}

module.exports = { createMomoPayment, verifyMomoCallback };
