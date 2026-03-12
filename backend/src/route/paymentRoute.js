const express = require('express');
const router  = express.Router();
const ctrl    = require('../controller/paymentController');
const auth    = require('../middleWare/authenticateToken');

// Middleware bypass ngrok browser warning cho tất cả GET routes
const ngrokBypass = (req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
};

// Tạo URL thanh toán VNPay — yêu cầu đăng nhập
router.post('/vnpay-create', auth, ctrl.createVnpayPayment);

// VNPay redirect về sau thanh toán — KHÔNG cần auth
router.get('/vnpay-return', ngrokBypass, ctrl.vnpayReturn);

// VNPay IPN (server-to-server) — KHÔNG cần auth
router.get('/vnpay-ipn', ngrokBypass, ctrl.vnpayIpn);

module.exports = router;