const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    label: {
        type: String,
        enum: ['Nhà riêng', 'Văn phòng', 'Khác'],
        default: 'Nhà riêng',
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
    },
    phone: {
        type: String,
        required: true,
        trim: true,
    },
    address: {
        type: String,
        required: true,
    },
    ward: {
        type: String,
        default: '',
    },
    district: {
        type: String,
        default: '',
    },
    city: {
        type: String,
        required: true,
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Address', addressSchema);