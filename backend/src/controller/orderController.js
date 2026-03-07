const Order   = require('../model/Order');
const Product = require('../model/Product');
const Voucher = require('../model/Voucher');

// ── Helper: tính discount từ voucher ─────────────────────────────────────────
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

// ── Helper: validate voucher ──────────────────────────────────────────────────
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

// ── POST /api/orders ───────────────────────────────────────────────────────────
const createOrder = async (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod, notes, voucherCode } = req.body;
        const userId = req.user.userId || req.userId;
        if (!items || items.length === 0)
            return res.status(400).json({ status: 'error', message: 'Đơn hàng phải có ít nhất 1 sản phẩm.' });

        let subtotal = 0;
        const verifiedItems = [];
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product)
                return res.status(404).json({ status: 'error', message: `Sản phẩm không tồn tại: ${item.productId}` });
            if (product.stock < item.quantity)
                return res.status(400).json({ status: 'error', message: `Sản phẩm "${product.name}" không đủ hàng. Còn lại: ${product.stock}` });

            const itemPrice = item.price || product.price;
            subtotal += itemPrice * item.quantity;

            // ✅ Snapshot giá vốn tại thời điểm mua
            const costPrice = product.costPrice || product.avgCost || 0;
            verifiedItems.push({
                productId: product._id,
                name:      product.name,
                price:     itemPrice,
                costPrice: costPrice,   // giá vốn — dùng tính lợi nhuận
                discount:  item.discount || 0,
                quantity:  item.quantity,
                color:     item.color || '',
                size:      item.size  || '',
                image:     product.images?.[0] || '',
            });
        }

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

        const shippingFee = 0;
        const total       = subtotal - discountAmount + shippingFee;

        const order = await Order.create({
            userId,
            items:           verifiedItems,
            shippingAddress,
            paymentMethod,
            notes:           notes || '',
            subtotal,
            shippingFee,
            discountAmount,
            voucherCode:     appliedVoucher ? appliedVoucher.code : null,
            total,
            paymentStatus:   'pending',
            status:          'pending',
            revenueRecorded: false,  // ✅ chưa ghi nhận doanh thu
        });

        await Promise.all([
            ...verifiedItems.map(item =>
                Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } })
            ),
            appliedVoucher && Voucher.findByIdAndUpdate(appliedVoucher._id, {
                $inc: { usageCount: 1 },
                $push: { usedBy: { $each: [{ userId, usedCount: 1, usedAt: new Date() }], $position: 0 } },
            }),
        ].filter(Boolean));

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
        await Promise.all(order.items.map(item =>
            Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } })
        ));
        if (order.voucherCode)
            await Voucher.findOneAndUpdate({ code: order.voucherCode }, { $inc: { usageCount: -1 }, $pull: { usedBy: { userId } } });
        res.status(200).json({ status: 'success', message: 'Đơn hàng đã được hủy.', data: order });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── PUT /api/orders/:id/status (Admin) ───────────────────────────────────────
const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending','confirmed','processing','shipped','delivered','cancelled'];
        if (!validStatuses.includes(status))
            return res.status(400).json({ status: 'error', message: 'Trạng thái không hợp lệ.' });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng.' });

        const prevStatus = order.status;
        order.status    = status;
        order.updatedAt = new Date();

        // ── Khi chuyển sang "delivered" ───────────────────────────────────
        if (status === 'delivered' && prevStatus !== 'delivered') {

            // 1. COD → thanh toán hoàn tất
            if (order.paymentMethod === 'cod') {
                order.paymentStatus = 'completed';
            }

            // 2. Ghi nhận doanh thu — chỉ 1 lần (tránh double-count)
            if (!order.revenueRecorded) {
                order.revenueRecorded = true;
                // soldCount: cộng số lượng đã bán vào Product
                await Promise.all(
                    order.items.map(item =>
                        Product.findByIdAndUpdate(item.productId, {
                            $inc: { soldCount: item.quantity }
                        })
                    )
                );
            }
        }

        // ── Khi admin hủy đơn → hoàn stock ──────────────────────────────
        if (status === 'cancelled' && prevStatus !== 'cancelled') {
            await Promise.all(order.items.map(item =>
                Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } })
            ));
            // Nếu doanh thu đã ghi nhận mà hủy → rollback soldCount
            if (order.revenueRecorded) {
                order.revenueRecorded = false;
                await Promise.all(order.items.map(item =>
                    Product.findByIdAndUpdate(item.productId, { $inc: { soldCount: -item.quantity } })
                ));
            }
        }

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
        if (paymentMethod === 'cod') {
            order.paymentStatus = 'pending';
        } else {
            order.paymentStatus = 'completed';
            order.status        = 'confirmed';
        }
        await order.save();
        res.status(200).json({ status: 'success', message: 'Thanh toán đã được xử lý.', data: { orderId: order._id, paymentStatus: order.paymentStatus } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── Admin: GET /api/admin/orders ──────────────────────────────────────────────
const getAdminOrders = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const filter = {};
        if (status) filter.status = status;
        const [orders, total] = await Promise.all([
            Order.find(filter).populate('userId', 'name email phone').sort({ createdAt: -1 }).skip((page-1)*limit).limit(Number(limit)).lean(),
            Order.countDocuments(filter),
        ]);
        res.status(200).json({ status: 'success', data: { orders, pagination: { total, page: Number(page), pages: Math.ceil(total/limit), limit: Number(limit) } } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

module.exports = {
    createOrder, getUserOrders, getOrderById, cancelOrder,
    updateOrderStatus, processPayment, getAdminOrders,
    validateVoucherCode, calcVoucherDiscount,
};