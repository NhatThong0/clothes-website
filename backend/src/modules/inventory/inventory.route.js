const express    = require('express');
const router     = express.Router();
const auth       = require('../../middleware/authenticateToken');
const adminOnly  = require('../../middleware/authorizeAdmin');
const ctrl       = require('./inventory.controller');

router.use(auth, adminOnly);

// ── Phiếu nhập kho ────────────────────────────────────────────────────────────
router.get ('/receipts',              ctrl.getReceipts);
router.get ('/receipts/:id',          ctrl.getReceiptById);
router.post('/receipts',              ctrl.createReceipt);
router.put ('/receipts/:id',          ctrl.updateReceipt);
router.post('/receipts/:id/confirm',  ctrl.confirmReceipt);
router.post('/receipts/:id/cancel',   ctrl.cancelReceipt);

// ── Điều chỉnh kho ────────────────────────────────────────────────────────────
router.post('/adjustments',           ctrl.createAdjustment);

// ── Phiếu xuất / Delivery ─────────────────────────────────────────────────────
router.get ('/deliveries',                       ctrl.getDeliveries);
router.post('/deliveries/:orderId/export',       ctrl.exportDelivery);

// ── Báo cáo ───────────────────────────────────────────────────────────────────
router.get('/stock-report',   ctrl.getStockReport);
router.get('/movements',      ctrl.getMovements);
router.get('/profit-report',  ctrl.getProfitReport);

module.exports = router;
