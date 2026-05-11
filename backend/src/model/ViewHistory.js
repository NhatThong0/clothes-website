'use strict';
const mongoose = require('mongoose');

const viewHistorySchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  viewedAt:  { type: Date, default: Date.now },
});

// Compound index để dedup + query nhanh
viewHistorySchema.index({ userId: 1, productId: 1 });
// TTL 30 ngày
viewHistorySchema.index({ viewedAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

module.exports = mongoose.model('ViewHistory', viewHistorySchema);
