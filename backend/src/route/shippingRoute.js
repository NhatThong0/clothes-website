// src/route/shippingRoute.js
const express    = require('express');
const router     = express.Router();
const ghnService = require('../services/ghnService');

// Không cần auth vì địa chỉ là public data của GHN
// Nhưng rate limit để tránh abuse — thêm nếu cần

// GET /api/shipping/provinces
router.get('/provinces', async (req, res) => {
    try {
        const provinces = await ghnService.getProvinces();
        res.json({ status: 'success', data: provinces });
    } catch (err) {
        console.error('[GHN] getProvinces error:', err.response?.data || err.message);
        res.status(500).json({ status: 'error', message: 'Không thể tải danh sách tỉnh/thành' });
    }
});

// GET /api/shipping/districts?province_id=xxx
router.get('/districts', async (req, res) => {
    const { province_id } = req.query;
    if (!province_id) return res.status(400).json({ status: 'error', message: 'Thiếu province_id' });
    try {
        const districts = await ghnService.getDistricts(province_id);
        res.json({ status: 'success', data: districts });
    } catch (err) {
        console.error('[GHN] getDistricts error:', err.response?.data || err.message);
        res.status(500).json({ status: 'error', message: 'Không thể tải danh sách quận/huyện' });
    }
});

// GET /api/shipping/wards?district_id=xxx
router.get('/wards', async (req, res) => {
    const { district_id } = req.query;
    if (!district_id) return res.status(400).json({ status: 'error', message: 'Thiếu district_id' });
    try {
        const wards = await ghnService.getWards(district_id);
        res.json({ status: 'success', data: wards });
    } catch (err) {
        console.error('[GHN] getWards error:', err.response?.data || err.message);
        res.status(500).json({ status: 'error', message: 'Không thể tải danh sách phường/xã' });
    }
});

// POST /api/shipping/fee
// Body: { to_district_id, to_ward_code, weight?, items? }
router.post('/fee', async (req, res) => {
    const { to_district_id, to_ward_code, weight, insurance_value } = req.body;
    if (!to_district_id || !to_ward_code) {
        return res.status(400).json({ status: 'error', message: 'Thiếu to_district_id hoặc to_ward_code' });
    }
    try {
        const fee = await ghnService.calculateShippingFee({
            toDistrictId:   to_district_id,
            toWardCode:     to_ward_code,
            weight:         weight         || 500,
            insuranceValue: insurance_value || 0,
        });
        res.json({ status: 'success', data: fee });
    } catch (err) {
        console.error('[GHN] calculateFee error:', err.response?.data || err.message);
        res.status(500).json({ status: 'error', message: 'Không thể tính phí vận chuyển' });
    }
});

module.exports = router;