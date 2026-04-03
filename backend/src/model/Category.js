const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a category name'],
        unique: true,
        trim: true,
    },
    description: {
        type: String,
        default: '',
    },
    image: {
        type: String,
        default: null,
    },
    sizeChart: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SizeChart',
        default: null,
    },
    isFeatured: {          // ✅ thêm field này
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Category', categorySchema);
