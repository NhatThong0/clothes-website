const mongoose = require('mongoose');

const loyaltyRewardSchema = new mongoose.Schema({
    name:             { type: String, required: true, trim: true },
    description:      { type: String, default: '' },
    pointsRequired:   { type: Number, required: true, min: 1 },
    requiredTier:     { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
    // Thông tin voucher tạo ra khi đổi
    discountType:     { type: String, enum: ['percentage', 'fixed'], required: true },
    discountValue:    { type: Number, required: true, min: 1 },
    maxDiscountAmount:{ type: Number, default: null },
    minPurchaseAmount:{ type: Number, default: 0 },
    voucherValidDays: { type: Number, default: 30 },
    // Giới hạn số lần đổi toàn hệ thống
    maxRedeemCount:   { type: Number, default: null },
    redeemedCount:    { type: Number, default: 0 },
    // Giới hạn lượt đổi trên mỗi người
    maxRedeemPerUser: { type: Number, default: null },
    redeemedBy: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        count:  { type: Number, default: 1 },
    }],
    isActive:         { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('LoyaltyReward', loyaltyRewardSchema);
