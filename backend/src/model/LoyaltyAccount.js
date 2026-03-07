const mongoose = require('mongoose');

/**
 * LoyaltyAccount — lưu điểm & hạng thành viên của mỗi user
 * Điểm cộng: mỗi 1.000đ chi tiêu = 1 điểm (có thể cấu hình)
 * Hạng:
 *   Bronze:   0      – 999   điểm tích lũy
 *   Silver:   1.000  – 4.999
 *   Gold:     5.000  – 19.999
 *   Platinum: 20.000+
 */
const TIERS = [
    { name: 'bronze',   min: 0,      max: 999,    label: 'Đồng',  discount: 0   },
    { name: 'silver',   min: 1000,   max: 4999,   label: 'Bạc',   discount: 2   }, // 2%
    { name: 'gold',     min: 5000,   max: 19999,  label: 'Vàng',  discount: 5   }, // 5%
    { name: 'platinum', min: 20000,  max: Infinity,label: 'Kim Cương', discount: 10 }, // 10%
];

const loyaltySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    points:           { type: Number, default: 0 },  // điểm hiện tại (có thể dùng)
    totalPointsEarned:{ type: Number, default: 0 },  // tổng điểm tích lũy (xác định tier)
    tier: {
        type: String,
        enum: ['bronze', 'silver', 'gold', 'platinum'],
        default: 'bronze',
    },
    history: [
        {
            type:        { type: String, enum: ['earn', 'redeem', 'expire', 'adjust'] },
            points:      Number,
            description: String,
            orderId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
            createdAt:   { type: Date, default: Date.now },
        }
    ],
}, { timestamps: true });

// ── Helper tĩnh: tính tier từ tổng điểm ──────────────────────────────────────
loyaltySchema.statics.getTier = function (totalPoints) {
    for (let i = TIERS.length - 1; i >= 0; i--) {
        if (totalPoints >= TIERS[i].min) return TIERS[i].name;
    }
    return 'bronze';
};

loyaltySchema.statics.getTierInfo = function (tierName) {
    return TIERS.find(t => t.name === tierName) || TIERS[0];
};

loyaltySchema.statics.TIERS = TIERS;

// ── Cộng điểm sau khi đặt hàng thành công ────────────────────────────────────
loyaltySchema.methods.addPoints = async function (amount, orderId, description) {
    const earned = Math.floor(amount / 1000); // 1 điểm / 1.000đ
    if (earned <= 0) return this;

    this.points            += earned;
    this.totalPointsEarned += earned;
    this.tier = this.constructor.getTier(this.totalPointsEarned);
    this.history.push({ type: 'earn', points: earned, description: description || `Mua hàng +${earned} điểm`, orderId });

    return this.save();
};

// ── Trừ điểm khi đổi ưu đãi ──────────────────────────────────────────────────
loyaltySchema.methods.redeemPoints = async function (points, description) {
    if (this.points < points) throw new Error('Không đủ điểm để đổi.');
    this.points -= points;
    this.history.push({ type: 'redeem', points: -points, description: description || `Đổi ${points} điểm` });
    return this.save();
};

module.exports = mongoose.model('LoyaltyAccount', loyaltySchema);