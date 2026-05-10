'use strict';

const axios = require('axios');
const Product = require('../../model/Product');

// ── FASHN.ai ──────────────────────────────────────────────────────────────────
const FASHN_KEY      = process.env.FASHN_API_KEY;
const FASHN_BASE     = 'https://api.fashn.ai/v1';

// ── Replicate ─────────────────────────────────────────────────────────────────
const REPLICATE_TOKEN    = process.env.REPLICATE_API_KEY;
const REPLICATE_MODELS   = ['cuuupid/idm-vton', 'yisol/idm-vton'];
let   _replicateVersion  = null; // { model, versionId }

// ─────────────────────────────────────────────────────────────────────────────

function detectCategory(categoryName = '') {
  const n = categoryName.toLowerCase();
  if (/quần|pants|trouser|short|jeans/.test(n)) return 'bottoms';
  if (/váy liền|dress|jumpsuit|bodysuit/.test(n)) return 'one-pieces';
  return 'tops';
}

function replicateErr(err) {
  if (err.response) {
    const body   = err.response.data;
    const detail = body?.detail || body?.error || JSON.stringify(body);
    return new Error(`Replicate [${err.response.status}]: ${detail}`);
  }
  return err;
}

// ── FASHN.ai flow ─────────────────────────────────────────────────────────────
async function tryOnFashn({ personImageUrl, garmentImageUrl, category }) {
  let prediction;
  try {
    const { data } = await axios.post(
      `${FASHN_BASE}/run`,
      { model_image: personImageUrl, garment_image: garmentImageUrl, category },
      {
        headers: { Authorization: `Bearer ${FASHN_KEY}`, 'Content-Type': 'application/json' },
        timeout: 30_000,
      },
    );
    prediction = data;
  } catch (err) {
    if (err.response) {
      const detail = err.response.data?.error || err.response.data?.message || JSON.stringify(err.response.data);
      throw new Error(`FASHN.ai [${err.response.status}]: ${detail}`);
    }
    throw err;
  }
  if (prediction.error) throw new Error(`FASHN.ai: ${prediction.error}`);

  const id = prediction.id;
  console.log(`[AR Try-On] FASHN.ai prediction: ${id}`);

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const { data } = await axios.get(`${FASHN_BASE}/status/${id}`, {
      headers: { Authorization: `Bearer ${FASHN_KEY}` },
      timeout: 15_000,
    });
    console.log(`[AR Try-On] FASHN poll ${id}: ${data.status}`);
    if (data.status === 'completed') {
      const out = data.output;
      return Array.isArray(out) ? out[0] : out;
    }
    if (data.status === 'failed') throw new Error(data.error || 'FASHN.ai xử lý thất bại');
  }
  throw new Error('Hết thời gian chờ. Vui lòng thử lại.');
}

// ── Replicate flow ────────────────────────────────────────────────────────────
async function resolveReplicateVersion() {
  if (_replicateVersion) return _replicateVersion;
  for (const model of REPLICATE_MODELS) {
    try {
      const { data } = await axios.get(
        `https://api.replicate.com/v1/models/${model}`,
        { headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` }, timeout: 15_000 },
      );
      const versionId = data?.latest_version?.id;
      if (versionId) {
        _replicateVersion = { model, versionId };
        console.log(`[AR Try-On] Replicate model "${model}"  version: ${versionId}`);
        return _replicateVersion;
      }
    } catch (e) {
      console.warn(`[AR Try-On] model "${model}" unavailable (${e.response?.status ?? e.message})`);
    }
  }
  throw new Error('Không tìm thấy model Virtual Try-On trên Replicate.');
}

async function tryOnReplicate({ personImageUrl, garmentImageUrl, productName }) {
  const { versionId } = await resolveReplicateVersion();

  let prediction;
  try {
    ({ data: prediction } = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version: versionId,
        input: {
          human_img: personImageUrl, garm_img: garmentImageUrl,
          garment_des: productName, is_checked: true,
          is_checked_crop: false, denoise_steps: 30, seed: 42,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${REPLICATE_TOKEN}`,
          'Content-Type': 'application/json',
          Prefer: 'wait=60',
        },
        timeout: 70_000,
      },
    ));
  } catch (err) { throw replicateErr(err); }

  console.log(`[AR Try-On] Replicate prediction ${prediction.id} → ${prediction.status}`);

  if (prediction.status === 'succeeded') {
    const out = prediction.output;
    return Array.isArray(out) ? out[0] : out;
  }
  if (prediction.status === 'failed') throw new Error(prediction.error || 'Model thất bại');

  // Poll
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    let d;
    try {
      ({ data: d } = await axios.get(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        { headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` }, timeout: 15_000 },
      ));
    } catch (err) { throw replicateErr(err); }
    console.log(`[AR Try-On] Replicate poll ${prediction.id}: ${d.status}`);
    if (d.status === 'succeeded') { const out = d.output; return Array.isArray(out) ? out[0] : out; }
    if (d.status === 'failed' || d.status === 'canceled') throw new Error(d.error || `Prediction ${d.status}`);
  }
  throw new Error('Hết thời gian chờ. Vui lòng thử lại.');
}

// ── Public API ────────────────────────────────────────────────────────────────
async function tryOnForProduct({ productId, personImageUrl }) {
  const product = await Product.findById(productId)
    .select('name images category')
    .populate('category', 'name');
  if (!product) throw new Error('Không tìm thấy sản phẩm');

  const garmentImageUrl = product.images?.[0];
  if (!garmentImageUrl) throw new Error('Sản phẩm không có ảnh để thử đồ');

  const categoryName = product.category?.name || '';
  const category     = detectCategory(categoryName);

  // Prefer FASHN.ai (free tier) → fallback to Replicate
  if (FASHN_KEY) {
    console.log('[AR Try-On] provider: FASHN.ai');
    const resultUrl = await tryOnFashn({ personImageUrl, garmentImageUrl, category });
    return { resultUrl, garmentImageUrl };
  }

  if (REPLICATE_TOKEN) {
    console.log('[AR Try-On] provider: Replicate');
    const resultUrl = await tryOnReplicate({ personImageUrl, garmentImageUrl, productName: product.name });
    return { resultUrl, garmentImageUrl };
  }

  throw new Error('Chưa cấu hình API key. Thêm FASHN_API_KEY (miễn phí) hoặc REPLICATE_API_KEY vào file .env');
}

module.exports = { tryOnForProduct };
