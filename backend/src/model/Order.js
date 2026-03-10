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
    },
    paymentMethod: {
        type: String,
        enum: ['cod','card','bank_transfer','e_wallet','credit-card','bank-transfer'],
        required: true,
    },
    paymentStatus: {
        type: String, enum: ['pending','completed','failed'], default: 'pending',
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
            'pending','confirmed','processing','shipped','delivered',
            'return_requested',  // user gửi yêu cầu hoàn trả
            'returned',          // admin xác nhận hoàn trả
            'cancelled'
        ],
        default: 'pending',
    },
    notes:             { type: String, default: '' },
    trackingNumber:    { type: String, default: null },
    revenueRecorded:   { type: Boolean, default: false },
    deliveredAt:       { type: Date, default: null },      // mốc giao → tính 5 ngày hoàn trả
    returnRequestedAt: { type: Date, default: null },
    returnedAt:        { type: Date, default: null },
    returnReason:      { type: String, default: '' },
    returnImages:      { type: [String], default: [] },  // ✅ ảnh minh chứng hoàn trả
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);