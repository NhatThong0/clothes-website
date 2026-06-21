const express = require('express');
const authenticateToken = require('../../middleware/authenticateToken');
const controller = require('./loyalty.controller');

const router = express.Router();

router.get('/me',       authenticateToken, controller.getMe);
router.post('/events',  authenticateToken, controller.postEvent);
router.post('/checkout',authenticateToken, controller.checkout);
router.get('/rewards',     authenticateToken, controller.getRewards);
router.post('/redeem',     authenticateToken, controller.redeemReward);
router.get('/my-vouchers', authenticateToken, controller.getMyVouchers);

module.exports = router;

