const express  = require('express');
const router   = express.Router();
const auth     = require('../middleWare/authenticateToken');
const {
    createOrder,
    getUserOrders,
    getOrderById,
    cancelOrder,
    updateOrderStatus,
    processPayment,
    getAdminOrders,
    retryPayment,
    requestReturn,
} = require('../controller/orderController');

router.use(auth);

// ── Customer ──────────────────────────────────────────────────────
router.post('/',                    createOrder);
router.get('/',                     getUserOrders);
router.post('/payment/process',     processPayment);  // static trước /:id
router.get('/:id',                  getOrderById);
router.post('/:id/cancel',          cancelOrder);
router.post('/:id/return-request',  requestReturn);   // ✅ hoàn trả
router.post('/:id/retry-payment',  retryPayment);
// ── Admin ─────────────────────────────────────────────────────────
router.get('/admin/all',            getAdminOrders);
router.put('/:id/status',           updateOrderStatus);

module.exports = router;