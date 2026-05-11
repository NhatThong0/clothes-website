'use strict';

const Product     = require('../../model/Product');
const Order       = require('../../model/Order');
const ViewHistory = require('../../model/ViewHistory');
const Wishlist    = require('../../model/Wishlist');

// ─── Build user preference profile ───────────────────────────────────────────
async function buildUserProfile(userId) {
  const [orders, views, wishlist] = await Promise.all([
    Order.find({ userId, status: 'delivered' }).select('items').lean(),
    ViewHistory.find({ userId }).sort({ viewedAt: -1 }).limit(60).lean(),
    Wishlist.findOne({ userId }).lean(),
  ]);

  // Weighted sources: purchased=3, wishlist=2, viewed=1
  const sources = [
    ...orders.flatMap(o => o.items.map(i => ({ id: i.productId.toString(), w: 3 }))),
    ...(wishlist?.items || []).map(i => ({ id: i.productId.toString(), w: 2 })),
    ...views.map(v => ({ id: v.productId.toString(), w: 1 })),
  ];

  const seenIds = new Set([
    ...orders.flatMap(o => o.items.map(i => i.productId.toString())),
    ...views.map(v => v.productId.toString()),
  ]);
  const wishlistIds = new Set((wishlist?.items || []).map(i => i.productId.toString()));

  if (sources.length === 0) return null;

  // Fetch source product metadata
  const uniqueIds = [...new Set(sources.map(s => s.id))];
  const prods = await Product.find({ _id: { $in: uniqueIds } })
    .select('category styleTags occasionTags seasonTags genderTarget')
    .lean();
  const prodMap = Object.fromEntries(prods.map(p => [p._id.toString(), p]));

  const categories = {}, styleTags = {}, occasionTags = {}, seasonTags = {}, genderCounts = {};
  let totalW = 0;

  for (const { id, w } of sources) {
    const p = prodMap[id];
    if (!p) continue;
    totalW += w;

    const catId = p.category?.toString();
    if (catId) categories[catId] = (categories[catId] || 0) + w;
    for (const t of p.styleTags    || []) styleTags[t]    = (styleTags[t]    || 0) + w;
    for (const t of p.occasionTags || []) occasionTags[t] = (occasionTags[t] || 0) + w;
    for (const t of p.seasonTags   || []) seasonTags[t]   = (seasonTags[t]   || 0) + w;
    if (p.genderTarget) genderCounts[p.genderTarget] = (genderCounts[p.genderTarget] || 0) + w;
  }

  const preferredGender = Object.entries(genderCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unisex';

  return { categories, styleTags, occasionTags, seasonTags, preferredGender, seenIds, wishlistIds, totalW };
}

// ─── Score one product against user profile ───────────────────────────────────
function scoreProduct(p, profile) {
  let score = 0;
  const catId = typeof p.category === 'object' ? p.category?._id?.toString() : p.category?.toString();

  if (catId && profile.categories[catId])
    score += (profile.categories[catId] / profile.totalW) * 50;

  for (const t of p.styleTags    || []) if (profile.styleTags[t])    score += (profile.styleTags[t]    / profile.totalW) * 25;
  for (const t of p.occasionTags || []) if (profile.occasionTags[t]) score += (profile.occasionTags[t] / profile.totalW) * 18;
  for (const t of p.seasonTags   || []) if (profile.seasonTags[t])   score += (profile.seasonTags[t]   / profile.totalW) * 12;

  if (p.genderTarget === profile.preferredGender || p.genderTarget === 'unisex') score += 8;
  score += Math.log1p(p.soldCount || 0) * 2;
  if ((p.averageRating || 0) > 3) score += ((p.averageRating || 0) - 3) * 4;

  return score;
}

// ─── Public: personalized recommendations ────────────────────────────────────
async function getForYou({ userId, limit = 12, excludeId }) {
  const profile = await buildUserProfile(userId);

  // Fallback: popular products when no history
  if (!profile) return getPopular({ limit, excludeId });

  const exclude = [...profile.seenIds];
  if (excludeId) exclude.push(excludeId.toString());

  const candidates = await Product.find({
    isActive: true,
    _id: { $nin: exclude },
    stock: { $gt: 0 },
  })
    .select('_id name price discount images averageRating soldCount category styleTags occasionTags seasonTags genderTarget stock')
    .populate('category', 'name')
    .lean();

  const scored = candidates.map(p => ({ ...p, _score: scoreProduct(p, profile) }));
  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, limit);
}

// ─── Public: related products (content-based by tags + category) ──────────────
async function getRelated({ productId, limit = 8 }) {
  const target = await Product.findById(productId)
    .select('category styleTags occasionTags seasonTags genderTarget')
    .lean();
  if (!target) return [];

  const catId = target.category?.toString();
  const allTags = [
    ...(target.styleTags    || []),
    ...(target.occasionTags || []),
    ...(target.seasonTags   || []),
  ];

  const candidates = await Product.find({
    isActive: true,
    _id: { $ne: productId },
    stock: { $gt: 0 },
    $or: [
      { category: catId ? target.category : null },
      { styleTags:    { $in: target.styleTags    || [] } },
      { occasionTags: { $in: target.occasionTags || [] } },
      { seasonTags:   { $in: target.seasonTags   || [] } },
    ].filter(Boolean),
  })
    .select('_id name price discount images averageRating soldCount category styleTags occasionTags seasonTags genderTarget stock')
    .populate('category', 'name')
    .lean();

  const scored = candidates.map(p => {
    let s = 0;
    if (p.category?.toString() === catId) s += 40;
    for (const t of p.styleTags    || []) if (allTags.includes(t)) s += 15;
    for (const t of p.occasionTags || []) if (allTags.includes(t)) s += 10;
    for (const t of p.seasonTags   || []) if (allTags.includes(t)) s += 8;
    if (p.genderTarget === target.genderTarget || p.genderTarget === 'unisex') s += 5;
    s += Math.log1p(p.soldCount || 0) * 1.5;
    return { ...p, _score: s };
  });

  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, limit);
}

// ─── Fallback: popular products ───────────────────────────────────────────────
async function getPopular({ limit = 12, excludeId } = {}) {
  const query = { isActive: true, stock: { $gt: 0 } };
  if (excludeId) query._id = { $ne: excludeId };
  return Product.find(query)
    .select('_id name price discount images averageRating soldCount category stock')
    .populate('category', 'name')
    .sort({ soldCount: -1, averageRating: -1 })
    .limit(limit)
    .lean();
}

module.exports = { getForYou, getRelated, getPopular };
