const mongoose = require('mongoose');

const loyaltyTierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    minPoints: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    discountPercent: {
      type: Number,
      required: true,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('LoyaltyTier', loyaltyTierSchema);
