// Shipping fee and location lookup routes
const express = require('express');
const shippingService = require('./shipping.service');

const router = express.Router();

// Public GHN data, so auth is not required here.
// Add rate limiting later if this endpoint starts getting abused.
router.get('/provinces', async (req, res) => {
  try {
    const provinces = await shippingService.getProvinces();
    res.json({ status: 'success', data: provinces });
  } catch (error) {
    console.error('[GHN] getProvinces error:', error.response?.data || error.message);
    res.status(500).json({
      status: 'error',
      message: 'Khong the tai danh sach tinh/thanh',
    });
  }
});

router.get('/districts', async (req, res) => {
  const { province_id: provinceId } = req.query;
  if (!provinceId) {
    return res.status(400).json({ status: 'error', message: 'Thieu province_id' });
  }

  try {
    const districts = await shippingService.getDistricts(provinceId);
    res.json({ status: 'success', data: districts });
  } catch (error) {
    console.error('[GHN] getDistricts error:', error.response?.data || error.message);
    res.status(500).json({
      status: 'error',
      message: 'Khong the tai danh sach quan/huyen',
    });
  }
});

router.get('/wards', async (req, res) => {
  const { district_id: districtId } = req.query;
  if (!districtId) {
    return res.status(400).json({ status: 'error', message: 'Thieu district_id' });
  }

  try {
    const wards = await shippingService.getWards(districtId);
    res.json({ status: 'success', data: wards });
  } catch (error) {
    console.error('[GHN] getWards error:', error.response?.data || error.message);
    res.status(500).json({
      status: 'error',
      message: 'Khong the tai danh sach phuong/xa',
    });
  }
});

router.post('/fee', async (req, res) => {
  const { to_district_id: toDistrictId, to_ward_code: toWardCode, weight, insurance_value } =
    req.body;

  if (!toDistrictId || !toWardCode) {
    return res.status(400).json({
      status: 'error',
      message: 'Thieu to_district_id hoac to_ward_code',
    });
  }

  try {
    const fee = await shippingService.calculateShippingFee({
      toDistrictId,
      toWardCode,
      weight: weight || 500,
      insuranceValue: insurance_value || 0,
    });

    res.json({ status: 'success', data: fee });
  } catch (error) {
    console.error('[GHN] calculateFee error:', error.response?.data || error.message);
    res.status(500).json({
      status: 'error',
      message: 'Khong the tinh phi van chuyen',
    });
  }
});

module.exports = router;
