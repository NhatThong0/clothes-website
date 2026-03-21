const express = require('express');
const router  = express.Router();
const { cloudinary, upload, uploadAvatar, uploadReturn } = require('../config/cloudinary');
const authenticateToken = require('../middleWare/authenticateToken');

// ── Upload nhiều ảnh sản phẩm ─────────────────────────────────────────────────
router.post('/', authenticateToken, upload.array('images', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ status: 'error', message: 'No files uploaded' });
        }
        const urls = req.files.map(file => file.path);
        res.status(200).json({ status: 'success', data: urls });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ── Upload avatar người dùng ──────────────────────────────────────────────────
router.post('/avatar', authenticateToken, uploadAvatar.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'No file uploaded' });
        }

        // Xóa avatar cũ trên Cloudinary nếu có
        const User = require('../model/User');
        const user = await User.findById(req.userId).select('avatar');
        if (user?.avatar && user.avatar.includes('cloudinary')) {
            try {
                const publicId = user.avatar
                    .split('/')
                    .slice(-3)
                    .join('/')
                    .replace(/\.[^/.]+$/, '');
                await cloudinary.uploader.destroy(publicId);
            } catch (e) {
                console.warn('Could not delete old avatar:', e.message);
            }
        }

        await User.findByIdAndUpdate(req.userId, { avatar: req.file.path });
        res.status(200).json({ status: 'success', data: req.file.path });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ── Upload ảnh hoàn trả ───────────────────────────────────────────────────────
router.post('/return-image', authenticateToken, uploadReturn.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'No file uploaded' });
        }
        res.status(200).json({ status: 'success', url: req.file.path });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ── Xóa ảnh ──────────────────────────────────────────────────────────────────
router.delete('/', authenticateToken, async (req, res) => {
    try {
        const { url } = req.body;
        const publicId = url.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
        res.status(200).json({ status: 'success', message: 'Image deleted' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;