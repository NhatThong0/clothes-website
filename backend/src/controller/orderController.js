const Order    = require('../model/Order');
const Product  = require('../model/Product');
const Voucher  = require('../model/Voucher');
const User     = require('../model/User');
const mongoose = require('mongoose');
// ─── stockHelpers.js — paste 2 hàm này vào đầu orderController.js ─────────────

// Thay hàm decrementStock trong orderController.js bằng hàm này
async function decrementStock(productId, quantity, color, size) {
    const product = await Product.findById(productId).lean();
    if (!product) { console.log('[stock-] product not found:', productId); return; }

    console.log('[stock-] product:', product.name);
    console.log('[stock-] color:', JSON.stringify(color), '| size:', JSON.stringify(size));
    console.log('[stock-] variants count:', product.variants?.length);
    console.log('[stock-] variants:', JSON.stringify(product.variants?.map(v => ({ color: v.color, size: v.size, stock: v.stock }))));

    if (color && size && Array.isArray(product.variants) && product.variants.length > 0) {
        const idx = product.variants.findIndex(v => v.color === color && v.size === size);
        console.log('[stock-] variant idx found:', idx);

        if (idx >= 0) {
            const oldStock        = product.variants[idx].stock || 0;
            const newVariantStock = Math.max(0, oldStock - quantity);
            console.log(`[stock-] variant ${color}/${size}: ${oldStock} → ${newVariantStock}`);

            await Product.findByIdAndUpdate(
                productId,
                { $set: { [`variants.${idx}.stock`]: newVariantStock } }
            );

            // Tính lại stock tổng
            const fresh    = await Product.findById(productId).lean();
            const newTotal = fresh.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
            await Product.findByIdAndUpdate(productId, { $set: { stock: newTotal } });
            console.log('[stock-] new total stock:', newTotal);
        } else {
            // Không tìm thấy variant → chỉ trừ tổng
            console.log('[stock-] variant NOT FOUND, decrement total only');
            const newStock = Math.max(0, (product.stock || 0) - quantity);
            await Product.findByIdAndUpdate(productId, { $set: { stock: newStock } });
        }
    } else {
        const newStock = Math.max(0, (product.stock || 0) - quantity);
        await Product.findByIdAndUpdate(productId, { $set: { stock: newStock } });
        console.log('[stock-] no variant, total:', product.stock, '→', newStock);
    }
}

async function incrementStock(productId, quantity, color, size) {
    const product = await Product.findById(productId);
    if (!product) return;

    if (color && size && Array.isArray(product.variants) && product.variants.length > 0) {
        const idx = product.variants.findIndex(v => v.color === color && v.size === size);
        if (idx >= 0) {
            const newVariantStock = (product.variants[idx].stock || 0) + quantity;

            await Product.findByIdAndUpdate(
                productId,
                { $set: { [`variants.${idx}.stock`]: newVariantStock } },
                { new: true }
            );

            const fresh    = await Product.findById(productId).lean();
            const newTotal = fresh.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
            await Product.findByIdAndUpdate(productId, { $set: { stock: newTotal } });

            console.log(`[stock+] ${product.name} | ${color}/${size}: ${product.variants[idx].stock} → ${newVariantStock} | total: ${newTotal}`);
        }
    } else {
        const newStock = (product.stock || 0) + quantity;
        await Product.findByIdAndUpdate(productId, { $set: { stock: newStock } });
    }
}
// ─── Helper: trừ stock đúng variant ──────────────────────────────────────────
async function decrementStock(productId, quantity, color, size) {
    const product = await Product.findById(productId);
    if (!product) return;

    if (color && size && product.variants?.length > 0) {
        const idx = product.variants.findIndex(v => v.color === color && v.size === size);
        if (idx >= 0) {
            const newVariantStock = Math.max(0, (product.variants[idx].stock || 0) - quantity);
            // ✅ $set trực tiếp vào index — tránh pre-save hook ghi đè
            await Product.findByIdAndUpdate(productId, {
                $set: { [`variants.${idx}.stock`]: newVariantStock },
            });
            // Tính lại stock tổng sau khi update
            const updated  = await Product.findById(productId);
            const newTotal = updated.variants.reduce((s, v) => s + (v.stock || 0), 0);
            await Product.findByIdAndUpdate(productId, { stock: newTotal });
        }
    } else {
        const newStock = Math.max(0, (product.stock || 0) - quantity);
        await Product.findByIdAndUpdate(productId, { stock: newStock });
    }
}

// ─── Helper: hoàn stock ───────────────────────────────────────────────────────
async function incrementStock(productId, quantity, color, size) {
    const product = await Product.findById(productId);
    if (!product) return;

    if (color && size && product.variants?.length > 0) {
        const idx = product.variants.findIndex(v => v.color === color && v.size === size);
        if (idx >= 0) {
            const newVariantStock = (product.variants[idx].stock || 0) + quantity;
            await Product.findByIdAndUpdate(productId, {
                $set: { [`variants.${idx}.stock`]: newVariantStock },
            });
            const updated  = await Product.findById(productId);
            const newTotal = updated.variants.reduce((s, v) => s + (v.stock || 0), 0);
            await Product.findByIdAndUpdate(productId, { stock: newTotal });
        }
    } else {
        const newStock = (product.stock || 0) + quantity;
        await Product.findByIdAndUpdate(productId, { stock: newStock });
    }
}

// ─── Helper: validate voucher ─────────────────────────────────────────────────
const calcVoucherDiscount = (voucher, subtotal) => {
    let discount = 0;
    if (voucher.discountType === 'percentage') {
        discount = (subtotal * voucher.discountValue) / 100;
        if (voucher.maxDiscountAmount) discount = Math.min(discount, voucher.maxDiscountAmount);
    } else {
        discount = voucher.discountValue;
    }
    return Math.min(discount, subtotal);
};

const validateVoucherCode = async (code, userId, orderAmount) => {
    const voucher = await Voucher.findOne({ code: code.toUpperCase() });
    if (!voucher)          throw { status: 404, message: 'Mã voucher không tồn tại.' };
    if (!voucher.isActive) throw { status: 400, message: 'Voucher đã bị vô hiệu hóa.' };
    const now = new Date();
    if (now < voucher.startDate) throw { status: 400, message: 'Voucher chưa đến ngày áp dụng.' };
    if (now > voucher.endDate)   throw { status: 400, message: 'Voucher đã hết hạn.' };
    if (voucher.maxUsageCount !== null && voucher.usageCount >= voucher.maxUsageCount)
        throw { status: 400, message: 'Voucher đã hết lượt sử dụng.' };
    if (orderAmount < voucher.minPurchaseAmount)
        throw { status: 400, message: `Đơn hàng tối thiểu ${voucher.minPurchaseAmount.toLocaleString('vi-VN')}₫ để dùng voucher này.` };
    if (userId) {
        const userUsage = voucher.usedBy.find(u => u.userId.toString() === userId.toString());
        if (userUsage && userUsage.usedCount >= voucher.maxUsagePerUser)
            throw { status: 400, message: 'Bạn đã dùng hết lượt cho voucher này.' };
    }
    return voucher;
};

// ── POST /api/orders ──────────────────────────────────────────────────────────


const createOrder = async (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod, notes, voucherCode } = req.body;
        const userId = req.user.userId || req.userId;

        if (!items || items.length === 0)
            return res.status(400).json({ status: 'error', message: 'Đơn hàng phải có ít nhất 1 sản phẩm.' });

        let subtotal = 0;
        const verifiedItems = [];

        // ── Bước 1: Validate trước ─────────────────────────────────────────
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product)
                return res.status(404).json({ status: 'error', message: `Sản phẩm không tồn tại: ${item.productId}` });

            const color = item.color || '';
            const size  = item.size  || '';

            // Kiểm tra stock hiện tại (chưa lock)
            if (color && size && product.variants?.length > 0) {
                const variant = product.variants.find(v => v.color === color && v.size === size);
                if (!variant || variant.stock < item.quantity)
                    return res.status(400).json({
                        status: 'error',
                        message: `"${product.name}" (${color}/${size}) không đủ hàng. Còn: ${variant?.stock ?? 0}`
                    });
            } else {
                if (product.stock < item.quantity)
                    return res.status(400).json({
                        status: 'error',
                        message: `"${product.name}" không đủ hàng. Còn: ${product.stock}`
                    });
            }

            const itemPrice = item.price || product.price;
            subtotal += itemPrice * item.quantity;
            verifiedItems.push({
                productId: product._id,
                name:      product.name,
                price:     itemPrice,
                costPrice: product.costPrice || product.avgCost || 0,
                discount:  item.discount || 0,
                quantity:  item.quantity,
                color,
                size,
                image:     product.images?.[0] || '',
            });
        }

        // ── Bước 2: Voucher ────────────────────────────────────────────────
        let discountAmount = 0;
        let appliedVoucher = null;
        if (voucherCode) {
            try {
                appliedVoucher = await validateVoucherCode(voucherCode, userId, subtotal);
                discountAmount = calcVoucherDiscount(appliedVoucher, subtotal);
            } catch (vErr) {
                return res.status(vErr.status || 400).json({ status: 'error', message: vErr.message });
            }
        }

        const total = subtotal - discountAmount;

        // ── Bước 3: Atomic decrement stock ────────────────────────────────
        // Dùng findOneAndUpdate với điều kiện stock đủ — nếu race condition
        // thì update thất bại (trả về null) và báo hết hàng
        const reservedItems = [];
        try {
            for (const item of verifiedItems) {
                const { productId, quantity, color, size } = item;

                let updated;
                if (color && size) {
                    // Tìm index variant
                    const product = await Product.findById(productId);
                    const idx     = product?.variants?.findIndex(v => v.color === color && v.size === size) ?? -1;

                    if (idx >= 0) {
                        // ✅ Atomic: chỉ update nếu stock >= quantity
                        updated = await Product.findOneAndUpdate(
                            {
                                _id: productId,
                                [`variants.${idx}.stock`]: { $gte: quantity },
                            },
                            {
                                $inc: { [`variants.${idx}.stock`]: -quantity },
                            },
                            { new: true }
                        );

                        if (updated) {
                            // Cập nhật lại stock tổng
                            const newTotal = updated.variants.reduce((s, v) => s + (v.stock || 0), 0);
                            await Product.findByIdAndUpdate(productId, { $set: { stock: newTotal } });
                        }
                    }
                } else {
                    // ✅ Atomic: chỉ update nếu stock >= quantity
                    updated = await Product.findOneAndUpdate(
                        { _id: productId, stock: { $gte: quantity } },
                        { $inc: { stock: -quantity } },
                        { new: true }
                    );
                }

                if (!updated) {
                    // Race condition — hoàn lại stock đã trừ trước đó
                    for (const reserved of reservedItems) {
                        await incrementStock(reserved.productId, reserved.quantity, reserved.color, reserved.size);
                    }
                    const product = await Product.findById(productId).lean();
                    return res.status(400).json({
                        status: 'error',
                        message: `"${product?.name || productId}" vừa hết hàng. Vui lòng thử lại.`
                    });
                }

                reservedItems.push({ productId, quantity, color, size });
            }
        } catch (err) {
            // Rollback nếu có lỗi giữa chừng
            for (const reserved of reservedItems) {
                await incrementStock(reserved.productId, reserved.quantity, reserved.color, reserved.size);
            }
            throw err;
        }

        // ── Bước 4: Tạo đơn hàng ──────────────────────────────────────────
        const order = await Order.create({
            userId, items: verifiedItems, shippingAddress, paymentMethod,
            notes: notes || '', subtotal, shippingFee: 0, discountAmount,
            voucherCode:    appliedVoucher ? appliedVoucher.code : null,
            total, paymentStatus: 'pending', status: 'pending', revenueRecorded: false,
        });

        if (appliedVoucher) {
            await Voucher.findByIdAndUpdate(appliedVoucher._id, {
                $inc:  { usageCount: 1 },
                $push: { usedBy: { $each: [{ userId, usedCount: 1, usedAt: new Date() }], $position: 0 } },
            });
        }

        res.status(201).json({ status: 'success', message: 'Đơn hàng đã được tạo thành công.', data: order });
    } catch (err) {
        console.error('createOrder error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── GET /api/orders ───────────────────────────────────────────────────────────
const getUserOrders = async (req, res) => {
    try {
        const userId = req.user.userId || req.userId;
        const { page = 1, limit = 10, status } = req.query;
        const filter = { userId };
        if (status) filter.status = status;
        const [orders, total] = await Promise.all([
            Order.find(filter).sort({ createdAt: -1 }).skip((page-1)*limit).limit(Number(limit)).lean(),
            Order.countDocuments(filter),
        ]);
        res.status(200).json({ status: 'success', data: { orders, pagination: { total, page: Number(page), pages: Math.ceil(total/limit), limit: Number(limit) } } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
const getOrderById = async (req, res) => {
    try {
        const userId = req.user.userId || req.userId;
        const order  = await Order.findById(req.params.id).lean();
        if (!order) return res.status(404).json({ status: 'error', message: 'Đơn hàng không tồn tại.' });
        if (req.user.role !== 'admin' && order.userId.toString() !== userId.toString())
            return res.status(403).json({ status: 'error', message: 'Không có quyền truy cập.' });
        res.status(200).json({ status: 'success', data: order });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── POST /api/orders/:id/cancel ───────────────────────────────────────────────
const cancelOrder = async (req, res) => {
    try {
        const userId = req.user.userId || req.userId;
        const order  = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng.' });
        if (order.userId.toString() !== userId.toString())
            return res.status(403).json({ status: 'error', message: 'Không có quyền hủy đơn này.' });
        if (!['pending', 'confirmed'].includes(order.status))
            return res.status(400).json({ status: 'error', message: 'Không thể hủy đơn hàng ở trạng thái này.' });

        order.status    = 'cancelled';
        order.updatedAt = new Date();
        await order.save();

        // ✅ Hoàn stock đúng variant
        for (const item of order.items) {
            await incrementStock(item.productId, item.quantity, item.color, item.size);
        }

        if (order.voucherCode)
            await Voucher.findOneAndUpdate(
                { code: order.voucherCode },
                { $inc: { usageCount: -1 }, $pull: { usedBy: { userId } } }
            );

        res.status(200).json({ status: 'success', message: 'Đơn hàng đã được hủy.', data: order });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── PUT /api/orders/:id/status (Admin) ───────────────────────────────────────
const updateOrderStatus = async (req, res) => {
    try {
        const { status, trackingNumber } = req.body;
        const validStatuses = ['pending','confirmed','processing','shipped','delivered','cancelled','return_requested','returned'];
        if (!validStatuses.includes(status))
            return res.status(400).json({ status: 'error', message: 'Trạng thái không hợp lệ.' });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng.' });

        const prevStatus = order.status;
        order.status     = status;
        order.updatedAt  = new Date();
        if (trackingNumber) order.trackingNumber = trackingNumber;

        if (status === 'delivered' && prevStatus !== 'delivered') {
            order.paymentStatus = 'completed';
            order.deliveredAt   = new Date();
            if (!order.revenueRecorded) {
                order.revenueRecorded = true;
                await Promise.all(order.items.map(item =>
                    Product.findByIdAndUpdate(item.productId, { $inc: { soldCount: item.quantity } })
                ));
            }
        }

        if (status === 'returned' && prevStatus !== 'returned') {
            order.returnedAt = new Date();
            for (const item of order.items) {
                await incrementStock(item.productId, item.quantity, item.color, item.size);
            }
            if (order.revenueRecorded) {
                order.revenueRecorded = false;
                await Promise.all(order.items.map(item =>
                    Product.findByIdAndUpdate(item.productId, { $inc: { soldCount: -item.quantity } })
                ));
            }
        }

        if (status === 'cancelled' && prevStatus !== 'cancelled') {
            for (const item of order.items) {
                await incrementStock(item.productId, item.quantity, item.color, item.size);
            }
            if (order.revenueRecorded) {
                order.revenueRecorded = false;
                await Promise.all(order.items.map(item =>
                    Product.findByIdAndUpdate(item.productId, { $inc: { soldCount: -item.quantity } })
                ));
            }
        }

        await order.save();
        const populated = await Order.findById(order._id).populate('userId', 'name email phone');
        res.status(200).json({ status: 'success', data: populated });
    } catch (err) {
        console.error('updateOrderStatus error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── POST /api/orders/:id/return-request ──────────────────────────────────────
const requestReturn = async (req, res) => {
    try {
        const userId = req.user?.userId || req.userId;
        const order  = await Order.findById(req.params.id);
        if (!order)
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng.' });
        if (order.userId.toString() !== userId.toString())
            return res.status(403).json({ status: 'error', message: 'Không có quyền thao tác đơn hàng này.' });
        if (order.status !== 'delivered')
            return res.status(400).json({ status: 'error', message: 'Chỉ có thể yêu cầu hoàn trả đơn hàng đã giao.' });
        if (!order.deliveredAt)
            return res.status(400).json({ status: 'error', message: 'Không xác định được ngày giao hàng.' });

        const RETURN_WINDOW_DAYS = 5;
        const daysSince = (Date.now() - new Date(order.deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > RETURN_WINDOW_DAYS)
            return res.status(400).json({ status: 'error', message: `Đã quá ${RETURN_WINDOW_DAYS} ngày kể từ khi nhận hàng.` });

        order.status            = 'return_requested';
        order.returnRequestedAt = new Date();
        order.returnReason      = req.body?.reason || '';
        order.returnImages      = req.body?.images || [];
        order.updatedAt         = new Date();
        await order.save();

        res.status(200).json({ status: 'success', message: 'Yêu cầu hoàn trả đã được gửi.', data: order });
    } catch (err) {
        console.error('requestReturn error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── POST /api/orders/payment/process ─────────────────────────────────────────
const processPayment = async (req, res) => {
    try {
        const { orderId, paymentMethod } = req.body;
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng.' });
        order.paymentStatus = paymentMethod === 'cod' ? 'pending' : 'completed';
        if (paymentMethod !== 'cod') order.status = 'confirmed';
        await order.save();
        res.status(200).json({ status: 'success', message: 'Thanh toán đã được xử lý.', data: { orderId: order._id, paymentStatus: order.paymentStatus } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── Admin: GET /api/admin/orders ──────────────────────────────────────────────
const getAdminOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, search, dateFrom, dateTo } = req.query;
        const conditions = [];
        if (status) conditions.push({ status });
        if (dateFrom || dateTo) {
            const d = {};
            if (dateFrom) d.$gte = new Date(dateFrom + 'T00:00:00.000Z');
            if (dateTo)   d.$lte = new Date(dateTo   + 'T23:59:59.999Z');
            conditions.push({ createdAt: d });
        }
        if (search && search.trim()) {
            const q = search.trim();
            const searchOr = [];
            const matchedUsers = await User.find({
                $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }, { phone: { $regex: q, $options: 'i' } }]
            }).select('_id').lean();
            if (matchedUsers.length > 0) searchOr.push({ userId: { $in: matchedUsers.map(u => u._id) } });
            if (/^[0-9a-fA-F]{24}$/.test(q)) searchOr.push({ _id: new mongoose.Types.ObjectId(q) });
            if (/^[0-9a-fA-F]{6,23}$/.test(q)) searchOr.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `^${q}`, options: 'i' } } });
            searchOr.push({ 'shippingAddress.fullName': { $regex: q, $options: 'i' } });
            searchOr.push({ 'shippingAddress.phone': { $regex: q, $options: 'i' } });
            if (searchOr.length > 0) conditions.push({ $or: searchOr });
        }
        const filter = conditions.length > 0 ? { $and: conditions } : {};
        const [orders, total] = await Promise.all([
            Order.find(filter).populate('userId', 'name email phone avatar').sort({ createdAt: -1 }).skip((Number(page)-1)*Number(limit)).limit(Number(limit)).lean(),
            Order.countDocuments(filter),
        ]);
        res.status(200).json({ status: 'success', data: { orders, pagination: { total, page: Number(page), pages: Math.ceil(total/Number(limit)), limit: Number(limit) } } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── POST /api/orders/:id/retry-payment ───────────────────────────────────────
const retryPayment = async (req, res) => {
    try {
        const userId = req.user.userId || req.userId;
        const order  = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng.' });
        if (order.userId.toString() !== userId.toString()) return res.status(403).json({ status: 'error', message: 'Không có quyền.' });
        if (order.paymentMethod !== 'vnpay') return res.status(400).json({ status: 'error', message: 'Chỉ áp dụng cho đơn VNPay.' });
        if (order.paymentStatus === 'completed') return res.status(400).json({ status: 'error', message: 'Đơn hàng đã được thanh toán.' });
        if (order.status === 'cancelled') return res.status(400).json({ status: 'error', message: 'Đơn hàng đã bị hủy.' });
        order.paymentStatus = 'pending';
        await order.save();
        res.status(200).json({ status: 'success', data: order });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

module.exports = {
    createOrder, getUserOrders, getOrderById, cancelOrder,
    updateOrderStatus, processPayment, getAdminOrders,
    validateVoucherCode, calcVoucherDiscount, requestReturn, retryPayment,
};