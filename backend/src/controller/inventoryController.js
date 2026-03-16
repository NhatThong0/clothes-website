const StockReceipt  = require('../model/StockReceipt');
const StockMovement = require('../model/StockMovement');
const Product       = require('../model/Product');
const Order         = require('../model/Order');

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function calcFifoCost(productId, quantityNeeded) {
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

async function deductFifoBatches(breakdown) {
    for (const b of breakdown) {
        await StockReceipt.updateOne(
            { _id: b.receiptId, 'items._id': b.itemId },
            { $inc: { 'items.$.remainingQty': -b.take } }
        );
    }
}

// ✅ Cập nhật stock của 1 variant cụ thể (color + size)
// Nếu không có color/size → cộng vào stock tổng toàn bộ (không có variant)
async function updateVariantStock(productId, color, size, delta) {
    const product = await Product.findById(productId);
    if (!product) return null;

    if (color && size && product.variants?.length > 0) {
        // Tìm đúng variant
        const idx = product.variants.findIndex(v => v.color === color && v.size === size);
        if (idx >= 0) {
            product.variants[idx].stock = Math.max(0, (product.variants[idx].stock || 0) + delta);
        } else {
            // Variant chưa tồn tại → thêm mới
            product.variants.push({ color, size, stock: Math.max(0, delta), sku: '', price: 0 });
        }
        // Tính lại stock tổng từ variants
        product.stock = product.variants.reduce((s, v) => s + (v.stock || 0), 0);
        product.markModified('variants');
    } else {
        // Không có variant → cộng thẳng vào stock tổng
        product.stock = Math.max(0, (product.stock || 0) + delta);
    }

    return product;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHIẾU NHẬP KHO
// ═══════════════════════════════════════════════════════════════════════════════

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

exports.getReceiptById = async (req, res) => {
    try {
        const receipt = await StockReceipt.findById(req.params.id)
            .populate('items.productId', 'name images stock variants')
            .populate('createdBy',   'name')
            .populate('confirmedBy', 'name');
        if (!receipt) return res.status(404).json({ status: 'error', message: 'Không tìm thấy phiếu nhập' });
        res.json({ status: 'success', data: receipt });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

exports.createReceipt = async (req, res) => {
    try {
        const { supplier, items, note } = req.body;
        if (!items?.length) return res.status(400).json({ status: 'error', message: 'Cần ít nhất 1 sản phẩm' });

        const enrichedItems = await Promise.all(items.map(async item => {
            const product = await Product.findById(item.productId).select('name');
            return {
                productId:    item.productId,
                productName:  product?.name || '',
                color:        item.color  || '',
                size:         item.size   || '',
                quantity:     item.quantity,
                costPrice:    item.costPrice,
                remainingQty: item.quantity,
            };
        }));

        const receipt = await StockReceipt.create({
            supplier:  supplier || {},
            items:     enrichedItems,
            note:      note || '',
            createdBy: req.userId,
            status:    'draft',
        });

        res.status(201).json({ status: 'success', message: 'Tạo phiếu nhập thành công', data: receipt });
    } catch (e) {
        console.error(e);
        res.status(500).json({ status: 'error', message: e.message });
    }
};

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
                    color:        item.color  || '',
                    size:         item.size   || '',
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
 * POST /receipts/:id/confirm
 * ✅ Cập nhật cả variants[].stock lẫn product.stock tổng
 */
exports.confirmReceipt = async (req, res) => {
    try {
        const receipt = await StockReceipt.findById(req.params.id);
        if (!receipt) return res.status(404).json({ status: 'error', message: 'Không tìm thấy phiếu nhập' });
        if (receipt.status !== 'draft') return res.status(400).json({ status: 'error', message: 'Phiếu này đã được xử lý' });

        for (const item of receipt.items) {
            const product = await Product.findById(item.productId);
            if (!product) continue;

            const oldStock   = product.stock || 0;
            const oldAvgCost = product.avgCost || 0;

            // ✅ Cập nhật variant stock nếu có color + size
            if (item.color && item.size && product.variants?.length > 0) {
                const idx = product.variants.findIndex(
                    v => v.color === item.color && v.size === item.size
                );
                if (idx >= 0) {
                    product.variants[idx].stock = (product.variants[idx].stock || 0) + item.quantity;
                } else {
                    // Variant chưa có → thêm mới
                    product.variants.push({
                        color: item.color,
                        size:  item.size,
                        stock: item.quantity,
                        sku:   '',
                        price: 0,
                    });
                }
                product.markModified('variants');
                // Tính lại stock tổng từ variants
                product.stock = product.variants.reduce((s, v) => s + (v.stock || 0), 0);
            } else {
                // Không có variant → cộng thẳng stock tổng
                product.stock = oldStock + item.quantity;
            }

            const newStock = product.stock;

            // Tính lại avgCost
            const newAvgCost = newStock > 0
                ? (oldStock * oldAvgCost + item.quantity * item.costPrice) / newStock
                : item.costPrice;

            product.avgCost   = Math.round(newAvgCost);
            product.costPrice = item.costPrice;
            await product.save();

            // Ghi movement
            await StockMovement.create({
                productId:   item.productId,
                productName: item.productName,
                color:       item.color || '',
                size:        item.size  || '',
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
// ĐIỀU CHỈNH KHO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /adjustments
 * ✅ Cập nhật cả variants[].stock lẫn product.stock tổng
 */
exports.createAdjustment = async (req, res) => {
    try {
        const { items, note } = req.body;
        if (!items?.length) return res.status(400).json({ status: 'error', message: 'Cần ít nhất 1 sản phẩm' });

        const results = [];

        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product) continue;

            // ✅ Cập nhật variant stock nếu có color + size
            if (item.color && item.size && product.variants?.length > 0) {
                const idx = product.variants.findIndex(
                    v => v.color === item.color && v.size === item.size
                );
                if (idx >= 0) {
                    product.variants[idx].stock = Math.max(0, (product.variants[idx].stock || 0) + item.quantity);
                } else {
                    product.variants.push({
                        color: item.color,
                        size:  item.size,
                        stock: Math.max(0, item.quantity),
                        sku:   '',
                        price: 0,
                    });
                }
                product.markModified('variants');
                product.stock = product.variants.reduce((s, v) => s + (v.stock || 0), 0);
            } else {
                product.stock = Math.max(0, (product.stock || 0) + item.quantity);
            }

            await product.save();
            const newStock = product.stock;

            const movement = await StockMovement.create({
                productId:   item.productId,
                productName: product.name,
                color:       item.color || '',
                size:        item.size  || '',
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
// PHIẾU XUẤT
// ═══════════════════════════════════════════════════════════════════════════════

exports.getDeliveries = async (req, res) => {
    try {
        const { page = 1, limit = 15, status = 'confirmed' } = req.query;
        const skip = (page - 1) * limit;

        const filter = { status: { $in: ['confirmed', 'processing', 'shipped'] } };
        if (status !== 'all') filter.status = status;

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .populate('userId', 'name email phone')
                .populate('items.productId', 'name images stock avgCost variants')
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

exports.exportDelivery = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .populate('items.productId', 'name stock avgCost variants');
        if (!order) return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng' });

        const results = [];

        for (const item of order.items) {
            const product = item.productId;
            if (!product) continue;

            const { totalCost, avgCostPerUnit, breakdown, fulfilled } = await calcFifoCost(product._id, item.quantity);
            if (fulfilled) await deductFifoBatches(breakdown);

            // ✅ Trừ variant stock nếu có
            const color = item.color || '';
            const size  = item.size  || '';
            if (color && size && product.variants?.length > 0) {
                const idx = product.variants.findIndex(v => v.color === color && v.size === size);
                if (idx >= 0) {
                    product.variants[idx].stock = Math.max(0, (product.variants[idx].stock || 0) - item.quantity);
                    product.markModified('variants');
                }
                product.stock = product.variants.reduce((s, v) => s + (v.stock || 0), 0);
            } else {
                product.stock = Math.max(0, (product.stock || 0) - item.quantity);
            }
            await product.save();

            const newStock = product.stock;

            await StockMovement.create({
                productId:   product._id,
                productName: product.name,
                color,
                size,
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
                product:    product.name,
                quantity:   item.quantity,
                costPrice:  avgCostPerUnit,
                salePrice:  item.price,
                profit:     (item.price - avgCostPerUnit) * item.quantity,
                stockAfter: newStock,
            });
        }

        res.json({ status: 'success', message: 'Xuất kho thành công', data: results });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// BÁO CÁO
// ═══════════════════════════════════════════════════════════════════════════════

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
                .select('name images stock avgCost costPrice price category variants')
                .sort({ stock: 1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Product.countDocuments(filter),
        ]);

        const summary = await Product.aggregate([
            { $match: { isActive: true } },
            { $group: {
                _id:           null,
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