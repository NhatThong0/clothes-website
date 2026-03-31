const express = require('express');
const router  = express.Router();
const Banner  = require('../../model/Banner');
const { pool } = require('../../db/mysql');
const authenticateToken = require('../../middleware/authenticateToken');

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
        
        // ── LƯU SANG MYSQL (Song song) ──────────────────────────────────────────
        try {
            await pool.query(
                `INSERT INTO banners (id, title, image, link, isActive, \`order\`, createdAt) 
                 VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                [banner._id.toString(), banner.title || '', banner.image || '', banner.link || null, banner.isActive !== undefined ? banner.isActive : true, count]
            );
            console.log("✅ Banner saved to MySQL successfully");
        } catch (mysqlErr) {
            console.error("❌ MySQL Save Error (Banner):", mysqlErr.message);
        }
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

        // ── CẬP NHẬT SANG MYSQL (Song song) ─────────────────────────────────────
        try {
            const { title, image, link, isActive, order } = req.body;
            await pool.query(
                'UPDATE banners SET title = ?, image = ?, link = ?, isActive = ?, `order` = ?, updatedAt = NOW() WHERE id = ?',
                [title || banner.title, image || banner.image, link || banner.link, isActive !== undefined ? isActive : banner.isActive, order !== undefined ? order : banner.order, req.params.id]
            );
        } catch (mysqlErr) {
            console.error("❌ MySQL Update Error (Banner):", mysqlErr.message);
        }
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
