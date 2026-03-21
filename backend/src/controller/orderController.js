const Order    = require('../model/Order');
const Product  = require('../model/Product');
const Voucher  = require('../model/Voucher');
const User     = require('../model/User');
const mongoose = require('mongoose');

// ─── Helper: trừ stock đúng variant ──────────────────────────────────────────
async function decrementStock(productId, quantity, color, size) {
    const product = await Product.findById(productId).lean();
    if (!product) { console.log('[stock-] product not found:', productId); return; }

    if (color && size && Array.isArray(product.variants) && product.variants.length > 0) {
        const idx = product.variants.findIndex(v => v.color === color && v.size === size);
        if (idx >= 0) {
            const newVariantStock = Math.max(0, (product.variants[idx].stock || 0) - quantity);
            await Product.findByIdAndUpdate(productId, { $set: { [`variants.${idx}.stock`]: newVariantStock } });
            const fresh    = await Product.findById(productId).lean();
            const newTotal = fresh.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
            await Product.findByIdAndUpdate(productId, { $set: { stock: newTotal } });
        } else {
            const newStock = Math.max(0, (product.stock || 0) - quantity);
            await Product.findByIdAndUpdate(productId, { $set: { stock: newStock } });
        }
    } else {
        const newStock = Math.max(0, (product.stock || 0) - quantity);
        await Product.findByIdAndUpdate(productId, { $set: { stock: newStock } });
    }
}

// ─── Helper: hoàn stock ───────────────────────────────────────────────────────
async function incrementStock(productId, quantity, color, size) {
    const product = await Product.findById(productId);
    if (!product) return;

    if (color && size && Array.isArray(product.variants) && product.variants.length > 0) {
        const idx = product.variants.findIndex(v => v.color === color && v.size === size);
        if (idx >= 0) {
            const newVariantStock = (product.variants[idx].stock || 0) + quantity;
            await Product.findByIdAndUpdate(productId, { $set: { [`variants.${idx}.stock`]: newVariantStock } });
            const fresh    = await Product.findById(productId).lean();
            const newTotal = fresh.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
            await Product.findByIdAndUpdate(productId, { $set: { stock: newTotal } });
            console.log(`[stock+] ${product.name} | ${color}/${size}: → ${newVariantStock} | total: ${newTotal}`);
        }
    } else {
        const newStock = (product.stock || 0) + quantity;
        await Product.findByIdAndUpdate(productId, { $set: { stock: newStock } });
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

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /api/orders ──────────────────────────────────────────────────────────
const createOrder = async (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod, notes, voucherCode, shippingFee: clientShippingFee } = req.body;
        const userId = req.user.userId || req.userId;

        if (!items || items.length === 0)
            return res.status(400).json({ status: 'error', message: 'Đơn hàng phải có ít nhất 1 sản phẩm.' });

        let subtotal = 0;
        const verifiedItems = [];

        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product)
                return res.status(404).json({ status: 'error', message: `Sản phẩm không tồn tại: ${item.productId}` });

            const color = item.color || '';
            const size  = item.size  || '';

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
                color, size,
                image:     product.images?.[0] || '',
            });
        }

        // Voucher
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

        // Phí ship từ GHN (client đã tính, backend tin tưởng)
        const shippingFee = Number(clientShippingFee) || 0;
        const total       = subtotal + shippingFee - discountAmount;

        // Atomic decrement stock
        const reservedItems = [];
        try {
            for (const item of verifiedItems) {
                const { productId, quantity, color, size } = item;
                let updated;
                if (color && size) {
                    const product = await Product.findById(productId);
                    const idx     = product?.variants?.findIndex(v => v.color === color && v.size === size) ?? -1;
                    if (idx >= 0) {
                        updated = await Product.findOneAndUpdate(
                            { _id: productId, [`variants.${idx}.stock`]: { $gte: quantity } },
                            { $inc: { [`variants.${idx}.stock`]: -quantity } },
                            { new: true }
                        );
                        if (updated) {
                            const newTotal = updated.variants.reduce((s, v) => s + (v.stock || 0), 0);
                            await Product.findByIdAndUpdate(productId, { $set: { stock: newTotal } });
                        }
                    }
                } else {
                    updated = await Product.findOneAndUpdate(
                        { _id: productId, stock: { $gte: quantity } },
                        { $inc: { stock: -quantity } },
                        { new: true }
                    );
                }
                if (!updated) {
                    for (const reserved of reservedItems)
                        await incrementStock(reserved.productId, reserved.quantity, reserved.color, reserved.size);
                    const product = await Product.findById(productId).lean();
                    return res.status(400).json({ status: 'error', message: `"${product?.name || productId}" vừa hết hàng.` });
                }
                reservedItems.push({ productId, quantity, color, size });
            }
        } catch (err) {
            for (const reserved of reservedItems)
                await incrementStock(reserved.productId, reserved.quantity, reserved.color, reserved.size);
            throw err;
        }

        const order = await Order.create({
            userId, items: verifiedItems, shippingAddress, paymentMethod,
            notes: notes || '', subtotal, shippingFee, discountAmount,
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
        res.status(200).json({
            status: 'success',
            data: orders,
            pagination: { total, page: Number(page), pages: Math.ceil(total/limit), limit: Number(limit) },
        });
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

        order.status      = 'cancelled';
        order.cancelledAt = new Date();
        await order.save();

        for (const item of order.items)
            await incrementStock(item.productId, item.quantity, item.color, item.size);

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

// ── POST /api/orders/:id/return-request ──────────────────────────────────────
const requestReturn = async (req, res) => {
    try {
        const userId = req.user?.userId || req.userId;
        const order  = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng.' });
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

        if (!req.body?.reason?.trim())
            return res.status(400).json({ status: 'error', message: 'Vui lòng cung cấp lý do hoàn trả.' });

        order.status            = 'return_requested';
        order.returnRequestedAt = new Date();
        order.returnReason      = req.body.reason.trim();
        order.returnImages      = req.body.images || [];
        await order.save();

        res.status(200).json({ status: 'success', message: 'Yêu cầu hoàn trả đã được gửi.', data: order });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── POST /api/orders/:id/retry-payment ───────────────────────────────────────
const retryPayment = async (req, res) => {
    try {
        const userId = req.user.userId || req.userId;
        const order  = await Order.findById(req.params.id);
        if (!order)  return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng.' });
        if (order.userId.toString() !== userId.toString()) return res.status(403).json({ status: 'error', message: 'Không có quyền.' });
        if (order.paymentMethod !== 'vnpay')       return res.status(400).json({ status: 'error', message: 'Chỉ áp dụng cho đơn VNPay.' });
        if (order.paymentStatus === 'completed')   return res.status(400).json({ status: 'error', message: 'Đơn hàng đã được thanh toán.' });
        if (order.status === 'cancelled')          return res.status(400).json({ status: 'error', message: 'Đơn hàng đã bị hủy.' });
        order.paymentStatus = 'pending';
        await order.save();
        res.status(200).json({ status: 'success', data: order });
    } catch (err) {
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
        res.status(200).json({ status: 'success', data: { orderId: order._id, paymentStatus: order.paymentStatus } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/admin/orders ─────────────────────────────────────────────────────
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
            const q        = search.trim();
            const searchOr = [];
            const matchedUsers = await User.find({
                $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }, { phone: { $regex: q, $options: 'i' } }]
            }).select('_id').lean();
            if (matchedUsers.length > 0) searchOr.push({ userId: { $in: matchedUsers.map(u => u._id) } });
            if (/^[0-9a-fA-F]{24}$/.test(q))    searchOr.push({ _id: new mongoose.Types.ObjectId(q) });
            if (/^[0-9a-fA-F]{6,23}$/.test(q))  searchOr.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `^${q}`, options: 'i' } } });
            searchOr.push({ 'shippingAddress.fullName': { $regex: q, $options: 'i' } });
            searchOr.push({ 'shippingAddress.phone':    { $regex: q, $options: 'i' } });
            if (searchOr.length > 0) conditions.push({ $or: searchOr });
        }
        const filter = conditions.length > 0 ? { $and: conditions } : {};
        const [orders, total] = await Promise.all([
            Order.find(filter).populate('userId', 'name email phone avatar').sort({ createdAt: -1 })
                .skip((Number(page)-1)*Number(limit)).limit(Number(limit)).lean(),
            Order.countDocuments(filter),
        ]);
        res.status(200).json({
            status: 'success',
            data: { orders, pagination: { total, page: Number(page), pages: Math.ceil(total/Number(limit)), limit: Number(limit) } },
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── PUT /api/orders/:id/status (Admin — chuyển trạng thái thủ công) ───────────
const updateOrderStatus = async (req, res) => {
    try {
        const { status, trackingNumber } = req.body;
        const validStatuses = [
            'pending','confirmed','shipped','delivered',
            'return_requested','return_approved','return_rejected',
            'returned','cancelled',
        ];
        if (!validStatuses.includes(status))
            return res.status(400).json({ status: 'error', message: 'Trạng thái không hợp lệ.' });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng.' });

        const prevStatus = order.status;
        order.status     = status;
        if (trackingNumber) order.trackingNumber = trackingNumber;

        // Ghi timestamps
        if (status === 'confirmed'  && !order.confirmedAt) order.confirmedAt = new Date();
        if (status === 'shipped'    && !order.shippedAt)   order.shippedAt   = new Date();
        if (status === 'cancelled'  && !order.cancelledAt) order.cancelledAt = new Date();

        if (status === 'delivered' && prevStatus !== 'delivered') {
            order.deliveredAt   = new Date();
            order.paymentStatus = 'completed';
            if (!order.revenueRecorded) {
                order.revenueRecorded = true;
                await Promise.all(order.items.map(item =>
                    Product.findByIdAndUpdate(item.productId, { $inc: { soldCount: item.quantity } })
                ));
            }
        }

        if (status === 'cancelled' && prevStatus !== 'cancelled') {
            for (const item of order.items)
                await incrementStock(item.productId, item.quantity, item.color, item.size);
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
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── PUT /api/orders/:id/approve-return (Admin duyệt hoàn trả) ────────────────
const approveReturn = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng.' });
        if (order.status !== 'return_requested')
            return res.status(400).json({ status: 'error', message: 'Đơn hàng không ở trạng thái yêu cầu hoàn trả.' });

        order.status           = 'return_approved';
        order.returnReviewedAt = new Date();
        order.returnReviewedBy = req.user?.userId || req.userId;
        // Hướng dẫn gửi hàng về — admin có thể truyền lên hoặc dùng mặc định
        order.returnShipNote   = req.body.shipNote || 'Vui lòng gửi hàng về: k58/04e Cô Bắc, Hải Châu, Đà Nẵng. Liên hệ shop để được hỗ trợ.';
        await order.save();

        res.json({ status: 'success', message: 'Đã duyệt yêu cầu hoàn trả.', data: order });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── PUT /api/orders/:id/reject-return (Admin từ chối hoàn trả) ───────────────
const rejectReturn = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng.' });
        if (order.status !== 'return_requested')
            return res.status(400).json({ status: 'error', message: 'Đơn hàng không ở trạng thái yêu cầu hoàn trả.' });
        if (!req.body.reason?.trim())
            return res.status(400).json({ status: 'error', message: 'Vui lòng cung cấp lý do từ chối.' });

        order.status              = 'return_rejected';
        order.returnReviewedAt    = new Date();
        order.returnReviewedBy    = req.user?.userId || req.userId;
        order.returnRejectReason  = req.body.reason.trim();
        await order.save();

        res.json({ status: 'success', message: 'Đã từ chối yêu cầu hoàn trả.', data: order });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── PUT /api/orders/:id/confirm-return (Admin xác nhận đã nhận hàng) ─────────
const confirmReturn = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng.' });
        if (!['return_requested', 'return_approved'].includes(order.status))
            return res.status(400).json({ status: 'error', message: 'Trạng thái đơn hàng không hợp lệ để xác nhận hoàn trả.' });

        // Hoàn kho
        for (const item of order.items)
            await incrementStock(item.productId, item.quantity, item.color, item.size);

        // Trừ soldCount
        if (order.revenueRecorded) {
            order.revenueRecorded = false;
            await Promise.all(order.items.map(item =>
                Product.findByIdAndUpdate(item.productId, { $inc: { soldCount: -item.quantity } })
            ));
        }

        order.status       = 'returned';
        order.returnedAt   = new Date();
        order.returnedBy   = req.user?.userId || req.userId;
        order.refundStatus = 'pending';
        order.refundAmount = order.total;
        await order.save();

        res.json({
            status: 'success',
            message: 'Xác nhận hoàn trả thành công. Kho hàng đã được cập nhật. Vui lòng hoàn tiền cho khách.',
            data: order,
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── PUT /api/orders/:id/confirm-refund (Admin xác nhận đã hoàn tiền) ─────────
// Body: { note } — VD: "Đã chuyển khoản 150.000đ qua MB Bank lúc 14:30"
const confirmRefund = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng.' });
        if (order.status !== 'returned')
            return res.status(400).json({ status: 'error', message: 'Chỉ xác nhận hoàn tiền cho đơn đã hoàn trả.' });
        if (order.refundStatus === 'completed')
            return res.status(400).json({ status: 'error', message: 'Đơn này đã được hoàn tiền.' });

        order.refundStatus  = 'completed';
        order.refundNote    = req.body.note || '';
        order.refundAt      = new Date();
        order.refundBy      = req.user?.userId || req.userId;
        order.paymentStatus = 'refunded';
        await order.save();

        res.json({ status: 'success', message: 'Đã xác nhận hoàn tiền thành công.', data: order });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── GET /api/admin/orders/returns (Danh sách đơn cần xử lý hoàn trả) ─────────
const getReturnOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const returnStatuses = status
            ? [status]
            : ['return_requested', 'return_approved', 'return_rejected', 'returned'];

        const filter = { status: { $in: returnStatuses } };
        const [orders, total] = await Promise.all([
            Order.find(filter)
                .populate('userId', 'name email phone')
                .sort({ returnRequestedAt: -1 })
                .skip((Number(page)-1)*Number(limit))
                .limit(Number(limit))
                .lean(),
            Order.countDocuments(filter),
        ]);
        res.json({
            status: 'success',
            data: { orders, pagination: { total, page: Number(page), pages: Math.ceil(total/Number(limit)), limit: Number(limit) } },
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

module.exports = {
    createOrder,
    getUserOrders,
    getOrderById,
    cancelOrder,
    updateOrderStatus,
    processPayment,
    getAdminOrders,
    validateVoucherCode,
    calcVoucherDiscount,
    requestReturn,
    retryPayment,
    // Hoàn trả
    approveReturn,
    rejectReturn,
    confirmReturn,
    confirmRefund,
    getReturnOrders,
};