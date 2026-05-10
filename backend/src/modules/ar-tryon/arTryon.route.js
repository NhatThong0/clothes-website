'use strict';

const { Router } = require('express');
const { uploadArTryOn } = require('../../config/cloudinary');
const { tryon } = require('./arTryon.controller');

const router = Router();

// Wrap multer so its errors become JSON responses instead of crashing
function uploadMiddleware(req, res, next) {
  uploadArTryOn.single('personImage')(req, res, (err) => {
    if (err) {
      console.error('[AR Try-On] Upload error:', err.message);
      return res.status(400).json({ status: 'error', message: `Upload ảnh thất bại: ${err.message}` });
    }
    next();
  });
}

// POST /api/ar-tryon  multipart/form-data: personImage (file) + productId (text)
router.post('/', uploadMiddleware, tryon);

module.exports = router;
