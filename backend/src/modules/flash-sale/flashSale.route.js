const express = require('express');
const authenticateToken = require('../../middleware/authenticateToken');
const {
  getActiveFlashSales,
  reserveFlashSale,
} = require('./flashSale.controller');

const router = express.Router();

// Public: active flash sales (for banner + countdown)
router.get('/active', getActiveFlashSales);

// Auth: reserve slots atomically (-remaining)
router.post('/:id/reserve', authenticateToken, reserveFlashSale);

module.exports = router;

