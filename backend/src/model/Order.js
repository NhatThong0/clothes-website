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
        enum: ['cod', 'vnpay'],   // ✅ lowercase vnpay
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
            'return_requested',
            'returned',
            'cancelled'
        ],
        default: 'pending',
    },
    notes:             { type: String, default: '' },
    trackingNumber:    { type: String, default: null },
    vnpayTxnRef:       { type: String, default: null },   // ✅ lưu txnRef để map khi VNPay return
    revenueRecorded:   { type: Boolean, default: false },
    deliveredAt:       { type: Date, default: null },
    returnRequestedAt: { type: Date, default: null },
    returnedAt:        { type: Date, default: null },
    returnReason:      { type: String, default: '' },
    returnImages:      { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);