const mongoose = require('mongoose');

const loyaltyPointRuleSchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      enum: ['PURCHASE', 'REVIEW', 'SHARE'],
      required: true,
      index: true,
    },
    pointsPerUnit: {
      type: Number,
      required: true,
    },
    minOrderValue: {
      type: Number,
      default: null,
    },
    maxPointsPerEvent: {
      type: Number,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('LoyaltyPointRule', loyaltyPointRuleSchema);
