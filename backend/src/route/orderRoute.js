
const express    = require('express');
const router     = express.Router();
const auth       = require('../middleWare/authenticateToken');
const {
    createOrder,
    getUserOrders,
    getOrderById,
    cancelOrder,
    updateOrderStatus,
    processPayment,
    getAdminOrders,
} = require('../controller/orderController');

// ── Tất cả route đều cần đăng nhập ───────────────────────────
router.use(auth);

// ── Customer ──────────────────────────────────────────────────
router.post('/',              createOrder);      // tạo đơn (có validate voucher bên trong)
router.get('/',               getUserOrders);    // danh sách đơn của user
router.get('/:id',            getOrderById);     // chi tiết đơn
router.post('/:id/cancel',    cancelOrder);      // hủy đơn

// ── Payment ───────────────────────────────────────────────────
// QUAN TRỌNG: route tĩnh phải khai báo TRƯỚC route động /:id


// ── Admin ─────────────────────────────────────────────────────
router.get('/admin/all',      getAdminOrders);   // admin xem tất cả đơn
router.put('/:id/status',     updateOrderStatus); // admin cập nhật trạng thái
router.post('/payment/process', processPayment);
module.exports = router;