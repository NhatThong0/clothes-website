const crypto = require('crypto');
const axios  = require('axios');

const CLIENT_ID    = process.env.PAYOS_CLIENT_ID    || '';
const API_KEY      = process.env.PAYOS_API_KEY       || '';
const CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY  || '';
const PAYOS_API    = 'https://api-merchant.payos.vn/v2/payment-requests';

function buildSignature(fields) {
    const keys = Object.keys(fields).sort();
    const str  = keys.map(k => `${k}=${fields[k]}`).join('&');
    return crypto.createHmac('sha256', CHECKSUM_KEY).update(str).digest('hex');
}

async function createPayosPayment({ orderCode, amount, description, returnUrl, cancelUrl, buyerName, buyerEmail, buyerPhone }) {
    if (!CLIENT_ID || !API_KEY || !CHECKSUM_KEY)
        throw new Error('Thiếu cấu hình PayOS trong .env (PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY)');

    const amountInt = Math.round(Number(amount));
    const safeDesc  = String(description).replace(/[^\w\s]/g, '').trim().slice(0, 25);

    const signature = buildSignature({
        amount:      amountInt,
        cancelUrl,
        description: safeDesc,
        orderCode,
        returnUrl,
    });

    const body = {
        orderCode,
        amount:      amountInt,
        description: safeDesc,
        cancelUrl,
        returnUrl,
        signature,
        expiredAt: Math.floor(Date.now() / 1000) + 900,
    };
    if (buyerName)  body.buyerName  = buyerName;
    if (buyerEmail) body.buyerEmail = buyerEmail;
    if (buyerPhone) body.buyerPhone = buyerPhone;

    console.log('[PayOS] orderCode:', orderCode, '| amount:', amountInt, '| desc:', safeDesc);

    const res = await axios.post(PAYOS_API, body, {
        headers: {
            'x-client-id':  CLIENT_ID,
            'x-api-key':    API_KEY,
            'Content-Type': 'application/json',
        },
        timeout: 10000,
    });

    console.log('[PayOS] result code:', res.data.code, '|', res.data.desc);

    if (res.data.code !== '00')
        throw new Error(`PayOS: ${res.data.desc} (code ${res.data.code})`);

    return {
        checkoutUrl:   res.data.data.checkoutUrl,
        paymentLinkId: res.data.data.paymentLinkId,
    };
}

function verifyWebhook(webhookBody) {
    const { data, signature: receivedSig } = webhookBody || {};
    if (!data || !receivedSig) return { isValid: false, orderCode: null, success: false };

    const computed = buildSignature({
        accountNumber:       String(data.accountNumber       || ''),
        amount:              String(data.amount              || ''),
        description:         String(data.description         || ''),
        orderCode:           String(data.orderCode           || ''),
        paymentLinkId:       String(data.paymentLinkId       || ''),
        reference:           String(data.reference           || ''),
        transactionDateTime: String(data.transactionDateTime || ''),
    });

    const isValid = computed === receivedSig;
    console.log('[PayOS Webhook] isValid:', isValid, '| orderCode:', data.orderCode);

    return {
        isValid,
        orderCode: data.orderCode ? Number(data.orderCode) : null,
        success:   webhookBody.success === true || webhookBody.code === '00',
    };
}

module.exports = { createPayosPayment, verifyWebhook };
