const mongoose = require('mongoose');

/**
 * PROMOTION MODEL — hỗ trợ 5 loại:
 *  1. DISCOUNT     — Giảm % hoặc số tiền cố định trực tiếp trên sản phẩm/đơn hàng
 *  2. COUPON       — Mã nhập tay tại checkout
 *  3. FLASH_SALE   — Giảm giá trong khung giờ giới hạn + giới hạn số lượng
 *  4. HOLIDAY      — Khuyến mãi dịp lễ (tự động apply theo ngày)
 *  5. LOYALTY      — Tích điểm đổi quà / giảm giá theo hạng thành viên
 */
const promotionSchema = new mongoose.Schema({

    // ── Chung ─────────────────────────────────────────────────────────────────
    type: {
        type: String,
        enum: ['discount', 'coupon', 'flash_sale', 'holiday', 'loyalty'],
        required: true,
    },
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    isActive:    { type: Boolean, default: true },
    startDate:   { type: Date, required: true },
    endDate:     { type: Date, required: true },

    // ── Giảm giá ─────────────────────────────────────────────────────────────
    discountType: {
        type: String,
        enum: ['percentage', 'fixed', 'freeship'],
        default: 'percentage',
    },
    discountValue:     { type: Number, default: 0 },        // % hoặc VND
    maxDiscountAmount: { type: Number, default: null },      // cap khi dùng %
    minOrderAmount:    { type: Number, default: 0 },         // đơn tối thiểu
    minQuantity:       { type: Number, default: 0 },         // số SP tối thiểu trong giỏ

    // ── Áp dụng cho ───────────────────────────────────────────────────────────
    applyTo: {
        type: String,
        enum: ['all', 'specific_products', 'specific_categories'],
        default: 'all',
    },
    productIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],

    // ── COUPON fields ─────────────────────────────────────────────────────────
    code:            { type: String, uppercase: true, trim: true, default: null },
    maxUsageCount:   { type: Number, default: null },   // null = unlimited
    maxUsagePerUser: { type: Number, default: 1 },
    usageCount:      { type: Number, default: 0 },
    usedBy: [
        {
            userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            usedCount: { type: Number, default: 1 },
            usedAt:    { type: Date, default: Date.now },
        }
    ],

    // ── FLASH SALE fields ─────────────────────────────────────────────────────
    flashSaleStock:     { type: Number, default: null },  // số lượng tồn flash sale
    flashSaleRemaining: { type: Number, default: null },  // còn lại
    flashSaleHour: {                                       // khung giờ (HH:mm)
        start: { type: String, default: null },
        end:   { type: String, default: null },
    },

    // ── HOLIDAY fields ────────────────────────────────────────────────────────
    holidayName: { type: String, default: '' },  // 'Tết Nguyên Đán', '8/3', ...
    autoApply:   { type: Boolean, default: false }, // tự động apply không cần mã

    // ── LOYALTY fields ────────────────────────────────────────────────────────
    loyaltyTier: {
        type: String,
        enum: ['all', 'bronze', 'silver', 'gold', 'platinum'],
        default: 'all',
    },
    pointsRequired:  { type: Number, default: 0 },   // điểm cần để đổi
    pointsReward:    { type: Number, default: 0 },   // điểm thưởng khi dùng promo này

}, { timestamps: true });

// ── Index để query nhanh ──────────────────────────────────────────────────────
promotionSchema.index({ code: 1 }, { sparse: true, unique: true });
promotionSchema.index({ type: 1, isActive: 1, startDate: 1, endDate: 1 });

// ── Virtual: còn hiệu lực không ──────────────────────────────────────────────
promotionSchema.virtual('isValid').get(function () {
    const now = new Date();
    const active = this.isActive && now >= this.startDate && now <= this.endDate;
    if (!active) return false;
    if (this.type === 'flash_sale' && this.flashSaleRemaining !== null && this.flashSaleRemaining <= 0) return false;
    if (this.maxUsageCount !== null && this.usageCount >= this.maxUsageCount) return false;
    return true;
});

module.exports = mongoose.model('Promotion', promotionSchema);