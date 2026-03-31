// Promotion routes
const express = require('express');
const router  = express.Router();
const auth    = require('../../middleware/authenticateToken');
const {
    validatePromotionCode,
    getAutoApplyPromotions,
    getMyLoyalty,
    getPromotions,
    createPromotion,
    updatePromotion,
    deletePromotion,
    togglePromotion,
    getUserLoyalty,
    adjustLoyaltyPoints,
} = require('./promotion.controller');

// ── User (cần đăng nhập) ──────────────────────────────────────────────────────
router.post('/validate',        auth, validatePromotionCode);  // nhập mã coupon
router.get('/auto-apply',       auth, getAutoApplyPromotions); // tự động lấy promo phù hợp
router.get('/loyalty/my',       auth, getMyLoyalty);           // điểm & tier của mình

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/',                         auth, getPromotions);
router.post('/',                        auth, createPromotion);
router.put('/:id',                      auth, updatePromotion);
router.delete('/:id',                   auth, deletePromotion);
router.patch('/:id/toggle',             auth, togglePromotion);
router.get('/loyalty/user/:userId',     auth, getUserLoyalty);
router.post('/loyalty/adjust',          auth, adjustLoyaltyPoints);

module.exports = router;
