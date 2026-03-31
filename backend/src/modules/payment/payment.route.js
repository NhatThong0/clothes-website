const express = require('express');
const ctrl = require('./payment.controller');
const auth = require('../../middleware/authenticateToken');

const router = express.Router();

// Bypass the ngrok browser warning for VNPay GET callbacks.
const ngrokBypass = (req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
};

router.post('/vnpay-create', auth, ctrl.createVnpayPayment);
router.get('/vnpay-return', ngrokBypass, ctrl.vnpayReturn);
router.get('/vnpay-ipn', ngrokBypass, ctrl.vnpayIpn);

module.exports = router;
