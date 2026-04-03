'use strict';

const axios = require('axios');
const Product = require('../../model/Product');
require('../../model/SizeChart');

// ─────────────────────────────────────────────
// SECTION 1 — CONFIGURATION & CONSTANTS
// ─────────────────────────────────────────────

/**
 * Score weights cho ranking sản phẩm.
 * Tập trung tất cả magic numbers vào một chỗ để dễ điều chỉnh.
 */
const SCORE_WEIGHTS = {
  TYPE_MATCH: 40,       // Khớp đúng loại sản phẩm (giày, áo, quần...)
  TYPE_MISMATCH: -35,   // Sai loại sản phẩm
  OTHER_TYPE: -18,      // Là loại khác không liên quan
  SUBTYPE_MATCH: 45,    // Khớp đúng sub-loại (short, jean, sneaker...)
  SUBTYPE_MISMATCH: -30,
  OTHER_SUBTYPE: -12,
  GENDER_MATCH: 18,     // Đúng giới tính
  GENDER_MISMATCH: -24, // Sai giới tính — penalty nặng hơn bonus
};

/** Giới hạn độ dài input từ user để tránh prompt injection qua message dài. */
const USER_MESSAGE_MAX_LENGTH = 500;

/** Số message tối đa đưa vào context history, tính theo token budget. */
const HISTORY_MAX_TOKENS = 2000;

/** Alias nhận diện loại sản phẩm từ câu hỏi tự nhiên. */
const PRODUCT_TYPE_ALIASES = {
  giay: ['giay', 'sneaker', 'boot', 'boots', 'dep', 'loafer', 'oxford'],
  ao: ['ao', 'thun', 'so mi', 'somi', 'polo', 'hoodie', 'khoac'],
  quan: ['quan', 'jean', 'jeans', 'kaki', 'short', 'jogger', 'tay'],
  dam: ['dam', 'dress'],
  vay: ['vay', 'chan vay', 'skirt'],
  phu_kien: ['phu kien', 'that lung', 'non', 'mu', 'vi', 'tui', 'kinh', 'dong ho'],
};

/** Alias nhận diện sub-loại sản phẩm chi tiết hơn. */
const SUBTYPE_ALIASES = {
  short: ['short', 'shorts'],
  jean: ['jean', 'jeans', 'denim'],
  kaki: ['kaki'],
  cargo: ['cargo', 'tui hop'],
  sneaker: ['sneaker'],
  dep: ['dep', 'sandal'],
  polo: ['polo'],
  hoodie: ['hoodie'],
};

/**
 * Alias nhận diện giới tính — tập trung vào config thay vì hardcode regex.
 * Mỗi key là một giá trị canonical, value là danh sách từ đồng nghĩa.
 */
const GENDER_ALIASES = {
  male: ['nam', 'men', 'male', 'be trai'],
  female: ['nu', 'women', 'woman', 'female', 'be gai'],
};

/**
 * Các loại intent người dùng có thể có.
 * Dùng để chọn chiến lược trả lời phù hợp.
 *
 * OUTFIT_REQUEST  → "mình nên mặc gì với...", "phối đồ như thế nào"
 * PRODUCT_SEARCH  → "tìm áo thun", "có giày sneaker không"
 * STYLE_ADVICE    → "mặc gì đi tiệc", "style nào phù hợp với mình"
 * GENERAL         → chào hỏi, câu hỏi chung không liên quan sản phẩm
 */
const INTENT = {
  OUTFIT_REQUEST: 'OUTFIT_REQUEST',
  PRODUCT_SEARCH: 'PRODUCT_SEARCH',
  STYLE_ADVICE: 'STYLE_ADVICE',
  GENERAL: 'GENERAL',
};

/** Từ khóa nhận diện intent phối đồ. */
const OUTFIT_KEYWORDS = [
  'phoi', 'phối', 'mac voi', 'mặc với', 'ket hop', 'kết hợp', 'mix',
  'mac gi', 'mặc gì', 'dung voi', 'dùng với', 'mac cung', 'mặc cùng',
  'nen mac', 'nên mặc', 'set do', 'set đồ', 'trang phuc', 'outfit',
  'trong voi', 'trông với',
];

/** Từ khóa nhận diện intent tư vấn phong cách. */
const STYLE_ADVICE_KEYWORDS = [
  'mac gi khi', 'mặc gì khi', 'nen mac gi', 'nên mặc gì',
  'phong cach', 'phong cách', 'style', 'kieu dang', 'kiểu dáng',
  'hop voi', 'hợp với', 'phu hop', 'phù hợp', 'mac gi di', 'mặc gì đi',
  'di tiec', 'đi tiệc', 'du tiec', 'dự tiệc', 'su kien', 'sự kiện',
  'tư vấn', 'tu van', 'goi y', 'gợi ý', 'nen chon', 'nên chọn',
];

// ─────────────────────────────────────────────
// SECTION 2 — UTILITY HELPERS
// ─────────────────────────────────────────────

/**
 * Cắt ngắn text về độ dài tối đa, thêm "..." nếu bị cắt.
 * Dùng để giới hạn token khi build prompt cho LLM.
 */
function trimText(value, max = 200) {
  const text = String(value ?? '');
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * Format mảng thành chuỗi phân cách bởi dấu phẩy.
 * Trả về 'Khong ro' khi rỗng để LLM không bị confused bởi giá trị trống.
 */
function formatList(values) {
  return Array.isArray(values) && values.length ? values.join(', ') : 'Khong ro';
}

/**
 * Chuẩn hóa text: bỏ dấu tiếng Việt, lowercase, loại bỏ ký tự đặc biệt.
 * Kết quả dùng để so sánh fuzzy — không dùng cho display.
 */
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

/** Format mảng thành chuỗi (không có separator) để dùng trong search text. */
function formatListForSearch(values) {
  return Array.isArray(values) ? values.join(' ') : '';
}

/**
 * Tách query thành danh sách keyword.
 * Lọc bỏ các từ quá ngắn (< 2 ký tự) và giới hạn tối đa 10 keywords.
 */
function extractKeywords(query) {
  return String(query ?? '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length >= 2)
    .slice(0, 10);
}

/** Kiểm tra text có chứa ít nhất một alias trong danh sách không. */
function matchesAnyAlias(text, aliases) {
  const normalizedText = ` ${normalizeText(text)} `;

  return aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias) return false;
    return normalizedText.includes(` ${normalizedAlias} `);
  });
}

/**
 * Xây dựng "search text" tổng hợp cho một sản phẩm.
 * Kết hợp tất cả các field liên quan thành một chuỗi normalized để scoring.
 */
function getProductSearchText(product) {
  return normalizeText(
    [
      product.name,
      product.description,
      product.shortDescription,
      product.material,
      product.aiSummary,
      product.category?.name,
      product.genderTarget,
      formatListForSearch(product.features),
      formatListForSearch(product.styleTags),
      formatListForSearch(product.occasionTags),
      formatListForSearch(product.seasonTags),
      formatListForSearch(product.matchWith),
      formatListForSearch(product.colorFamilies || product.colors),
    ].join(' '),
  );
}

// ─────────────────────────────────────────────
// SECTION 3 — INPUT SANITIZATION
// ─────────────────────────────────────────────

/**
 * Sanitize message từ user trước khi đưa vào prompt LLM.
 *
 * Mục tiêu:
 * 1. Giới hạn độ dài để tránh token overflow.
 * 2. Loại bỏ các pattern prompt injection phổ biến.
 *
 * Lưu ý: Đây là lớp bảo vệ cơ bản (defense-in-depth).
 * Không thể chặn 100% injection — cần kết hợp với việc
 * validate output của LLM trước khi dùng.
 */
function sanitizeUserMessage(message) {
  return String(message ?? '')
    .slice(0, USER_MESSAGE_MAX_LENGTH)
    .replace(/ignore\s+(all\s+|previous\s+|above\s+)?instructions?/gi, '[blocked]')
    .replace(/system\s+prompt/gi, '[blocked]')
    .replace(/you\s+are\s+now/gi, '[blocked]')
    .replace(/act\s+as/gi, '[blocked]')
    .trim();
}

// ─────────────────────────────────────────────
// SECTION 4 — REQUEST PROFILE INFERENCE
// ─────────────────────────────────────────────

/**
 * Phân tích query của user để rút ra "profile yêu cầu":
 * - productTypes: loại sản phẩm chính (giày, áo, quần...)
 * - subtypes: sub-loại cụ thể (jean, short, sneaker...)
 * - gender: giới tính nếu có đề cập
 *
 * Profile này được dùng để filter và score sản phẩm,
 * không phải để trả lời trực tiếp cho user.
 */
function inferRequestProfile(query) {
  const text = normalizeText(query);

  const productTypes = Object.entries(PRODUCT_TYPE_ALIASES)
    .filter(([, aliases]) => matchesAnyAlias(text, aliases))
    .map(([type]) => type);

  const subtypes = Object.entries(SUBTYPE_ALIASES)
    .filter(([, aliases]) => matchesAnyAlias(text, aliases))
    .map(([type]) => type);

  // Detect giới tính bằng config GENDER_ALIASES thay vì hardcode regex
  let gender = null;
  for (const [genderKey, aliases] of Object.entries(GENDER_ALIASES)) {
    const pattern = new RegExp(`(^|\\s)(${aliases.join('|')})(\\s|$)`);
    if (pattern.test(text)) {
      gender = genderKey;
      break;
    }
  }

  return { normalizedQuery: text, productTypes, subtypes, gender };
}

/**
 * Phát hiện intent của user từ câu hỏi.
 *
 * Thứ tự ưu tiên:
 * 1. OUTFIT_REQUEST — hỏi về phối đồ (ưu tiên cao nhất vì cần xử lý khác)
 * 2. STYLE_ADVICE   — hỏi tư vấn phong cách
 * 3. PRODUCT_SEARCH — tìm sản phẩm cụ thể
 * 4. GENERAL        — mọi thứ còn lại
 *
 * Tại sao cần intent?
 * → Mỗi intent cần tone và format trả lời khác nhau.
 *   OUTFIT_REQUEST cần gợi ý set đồ hoàn chỉnh.
 *   PRODUCT_SEARCH cần focus vào thông tin sản phẩm.
 *   STYLE_ADVICE cần câu hỏi làm rõ context trước khi gợi ý.
 *
 * @param {string} query - Raw query từ user (chưa normalize)
 * @param {object} profile - Profile đã infer từ inferRequestProfile
 * @returns {string} Một trong các giá trị INTENT.*
 */
function detectIntent(query, profile) {
  const text = normalizeText(query);

  if (OUTFIT_KEYWORDS.some((kw) => text.includes(normalizeText(kw)))) {
    return INTENT.OUTFIT_REQUEST;
  }

  if (STYLE_ADVICE_KEYWORDS.some((kw) => text.includes(normalizeText(kw)))) {
    return INTENT.STYLE_ADVICE;
  }

  if (profile.productTypes.length || profile.subtypes.length) {
    return INTENT.PRODUCT_SEARCH;
  }

  return INTENT.GENERAL;
}



/**
 * Tính điểm keyword match cho một sản phẩm.
 * Mỗi field có weight riêng — field quan trọng hơn (name, category)
 * đóng góp điểm nhiều hơn.
 */
function scoreCandidate(product, keywords) {
  const buckets = [
    { text: product.name, weight: 6 },
    { text: product.shortDescription, weight: 5 },
    { text: product.description, weight: 3 },
    { text: product.aiSummary, weight: 5 },
    { text: product.material, weight: 4 },
    { text: formatList(product.features), weight: 7 },
    { text: formatList(product.styleTags), weight: 5 },
    { text: formatList(product.occasionTags), weight: 5 },
    { text: formatList(product.matchWith), weight: 4 },
    { text: formatList(product.colorFamilies || product.colors), weight: 2 },
    { text: product.category?.name, weight: 8 },
  ];

  return keywords.reduce((score, keyword) => {
    return (
      score +
      buckets.reduce((sum, bucket) => {
        const haystack = String(bucket.text ?? '').toLowerCase();
        return sum + (haystack.includes(keyword) ? bucket.weight : 0);
      }, 0)
    );
  }, 0);
}

/**
 * Điều chỉnh điểm dựa trên giới tính.
 * Bonus khi match, penalty nặng khi sai giới tính.
 * Penalty > bonus để tránh gợi ý sản phẩm sai đối tượng.
 */
function getProductGenderScore(product, profile, searchText) {
  if (!profile.gender) return 0;

  const genderText = normalizeText([product.genderTarget, searchText].join(' '));
  const maleHints = GENDER_ALIASES.male.map((alias) => ` ${alias} `);
  const femaleHints = GENDER_ALIASES.female.map((alias) => ` ${alias} `);
  const padded = ` ${genderText} `;

  if (profile.gender === 'male') {
    if (maleHints.some((hint) => padded.includes(hint))) return SCORE_WEIGHTS.GENDER_MATCH;
    if (femaleHints.some((hint) => padded.includes(hint))) return SCORE_WEIGHTS.GENDER_MISMATCH;
  }

  if (profile.gender === 'female') {
    if (femaleHints.some((hint) => padded.includes(hint))) return SCORE_WEIGHTS.GENDER_MATCH;
    if (maleHints.some((hint) => padded.includes(hint))) return SCORE_WEIGHTS.GENDER_MISMATCH;
  }

  return 0;
}

/**
 * Điều chỉnh điểm dựa trên loại sản phẩm chính.
 * +40 nếu đúng loại, -35 nếu không match loại nào được yêu cầu,
 * -18 nếu là loại khác hoàn toàn.
 */
function getProductTypeScore(profile, searchText) {
  if (!profile.productTypes.length) return 0;

  let score = 0;
  for (const type of profile.productTypes) {
    const aliases = PRODUCT_TYPE_ALIASES[type] || [];
    if (matchesAnyAlias(searchText, aliases)) score += SCORE_WEIGHTS.TYPE_MATCH;
  }

  const requestedAliases = profile.productTypes.flatMap((type) => PRODUCT_TYPE_ALIASES[type] || []);
  if (requestedAliases.length && !matchesAnyAlias(searchText, requestedAliases)) {
    score += SCORE_WEIGHTS.TYPE_MISMATCH;
  }

  const otherAliases = Object.entries(PRODUCT_TYPE_ALIASES)
    .filter(([type]) => !profile.productTypes.includes(type))
    .flatMap(([, aliases]) => aliases);
  if (matchesAnyAlias(searchText, otherAliases)) score += SCORE_WEIGHTS.OTHER_TYPE;

  return score;
}

/**
 * Điều chỉnh điểm dựa trên sub-loại (jean, short, sneaker...).
 * Precision cao hơn getProductTypeScore — penalty cũng nặng hơn.
 */
function getSubtypeScore(profile, searchText) {
  if (!profile.subtypes.length) return 0;

  let score = 0;
  for (const subtype of profile.subtypes) {
    const aliases = SUBTYPE_ALIASES[subtype] || [];
    score += matchesAnyAlias(searchText, aliases)
      ? SCORE_WEIGHTS.SUBTYPE_MATCH
      : SCORE_WEIGHTS.SUBTYPE_MISMATCH;
  }

  const unrelatedSubtypes = Object.entries(SUBTYPE_ALIASES)
    .filter(([type]) => !profile.subtypes.includes(type))
    .flatMap(([, aliases]) => aliases);
  if (matchesAnyAlias(searchText, unrelatedSubtypes)) score += SCORE_WEIGHTS.OTHER_SUBTYPE;

  return score;
}

// ─────────────────────────────────────────────
// SECTION 6 — PRODUCT FILTERING & RANKING
// ─────────────────────────────────────────────

/** Kiểm tra một sản phẩm có thỏa mãn profile yêu cầu không (hard filter). */
function isStrongProfileMatch(product, profile) {
  const searchText = getProductSearchText(product);

  const typeOk =
    !profile.productTypes.length ||
    profile.productTypes.some((type) =>
      matchesAnyAlias(searchText, PRODUCT_TYPE_ALIASES[type] || []),
    );

  const subtypeOk =
    !profile.subtypes.length ||
    profile.subtypes.every((type) =>
      matchesAnyAlias(searchText, SUBTYPE_ALIASES[type] || []),
    );

  const genderPenalty = getProductGenderScore(product, profile, searchText);
  return typeOk && subtypeOk && genderPenalty > -20;
}

/**
 * Lọc sản phẩm theo profile.
 * Chiến lược: thử strict match trước, nếu không có kết quả
 * thì fallback về toàn bộ danh sách (tránh trả về rỗng).
 */
function filterProductsByProfile(products, profile) {
  if (!profile.productTypes.length && !profile.subtypes.length && !profile.gender) {
    return products;
  }

  const strictMatches = (products || []).filter((product) =>
    isStrongProfileMatch(product, profile),
  );
  if (strictMatches.length) return strictMatches;

  if (profile.productTypes.length || profile.subtypes.length) return [];

  return products;
}

/**
 * Sắp xếp sản phẩm theo tổng điểm (keyword + type + subtype + gender).
 * Kết quả là top `limit` sản phẩm phù hợp nhất.
 */
function rankProducts(products, keywords, limit, profile) {
  const filteredProducts = filterProductsByProfile(products, profile);

  return filteredProducts
    .map((product) => {
      const searchText = getProductSearchText(product);
      return {
        ...product,
        _featureScore:
          scoreCandidate(product, keywords) +
          getProductTypeScore(profile, searchText) +
          getSubtypeScore(profile, searchText) +
          getProductGenderScore(product, profile, searchText),
      };
    })
    .sort((a, b) => b._featureScore - a._featureScore)
    .slice(0, limit);
}

// ─────────────────────────────────────────────
// SECTION 7 — DATABASE SEARCH
// ─────────────────────────────────────────────

/** Tạo điều kiện $or để regex search trên nhiều field. */
function buildSearchOrConditions(pattern) {
  return [
    { name: { $regex: pattern, $options: 'i' } },
    { description: { $regex: pattern, $options: 'i' } },
    { shortDescription: { $regex: pattern, $options: 'i' } },
    { material: { $regex: pattern, $options: 'i' } },
    { features: { $regex: pattern, $options: 'i' } },
    { styleTags: { $regex: pattern, $options: 'i' } },
    { occasionTags: { $regex: pattern, $options: 'i' } },
    { seasonTags: { $regex: pattern, $options: 'i' } },
    { matchWith: { $regex: pattern, $options: 'i' } },
    { aiSummary: { $regex: pattern, $options: 'i' } },
  ];
}

/**
 * Tìm kiếm sản phẩm với 2 chiến lược:
 * 1. MongoDB text search (nhanh, cần text index).
 * 2. Regex search (fallback khi text index không khả dụng).
 *
 * Cả hai đều đi qua rankProducts để đảm bảo kết quả nhất quán.
 *
 * @param {object} options
 * @param {string} options.query - Câu query từ user
 * @param {number} options.limit - Số sản phẩm tối đa trả về
 * @param {object} options.stockFilter - MongoDB filter cho trường stock
 */
async function searchProducts({ query, limit = 4, stockFilter }) {
  const normalizedQuery = String(query ?? '').trim();
  if (!normalizedQuery) return [];

  const profile = inferRequestProfile(normalizedQuery);
  const keywords = extractKeywords(normalizedQuery);
  const baseFilter = { isActive: { $ne: false }, stock: stockFilter };

  // Chiến lược 1: MongoDB full-text search
  try {
    const textMatches = await Product.find(
      { ...baseFilter, $text: { $search: normalizedQuery } },
      { score: { $meta: 'textScore' } },
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit * 6)
      .populate({ path: 'category', select: 'name sizeChart', populate: { path: 'sizeChart' } })
      .populate('sizeChart')
      .lean();

    if (Array.isArray(textMatches) && textMatches.length) {
      return rankProducts(textMatches, keywords, limit, profile);
    }
  } catch (err) {
    // Text index chưa tạo hoặc không khả dụng → fallback regex
    // Không log error ở đây vì đây là expected behavior khi chưa có index
  }

  // Chiến lược 2: Regex search (fallback)
  if (!keywords.length) return [];

  try {
    const pattern = keywords.join('|');
    const candidates = await Product.find({
      ...baseFilter,
      $or: buildSearchOrConditions(pattern),
    })
      .limit(limit * 10)
      .populate({ path: 'category', select: 'name sizeChart', populate: { path: 'sizeChart' } })
      .populate('sizeChart')
      .lean();

    return rankProducts(candidates, keywords, limit, profile);
  } catch (err) {
    // Log lỗi thực sự từ DB (connection error, timeout...)
    console.error('[searchProducts] DB error during regex search:', err.message);
    return [];
  }
}

/** Tìm sản phẩm còn hàng (stock > 0). */
async function getProductCandidates({ query, limit = 4 }) {
  return searchProducts({ query, limit, stockFilter: { $gt: 0 } });
}

/** Tìm sản phẩm đã hết hàng (stock <= 0) — dùng để phát hiện intent. */
async function getUnavailableProductMatches({ query, limit = 3 }) {
  return searchProducts({ query, limit, stockFilter: { $lte: 0 } });
}

// ─────────────────────────────────────────────
// SECTION 8 — LLM PROMPT BUILDERS
// ─────────────────────────────────────────────

/**
 * System prompt — định nghĩa nhân cách và rule cứng cho LLM.
 *
 * Thiết kế theo 3 lớp:
 * 1. NHÂN CÁCH: Ai là chatbot này? Nói chuyện như thế nào?
 * 2. RULE CỨNG: Không được làm gì? (constraints không thể vi phạm)
 * 3. HƯỚNG DẪN TRẢ LỜI: Làm thế nào cho tốt?
 *
 * Tone: "người bạn thân am hiểu thời trang" — thân mật, tự nhiên,
 * không quá formal nhưng vẫn đáng tin cậy với mọi độ tuổi.
 */
function buildSystemPrompt() {
  return `Bạn là stylist cá nhân của Fashion Hub — một người bạn thân am hiểu thời trang, luôn sẵn sàng giúp khách chọn đồ và phối outfit.

NHÂN CÁCH & TONE:
- Nói chuyện tự nhiên, thân thiện như bạn bè — không cứng nhắc, không quá formal.
- Dùng "mình" và "bạn", thi thoảng dùng "nha", "nhé", "á", "vậy" cho tự nhiên.
- Phù hợp với mọi lứa tuổi: không dùng tiếng lóng quá Gen Z, nhưng cũng không khô khan.
- Khi gợi ý, hãy nói lý do cụ thể — tại sao cái này hợp, mặc khi nào, phối với gì.
- Được phép có quan điểm riêng: "Mình thấy cái này hợp hơn vì...", "Theo mình thì..."
- Không liệt kê sản phẩm khô khan — hãy kể như đang chỉ cho bạn xem trong shop.

RULE KHÔNG ĐƯỢC VI PHẠM:
- Chỉ được nhắc đến sản phẩm có trong danh sách hệ thống cung cấp.
- Không tự bịa tên sản phẩm, màu sắc, chất liệu, giá, tồn kho ngoài dữ liệu hệ thống.
- Nếu sản phẩm hết hàng: phải nói rõ trước, rồi mới gợi ý thay thế.
- Không gợi ý sản phẩm sai loại với nhu cầu chính (hỏi giày → gợi ý giày, hỏi quần → gợi ý quần).

HƯỚNG DẪN THEO TÌNH HUỐNG:
- Khách tìm sản phẩm cụ thể: Giải thích ngắn tại sao phù hợp, nhấn điểm nổi bật.
- Khách hỏi phối đồ: Gợi ý set hoàn chỉnh, nói rõ từng món hợp nhau ở điểm gì.
- Khách hỏi mơ hồ: Hỏi thêm 1-2 câu để hiểu nhu cầu trước khi gợi ý.
- Khách hỏi tư vấn style: Hỏi dịp, phong cách thích, rồi mới gợi ý có chủ đề.`;
}

/**
 * Format thông tin một sản phẩm thành text ngắn gọn cho LLM.
 *
 * Chỉ include các field thực sự hữu ích cho LLM để sinh câu trả lời.
 * Tránh đưa quá nhiều data → LLM bị "overwhelmed" và trả lời không tự nhiên.
 */
function formatProductForPrompt(product, index) {
  const price = typeof product.price === 'number' ? product.price : Number(product.price || 0);
  const discount =
    typeof product.discount === 'number' ? product.discount : Number(product.discount || 0);

  const lines = [
    `[${index + 1}] ${product.name}`,
    `Giá: ${price.toLocaleString('vi-VN')}đ${discount > 0 ? ` (giảm ${discount}%)` : ''}`,
    `Danh mục: ${product.category?.name || 'Chưa rõ'}`,
    `Chất liệu: ${product.material || 'Chưa rõ'}`,
    `Form dáng: ${product.fit || 'Chưa rõ'}`,
    `Đối tượng: ${product.genderTarget || 'Unisex'}`,
  ];

  if (product.shortDescription || product.description) {
    lines.push(`Mô tả: ${trimText(product.shortDescription || product.description, 150)}`);
  }
  if (Array.isArray(product.features) && product.features.length) {
    lines.push(`Điểm nổi bật: ${product.features.slice(0, 4).join(', ')}`);
  }
  if (Array.isArray(product.styleTags) && product.styleTags.length) {
    lines.push(`Phong cách: ${product.styleTags.join(', ')}`);
  }
  if (Array.isArray(product.occasionTags) && product.occasionTags.length) {
    lines.push(`Dịp dùng: ${product.occasionTags.join(', ')}`);
  }
  if (Array.isArray(product.matchWith) && product.matchWith.length) {
    lines.push(`Phối với: ${product.matchWith.slice(0, 4).join(', ')}`);
  }
  if (product.aiSummary) {
    lines.push(`Tóm tắt: ${trimText(product.aiSummary, 180)}`);
  }

  return lines.join('\n');
}

/**
 * Tạo hướng dẫn trả lời cụ thể cho từng intent.
 *
 * Tại sao không dùng chung một hướng dẫn?
 * → LLM cần được "anchored" vào đúng task.
 *   OUTFIT intent cần nghĩ về set đồ tổng thể.
 *   PRODUCT_SEARCH cần focus vào so sánh và điểm nổi bật.
 *   STYLE_ADVICE cần hỏi thêm context trước khi gợi ý.
 *
 * @param {string} intent - Một trong các giá trị INTENT.*
 * @returns {string} Instruction text cho LLM
 */
function buildIntentInstruction(intent) {
  switch (intent) {
    case INTENT.OUTFIT_REQUEST:
      return `Khách đang hỏi về cách PHỐI ĐỒ. Hãy:
- Gợi ý set đồ hoàn chỉnh từ các sản phẩm có trong danh sách.
- Giải thích tại sao các món này hợp nhau (màu sắc, chất liệu, phong cách).
- Nói rõ phù hợp với dịp nào, thời tiết nào nếu biết.
- Nếu thiếu một món trong set (ví dụ khách có sẵn quần, cần tìm áo), hãy gợi ý món còn thiếu.
- Tone: như đang đứng trong shop chỉ cho bạn xem.`;

    case INTENT.STYLE_ADVICE:
      return `Khách đang hỏi TƯ VẤN PHONG CÁCH. Hãy:
- Nếu chưa rõ dịp mặc hoặc phong cách muốn hướng đến → hỏi thêm 1-2 câu trước.
- Nếu đã đủ context → gợi ý theo chủ đề/phong cách rõ ràng (casual, formal, streetwear...).
- Giải thích tại sao phong cách đó phù hợp với nhu cầu của khách.
- Gợi ý sản phẩm kèm theo cách mặc cụ thể, không chỉ liệt kê tên.`;

    case INTENT.PRODUCT_SEARCH:
      return `Khách đang TÌM SẢN PHẨM cụ thể. Hãy:
- Giải thích ngắn tại sao sản phẩm gợi ý phù hợp với nhu cầu.
- Nhấn mạnh 2-3 điểm nổi bật thực sự khác biệt của mỗi sản phẩm.
- Nếu có nhiều lựa chọn, phân biệt rõ từng cái hợp với ai/dịp nào.
- Không cần dài — 1-2 câu giải thích mỗi sản phẩm là đủ.`;

    case INTENT.GENERAL:
    default:
      return `Khách đang hỏi chung. Hãy:
- Trả lời tự nhiên, thân thiện.
- Nếu có thể gợi ý sản phẩm phù hợp → làm, nhưng không ép buộc.
- Nếu câu hỏi quá chung → hỏi thêm để hiểu nhu cầu cụ thể hơn.`;
  }
}

/**
 * User prompt — context cụ thể của request, bao gồm intent instruction.
 *
 * Cấu trúc:
 * 1. Intent instruction — định hướng cách trả lời
 * 2. Câu hỏi của khách
 * 3. Dữ liệu sản phẩm (unavailable trước, candidates sau)
 * 4. Output format instruction
 *
 * @param {string} userMessage - Message đã sanitize
 * @param {Array}  productCandidates - Sản phẩm còn hàng
 * @param {Array}  unavailableMatches - Sản phẩm hết hàng
 * @param {string} intent - Intent đã detect
 */
function buildUserPrompt(userMessage, productCandidates, unavailableMatches, intent = INTENT.GENERAL) {
  const intentInstruction = buildIntentInstruction(intent);

  const candidatesText = (productCandidates || [])
    .map((product, index) => formatProductForPrompt(product, index))
    .join('\n---\n');

  const unavailableText = (unavailableMatches || [])
    .map((product, index) => [
      `[${index + 1}] ${product.name}`,
      `Tình trạng: HẾT HÀNG`,
      `Mô tả: ${trimText(product.shortDescription || product.description, 100)}`,
    ].join('\n'))
    .join('\n---\n');

  return `${intentInstruction}

KHÁCH HỎI: "${userMessage}"

${unavailableText ? `SẢN PHẨM HẾT HÀNG (liên quan đến câu hỏi):\n${unavailableText}\n` : ''}
SẢN PHẨM CÒN HÀNG (dùng để gợi ý):
${candidatesText || '(Không có sản phẩm phù hợp trong kho)'}

Trả về JSON hợp lệ, KHÔNG có markdown hay text ngoài JSON:
{
  "answer": "<câu trả lời tiếng Việt tự nhiên>",
  "suggestedIndices": [1, 2, 3]
}

Quy tắc JSON:
- suggestedIndices chỉ chứa số nguyên tương ứng index [N] trong danh sách sản phẩm CÒN HÀNG.
- Nếu không có sản phẩm phù hợp → suggestedIndices = [].
- Nếu sản phẩm khách hỏi hết hàng → nói rõ trong answer trước khi gợi ý thay thế.
- answer phải tự nhiên, có cảm xúc — không liệt kê khô khan.
- Không bịa đặt giá, chất liệu hay thuộc tính ngoài dữ liệu hệ thống.`;
}

// ─────────────────────────────────────────────
// SECTION 9 — LLM CALL & RESPONSE PARSING
// ─────────────────────────────────────────────

/**
 * Gọi LLM API với retry đơn giản và timeout.
 *
 * Error handling phân loại rõ:
 * - 429: rate limited → throw để caller xử lý
 * - timeout: throw để caller có thể retry
 * - 5xx: LLM service down → throw
 * - network: throw
 *
 * @throws {Error} với message là error code để caller xử lý
 */
async function callLLM({ systemPrompt, userPrompt, history, model, baseUrl, headers }) {
  const payload = {
    model,
    temperature: 0.2,
    max_tokens: 1000,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userPrompt },
    ],
  };

  try {
    const response = await axios.post(`${baseUrl}/chat/completions`, payload, {
      headers,
      timeout: 15000, // 15 giây — đủ cho hầu hết LLM request
    });
    return response.data?.choices?.[0]?.message?.content || '';
  } catch (err) {
    if (err.response?.status === 429) {
      throw new Error('LLM_RATE_LIMITED');
    }
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      throw new Error('LLM_TIMEOUT');
    }
    if (err.response?.status >= 500) {
      throw new Error('LLM_SERVER_ERROR');
    }
    throw new Error(`LLM_UNAVAILABLE: ${err.message}`);
  }
}

/**
 * Parse raw response từ LLM thành structured output.
 *
 * Xử lý 2 trường hợp:
 * 1. LLM trả về JSON thuần.
 * 2. LLM trả về JSON bọc trong markdown code block (hallucination phổ biến).
 *
 * Validate suggestedIndices để đảm bảo chỉ reference đúng index tồn tại.
 */
function parseAiResponse(rawContent, candidatesLength) {
  let parsed = null;

  // Thử parse trực tiếp
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    // Thử extract JSON từ markdown block
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        parsed = null;
      }
    }
  }

  const answer =
    parsed?.answer && String(parsed.answer).trim()
      ? String(parsed.answer).trim()
      : 'Mình tìm được một vài lựa chọn phù hợp với nhu cầu của bạn. Bạn xem các sản phẩm gợi ý bên dưới nhé.';

  const safeIndices = (Array.isArray(parsed?.suggestedIndices) ? parsed.suggestedIndices : [])
    .map(Number)
    .filter((v) => Number.isFinite(v) && v >= 1 && v <= candidatesLength)
    .slice(0, 3);

  return { answer, safeIndices };
}

/**
 * Ước tính số token từ text (approximation: 4 ký tự ≈ 1 token).
 * Dùng để giới hạn history đưa vào context thay vì slice cứng.
 */
function estimateTokens(text) {
  return Math.ceil(String(text ?? '').length / 4);
}

/**
 * Xây dựng history trong giới hạn token budget.
 * Ưu tiên các message gần nhất (reverse order).
 *
 * Tại sao không dùng .slice(-10)?
 * - Với 10 message dài có thể vượt context window.
 * - Với 10 message ngắn thì bỏ phí context window.
 * Token budget linh hoạt hơn.
 */
function buildHistoryWithinBudget(conversationMessages, maxTokens = HISTORY_MAX_TOKENS) {
  const result = [];
  let tokenCount = 0;

  for (const msg of [...(conversationMessages || [])].reverse()) {
    const estimated = estimateTokens(msg.content);
    if (tokenCount + estimated > maxTokens) break;
    result.unshift({
      role: msg.senderRole === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
    tokenCount += estimated;
  }

  return result;
}

// ─────────────────────────────────────────────
// SECTION 10 — MAIN ORCHESTRATION
// ─────────────────────────────────────────────

/**
 * Tạo response trả lời cho user khi sản phẩm không còn hàng.
 * Tách ra để không phải gọi LLM trong trường hợp đơn giản.
 */
function buildUnavailableAnswer(userMessage, unavailableMatches) {
  const firstMatch = unavailableMatches?.[0];
  if (!firstMatch) {
    return `Mình chưa tìm thấy sản phẩm phù hợp với nhu cầu "${userMessage}" trong kho lúc này. Bạn có thể mô tả thêm để mình tìm kỹ hơn.`;
  }
  return 'Sản phẩm bạn đang quan tâm hiện đã hết hàng. Mời bạn xem các sản phẩm khác tương tự bên dưới.';
}

/**
 * Tạo mô tả ngắn gọn cho một sản phẩm để dùng trong fallback không cần LLM.
 * Mục tiêu là vẫn tư vấn được bằng dữ liệu có sẵn thay vì báo lỗi kỹ thuật.
 */
function buildProductHighlight(product) {
  if (!product) return '';

  const parts = [];
  const categoryName = product.category?.name;
  const material = product.material;
  const fit = product.fit;
  const features = Array.isArray(product.features) ? product.features.filter(Boolean).slice(0, 2) : [];
  const colors = Array.isArray(product.colorFamilies || product.colors)
    ? (product.colorFamilies || product.colors).filter(Boolean).slice(0, 2)
    : [];

  if (categoryName) parts.push(categoryName);
  if (material) parts.push(`chất liệu ${material}`);
  if (fit) parts.push(`form ${fit}`);
  if (colors.length) parts.push(`màu ${colors.join(', ')}`);
  if (features.length) parts.push(features.join(', '));

  return parts.join(', ');
}

/**
 * Fallback trả lời khi LLM lỗi/timeout.
 * Dựa vào intent + top sản phẩm để vẫn tạo được câu tư vấn ngắn gọn, hữu ích.
 */
function buildHeuristicAnswer({ userMessage, productCandidates, intent, llmFailed = false }) {
  const topProducts = (productCandidates || []).slice(0, 3);

  if (!topProducts.length) {
    return llmFailed
      ? `Mình chưa kịp xử lý AI cho yêu cầu "${userMessage}", nhưng hiện cũng chưa thấy sản phẩm thật sự khớp trong kho. Bạn thử nói rõ hơn về kiểu dáng, màu hoặc mức giá để mình lọc chuẩn hơn nhé.`
      : `Mình chưa tìm thấy sản phẩm thật sự phù hợp với nhu cầu "${userMessage}" trong kho lúc này. Bạn có thể nói rõ hơn về kiểu dáng, màu hoặc mức giá để mình tìm sát hơn nhé.`;
  }

  const leadInByIntent = {
    [INTENT.OUTFIT_REQUEST]:
      'Nếu bạn đang tìm đồ để phối thành set đi tiệc, mình nghiêng về các lựa chọn này vì lên dáng lịch sự và dễ mặc:',
    [INTENT.STYLE_ADVICE]:
      'Với nhu cầu này, mình thấy các lựa chọn bên dưới khá dễ mặc và đúng tinh thần bạn đang tìm:',
    [INTENT.PRODUCT_SEARCH]:
      'Mình thấy các mẫu này đang khớp nhu cầu của bạn nhất:',
    [INTENT.GENERAL]:
      'Mình gợi ý bạn xem qua vài mẫu nổi bật bên dưới nhé:',
  };

  const productLines = topProducts.map((product, index) => {
    const price = typeof product.price === 'number' ? product.price : Number(product.price || 0);
    const priceText = Number.isFinite(price) && price > 0 ? `${price.toLocaleString('vi-VN')}đ` : null;
    const highlight = buildProductHighlight(product);
    const lineParts = [`${index + 1}. ${product.name}`];

    if (highlight) lineParts.push(highlight);
    if (priceText) lineParts.push(`giá ${priceText}`);

    return lineParts.join(' - ');
  });

  const closeByIntent = {
    [INTENT.OUTFIT_REQUEST]:
      'Bạn xem 3 mẫu này trước, rồi mình có thể giúp chọn tiếp món nào mặc cùng cho ra set gọn và hợp dịp tiệc.',
    [INTENT.STYLE_ADVICE]:
      'Nếu bạn muốn, mình có thể tiếp tục chốt theo hướng lịch sự, trẻ trung hoặc tối giản để dễ chọn hơn.',
    [INTENT.PRODUCT_SEARCH]:
      'Bạn xem mẫu nào hợp mắt nhất, mình sẽ gợi ý tiếp cách chọn size hoặc mẫu gần giống.',
    [INTENT.GENERAL]:
      'Bạn thích kiểu nào hơn thì mình sẽ lọc tiếp theo đúng gu đó cho bạn.',
  };

  const prefix = llmFailed ? 'Mình đã lọc nhanh từ các sản phẩm đang có trong shop.' : '';

  return [prefix, leadInByIntent[intent] || leadInByIntent[INTENT.GENERAL], ...productLines, closeByIntent[intent] || closeByIntent[INTENT.GENERAL]]
    .filter(Boolean)
    .join(' ');
}

/**
 * Orchestrator chính — điều phối toàn bộ flow tạo AI reply.
 *
 * Flow:
 * 1. Short-circuit nếu có unavailable matches (không cần gọi LLM).
 * 2. Validate config LLM.
 * 3. Sanitize input.
 * 4. Build prompt.
 * 5. Gọi LLM.
 * 6. Parse + validate response.
 * 7. Map indices → products.
 *
 * @param {object} options
 * @param {Array}  options.conversationMessages - Lịch sử hội thoại
 * @param {string} options.userMessage - Câu hỏi hiện tại của user
 * @param {Array}  options.productCandidates - Sản phẩm còn hàng tìm được
 * @param {Array}  options.unavailableMatches - Sản phẩm hết hàng liên quan
 */
async function generateAiReply({
  conversationMessages,
  userMessage,
  productCandidates,
  unavailableMatches,
}) {
  // Short-circuit 1: Có unavailable + có candidates → trả lời nhanh, không cần LLM
  if (unavailableMatches?.length && productCandidates?.length) {
    return {
      answer: buildUnavailableAnswer(userMessage, unavailableMatches),
      suggestedProducts: productCandidates.slice(0, 3),
    };
  }

  // Short-circuit 2: Hết hàng, không có alternatives
  if (!productCandidates?.length && unavailableMatches?.length) {
    return {
      answer: buildUnavailableAnswer(userMessage, unavailableMatches),
      suggestedProducts: [],
    };
  }

  // Validate LLM config
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const isLocalModel = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

  if (!apiKey && !isLocalModel) {
    const safeMessage = sanitizeUserMessage(userMessage);
    const profile = inferRequestProfile(safeMessage);
    const intent = detectIntent(safeMessage, profile);
    return {
      answer: buildHeuristicAnswer({
        userMessage: safeMessage,
        productCandidates,
        intent,
      }),
      suggestedProducts: (productCandidates || []).slice(0, 3),
    };
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  // Sanitize + detect intent + build context
  const safeMessage = sanitizeUserMessage(userMessage);
  const profile = inferRequestProfile(safeMessage);
  const intent = detectIntent(safeMessage, profile);
  const history = buildHistoryWithinBudget(conversationMessages);
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(safeMessage, productCandidates, unavailableMatches, intent);

  // Gọi LLM với error handling
  let rawContent = '';
  try {
    rawContent = await callLLM({ systemPrompt, userPrompt, history, model, baseUrl, headers });
  } catch (err) {
    console.error('[generateAiReply] LLM call failed:', err.message);

    // Fallback graceful: vẫn tư vấn ngắn gọn từ dữ liệu sản phẩm thay vì báo lỗi kỹ thuật.
    return {
      answer: buildHeuristicAnswer({
        userMessage: safeMessage,
        productCandidates,
        intent,
        llmFailed: true,
      }),
      suggestedProducts: (productCandidates || []).slice(0, 3),
    };
  }

  // Parse + map về products
  const { answer, safeIndices } = parseAiResponse(rawContent, productCandidates?.length || 0);

  const suggestedProducts = (
    safeIndices.length
      ? safeIndices.map((index) => productCandidates[index - 1])
      : (productCandidates || []).slice(0, 3)
  ).filter(Boolean);

  return { answer, suggestedProducts };
}

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

module.exports = {
  getProductCandidates,
  getUnavailableProductMatches,
  generateAiReply,
  // Export thêm các helper để unit test riêng từng phần
  _internal: {
    sanitizeUserMessage,
    inferRequestProfile,
    detectIntent,
    rankProducts,
    buildSystemPrompt,
    buildUserPrompt,
    buildIntentInstruction,
    parseAiResponse,
    buildHistoryWithinBudget,
    buildHeuristicAnswer,
  },
};
