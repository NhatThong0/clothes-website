const express    = require('express');
const router     = express.Router();
const userCtrl   = require('./user.controller');
const { protect } = require('../../middleware/auth');

// ─── Profile ──────────────────────────────────────────────────────────────────
router.get   ('/profile',         protect, userCtrl.getProfile);
router.put   ('/profile',         protect, userCtrl.updateProfile);
router.put   ('/change-password', protect, userCtrl.changePassword);


// ─── Orders ───────────────────────────────────────────────────────────────────
router.get   ('/orders',          protect, userCtrl.getMyOrders);
router.get   ('/orders/:id',      protect, userCtrl.getOrderById);
router.put   ('/orders/:id/cancel', protect, userCtrl.cancelOrder);

// ─── Addresses ────────────────────────────────────────────────────────────────
router.get   ('/addresses',                          protect, userCtrl.getAddresses);
router.post  ('/addresses',                          protect, userCtrl.createAddress);
router.put   ('/addresses/:addressId',               protect, userCtrl.updateAddress);
router.delete('/addresses/:addressId',               protect, userCtrl.deleteAddress);
router.put   ('/addresses/:addressId/set-default',   protect, userCtrl.setDefaultAddress);

module.exports = router;
