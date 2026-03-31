const User    = require('../../model/User');
const Order   = require('../../model/Order');
const Address = require('../../model/Address');

// ─── Profile ──────────────────────────────────────────────────────────────────

exports.getProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

        res.status(200).json({ status: 'success', data: user });
    } catch (error) {
        next(error);
    }
};

exports.updateProfile = async (req, res, next) => {
    try {
        const { name, phone, avatar } = req.body;

        const user = await User.findByIdAndUpdate(
            req.userId,
            { name, phone, avatar, updatedAt: Date.now() },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

        res.status(200).json({ status: 'success', message: 'Profile updated', data: user });
    } catch (error) {
        next(error);
    }
};

exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.userId).select('+password');
        if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) return res.status(400).json({ status: 'error', message: 'Mật khẩu hiện tại không đúng' });

        user.password  = newPassword;
        user.updatedAt = Date.now();
        await user.save();

        // ── ĐỒNG BỘ MYSQL (Song song) ──────────────────────────────────────────
        try {
const { pool } = require('../../db/mysql');
            await pool.query(
                'UPDATE users SET password = ?, updatedAt = NOW() WHERE id = ?',
                [user.password, user._id.toString()]
            );
            console.log("✅ User password synced to MySQL");
        } catch (mysqlErr) {
            console.error("❌ MySQL Password Sync Error:", mysqlErr.message);
        }

        res.status(200).json({ status: 'success', message: 'Đổi mật khẩu thành công' });
    } catch (error) {
        next(error);
    }
};

// ─── Orders ───────────────────────────────────────────────────────────────────

exports.getMyOrders = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status } = req.query;

        const filter = { userId: req.userId };
        if (status) filter.status = status;

        const skip   = (page - 1) * limit;
        const orders = await Order.find(filter)
            .populate('items.productId', 'name price images')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Order.countDocuments(filter);

        res.status(200).json({
            status: 'success',
            data: orders,
            pagination: {
                total,
                page:  parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};

exports.getOrderById = async (req, res, next) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, userId: req.userId })
            .populate('items.productId', 'name price images');

        if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

        res.status(200).json({ status: 'success', data: order });
    } catch (error) {
        next(error);
    }
};

exports.cancelOrder = async (req, res, next) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, userId: req.userId });

        if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });

        if (order.status !== 'pending') {
            return res.status(400).json({
                status: 'error',
                message: 'Chỉ có thể hủy đơn hàng đang chờ xác nhận',
            });
        }

        order.status    = 'cancelled';
        order.updatedAt = Date.now();
        await order.save();

        res.status(200).json({ status: 'success', message: 'Đơn hàng đã được hủy', data: order });
    } catch (error) {
        next(error);
    }
};

// ─── Addresses ───────────────────────────────────────────────────────────────

/**
 * GET /user/addresses
 */
exports.getAddresses = async (req, res, next) => {
    try {
        const addresses = await Address.find({ userId: req.userId }).sort({ isDefault: -1, createdAt: -1 });

        res.status(200).json({ status: 'success', data: addresses });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /user/addresses
 */
exports.createAddress = async (req, res, next) => {
    try {
        const { label, fullName, phone, address, ward, district, city, isDefault } = req.body;

        if (!fullName || !phone || !address || !city) {
            return res.status(400).json({ status: 'error', message: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
        }

        // Nếu set làm mặc định → bỏ mặc định cũ
        if (isDefault) {
            await Address.updateMany({ userId: req.userId }, { isDefault: false });
        }

        // Nếu chưa có địa chỉ nào → tự động set mặc định
        const count = await Address.countDocuments({ userId: req.userId });

        const newAddress = await Address.create({
            userId: req.userId,
            label:     label     || 'Nhà riêng',
            fullName,
            phone,
            address,
            ward:      ward      || '',
            district:  district  || '',
            city,
            isDefault: isDefault || count === 0,
        });

        // Gắn vào user.addresses
        await User.findByIdAndUpdate(req.userId, { $push: { addresses: newAddress._id } });

        res.status(201).json({ status: 'success', message: 'Địa chỉ đã được thêm', data: newAddress });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /user/addresses/:addressId
 */
exports.updateAddress = async (req, res, next) => {
    try {
        const { addressId } = req.params;
        const { label, fullName, phone, address, ward, district, city, isDefault } = req.body;

        const existing = await Address.findOne({ _id: addressId, userId: req.userId });
        if (!existing) return res.status(404).json({ status: 'error', message: 'Không tìm thấy địa chỉ' });

        if (isDefault) {
            await Address.updateMany({ userId: req.userId }, { isDefault: false });
        }

        const updated = await Address.findByIdAndUpdate(
            addressId,
            { label, fullName, phone, address, ward, district, city, isDefault: isDefault || false },
            { new: true, runValidators: true }
        );

        res.status(200).json({ status: 'success', message: 'Địa chỉ đã được cập nhật', data: updated });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /user/addresses/:addressId
 */
exports.deleteAddress = async (req, res, next) => {
    try {
        const { addressId } = req.params;

        const existing = await Address.findOne({ _id: addressId, userId: req.userId });
        if (!existing) return res.status(404).json({ status: 'error', message: 'Không tìm thấy địa chỉ' });

        await Address.findByIdAndDelete(addressId);
        await User.findByIdAndUpdate(req.userId, { $pull: { addresses: addressId } });

        // Nếu xóa địa chỉ mặc định → set địa chỉ đầu tiên còn lại làm mặc định
        if (existing.isDefault) {
            const next = await Address.findOne({ userId: req.userId }).sort({ createdAt: 1 });
            if (next) { next.isDefault = true; await next.save(); }
        }

        res.status(200).json({ status: 'success', message: 'Địa chỉ đã được xóa' });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /user/addresses/:addressId/set-default
 */
exports.setDefaultAddress = async (req, res, next) => {
    try {
        const { addressId } = req.params;

        const existing = await Address.findOne({ _id: addressId, userId: req.userId });
        if (!existing) return res.status(404).json({ status: 'error', message: 'Không tìm thấy địa chỉ' });

        await Address.updateMany({ userId: req.userId }, { isDefault: false });
        existing.isDefault = true;
        await existing.save();

        res.status(200).json({ status: 'success', message: 'Đã đặt làm địa chỉ mặc định', data: existing });
    } catch (error) {
        next(error);
    }
};
