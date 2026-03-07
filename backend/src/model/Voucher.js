const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
    },
    description:  { type: String, default: '' },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true,
    },
    discountValue:    { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, default: null }, // chỉ dùng khi percentage
    minPurchaseAmount: { type: Number, default: 0 },
    voucherType: {
        type: String,
        enum: ['all_products', 'selected_products', 'selected_categories'],
        default: 'all_products',
    },
    maxUsageCount:   { type: Number, default: null }, // null = unlimited
    maxUsagePerUser: { type: Number, default: 1 },
    usageCount:      { type: Number, default: 0 },
    // Lưu userId đã dùng để check maxUsagePerUser
    usedBy: [
        {
            userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            usedCount: { type: Number, default: 1 },
            usedAt:    { type: Date, default: Date.now },
        }
    ],
    startDate: { type: Date, required: true },
    endDate:   { type: Date, required: true },
    isActive:  { type: Boolean, default: true },
}, { timestamps: true });

// Virtual: check còn hiệu lực không
voucherSchema.virtual('isValid').get(function () {
    const now = new Date();
    return (
        this.isActive &&
        now >= this.startDate &&
        now <= this.endDate &&
        (this.maxUsageCount === null || this.usageCount < this.maxUsageCount)
    );
});

module.exports = mongoose.model('Voucher', voucherSchema);