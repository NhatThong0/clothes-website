const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name:      String,
        price:     Number,
        costPrice: { type: Number, default: 0 },
        discount:  Number,
        quantity:  Number,
        color:     String,
        size:      String,
        image:     String,
    }],
    shippingAddress: {
        fullName: String, email: String, phone: String,
        address: String, ward: String, district: String, city: String,
        // GHN IDs — dùng để tính phí ship
        ghnProvinceId: { type: String, default: null },
        ghnDistrictId: { type: String, default: null },
        ghnWardCode:   { type: String, default: null },
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'vnpay'],
        required: true,
    },
    paymentStatus: {
        type: String, enum: ['pending','completed','failed','refunded'], default: 'pending',
    },
    subtotal:       { type: Number, required: true },
    shippingFee:    { type: Number, default: 0 },
    tax:            { type: Number, default: 0 },
    voucherCode:    { type: String, default: null },
    discountAmount: { type: Number, default: 0 },
    total:          { type: Number, required: true },
    status: {
        type: String,
        enum: [
            'pending','confirmed','shipped','delivered',
            'return_requested','return_approved','return_rejected',
            'returned','cancelled',
        ],
        default: 'pending',
    },
    notes:           { type: String, default: '' },
    trackingNumber:  { type: String, default: null },
    vnpayTxnRef:     { type: String, default: null },
    revenueRecorded: { type: Boolean, default: false },

    // ── Timestamps ────────────────────────────────────────────────────────────
    confirmedAt:  { type: Date, default: null },
    shippedAt:    { type: Date, default: null },
    deliveredAt:  { type: Date, default: null },
    cancelledAt:  { type: Date, default: null },

    // ── Hoàn trả ─────────────────────────────────────────────────────────────
    returnRequestedAt: { type: Date,   default: null },
    returnReason:      { type: String, default: '' },
    returnImages:      { type: [String], default: [] },

    // Admin duyệt / từ chối
    returnReviewedAt:  { type: Date,   default: null },
    returnReviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    returnRejectReason:{ type: String, default: '' }, // lý do từ chối nếu có

    // Admin hướng dẫn user gửi hàng về
    returnShipNote:    { type: String, default: '' }, // VD: "Gửi về: 123 Cô Bắc, Hải Châu, Đà Nẵng"

    // Khi admin xác nhận đã nhận hàng hoàn
    returnedAt:        { type: Date,   default: null },
    userConfirmedAt:   { type: Date,    default: null },
    autoConfirmed:     { type: Boolean, default: false }, // true = hệ thống tự xác nhận sau 24h
    returnedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Hoàn tiền
    refundStatus:  { type: String, enum: ['none','pending','completed'], default: 'none' },
    refundAmount:  { type: Number, default: 0 },
    refundNote:    { type: String, default: '' }, // ghi chú hoàn tiền thủ công
    refundAt:      { type: Date,   default: null },
    refundBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);