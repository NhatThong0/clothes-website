const express = require('express');
const router  = express.Router();
const Banner  = require('../model/Banner');
const authenticateToken = require('../middleWare/authenticateToken');

// ── Public: lấy banner đang active (dùng cho HomePage) ───────────────────────
router.get('/', async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true }).sort({ order: 1 });
        res.status(200).json({ status: 'success', data: banners });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ── Admin: lấy tất cả banner ──────────────────────────────────────────────────
router.get('/admin', authenticateToken, async (req, res) => {
    try {
        const banners = await Banner.find().sort({ order: 1 });
        res.status(200).json({ status: 'success', data: banners });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ── Admin: tạo banner mới ─────────────────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
    try {
        const count  = await Banner.countDocuments();
        const banner = await Banner.create({ ...req.body, order: count });
        res.status(201).json({ status: 'success', data: banner });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ── Admin: cập nhật banner ────────────────────────────────────────────────────
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const banner = await Banner.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!banner) return res.status(404).json({ status: 'error', message: 'Banner not found' });
        res.status(200).json({ status: 'success', data: banner });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ── Admin: xóa banner ─────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const banner = await Banner.findByIdAndDelete(req.params.id);
        if (!banner) return res.status(404).json({ status: 'error', message: 'Banner not found' });
        res.status(200).json({ status: 'success', message: 'Banner deleted' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;