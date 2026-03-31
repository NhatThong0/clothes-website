const express = require('express');
const router = express.Router();
const {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
} = require('./cart.controller');
const authenticateToken = require('../../middleware/authenticateToken');

// All cart routes require authentication
router.use(authenticateToken);

router.get('/', getCart);
router.post('/add', addToCart);
router.put('/update', updateCartItem);
router.post('/remove', removeFromCart);
router.delete('/clear', clearCart);

module.exports = router;
