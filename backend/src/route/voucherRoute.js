// ════════════════════════════════════════════════════════════
//  voucherRoute.js  —  đặt tại src/route/voucherRoute.js
// ════════════════════════════════════════════════════════════
const express = require('express');
const router  = express.Router();
const auth    = require('../middleWare/authenticateToken');
const {
    validateVoucher,
    getVouchers,
    createVoucher,
    updateVoucher,
    deleteVoucher,
} = require('../controller/voucherController');

// ── Public (user đã đăng nhập) ────────────────────────────────
// POST /api/vouchers/validate  { code, orderAmount }
router.post('/validate', auth, validateVoucher);

// ── Admin CRUD ────────────────────────────────────────────────
router.get('/',      auth, getVouchers);    // GET  /api/vouchers
router.post('/',     auth, createVoucher);  // POST /api/vouchers
router.put('/:id',   auth, updateVoucher);  // PUT  /api/vouchers/:id
router.delete('/:id',auth, deleteVoucher);  // DEL  /api/vouchers/:id

module.exports = router;