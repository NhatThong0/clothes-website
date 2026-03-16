const mongoose = require('mongoose');

const receiptItemSchema = new mongoose.Schema({
    productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String },
    color:       { type: String, default: '' }, // ✅ thêm
    size:        { type: String, default: '' }, // ✅ thêm
    quantity:    { type: Number, required: true, min: 1 },
    costPrice:   { type: Number, required: true, min: 0 },
    totalCost:   { type: Number },
    remainingQty:{ type: Number },
}, { _id: true });

const stockReceiptSchema = new mongoose.Schema({
    code: { type: String, unique: true },
    supplier: {
        name:  { type: String, default: '' },
        phone: { type: String, default: '' },
        note:  { type: String, default: '' },
    },
    items:       [receiptItemSchema],
    status:      { type: String, enum: ['draft','confirmed','cancelled'], default: 'draft' },
    totalItems:  { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    note:        { type: String, default: '' },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    confirmedAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt:   { type: Date, default: Date.now },
    updatedAt:   { type: Date, default: Date.now },
});

stockReceiptSchema.pre('save', async function () {
    if (!this.code) {
        const d    = new Date();
        const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
        const count = await mongoose.model('StockReceipt').countDocuments();
        this.code  = `PN-${date}-${String(count + 1).padStart(4, '0')}`;
    }
    this.items.forEach(item => {
        item.totalCost   = item.quantity * item.costPrice;
        if (item.remainingQty === undefined) item.remainingQty = item.quantity;
    });
    this.totalAmount = this.items.reduce((s, i) => s + (i.totalCost || 0), 0);
    this.totalItems  = this.items.reduce((s, i) => s + i.quantity, 0);
    this.updatedAt   = Date.now();
});

module.exports = mongoose.model('StockReceipt', stockReceiptSchema);