const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating:    { type: Number, required: true, min: 1, max: 5 },
    comment:   { type: String, required: true },
    images:    [{ type: String }],
    isVisible: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
});

const variantSchema = new mongoose.Schema({
    color: { type: String, default: '' },
    size:  { type: String, default: '' },
    stock: { type: Number, default: 0, min: 0 },
    sku:   { type: String, default: '' },
    price: { type: Number, default: 0 },
}, { _id: false });

const productSchema = new mongoose.Schema({
    name:          { type: String, required: true, trim: true },
    description:   { type: String, required: true },
    shortDescription: { type: String, default: '' },
    price:         { type: Number, required: true, min: 0 },
    discount:      { type: Number, default: 0, min: 0, max: 100 },
    category:      { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    sizeChart:     { type: mongoose.Schema.Types.ObjectId, ref: 'SizeChart', default: null },
    images:        [{ type: String }],
    stock:         { type: Number, default: 0, min: 0 }, // ✅ KHÔNG required — tự tính từ variants
    variants:      [variantSchema],
    colors:        [{ type: String }],
    sizes:         [{ type: String }],
    features:      [{ type: String }],
    fit:           { type: String, default: 'regular' },
    genderTarget:  { type: String, default: 'unisex' },
    material:      { type: String, default: '' },
    styleTags:     [{ type: String }],
    occasionTags:  [{ type: String }],
    seasonTags:    [{ type: String }],
    matchWith:     [{ type: String }],
    colorFamilies: [{ type: String }],
    aiSummary:     { type: String, default: '' },
    averageRating: { type: Number, default: 0 },
    rating:        { type: Number, default: 0 },
    reviews:       [reviewSchema],
    isActive:      { type: Boolean, default: true },
    isFeatured:    { type: Boolean, default: false },
    soldCount:     { type: Number, default: 0 },
    avgCost:       { type: Number, default: 0 },
    costPrice:     { type: Number, default: 0 },
    createdAt:     { type: Date, default: Date.now },
    updatedAt:     { type: Date, default: Date.now },
});

// ✅ pre-save: dùng async để tránh lỗi next is not a function
productSchema.pre('save', async function() {
    if (Array.isArray(this.variants) && this.variants.length > 0) {
        this.stock  = this.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
        this.colors = [...new Set(this.variants.map(v => v.color).filter(Boolean))];
        this.sizes  = [...new Set(this.variants.map(v => v.size).filter(Boolean))];
    }
    this.updatedAt = new Date();
});

// ✅ Index tìm kiếm — đặt sau schema definition
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });

module.exports = mongoose.model('Product', productSchema);
