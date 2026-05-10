'use strict';

const { tryOnForProduct } = require('./arTryon.service');

async function tryon(req, res) {
  try {
    const productId = req.body?.productId;

    if (!productId) {
      return res.status(400).json({ status: 'error', message: 'productId là bắt buộc' });
    }
    if (!req.file?.path) {
      return res.status(400).json({ status: 'error', message: 'Ảnh người dùng là bắt buộc (field: personImage)' });
    }

    console.log(`[AR Try-On] productId=${productId}  personImageUrl=${req.file.path}`);

    const { resultUrl, garmentImageUrl } = await tryOnForProduct({
      productId,
      personImageUrl: req.file.path,
    });

    return res.json({ status: 'success', data: { resultUrl, garmentImageUrl } });
  } catch (err) {
    // Log full details — this shows in the backend terminal
    console.error('[AR Try-On] ERROR:', err.message);
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Không thể xử lý ảnh thử đồ',
    });
  }
}

module.exports = { tryon };
