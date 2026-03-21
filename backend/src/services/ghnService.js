// src/services/ghnService.js
const axios = require('axios');

const GHN_TOKEN   = process.env.GHN_TOKEN; // 6dd0619c-2515-11f1-a973-aee5264794df
const GHN_SHOP_ID = Number(process.env.GHN_SHOP_ID || '199674'); // Phải là số
const GHN_BASE    = 'https://dev-online-gateway.ghn.vn/shiip/public-api'; // Sandbox

// Kho hàng — Hải Châu, Đà Nẵng
const SHOP_DISTRICT_ID = 1490;  // Hải Châu, Đà Nẵng
const SHOP_WARD_CODE   = '550113';

const ghnHeaders = {
    'Content-Type': 'application/json',
    'Token':        GHN_TOKEN,
};

const ghnShopHeaders = {
    'Content-Type': 'application/json',
    'Token':        GHN_TOKEN,
    'ShopId':       GHN_SHOP_ID, // Số nguyên, không phải string
};

const ghnService = {
    // ── Lấy danh sách tỉnh/thành ─────────────────────────────────────────────
    async getProvinces() {
        const { data } = await axios.get(`${GHN_BASE}/master-data/province`, {
            headers: ghnHeaders,
        });
        return data.data; // [{ ProvinceID, ProvinceName, ... }]
    },

    // ── Lấy danh sách quận/huyện theo tỉnh ──────────────────────────────────
    async getDistricts(provinceId) {
        const { data } = await axios.post(`${GHN_BASE}/master-data/district`, {
            province_id: Number(provinceId),
        }, { headers: ghnHeaders });
        return data.data; // [{ DistrictID, DistrictName, ... }]
    },

    // ── Lấy danh sách phường/xã theo huyện ──────────────────────────────────
    async getWards(districtId) {
        const { data } = await axios.post(`${GHN_BASE}/master-data/ward`, {
            district_id: Number(districtId),
        }, { headers: ghnHeaders });
        return data.data; // [{ WardCode, WardName, ... }]
    },

    // ── Tính phí vận chuyển ──────────────────────────────────────────────────
    async calculateShippingFee({ toDistrictId, toWardCode, weight = 500, length = 20, width = 20, height = 10, insuranceValue = 0 }) {
        const payload = {
            service_type_id:  2,          // Hàng nhẹ (2 = GHN Express)
            from_district_id: SHOP_DISTRICT_ID,
            from_ward_code:   SHOP_WARD_CODE,
            to_district_id:   Number(toDistrictId),
            to_ward_code:     String(toWardCode),
            weight:           Number(weight),    // gram
            length:           Number(length),    // cm
            width:            Number(width),     // cm
            height:           Number(height),    // cm
            insurance_value:  Number(insuranceValue),
        };

        const { data } = await axios.post(
            `${GHN_BASE}/v2/shipping-order/fee`,
            payload,
            { headers: ghnShopHeaders },
        );

        return {
            total:           data.data.total,           // Tổng phí
            service_fee:     data.data.service_fee,     // Phí dịch vụ
            insurance_fee:   data.data.insurance_fee,   // Phí bảo hiểm
            expected_time:   data.data.expected_delivery_time,
        };
    },

    // ── Ước tính thời gian giao hàng ─────────────────────────────────────────
    async getLeadTime({ toDistrictId, toWardCode }) {
        const { data } = await axios.post(
            `${GHN_BASE}/v2/shipping-order/leadtime`,
            {
                from_district_id: SHOP_DISTRICT_ID,
                from_ward_code:   SHOP_WARD_CODE,
                to_district_id:   Number(toDistrictId),
                to_ward_code:     String(toWardCode),
                service_id:       53321, // GHN Express
            },
            { headers: ghnShopHeaders },
        );
        return data.data; // { leadtime, order_date }
    },
};

module.exports = ghnService;