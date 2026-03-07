const StockReceipt  = require('../model/StockReceipt');
const StockMovement = require('../model/StockMovement');
const Product       = require('../model/Product');
const Order         = require('../model/Order');

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Tính giá vốn FIFO cho productId khi xuất `quantityNeeded` đơn vị.
 * Lấy các batch nhập còn tồn (remainingQty > 0) theo thứ tự cũ nhất trước.
 * Returns: { totalCost, breakdown }
 */
async function calcFifoCost(productId, quantityNeeded) {
    // Lấy các receipt item còn hàng, sort theo ngày nhập (cũ nhất trước)
    const receipts = await StockReceipt.find({
        status: 'confirmed',
        'items.productId': productId,
        'items.remainingQty': { $gt: 0 },
    }).sort({ confirmedAt: 1 });

    let remaining = quantityNeeded;
    let totalCost = 0;
    const breakdown = [];

    for (const receipt of receipts) {
        if (remaining <= 0) break;
        for (const item of receipt.items) {
            if (!item.productId.equals(productId)) continue;
            if (item.remainingQty <= 0) continue;

            const take = Math.min(item.remainingQty, remaining);
            totalCost += take * item.costPrice;
            breakdown.push({ receiptId: receipt._id, itemId: item._id, take, costPrice: item.costPrice });
            remaining -= take;
            if (remaining <= 0) break;
        }
    }

    return { totalCost, avgCostPerUnit: quantityNeeded > 0 ? totalCost / quantityNeeded : 0, breakdown, fulfilled: remaining <= 0 };
}

/**
 * Deduct FIFO batches khi xuất kho (cập nhật remainingQty)
 */
async function deductFifoBatches(breakdown) {
    for (const b of breakdown) {
        await StockReceipt.updateOne(
            { _id: b.receiptId, 'items._id': b.itemId },
            { $inc: { 'items.$.remainingQty': -b.take } }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHIẾU NHẬP KHO (Purchase Receipts)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/inventory/receipts
 */
exports.getReceipts = async (req, res) => {
    try {
        const { page = 1, limit = 15, status, search } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (search) filter.$or = [
            { code: new RegExp(search, 'i') },
            { 'supplier.name': new RegExp(search, 'i') },
        ];

        const skip = (page - 1) * limit;
        const [receipts, total] = await Promise.all([
            StockReceipt.find(filter)
                .populate('createdBy',   'name')
                .populate('confirmedBy', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            StockReceipt.countDocuments(filter),
        ]);

        res.json({ status: 'success', data: { receipts, pagination: { current: +page, pages: Math.ceil(total / limit), total } } });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

/**
 * GET /api/admin/inventory/receipts/:id
 */
exports.getReceiptById = async (req, res) => {
    try {
        const receipt = await StockReceipt.findById(req.params.id)
            .populate('items.productId', 'name images stock')
            .populate('createdBy',   'name')
            .populate('confirmedBy', 'name');
        if (!receipt) return res.status(404).json({ status: 'error', message: 'Không tìm thấy phiếu nhập' });
        res.json({ status: 'success', data: receipt });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

/**
 * POST /api/admin/inventory/receipts  — Tạo phiếu nháp
 */
exports.createReceipt = async (req, res) => {
    try {
        const { supplier, items, note } = req.body;
        if (!items?.length) return res.status(400).json({ status: 'error', message: 'Cần ít nhất 1 sản phẩm' });

        // Snapshot tên sản phẩm
        const enrichedItems = await Promise.all(items.map(async item => {
            const product = await Product.findById(item.productId).select('name');
            return {
                productId:   item.productId,
                productName: product?.name || '',
                quantity:    item.quantity,
                costPrice:   item.costPrice,
                remainingQty: item.quantity,
            };
        }));

        const receipt = await StockReceipt.create({
            supplier: supplier || {},
            items:    enrichedItems,
            note:     note || '',
            createdBy: req.userId,
            status:   'draft',
        });

        res.status(201).json({ status: 'success', message: 'Tạo phiếu nhập thành công', data: receipt });
    } catch (e) {
        console.error(e);
        res.status(500).json({ status: 'error', message: e.message });
    }
};

/**
 * PUT /api/admin/inventory/receipts/:id  — Sửa phiếu (chỉ khi draft)
 */
exports.updateReceipt = async (req, res) => {
    try {
        const receipt = await StockReceipt.findById(req.params.id);
        if (!receipt) return res.status(404).json({ status: 'error', message: 'Không tìm thấy phiếu nhập' });
        if (receipt.status !== 'draft') return res.status(400).json({ status: 'error', message: 'Chỉ có thể sửa phiếu ở trạng thái Nháp' });

        const { supplier, items, note } = req.body;

        if (items?.length) {
            const enrichedItems = await Promise.all(items.map(async item => {
                const product = await Product.findById(item.productId).select('name');
                return {
                    productId:    item.productId,
                    productName:  product?.name || '',
                    quantity:     item.quantity,
                    costPrice:    item.costPrice,
                    remainingQty: item.quantity,
                };
            }));
            receipt.items = enrichedItems;
        }
        if (supplier !== undefined) receipt.supplier = supplier;
        if (note     !== undefined) receipt.note     = note;

        await receipt.save();
        res.json({ status: 'success', message: 'Cập nhật phiếu thành công', data: receipt });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

/**
 * POST /api/admin/inventory/receipts/:id/confirm  — Xác nhận nhập kho
 * Hành động:
 *   1. Cộng stock vào Product
 *   2. Tính lại avgCost của Product
 *   3. Ghi StockMovement
 *   4. Khóa phiếu (status = confirmed)
 */
exports.confirmReceipt = async (req, res) => {
    try {
        const receipt = await StockReceipt.findById(req.params.id);
        if (!receipt) return res.status(404).json({ status: 'error', message: 'Không tìm thấy phiếu nhập' });
        if (receipt.status !== 'draft') return res.status(400).json({ status: 'error', message: 'Phiếu này đã được xử lý' });

        // Xử lý từng dòng
        for (const item of receipt.items) {
            const product = await Product.findById(item.productId);
            if (!product) continue;

            const oldStock   = product.stock || 0;
            const oldAvgCost = product.avgCost || 0;
            const newStock   = oldStock + item.quantity;

            // Tính lại avgCost = (oldStock * oldAvgCost + newQty * newCost) / newStock
            const newAvgCost = newStock > 0
                ? (oldStock * oldAvgCost + item.quantity * item.costPrice) / newStock
                : item.costPrice;

            await Product.findByIdAndUpdate(item.productId, {
                stock:    newStock,
                avgCost:  Math.round(newAvgCost),
                costPrice: item.costPrice, // giá nhập gần nhất
            });

            // Ghi movement log
            await StockMovement.create({
                productId:   item.productId,
                productName: item.productName,
                type:        'receipt',
                quantity:    item.quantity,
                stockAfter:  newStock,
                costPrice:   item.costPrice,
                refType:     'StockReceipt',
                refId:       receipt._id,
                refCode:     receipt.code,
                note:        `Nhập kho: ${receipt.code}`,
                createdBy:   req.userId,
            });
        }

        // Khóa phiếu
        receipt.status      = 'confirmed';
        receipt.confirmedBy = req.userId;
        receipt.confirmedAt = new Date();
        await receipt.save();

        res.json({ status: 'success', message: 'Xác nhận nhập kho thành công', data: receipt });
    } catch (e) {
        console.error(e);
        res.status(500).json({ status: 'error', message: e.message });
    }
};

/**
 * POST /api/admin/inventory/receipts/:id/cancel  — Hủy phiếu (chỉ khi draft)
 */
exports.cancelReceipt = async (req, res) => {
    try {
        const receipt = await StockReceipt.findById(req.params.id);
        if (!receipt) return res.status(404).json({ status: 'error', message: 'Không tìm thấy phiếu nhập' });
        if (receipt.status === 'confirmed') return res.status(400).json({ status: 'error', message: 'Không thể hủy phiếu đã xác nhận' });

        receipt.status      = 'cancelled';
        receipt.cancelledBy = req.userId;
        await receipt.save();

        res.json({ status: 'success', message: 'Đã hủy phiếu nhập' });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ĐIỀU CHỈNH KHO (Stock Adjustment)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/admin/inventory/adjustments
 * Body: { items: [{ productId, quantity (+/-), reason, note }] }
 */
exports.createAdjustment = async (req, res) => {
    try {
        const { items, note } = req.body;
        if (!items?.length) return res.status(400).json({ status: 'error', message: 'Cần ít nhất 1 sản phẩm' });

        const results = [];

        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product) continue;

            const newStock = Math.max(0, (product.stock || 0) + item.quantity);
            await Product.findByIdAndUpdate(item.productId, { stock: newStock });

            const movement = await StockMovement.create({
                productId:   item.productId,
                productName: product.name,
                type:        'adjustment',
                quantity:    item.quantity,
                stockAfter:  newStock,
                costPrice:   product.avgCost || 0,
                refType:     'Manual',
                reason:      item.reason || '',
                note:        item.note || note || '',
                createdBy:   req.userId,
            });

            results.push({ product: product.name, quantity: item.quantity, stockAfter: newStock, movement });
        }

        res.status(201).json({ status: 'success', message: 'Điều chỉnh kho thành công', data: results });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHIẾU XUẤT (Delivery Orders — liên kết với Order)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/inventory/deliveries
 * Lấy danh sách đơn hàng cần xuất kho (status = confirmed hoặc processing)
 */
exports.getDeliveries = async (req, res) => {
    try {
        const { page = 1, limit = 15, status = 'confirmed' } = req.query;
        const skip = (page - 1) * limit;

        const filter = { status: { $in: ['confirmed', 'processing', 'shipped'] } };
        if (status !== 'all') filter.status = status;

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .populate('userId', 'name email phone')
                .populate('items.productId', 'name images stock avgCost')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Order.countDocuments(filter),
        ]);

        res.json({ status: 'success', data: { orders, pagination: { current: +page, pages: Math.ceil(total / limit), total } } });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

/**
 * POST /api/admin/inventory/deliveries/:orderId/export
 * Xuất kho cho một đơn hàng (ghi movement + deduct FIFO)
 */
exports.exportDelivery = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .populate('items.productId', 'name stock avgCost');
        if (!order) return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng' });

        const results = [];

        for (const item of order.items) {
            const product = item.productId;
            if (!product) continue;

            // Tính FIFO cost
            const { totalCost, avgCostPerUnit, breakdown, fulfilled } = await calcFifoCost(product._id, item.quantity);

            // Deduct FIFO batches
            if (fulfilled) await deductFifoBatches(breakdown);

            const newStock = Math.max(0, (product.stock || 0) - item.quantity);
            await Product.findByIdAndUpdate(product._id, { stock: newStock });

            await StockMovement.create({
                productId:   product._id,
                productName: product.name,
                type:        'sale',
                quantity:    -item.quantity,
                stockAfter:  newStock,
                costPrice:   avgCostPerUnit,
                salePrice:   item.price,
                refType:     'Order',
                refId:       order._id,
                refCode:     order._id.toString().slice(-8).toUpperCase(),
                note:        `Xuất kho đơn hàng #${order._id.toString().slice(-8).toUpperCase()}`,
                createdBy:   req.userId,
            });

            results.push({
                product:     product.name,
                quantity:    item.quantity,
                costPrice:   avgCostPerUnit,
                salePrice:   item.price,
                profit:      (item.price - avgCostPerUnit) * item.quantity,
                stockAfter:  newStock,
            });
        }

        res.json({ status: 'success', message: 'Xuất kho thành công', data: results });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// BÁO CÁO TỒN KHO & LỊCH SỬ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/inventory/stock-report
 * Báo cáo tồn kho hiện tại
 */
exports.getStockReport = async (req, res) => {
    try {
        const { search, lowStock, page = 1, limit = 20 } = req.query;
        const filter = { isActive: true };
        if (search) filter.$or = [{ name: new RegExp(search, 'i') }];
        if (lowStock === 'true') filter.stock = { $lte: 10 };

        const skip = (page - 1) * limit;
        const [products, total] = await Promise.all([
            Product.find(filter)
                .populate('category', 'name')
                .select('name images stock avgCost costPrice price category')
                .sort({ stock: 1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Product.countDocuments(filter),
        ]);

        const summary = await Product.aggregate([
            { $match: { isActive: true } },
            { $group: {
                _id:          null,
                totalProducts: { $sum: 1 },
                totalStock:    { $sum: '$stock' },
                totalValue:    { $sum: { $multiply: ['$stock', { $ifNull: ['$avgCost', 0] }] } },
                lowStockCount: { $sum: { $cond: [{ $lte: ['$stock', 10] }, 1, 0] } },
                outOfStock:    { $sum: { $cond: [{ $eq:  ['$stock', 0] },  1, 0] } },
            }},
        ]);

        res.json({
            status: 'success',
            data: {
                products,
                summary: summary[0] || {},
                pagination: { current: +page, pages: Math.ceil(total / limit), total },
            },
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

/**
 * GET /api/admin/inventory/movements
 * Lịch sử biến động kho (toàn bộ hoặc theo product)
 */
exports.getMovements = async (req, res) => {
    try {
        const { productId, type, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (productId) filter.productId = productId;
        if (type)      filter.type      = type;

        const skip = (page - 1) * limit;
        const [movements, total] = await Promise.all([
            StockMovement.find(filter)
                .populate('productId', 'name')
                .populate('createdBy', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            StockMovement.countDocuments(filter),
        ]);

        res.json({ status: 'success', data: { movements, pagination: { current: +page, pages: Math.ceil(total / limit), total } } });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

/**
 * GET /api/admin/inventory/profit-report
 * Báo cáo lợi nhuận từ các movement type=sale
 */
exports.getProfitReport = async (req, res) => {
    try {
        const { from, to } = req.query;
        const match = { type: 'sale' };
        if (from || to) {
            match.createdAt = {};
            if (from) match.createdAt.$gte = new Date(from);
            if (to)   match.createdAt.$lte = new Date(to);
        }

        const data = await StockMovement.aggregate([
            { $match: match },
            { $group: {
                _id:          '$productId',
                productName:  { $first: '$productName' },
                totalQty:     { $sum: { $abs: '$quantity' } },
                totalRevenue: { $sum: { $multiply: [{ $abs: '$quantity' }, '$salePrice'] } },
                totalCost:    { $sum: { $multiply: [{ $abs: '$quantity' }, '$costPrice'] } },
            }},
            { $addFields: { profit: { $subtract: ['$totalRevenue', '$totalCost'] } } },
            { $sort: { profit: -1 } },
        ]);

        const totals = data.reduce((s, d) => ({
            revenue: s.revenue + d.totalRevenue,
            cost:    s.cost    + d.totalCost,
            profit:  s.profit  + d.profit,
        }), { revenue: 0, cost: 0, profit: 0 });

        res.json({ status: 'success', data: { items: data, totals } });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};