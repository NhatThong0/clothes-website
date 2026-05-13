const express = require('express');
const ctrl    = require('./payment.controller');
const auth    = require('../../middleware/authenticateToken');

const router = express.Router();

const ngrokBypass = (_req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
};

// VNPay (giữ lại để backward-compatible)
router.post('/vnpay-create', auth, ctrl.createVnpayPayment);
router.get('/vnpay-return',  ngrokBypass, ctrl.vnpayReturn);
router.get('/vnpay-ipn',     ngrokBypass, ctrl.vnpayIpn);

// PayOS
router.post('/payos-create',  auth, ctrl.createPayosPayment);
router.get('/payos-return',   ngrokBypass, ctrl.payosReturn);
router.post('/payos-webhook', ctrl.payosWebhook);

module.exports = router;
