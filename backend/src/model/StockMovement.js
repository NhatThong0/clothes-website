const mongoose = require('mongoose');

/**
 * StockMovement: ghi lại MỌI biến động kho
 * type:
 *   - 'receipt'    : nhập hàng từ phiếu nhập
 *   - 'sale'       : bán hàng (đơn hàng delivered)
 *   - 'adjustment' : điều chỉnh thủ công (mất/hỏng/tặng)
 *   - 'return'     : trả hàng
 */
const stockMovementSchema = new mongoose.Schema({
    productId: {
        type:     mongoose.Schema.Types.ObjectId,
        ref:      'Product',
        required: true,
        index:    true,
    },
    productName: { type: String }, // snapshot

    type: {
        type:     String,
        enum:     ['receipt', 'sale', 'adjustment', 'return'],
        required: true,
        index:    true,
    },

    // Số lượng: dương = vào kho, âm = ra kho
    quantity:    { type: Number, required: true },
    // Tồn kho SAU biến động này
    stockAfter:  { type: Number, required: true },

    // Giá vốn tại thời điểm này (dùng cho lợi nhuận)
    costPrice:   { type: Number, default: 0 },
    // Giá bán (nếu là sale)
    salePrice:   { type: Number, default: 0 },

    // Tham chiếu nguồn
    refType:     { type: String, enum: ['StockReceipt', 'Order', 'Manual', null] },
    refId:       { type: mongoose.Schema.Types.ObjectId },
    refCode:     { type: String }, // mã phiếu hoặc mã đơn hàng

    reason:      { type: String, default: '' }, // lý do điều chỉnh
    note:        { type: String, default: '' },

    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt:   { type: Date, default: Date.now, index: true },
});

// Compound index để query nhanh theo product + time
stockMovementSchema.index({ productId: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);