const axios = require('axios');

const GHN_TOKEN = process.env.GHN_TOKEN;
const GHN_SHOP_ID = Number(process.env.GHN_SHOP_ID || '199674');
const GHN_BASE = 'https://dev-online-gateway.ghn.vn/shiip/public-api';

const SHOP_DISTRICT_ID = 1490;
const SHOP_WARD_CODE = '550113';

const ghnHeaders = {
  'Content-Type': 'application/json',
  Token: GHN_TOKEN,
};

const ghnShopHeaders = {
  'Content-Type': 'application/json',
  Token: GHN_TOKEN,
  ShopId: GHN_SHOP_ID,
};

const shippingService = {
  async getProvinces() {
    const { data } = await axios.get(`${GHN_BASE}/master-data/province`, {
      headers: ghnHeaders,
    });
    return data.data;
  },

  async getDistricts(provinceId) {
    const { data } = await axios.post(
      `${GHN_BASE}/master-data/district`,
      { province_id: Number(provinceId) },
      { headers: ghnHeaders },
    );
    return data.data;
  },

  async getWards(districtId) {
    const { data } = await axios.post(
      `${GHN_BASE}/master-data/ward`,
      { district_id: Number(districtId) },
      { headers: ghnHeaders },
    );
    return data.data;
  },

  async calculateShippingFee({
    toDistrictId,
    toWardCode,
    weight = 500,
    length = 20,
    width = 20,
    height = 10,
    insuranceValue = 0,
  }) {
    const payload = {
      service_type_id: 2,
      from_district_id: SHOP_DISTRICT_ID,
      from_ward_code: SHOP_WARD_CODE,
      to_district_id: Number(toDistrictId),
      to_ward_code: String(toWardCode),
      weight: Number(weight),
      length: Number(length),
      width: Number(width),
      height: Number(height),
      insurance_value: Number(insuranceValue),
    };

    const { data } = await axios.post(`${GHN_BASE}/v2/shipping-order/fee`, payload, {
      headers: ghnShopHeaders,
    });

    return {
      total: data.data.total,
      service_fee: data.data.service_fee,
      insurance_fee: data.data.insurance_fee,
      expected_time: data.data.expected_delivery_time,
    };
  },

  async getLeadTime({ toDistrictId, toWardCode }) {
    const { data } = await axios.post(
      `${GHN_BASE}/v2/shipping-order/leadtime`,
      {
        from_district_id: SHOP_DISTRICT_ID,
        from_ward_code: SHOP_WARD_CODE,
        to_district_id: Number(toDistrictId),
        to_ward_code: String(toWardCode),
        service_id: 53321,
      },
      { headers: ghnShopHeaders },
    );

    return data.data;
  },
};

module.exports = shippingService;
