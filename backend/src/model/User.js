const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: 6,
        select: false,
    },
    phone: {
        type: String,
        trim: true,
    },
    avatar: {
        type: String,
        default: null,
    },
    addresses: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Address',
        }
    ],
    role: {
        type: String,
        enum: ['customer', 'admin'],
        default: 'customer',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    // ✅ Thêm field tracking thời gian đăng nhập gần nhất
    lastLoginAt: {
        type: Date,
        default: null,
    },
    loyalty: {
        spendablePoints: {
            type: Number,
            default: 0,
        },
        tierPoints: {
            type: Number,
            default: 0,
        },
        currentTierId: {
            type: String,
            default: null,
        },
        tier: {
            name: {
                type: String,
                default: null,
            },
            minPoints: {
                type: Number,
                default: 0,
            },
            discountPercent: {
                type: Number,
                default: 0,
            },
            iconKey: {
                type: String,
                default: null,
            },
        },
        syncedAt: {
            type: Date,
            default: null,
        },
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

userSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
