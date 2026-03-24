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
    approveReturn,
    rejectReturn,
    confirmReturn,
    confirmRefund,
    getReturnOrders,
    confirmDelivery,
    autoConfirmDeliveredOrders,
} = require('../controller/orderController');

router.use(auth);

// ── Customer ──────────────────────────────────────────────────────────────────
router.post('/',                       createOrder);
router.get('/',                        getUserOrders);
router.post('/payment/process',        processPayment);       // static trước /:id
router.get('/:id',                     getOrderById);
router.post('/:id/cancel',             cancelOrder);
router.post('/:id/return-request',     requestReturn);        // Gửi yêu cầu hoàn trả
router.post('/:id/retry-payment',      retryPayment);
router.post('/:id/confirm-delivery',   confirmDelivery);   // User xác nhận đã nhận

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/all',               getAdminOrders);
router.get('/admin/returns',           getReturnOrders);      // Danh sách đơn hoàn trả
router.put('/:id/status',              updateOrderStatus);    // Chuyển trạng thái thủ công

// Hoàn trả flow
router.post('/admin/auto-confirm',        autoConfirmDeliveredOrders); // Cron hoặc manual trigger
router.put('/:id/approve-return',      approveReturn);        // Admin duyệt → return_approved
router.put('/:id/reject-return',       rejectReturn);         // Admin từ chối → return_rejected
router.put('/:id/confirm-return',      confirmReturn);        // Admin nhận hàng → returned + hoàn kho
router.put('/:id/confirm-refund',      confirmRefund);        // Admin xác nhận đã hoàn tiền

module.exports = router;