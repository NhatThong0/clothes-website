const StockReceipt  = require('../../model/StockReceipt');
const StockMovement = require('../../model/StockMovement');
const Product       = require('../../model/Product');
const Order         = require('../../model/Order');
const { pool }     = require('../../db/mysql');

// ── MySQL helpers (inventory sync) ─────────────────────────────────────────────
function toInt(val) {
    const n = Number(val);
    if (!Number.isFinite(n)) return 0;
    return Math.trunc(n);
}

async function upsertStockReceiptInMySQL(receipt, reqUserId) {
    const receiptId = receipt._id.toString();
    const supplier = receipt.supplier || {};

    // NOTE: bảng MySQL dùng status: pending/confirmed/cancelled.
    // Ở đây receipt đã được "confirm" ở tầng Mongo nên status sẽ là 'confirmed'.
    await pool.query(
        `INSERT INTO stock_receipts
            (id, code, status, totalItems, totalAmount, note,
             supplierName, supplierPhone, supplierNote,
             createdBy, confirmedBy, cancelledBy,
             confirmedAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?,
                 ?, ?, ?,
                 ?, ?, ?,
                 ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            status        = VALUES(status),
            totalItems    = VALUES(totalItems),
            totalAmount   = VALUES(totalAmount),
            note          = VALUES(note),
            supplierName  = VALUES(supplierName),
            supplierPhone = VALUES(supplierPhone),
            supplierNote  = VALUES(supplierNote),
            confirmedBy   = VALUES(confirmedBy),
            confirmedAt   = VALUES(confirmedAt),
            updatedAt     = VALUES(updatedAt)`,
        [
            receiptId,
            receipt.code || '',
            receipt.status || 'confirmed',
            toInt(receipt.totalItems),
            toInt(receipt.totalAmount),
            receipt.note || '',
            supplier.name || '',
            supplier.phone || '',
            supplier.note || '',
            receipt.createdBy?.toString?.() || receipt.createdBy || null,
            reqUserId?.toString?.() || reqUserId || null,
            receipt.cancelledBy?.toString?.() || receipt.cancelledBy || null,
            receipt.confirmedAt || new Date(),
            receipt.createdAt || new Date(),
            receipt.updatedAt || new Date(),
        ]
    );
}

async function syncStockReceiptItemsInMySQL(receipt) {
    const receiptId = receipt._id.toString();

    await pool.query('DELETE FROM stock_receipt_items WHERE receiptId = ?', [receiptId]);

    for (const item of receipt.items || []) {
        await pool.query(
            `INSERT INTO stock_receipt_items
                (receiptId, itemId, productId, productName,
                 color, size, quantity, remainingQty, costPrice, totalCost)
             VALUES (?, ?, ?, ?,
                     ?, ?, ?, ?, ?, ?)`,
            [
                receiptId,
                item._id?.toString?.() || item._id || null,
                item.productId?.toString?.() || item.productId || null,
                item.productName || '',
                item.color || '',
                item.size || '',
                toInt(item.quantity),
                toInt(item.remainingQty ?? item.quantity),
                toInt(item.costPrice),
                toInt(item.totalCost ?? (Number(item.quantity) || 0) * (Number(item.costPrice) || 0)),
            ]
        );
    }
}

async function insertStockMovementInMySQL(movement) {
    const movementId = movement._id.toString();
    await pool.query(
        `INSERT INTO stock_movements
            (id, productId, productName, type, quantity, stockAfter,
             costPrice, salePrice, refType, refId, refCode,
             reason, note, createdBy, createdAt)
         VALUES (?, ?, ?, ?, ?, ?,
                 ?, ?, ?, ?, ?,
                 ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            productId   = VALUES(productId),
            productName = VALUES(productName),
            type        = VALUES(type),
            quantity    = VALUES(quantity),
            stockAfter  = VALUES(stockAfter),
            costPrice   = VALUES(costPrice),
            salePrice   = VALUES(salePrice),
            refType     = VALUES(refType),
            refId       = VALUES(refId),
            refCode     = VALUES(refCode),
            reason      = VALUES(reason),
            note        = VALUES(note),
            createdBy   = VALUES(createdBy),
            createdAt   = VALUES(createdAt)`,
        [
            movementId,
            movement.productId?.toString?.() || movement.productId || null,
            movement.productName || '',
            movement.type,
            toInt(movement.quantity),
            toInt(movement.stockAfter),
            toInt(movement.costPrice),
            toInt(movement.salePrice),
            movement.refType || null,
            movement.refId?.toString?.() || movement.refId || null,
            movement.refCode || null,
            movement.reason || null,
            movement.note || null,
            movement.createdBy?.toString?.() || movement.createdBy || null,
            movement.createdAt || new Date(),
        ]
    );
}

async function syncProductStockForReceiptItemInMySQL({ product, item, newStock }) {
    const productId = product._id.toString();
    const pid = productId;

    const hasVariant = Boolean(item.color && item.size && product.variants?.length > 0);

    if (hasVariant) {
        const variant = product.variants?.find(v => v.color === item.color && v.size === item.size);
        const variantStock = toInt(variant?.stock ?? item.quantity);

        // Try update first; if variant row doesn't exist yet, insert it (Mongo may have pushed it).
        const [upd] = await pool.query(
            'UPDATE product_variants SET stock = ? WHERE productId = ? AND color = ? AND size = ?',
            [variantStock, pid, item.color, item.size]
        );

        if (upd?.affectedRows === 0) {
            await pool.query(
                'INSERT INTO product_variants (productId, color, size, sku, price, stock) VALUES (?, ?, ?, ?, ?, ?)',
                [pid, item.color, item.size, '', 0, variantStock]
            );
        }
    }

    await pool.query(
        'UPDATE products SET stock = ?, avgCost = ?, costPrice = ?, updatedAt = NOW() WHERE id = ?',
        [toInt(newStock), toInt(product.avgCost), toInt(product.costPrice), pid]
    );
}

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

        const mysqlErrors = [];
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
            const movement = await StockMovement.create({
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
            // ── Sync sang MySQL (products + stock_movements + stock_receipts/items) ──
            try {
                await syncProductStockForReceiptItemInMySQL({
                    product,
                    item,
                    newStock,
                });

                await insertStockMovementInMySQL(movement);
            } catch (mysqlErr) {
                // Best-effort: Mongo đã update. Nếu MySQL fail, log để admin kiểm tra.
                console.error('[confirmReceipt][mysql-sync] product/movement:', mysqlErr.message);
                mysqlErrors.push({
                    productId: item.productId?.toString?.() || item.productId || null,
                    message: mysqlErr.message,
                });
            }
        }

        receipt.status      = 'confirmed';
        receipt.confirmedBy = req.userId;
        receipt.confirmedAt = new Date();
        await receipt.save();

        // ── Ghi receipt + items + movements vào MySQL ─────────────────────────────
        // Lưu ở đây để chắc chắn receipt đã ở trạng thái confirmed.
        try {
            await upsertStockReceiptInMySQL(receipt, req.userId);
            await syncStockReceiptItemsInMySQL(receipt);

        } catch (mysqlErr) {
            console.error('[confirmReceipt][mysql-sync] receipt/items/movements:', mysqlErr.message);
            mysqlErrors.push({ message: mysqlErr.message });
        }

        res.json({
            status: 'success',
            message: 'Xác nhận nhập kho thành công',
            data: receipt,
            mysqlSync: mysqlErrors.length ? 'partial' : 'ok',
            mysqlErrors: mysqlErrors.length ? mysqlErrors : undefined,
        });
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
        const mysqlErrors = [];

        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product) continue;

            const oldStock = product.stock || 0;

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
            const appliedQty = newStock - oldStock; // phản ánh thực tế (do clamp về 0)

            const absAppliedQty = Math.abs(appliedQty);
            const valueMode = item.valueMode || 'unit';
            const unitValue =
                appliedQty < 0
                    ? (valueMode === 'total'
                        ? (absAppliedQty > 0 ? (Number(item.totalValue || 0) || 0) / absAppliedQty : 0)
                        : (Number(item.unitValue || 0) || 0))
                    : (product.avgCost || 0);
            const costPriceForMovement = Math.round(unitValue || 0);

            const movement = await StockMovement.create({
                productId:   item.productId,
                productName: product.name,
                color:       item.color || '',
                size:        item.size  || '',
                type:        'adjustment',
                quantity:    appliedQty,
                stockAfter:  newStock,
                costPrice:   costPriceForMovement,
                refType:     'Manual',
                reason:      item.reason || '',
                note:        item.note || note || '',
                createdBy:   req.userId,
            });

            results.push({ product: product.name, quantity: appliedQty, stockAfter: newStock, movement });

            // ── Sync sang MySQL (stock + movement) ───────────────────────────────
            try {
                await syncProductStockForReceiptItemInMySQL({ product, item, newStock });
                await insertStockMovementInMySQL(movement);
            } catch (mysqlErr) {
                console.error('[createAdjustment][mysql-sync]:', mysqlErr.message);
                mysqlErrors.push({ message: mysqlErr.message });
            }
        }

        res.status(201).json({
            status: 'success',
            message: 'Điều chỉnh kho thành công',
            data: results,
            mysqlSync: mysqlErrors.length ? 'partial' : 'ok',
            mysqlErrors: mysqlErrors.length ? mysqlErrors : undefined,
        });
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
