'use strict';

const mongoose = require('mongoose');
const Product = require('../../model/Product');
const SizeChart = require('../../model/SizeChart');

const SIZE_INTENT_KEYWORDS = [
  'size',
  'co vua',
  'cỡ vừa',
  'chọn size',
  'tu van size',
  'tư vấn size',
  'mac vua',
  'mặc vừa',
  'vua khong',
  'vừa không',
  'so do',
  'số đo',
];

const FIELD_LABELS = {
  heightCm: 'chiều cao',
  weightKg: 'cân nặng',
  chestCm: 'vòng ngực',
  waistCm: 'vòng eo',
  hipCm: 'vòng mông',
  footLengthCm: 'chiều dài bàn chân',
};

const DEFAULT_SIZE_CHARTS = [
  {
    code: 'default-male-shirt-regular',
    name: 'Bảng size áo nam regular mặc định',
    categoryKey: 'shirt',
    gender: 'male',
    fit: 'regular',
    isDefault: true,
    sizes: [
      { size: 'S', heightMin: 160, heightMax: 168, weightMin: 50, weightMax: 58, chestMin: 84, chestMax: 90, priority: 1 },
      { size: 'M', heightMin: 165, heightMax: 172, weightMin: 58, weightMax: 66, chestMin: 90, chestMax: 96, priority: 2 },
      { size: 'L', heightMin: 168, heightMax: 176, weightMin: 66, weightMax: 74, chestMin: 96, chestMax: 102, priority: 3 },
      { size: 'XL', heightMin: 172, heightMax: 180, weightMin: 74, weightMax: 82, chestMin: 102, chestMax: 108, priority: 4 },
      { size: 'XXL', heightMin: 176, heightMax: 186, weightMin: 82, weightMax: 92, chestMin: 108, chestMax: 116, priority: 5 },
    ],
  },
  {
    code: 'default-female-shirt-regular',
    name: 'Bảng size áo nữ regular mặc định',
    categoryKey: 'shirt',
    gender: 'female',
    fit: 'regular',
    isDefault: true,
    sizes: [
      { size: 'XS', heightMin: 148, heightMax: 156, weightMin: 40, weightMax: 45, chestMin: 76, chestMax: 82, priority: 1 },
      { size: 'S', heightMin: 152, heightMax: 160, weightMin: 45, weightMax: 50, chestMin: 82, chestMax: 86, priority: 2 },
      { size: 'M', heightMin: 156, heightMax: 164, weightMin: 50, weightMax: 56, chestMin: 86, chestMax: 92, priority: 3 },
      { size: 'L', heightMin: 160, heightMax: 168, weightMin: 56, weightMax: 63, chestMin: 92, chestMax: 98, priority: 4 },
      { size: 'XL', heightMin: 164, heightMax: 172, weightMin: 63, weightMax: 70, chestMin: 98, chestMax: 104, priority: 5 },
    ],
  },
  {
    code: 'default-male-pants-regular',
    name: 'Bảng size quần nam mặc định',
    categoryKey: 'pants',
    gender: 'male',
    fit: 'regular',
    isDefault: true,
    sizes: [
      { size: '29', heightMin: 160, heightMax: 168, weightMin: 50, weightMax: 57, waistMin: 72, waistMax: 76, hipMin: 86, hipMax: 90, priority: 1 },
      { size: '30', heightMin: 163, heightMax: 170, weightMin: 57, weightMax: 62, waistMin: 76, waistMax: 79, hipMin: 90, hipMax: 94, priority: 2 },
      { size: '31', heightMin: 166, heightMax: 173, weightMin: 62, weightMax: 67, waistMin: 79, waistMax: 82, hipMin: 94, hipMax: 98, priority: 3 },
      { size: '32', heightMin: 168, heightMax: 176, weightMin: 67, weightMax: 73, waistMin: 82, waistMax: 85, hipMin: 98, hipMax: 102, priority: 4 },
      { size: '33', heightMin: 170, heightMax: 178, weightMin: 73, weightMax: 79, waistMin: 85, waistMax: 88, hipMin: 102, hipMax: 106, priority: 5 },
      { size: '34', heightMin: 172, heightMax: 182, weightMin: 79, weightMax: 86, waistMin: 88, waistMax: 92, hipMin: 106, hipMax: 111, priority: 6 },
    ],
  },
  {
    code: 'default-female-pants-regular',
    name: 'Bảng size quần nữ mặc định',
    categoryKey: 'pants',
    gender: 'female',
    fit: 'regular',
    isDefault: true,
    sizes: [
      { size: 'S', heightMin: 150, heightMax: 158, weightMin: 42, weightMax: 48, waistMin: 62, waistMax: 66, hipMin: 86, hipMax: 90, priority: 1 },
      { size: 'M', heightMin: 154, heightMax: 162, weightMin: 48, weightMax: 54, waistMin: 66, waistMax: 70, hipMin: 90, hipMax: 94, priority: 2 },
      { size: 'L', heightMin: 158, heightMax: 166, weightMin: 54, weightMax: 60, waistMin: 70, waistMax: 74, hipMin: 94, hipMax: 98, priority: 3 },
      { size: 'XL', heightMin: 162, heightMax: 170, weightMin: 60, weightMax: 67, waistMin: 74, waistMax: 79, hipMin: 98, hipMax: 104, priority: 4 },
    ],
  },
  {
    code: 'default-female-dress-regular',
    name: 'Bảng size đầm nữ mặc định',
    categoryKey: 'dress',
    gender: 'female',
    fit: 'regular',
    isDefault: true,
    sizes: [
      { size: 'S', heightMin: 150, heightMax: 158, chestMin: 80, chestMax: 84, waistMin: 62, waistMax: 66, hipMin: 86, hipMax: 90, priority: 1 },
      { size: 'M', heightMin: 154, heightMax: 162, chestMin: 84, chestMax: 88, waistMin: 66, waistMax: 70, hipMin: 90, hipMax: 94, priority: 2 },
      { size: 'L', heightMin: 158, heightMax: 166, chestMin: 88, chestMax: 94, waistMin: 70, waistMax: 76, hipMin: 94, hipMax: 100, priority: 3 },
      { size: 'XL', heightMin: 162, heightMax: 170, chestMin: 94, chestMax: 100, waistMin: 76, waistMax: 82, hipMin: 100, hipMax: 106, priority: 4 },
    ],
  },
  {
    code: 'default-unisex-shoes-regular',
    name: 'Bảng size giày mặc định',
    categoryKey: 'shoes',
    gender: 'unisex',
    fit: 'regular',
    isDefault: true,
    sizes: [
      { size: '38', footLengthMin: 23.5, footLengthMax: 24.1, priority: 1 },
      { size: '39', footLengthMin: 24.2, footLengthMax: 24.8, priority: 2 },
      { size: '40', footLengthMin: 24.9, footLengthMax: 25.4, priority: 3 },
      { size: '41', footLengthMin: 25.5, footLengthMax: 26.1, priority: 4 },
      { size: '42', footLengthMin: 26.2, footLengthMax: 26.8, priority: 5 },
      { size: '43', footLengthMin: 26.9, footLengthMax: 27.4, priority: 6 },
      { size: '44', footLengthMin: 27.5, footLengthMax: 28.1, priority: 7 },
    ],
  },
];

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[đĐ]/g, 'd')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsWholeWord(text, keyword) {
  return ` ${normalizeText(text)} `.includes(` ${normalizeText(keyword)} `);
}

function detectGender(text) {
  const normalized = normalizeText(text);
  if (/\b(nam|men|male)\b/.test(normalized)) return 'male';
  if (/\b(nu|female|women|woman)\b/.test(normalized)) return 'female';
  return '';
}

function detectFitPreference(text) {
  const normalized = normalizeText(text);
  if (normalized.includes('oversize') || normalized.includes('rong')) return 'oversize';
  if (normalized.includes('slim') || normalized.includes('om')) return 'slim';
  if (normalized.includes('regular') || normalized.includes('vua')) return 'regular';
  return '';
}

function detectSizeIntent(message, sizeState) {
  const normalized = normalizeText(message);
  if ((sizeState?.active || sizeState?.status === 'collecting_measurements') && hasMeasurementSignal(message)) {
    return true;
  }
  return SIZE_INTENT_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)));
}

function hasMeasurementSignal(message) {
  const normalized = normalizeText(message);
  return ['cao', 'cm', 'm ', 'kg', 'nguc', 'eo', 'mong', 'ban chan', 'chan dai'].some((hint) => normalized.includes(hint));
}

function parseMetricValue(message, aliases, unitPattern) {
  const source = String(message ?? '');

  for (const alias of aliases) {
    const regex = new RegExp(`${alias}\\s*(?:la|là|tam|tầm|khoang|khoảng|toi|tôi|:\\s*)?\\s*(\\d+(?:[\\.,]\\d+)?)\\s*${unitPattern}`, 'i');
    const match = source.match(regex);
    if (match) return Number.parseFloat(match[1].replace(',', '.'));
  }

  return null;
}

function extractHeightCm(message) {
  const source = String(message ?? '');
  const directCm = source.match(/(?:cao|height)\s*(?:la|là|tam|tầm|khoang|khoảng|:\s*)?\s*(\d{2,3}(?:[\.,]\d+)?)\s*cm/i);
  if (directCm) return Number.parseFloat(directCm[1].replace(',', '.'));

  const mixedMeter = source.match(/(?:cao|height)\s*(?:la|là|tam|tầm|khoang|khoảng|:\s*)?\s*(\d)\s*m\s*(\d{1,2})/i);
  if (mixedMeter) return Number(mixedMeter[1]) * 100 + Number(mixedMeter[2]);

  const decimalMeter = source.match(/(?:cao|height)\s*(?:la|là|tam|tầm|khoang|khoảng|:\s*)?\s*(\d(?:[\.,]\d{1,2}))\s*m/i);
  if (decimalMeter) return Math.round(Number.parseFloat(decimalMeter[1].replace(',', '.')) * 100);

  return null;
}

function extractMeasurements(message) {
  const measurements = {};
  const heightCm = extractHeightCm(message);
  const weightKg = parseMetricValue(message, ['nang', 'nặng', 'can nang', 'cân nặng', 'weight'], 'kg');
  const chestCm = parseMetricValue(message, ['nguc', 'ngực', 'vong nguc', 'vòng ngực'], 'cm');
  const waistCm = parseMetricValue(message, ['eo', 'vong eo', 'vòng eo'], 'cm');
  const hipCm = parseMetricValue(message, ['mong', 'mông', 'vong mong', 'vòng mông'], 'cm');
  const footLengthCm = parseMetricValue(message, ['ban chan', 'bàn chân', 'chan dai', 'chân dài', 'foot'], 'cm');
  const gender = detectGender(message);
  const fitPreference = detectFitPreference(message);

  if (heightCm) measurements.heightCm = heightCm;
  if (weightKg) measurements.weightKg = weightKg;
  if (chestCm) measurements.chestCm = chestCm;
  if (waistCm) measurements.waistCm = waistCm;
  if (hipCm) measurements.hipCm = hipCm;
  if (footLengthCm) measurements.footLengthCm = footLengthCm;
  if (gender) measurements.gender = gender;
  if (fitPreference) measurements.fitPreference = fitPreference;

  return measurements;
}

function mergeMeasurements(previous, current) {
  return {
    ...(previous || {}),
    ...(current || {}),
  };
}

function getLastSuggestedProducts(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (Array.isArray(message?.suggestedProducts) && message.suggestedProducts.length) {
      return message.suggestedProducts;
    }
  }
  return [];
}

function extractSuggestedIndex(message) {
  const match = String(message ?? '').match(/\b([1-3])\b/);
  return match ? Number(match[1]) : null;
}

async function resolveProductForSize({ conversation, userMessage, productCandidates }) {
  const sizeState = conversation?.sizeRecommendation;
  if (sizeState?.productId) {
    const existingProduct = await Product.findById(sizeState.productId)
      .populate({ path: 'category', select: 'name sizeChart', populate: { path: 'sizeChart' } })
      .populate('sizeChart')
      .lean();
    if (existingProduct) return existingProduct;
  }

  if (Array.isArray(productCandidates) && productCandidates.length) {
    const firstCandidate = productCandidates[0];
    return Product.findById(firstCandidate._id)
      .populate({ path: 'category', select: 'name sizeChart', populate: { path: 'sizeChart' } })
      .populate('sizeChart')
      .lean();
  }

  const suggestedProducts = getLastSuggestedProducts(conversation);
  if (suggestedProducts.length) {
    const selectedIndex = extractSuggestedIndex(userMessage) || 1;
    const selected = suggestedProducts[selectedIndex - 1] || suggestedProducts[0];
    if (selected?.productId) {
      return Product.findById(selected.productId)
        .populate({ path: 'category', select: 'name sizeChart', populate: { path: 'sizeChart' } })
        .populate('sizeChart')
        .lean();
    }
  }

  return null;
}

function resolveCategoryKey(product) {
  const normalized = normalizeText([product?.category?.name, product?.name, product?.description].join(' '));
  if (/(giay|sneaker|boot|loafer|dep|sandal)/.test(normalized)) return 'shoes';
  if (/(dam|dress)/.test(normalized)) return 'dress';
  if (/(chan vay|vay|skirt)/.test(normalized)) return 'skirt';
  if (/(quan|jean|jogger|short|kaki)/.test(normalized)) return 'pants';
  if (/(khoac|jacket|blazer|hoodie)/.test(normalized)) return 'outerwear';
  if (/(ao|shirt|tee|polo|so mi|thun)/.test(normalized)) return 'shirt';
  if (/(phu kien|accessory|non|mu|that lung|vi)/.test(normalized)) return 'accessory';
  return 'generic';
}

function resolveProductGender(product, measurements) {
  const genderFromUser = measurements?.gender;
  if (genderFromUser) return genderFromUser;

  const normalized = normalizeText(product?.genderTarget || '');
  if (/\bnam\b|\bmale\b|\bmen\b/.test(normalized)) return 'male';
  if (/\bnu\b|\bfemale\b|\bwomen\b/.test(normalized)) return 'female';
  return 'unisex';
}

function getRequiredMeasurementFields(categoryKey) {
  switch (categoryKey) {
    case 'shoes':
      return ['footLengthCm'];
    case 'pants':
    case 'skirt':
      return ['waistCm', 'hipCm', 'heightCm', 'weightKg'];
    case 'dress':
      return ['chestCm', 'waistCm', 'hipCm', 'heightCm'];
    case 'shirt':
    case 'outerwear':
      return ['chestCm', 'heightCm', 'weightKg'];
    case 'generic':
    default:
      return ['heightCm', 'weightKg'];
  }
}

function getMinimumMeasurementFields(categoryKey) {
  switch (categoryKey) {
    case 'shoes':
      return ['footLengthCm'];
    case 'pants':
    case 'skirt':
      return ['heightCm', 'weightKg'];
    case 'dress':
      return ['heightCm', 'chestCm'];
    case 'shirt':
    case 'outerwear':
    case 'generic':
    default:
      return ['heightCm', 'weightKg'];
  }
}

function listMissingFields(measurements, requiredFields) {
  return requiredFields.filter((field) => !Number.isFinite(Number(measurements?.[field])));
}

function formatFieldLabels(fields) {
  return fields.map((field) => FIELD_LABELS[field] || field).join(', ');
}

function buildMissingMeasurementsReply(product, missingFields, categoryKey) {
  const intro = product
    ? `Để mình tư vấn size chuẩn hơn cho "${product.name}", bạn cho mình thêm `
    : 'Để mình tư vấn size chuẩn hơn, bạn cho mình thêm ';

  if (!missingFields.length) {
    return `${intro}một vài số đo cơ bản nhé.`;
  }

  if (categoryKey === 'shoes') {
    return `${intro}${formatFieldLabels(missingFields)} nhé. Ví dụ: bàn chân 25.8cm.`;
  }

  return `${intro}${formatFieldLabels(missingFields)} nhé. Ví dụ: cao 175cm, nặng 68kg, ngực 96cm, eo 82cm.`;
}

function getDistanceToRange(value, min, max) {
  if (!Number.isFinite(value)) return 0;
  if (Number.isFinite(min) && value < min) return min - value;
  if (Number.isFinite(max) && value > max) return value - max;
  return 0;
}

function scoreSizeRule(rule, measurements, requiredFields) {
  let penalty = 0;
  let matchedRequired = 0;
  let matchedTotal = 0;

  const fields = ['heightCm', 'weightKg', 'chestCm', 'waistCm', 'hipCm', 'footLengthCm'];
  const keyMap = {
    heightCm: ['heightMin', 'heightMax'],
    weightKg: ['weightMin', 'weightMax'],
    chestCm: ['chestMin', 'chestMax'],
    waistCm: ['waistMin', 'waistMax'],
    hipCm: ['hipMin', 'hipMax'],
    footLengthCm: ['footLengthMin', 'footLengthMax'],
  };

  fields.forEach((field) => {
    const value = Number(measurements?.[field]);
    if (!Number.isFinite(value)) return;
    const [minKey, maxKey] = keyMap[field];
    const hasRule = Number.isFinite(rule[minKey]) || Number.isFinite(rule[maxKey]);
    if (!hasRule) return;
    const distance = getDistanceToRange(value, rule[minKey], rule[maxKey]);
    if (requiredFields.includes(field) && distance === 0) matchedRequired += 1;
    if (distance === 0) matchedTotal += 1;
    penalty += distance;
  });

  return {
    penalty,
    matchedRequired,
    matchedTotal,
    priority: Number(rule.priority || 0),
  };
}

function computeConfidence(bestScore, requiredFields, minimumFields, missingFields) {
  const baselineCount = requiredFields.length || 1;
  const matchedRatio = bestScore.matchedRequired / baselineCount;
  let confidence = 0.58;

  if (bestScore.penalty === 0 && matchedRatio >= 1) confidence = 0.94;
  else if (bestScore.penalty <= 2 && matchedRatio >= 0.75) confidence = 0.82;
  else if (bestScore.penalty <= 5) confidence = 0.7;

  const missingCount = missingFields.length;
  if (missingCount > 0) {
    const minimumCount = minimumFields.length || 1;
    const supportRatio = Math.min(1, bestScore.matchedRequired / minimumCount);
    confidence = Math.min(confidence, 0.76 * Math.max(0.75, supportRatio));
  }

  return confidence;
}

function buildReasoning(product, size, categoryKey, measurements) {
  const usedParts = [];
  if (Number.isFinite(Number(measurements.heightCm))) usedParts.push(`cao ${measurements.heightCm}cm`);
  if (Number.isFinite(Number(measurements.weightKg))) usedParts.push(`nặng ${measurements.weightKg}kg`);
  if (Number.isFinite(Number(measurements.chestCm)) && ['shirt', 'outerwear', 'dress'].includes(categoryKey)) usedParts.push(`ngực ${measurements.chestCm}cm`);
  if (Number.isFinite(Number(measurements.waistCm)) && ['pants', 'skirt', 'dress'].includes(categoryKey)) usedParts.push(`eo ${measurements.waistCm}cm`);
  if (Number.isFinite(Number(measurements.hipCm)) && ['pants', 'skirt', 'dress'].includes(categoryKey)) usedParts.push(`mông ${measurements.hipCm}cm`);
  if (Number.isFinite(Number(measurements.footLengthCm)) && categoryKey === 'shoes') usedParts.push(`bàn chân ${measurements.footLengthCm}cm`);

  const fitText = measurements.fitPreference ? `, thiên về dáng ${measurements.fitPreference}` : '';
  return `Size ${size} phù hợp với ${usedParts.join(', ')}${fitText} cho mẫu ${product.name}.`;
}

async function resolveSizeChart(product, categoryKey, measurements) {
  if (product?.sizeChart?.sizes?.length) {
    return product.sizeChart;
  }

  if (product?.category?.sizeChart?.sizes?.length) {
    return product.category.sizeChart;
  }

  if (product?.sizeChart && typeof product.sizeChart === 'string' && mongoose.connection.readyState === 1) {
    const dbChart = await SizeChart.findById(product.sizeChart).lean();
    if (dbChart?.sizes?.length) return dbChart;
  }

  if (product?.category?.sizeChart && typeof product.category.sizeChart === 'string' && mongoose.connection.readyState === 1) {
    const categoryChart = await SizeChart.findById(product.category.sizeChart).lean();
    if (categoryChart?.sizes?.length) return categoryChart;
  }

  const gender = resolveProductGender(product, measurements);
  const fit = normalizeText(measurements?.fitPreference || product?.fit || 'regular') || 'regular';

  let dbChart = null;
  if (mongoose.connection.readyState === 1) {
    const genderPriority = gender && gender !== 'unisex'
      ? [gender, 'unisex', 'male', 'female']
      : ['unisex', 'male', 'female'];

    for (const genderCandidate of genderPriority) {
      dbChart = await SizeChart.findOne({
        categoryKey,
        gender: genderCandidate,
        fit: { $in: [fit, 'regular', 'unisex', 'other'] },
        isDefault: true,
        isActive: true,
      })
        .sort({ fit: -1 })
        .lean();

      if (dbChart?.sizes?.length) break;
    }
  }

  if (dbChart?.sizes?.length) return dbChart;

  const defaultCandidates = gender && gender !== 'unisex'
    ? [gender, 'unisex', 'male', 'female']
    : ['unisex', 'male', 'female'];

  for (const genderCandidate of defaultCandidates) {
    const fallbackChart = DEFAULT_SIZE_CHARTS.find((chart) =>
      chart.categoryKey === categoryKey &&
      chart.gender === genderCandidate &&
      (chart.fit === fit || chart.fit === 'regular')
    );
    if (fallbackChart) return fallbackChart;
  }

  return DEFAULT_SIZE_CHARTS.find((chart) =>
    chart.categoryKey === categoryKey && (chart.fit === fit || chart.fit === 'regular')
  ) || null;
}

async function recommendSizeForProduct(product, measurements) {
  const categoryKey = resolveCategoryKey(product);
  const sizeChart = await resolveSizeChart(product, categoryKey, measurements);
  if (!sizeChart?.sizes?.length) {
    return {
      ok: false,
      categoryKey,
      error: 'SIZE_CHART_NOT_FOUND',
    };
  }

  const requiredFields = getRequiredMeasurementFields(categoryKey);
  const minimumFields = getMinimumMeasurementFields(categoryKey);
  const minimumMissingFields = listMissingFields(measurements, minimumFields);
  if (minimumMissingFields.length) {
    return {
      ok: false,
      categoryKey,
      sizeChart,
      missingFields: minimumMissingFields,
      minimumMissingFields,
      canRecommendProvisionally: false,
    };
  }

  const missingFields = listMissingFields(measurements, requiredFields);

  const ranked = sizeChart.sizes
    .map((rule) => ({
      rule,
      score: scoreSizeRule(rule, measurements, minimumFields),
    }))
    .sort((a, b) => {
      if (a.score.penalty !== b.score.penalty) return a.score.penalty - b.score.penalty;
      if (a.score.matchedRequired !== b.score.matchedRequired) return b.score.matchedRequired - a.score.matchedRequired;
      if (a.score.matchedTotal !== b.score.matchedTotal) return b.score.matchedTotal - a.score.matchedTotal;
      return a.score.priority - b.score.priority;
    });

  const best = ranked[0];
  if (!best?.rule) {
    return {
      ok: false,
      categoryKey,
      sizeChart,
      error: 'SIZE_RULE_NOT_FOUND',
    };
  }

  return {
    ok: true,
    categoryKey,
    sizeChart,
    size: best.rule.size,
    confidence: computeConfidence(best.score, requiredFields, minimumFields, missingFields),
    reasoning: buildReasoning(product, best.rule.size, categoryKey, measurements),
    missingFields,
    isProvisional: missingFields.length > 0,
  };
}

function createIdleState() {
  return {
    active: false,
    status: 'idle',
    productId: null,
    productName: '',
    categoryKey: '',
    sizeChartId: null,
    measurements: {},
    missingFields: [],
    lastAskedFields: [],
    recommendedSize: '',
    confidence: 0,
    reasoning: '',
    updatedAt: new Date(),
  };
}

async function handleSizeConsultation({ conversation, userMessage, productCandidates }) {
  const currentState = conversation?.sizeRecommendation || createIdleState();
  const shouldHandle = detectSizeIntent(userMessage, currentState);
  if (!shouldHandle) return null;

  const product = await resolveProductForSize({ conversation, userMessage, productCandidates });
  if (!product) {
    return {
      handled: true,
      answer: 'Mình có thể tư vấn size cho bạn, nhưng trước tiên bạn gửi giúp mình tên hoặc sản phẩm bạn đang quan tâm nhé.',
      suggestedProducts: (productCandidates || []).slice(0, 3),
      sizeRecommendationState: {
        ...createIdleState(),
        active: true,
        status: 'collecting_measurements',
        updatedAt: new Date(),
      },
    };
  }

  const parsedMeasurements = extractMeasurements(userMessage);
  const mergedMeasurements = mergeMeasurements(currentState.measurements, parsedMeasurements);
  const recommendation = await recommendSizeForProduct(product, mergedMeasurements);

  if (!recommendation.ok && recommendation.missingFields?.length) {
    return {
      handled: true,
      answer: buildMissingMeasurementsReply(product, recommendation.missingFields, recommendation.categoryKey),
      suggestedProducts: [product],
      sizeRecommendationState: {
        active: true,
        status: 'collecting_measurements',
        productId: product._id,
        productName: product.name,
        categoryKey: recommendation.categoryKey,
        sizeChartId: recommendation.sizeChart?._id || null,
        measurements: mergedMeasurements,
        missingFields: recommendation.missingFields,
        lastAskedFields: recommendation.missingFields,
        recommendedSize: '',
        confidence: 0,
        reasoning: '',
        updatedAt: new Date(),
      },
    };
  }

  if (!recommendation.ok) {
    return {
      handled: true,
      answer: `Mình chưa có đủ bảng size chuẩn cho "${product.name}" để chốt size chính xác. Nếu cần, bạn có thể gắn size chart riêng cho sản phẩm này để mình tư vấn sát hơn.`,
      suggestedProducts: [product],
      sizeRecommendationState: {
        ...createIdleState(),
        active: false,
        status: 'idle',
        updatedAt: new Date(),
      },
    };
  }

  const fitSuggestion = mergedMeasurements.fitPreference === 'oversize'
    ? 'Nếu bạn thích mặc ôm hơn, có thể cân nhắc xuống 1 size.'
    : mergedMeasurements.fitPreference === 'slim'
      ? 'Nếu bạn thích mặc thoải mái hơn, có thể cân nhắc lên 1 size.'
      : 'Nếu bạn thích form rộng hơn, có thể cân nhắc lên 1 size.';

  const precisionNudge = recommendation.isProvisional && recommendation.missingFields?.length
    ? ` Mình đang chốt size tạm theo chiều cao và cân nặng. Nếu bạn gửi thêm ${formatFieldLabels(recommendation.missingFields)}, mình sẽ chốt sát dáng hơn nữa.`
    : '';

  return {
    handled: true,
    answer: `Mình gợi ý bạn chọn size ${recommendation.size} cho "${product.name}". ${recommendation.reasoning} Độ tự tin khoảng ${Math.round(recommendation.confidence * 100)}%. ${fitSuggestion}${precisionNudge}`,
    suggestedProducts: [product],
    sizeRecommendationState: {
      active: recommendation.isProvisional,
      status: recommendation.isProvisional ? 'collecting_measurements' : 'recommended',
      productId: product._id,
      productName: product.name,
      categoryKey: recommendation.categoryKey,
      sizeChartId: recommendation.sizeChart?._id || null,
      measurements: mergedMeasurements,
      missingFields: recommendation.missingFields || [],
      lastAskedFields: recommendation.missingFields || [],
      recommendedSize: recommendation.size,
      confidence: recommendation.confidence,
      reasoning: recommendation.reasoning,
      updatedAt: new Date(),
    },
  };
}

module.exports = {
  handleSizeConsultation,
  _internal: {
    detectSizeIntent,
    extractMeasurements,
    resolveCategoryKey,
    getRequiredMeasurementFields,
    recommendSizeForProduct,
    DEFAULT_SIZE_CHARTS,
  },
};
