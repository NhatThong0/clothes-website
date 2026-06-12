'use strict';

const ViewHistory = require('../../model/ViewHistory');
const Wishlist    = require('../../model/Wishlist');
const { getForYou, getRelated, getPopular } = require('./recommendation.service');

// POST /api/recommendations/view/:productId  (auth optional)
exports.trackView = async (req, res) => {
  try {
    const userId    = req.userId; // set by optional auth middleware
    const productId = req.params.productId;
    if (userId) {
      await ViewHistory.findOneAndUpdate(
        { userId, productId },
        { viewedAt: new Date() },
        { upsert: true },
      );
    }
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
};

// GET /api/recommendations/for-you  (auth required)
exports.forYou = async (req, res) => {
  try {
    const userId  = req.userId;
    const limit   = Math.min(parseInt(req.query.limit || 12), 24);
    const products = await getForYou({ userId, limit });
    res.json({ status: 'success', data: products });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
};

// GET /api/recommendations/related/:productId  (public)
exports.related = async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit || 8), 16);
    const products = await getRelated({ productId: req.params.productId, limit });
    res.json({ status: 'success', data: products });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
};

// GET /api/recommendations/popular  (public)
exports.popular = async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit || 12), 24);
    const products = await getPopular({ limit });
    res.json({ status: 'success', data: products });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
};

// GET  /api/recommendations/wishlist  (auth required)
exports.getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: req.userId })
      .populate({
        path: 'items.productId',
        select: '_id name price discount images averageRating stock soldCount category',
        populate: { path: 'category', select: 'name' },
      })
      .lean();
    const items = (wishlist?.items || [])
      .filter(i => i.productId)
      .map(i => ({ ...i.productId, addedAt: i.addedAt }));
    res.json({ status: 'success', data: items });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
};

// POST /api/recommendations/wishlist/:productId  (auth required, toggle)
exports.toggleWishlist = async (req, res) => {
  try {
    const userId    = req.userId;
    const productId = req.params.productId;
    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) wishlist = new Wishlist({ userId, items: [] });

    const idx = wishlist.items.findIndex(i => i.productId.toString() === productId);
    const added = idx === -1;
    if (added) wishlist.items.push({ productId });
    else        wishlist.items.splice(idx, 1);

    await wishlist.save();
    res.json({ status: 'success', data: { added, total: wishlist.items.length } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
};

// GET /api/recommendations/wishlist/check/:productId  (auth required)
exports.checkWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: req.userId }).lean();
    const saved = (wishlist?.items || []).some(i => i.productId.toString() === req.params.productId);
    res.json({ status: 'success', data: { saved } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
};
