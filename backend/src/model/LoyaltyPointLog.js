const mongoose = require('mongoose');

const loyaltyPointLogSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actionType: {
      type: String,
      required: true,
      enum: ['PURCHASE', 'REVIEW', 'SHARE', 'REDEEM'],
      index: true,
    },
    deltaSpendable: {
      type: Number,
      required: true,
    },
    deltaTier: {
      type: Number,
      required: true,
    },
    referenceType: {
      type: String,
      default: null,
    },
    referenceId: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('LoyaltyPointLog', loyaltyPointLogSchema);
