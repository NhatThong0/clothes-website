const User = require('../model/User');
const Product = require('../model/Product');
const Category = require('../model/Category');
const Order = require('../model/Order');
const Voucher = require('../model/Voucher');
const { notifyOrderStatus } = require('./notificationController');

// ============= DASHBOARD =============

/**
 * Get dashboard statistics
 */

exports.getDashboardStats = async (req, res) => {
    try {
        const ACTIVE_STATUSES = ['delivered', 'shipped', 'confirmed', 'processing'];
        const COMPLETED_STATUSES = ['delivered'];

        const [
            totalUsers,
            totalProducts,
            totalOrders,
            revenueAgg,        // tổng tất cả đơn active
            deliveredAgg,      // chỉ đơn delivered (doanh thu thực nhận)
            recentOrders,
            ordersByStatus,
        ] = await Promise.all([
            User.countDocuments({ role: 'customer' }),
            Product.countDocuments({ isActive: true }),
            Order.countDocuments({ status: 'delivered' }),

            // Tổng doanh thu: tất cả đơn không bị cancelled
            Order.aggregate([
                { $match: { status: { $in: ACTIVE_STATUSES } } },
                { $group: { _id: null, total: { $sum: '$total' } } }
            ]),

            // Doanh thu thực: chỉ delivered (tiền đã nhận)
            Order.aggregate([
                { $match: { status: { $in: COMPLETED_STATUSES } } },
                { $group: { _id: null, total: { $sum: '$total' } } }
            ]),

            Order.find()
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('userId', 'name email')
                .lean(),

            Order.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
        ]);

        const totalRevenue = revenueAgg[0]?.total || 0;
        const totalDeliveredRevenue = deliveredAgg[0]?.total || 0;

        const statusMap = {};
        ordersByStatus.forEach(s => { statusMap[s._id] = s.count; });

        res.status(200).json({
            status: 'success',
            data: {
                summary: {
                    totalUsers,
                    totalProducts,
                    totalOrders,
                    totalRevenue,           // ✅ KPI card: tổng doanh thu (excl. cancelled)
                    totalDeliveredRevenue,  // doanh thu thực đã nhận tiền
                },
                ordersByStatus: statusMap,
                recentOrders,
            }
        });
    } catch (e) {
        console.error('[getDashboardStats]', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
};
async function incrementStock(productId, quantity, color, size) {
    const product = await Product.findById(productId);
    if (!product) return;

    if (color && size && Array.isArray(product.variants) && product.variants.length > 0) {
        const idx = product.variants.findIndex(v => v.color === color && v.size === size);
        if (idx >= 0) {
            const newVariantStock = (product.variants[idx].stock || 0) + quantity;
            await Product.findByIdAndUpdate(productId, {
                $set: { [`variants.${idx}.stock`]: newVariantStock },
            });
            const fresh = await Product.findById(productId).lean();
            const newTotal = fresh.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
            await Product.findByIdAndUpdate(productId, { $set: { stock: newTotal } });
        }
    } else {
        const newStock = (product.stock || 0) + quantity;
        await Product.findByIdAndUpdate(productId, { $set: { stock: newStock } });
    }
}
// ============================================================
// THÊM VÀO adminController.js - 3 endpoints cho charts
// ============================================================

/**
 * GET /api/admin/dashboard/revenue?period=week|month|year
 */
exports.getDashboardRevenue = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        const now = new Date();
        let groupBy, matchCurrent, matchPrev;

        if (period === 'week') {
            const start = new Date(now);
            start.setDate(now.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            const prev = new Date(start);
            prev.setDate(prev.getDate() - 7);
            matchCurrent = { createdAt: { $gte: start } };
            matchPrev = { createdAt: { $gte: prev, $lt: start } };
            groupBy = { day: { $dayOfMonth: '$createdAt' }, month: { $month: '$createdAt' } };
        } else if (period === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
            const prev = new Date(now.getFullYear(), now.getMonth() - 23, 1);
            matchCurrent = { createdAt: { $gte: start } };
            matchPrev = { createdAt: { $gte: prev, $lt: start } };
            groupBy = { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } };
        } else {
            // year
            const start = new Date(now.getFullYear() - 4, 0, 1);
            const prev = new Date(now.getFullYear() - 9, 0, 1);
            matchCurrent = { createdAt: { $gte: start } };
            matchPrev = { createdAt: { $gte: prev, $lt: start } };
            groupBy = { year: { $year: '$createdAt' } };
        }

        const pipeline = (match) => [
            {
                $match: {
                    ...match,
                    status: { $in: ['delivered', 'shipped', 'confirmed', 'processing'] }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: groupBy,
                    // Doanh thu = tổng (giá bán × số lượng)
                    revenue: {
                        $sum: { $multiply: ['$items.price', '$items.quantity'] }
                    },
                    // Lợi nhuận thực:
                    //   Nếu item có costPrice > 0 → dùng thực tế
                    //   Nếu costPrice = 0 (đơn cũ) → fallback 30%
                    profit: {
                        $sum: {
                            $multiply: [
                                '$items.quantity',
                                {
                                    $cond: [
                                        { $gt: ['$items.costPrice', 0] },
                                        // lợi nhuận thực = giá bán - giá vốn
                                        { $subtract: ['$items.price', '$items.costPrice'] },
                                        // fallback: 30% giá bán
                                        { $multiply: ['$items.price', 0.30] }
                                    ]
                                }
                            ]
                        }
                    },
                    orders: { $addToSet: '$_id' }, // đếm số đơn duy nhất
                }
            },
            {
                $addFields: {
                    orders: { $size: '$orders' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, _id: 1 } }
        ];

        const [current, previous] = await Promise.all([
            Order.aggregate(pipeline(matchCurrent)),
            Order.aggregate(pipeline(matchPrev)),
        ]);

        const totalRev = current.reduce((s, d) => s + (d.revenue || 0), 0);
        const totalRevPrev = previous.reduce((s, d) => s + (d.revenue || 0), 0);
        const totalProfit = current.reduce((s, d) => s + (d.profit || 0), 0);
        const totalProfitPrev = previous.reduce((s, d) => s + (d.profit || 0), 0);

        res.json({
            status: 'success',
            data: {
                current,
                totalRevenue: totalRev,
                totalProfit: totalProfit,
                revenueChange: totalRevPrev > 0
                    ? parseFloat(((totalRev - totalRevPrev) / totalRevPrev * 100).toFixed(1))
                    : null,
                profitChange: totalProfitPrev > 0
                    ? parseFloat(((totalProfit - totalProfitPrev) / totalProfitPrev * 100).toFixed(1))
                    : null,
            }
        });
    } catch (e) {
        console.error('[getDashboardRevenue]', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
};


/**
 * GET /api/admin/dashboard/categories
 */
exports.getDashboardCategories = async (req, res) => {
    try {
        const data = await Order.aggregate([
            { $match: { status: { $in: ['delivered', 'shipped', 'confirmed', 'processing'] } } },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            // ✅ FIX: preserveNullAndEmptyArrays (không phải preserveNullAndEmpty)
            { $unwind: { path: '$product', preserveNullAndEmptyArrays: false } },
            // ✅ FIX: lookup linh hoạt — dùng $ifNull để thử cả 'category' và 'categoryId'
            {
                $lookup: {
                    from: 'categories',
                    let: { catRef: { $ifNull: ['$product.category', '$product.categoryId'] } },
                    pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$catRef'] } } }],
                    as: 'catDoc'
                }
            },
            { $unwind: { path: '$catDoc', preserveNullAndEmptyArrays: false } },
            {
                $group: {
                    _id: '$catDoc._id',
                    name: { $first: '$catDoc.name' },
                    revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                    quantity: { $sum: '$items.quantity' },
                }
            },
            { $sort: { revenue: -1 } },
            { $limit: 8 },
        ]);

        const total = data.reduce((s, d) => s + d.revenue, 0);
        const result = data.map(d => ({
            ...d,
            _id: d._id?.toString() || 'unknown',
            percentage: total > 0 ? parseFloat((d.revenue / total * 100).toFixed(1)) : 0
        }));

        res.json({ status: 'success', data: result });
    } catch (e) {
        console.error('[getDashboardCategories]', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
};


/**
 * GET /api/admin/dashboard/top-products?limit=10
 */
exports.getDashboardTopProducts = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const data = await Order.aggregate([
            { $match: { status: { $in: ['delivered', 'shipped', 'confirmed', 'processing'] } } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productId',
                    name: { $first: '$items.name' },
                    revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                    quantity: { $sum: '$items.quantity' },
                    orders: { $sum: 1 },
                    price: { $first: '$items.price' },
                }
            },
            { $sort: { revenue: -1 } },
            { $limit: limit },
            { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
            {
                $addFields: {
                    image: { $arrayElemAt: [{ $arrayElemAt: ['$product.images', 0] }, 0] },
                    name: { $ifNull: [{ $arrayElemAt: ['$product.name', 0] }, '$name'] },
                }
            },
            { $project: { product: 0 } }
        ]);

        const maxRev = data[0]?.revenue || 1;
        const result = data.map((d, i) => ({
            ...d,
            rank: i + 1,
            percentage: parseFloat((d.revenue / maxRev * 100).toFixed(1))
        }));

        res.json({ status: 'success', data: result });
    } catch (e) {
        console.error('[getDashboardTopProducts]', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
};
// ============= PRODUCT MANAGEMENT =============

/**
 * Get all products with filters (for admin)
 */
// THAY THẾ exports.adminGetAllProducts TRONG adminController.js

exports.adminGetAllProducts = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search, category, sort } = req.query;

        // ✅ Dùng $regex thay vì $text để không cần text index
        let filter = {};
        if (search && search.trim()) {
            filter.$or = [
                { name: { $regex: search.trim(), $options: 'i' } },
                { description: { $regex: search.trim(), $options: 'i' } },
            ];
        }
        if (category) {
            filter.category = category;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const products = await Product.find(filter)
            .populate('category', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Product.countDocuments(filter);
        const pages = Math.ceil(total / parseInt(limit));

        res.status(200).json({
            status: 'success',
            data: {
                products,
                pagination: { current: parseInt(page), pages, total }
            }
        });
    } catch (error) {
        console.error('adminGetAllProducts error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * Create product
 */
exports.createProduct = async (req, res, next) => {
    try {
        const { name, description, price, discount, category, images, features, variants } = req.body;

        if (!name || !description || price === undefined || !category) {
            return res.status(400).json({ status: 'error', message: 'Vui lòng cung cấp đầy đủ thông tin' });
        }

        const variantList = Array.isArray(variants) ? variants : [];
        const totalStock = variantList.reduce((s, v) => s + (Number(v.stock) || 0), 0);
        const colors = [...new Set(variantList.map(v => v.color).filter(Boolean))];
        const sizes = [...new Set(variantList.map(v => v.size).filter(Boolean))];

        const newProduct = new Product({
            name,
            description,
            price: parseFloat(price),
            discount: parseFloat(discount || 0),
            category,
            images: images || [],
            features: features || [],
            variants: variantList,
            stock: totalStock,
            colors,
            sizes,
            isActive: true,
        });

        await newProduct.save();
        await newProduct.populate('category', 'name');

        res.status(201).json({ status: 'success', message: 'Tạo sản phẩm thành công', data: newProduct });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ status: 'error', message: error.message || 'Lỗi khi tạo sản phẩm' });
    }
};



/**
 * Update product
 */
exports.updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, price, discount, category, images, features, variants, isActive, isFeatured } = req.body;

        const variantList = Array.isArray(variants) ? variants : [];
        const totalStock = variantList.reduce((s, v) => s + (Number(v.stock) || 0), 0);
        const colors = [...new Set(variantList.map(v => v.color).filter(Boolean))];
        const sizes = [...new Set(variantList.map(v => v.size).filter(Boolean))];

        const updateData = { updatedAt: new Date(), variants: variantList, stock: totalStock, colors, sizes };
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (price !== undefined) updateData.price = parseFloat(price);
        if (discount !== undefined) updateData.discount = parseFloat(discount || 0);
        if (category !== undefined) updateData.category = category;
        if (images !== undefined) updateData.images = images;
        if (features !== undefined) updateData.features = features;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (isFeatured !== undefined) updateData.isFeatured = isFeatured;

        const product = await Product.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
            .populate('category', 'name');

        if (!product) return res.status(404).json({ status: 'error', message: 'Không tìm thấy sản phẩm' });

        res.status(200).json({ status: 'success', message: 'Cập nhật thành công', data: product });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ status: 'error', message: error.message || 'Lỗi khi cập nhật sản phẩm' });
    }
};

/**
 * Toggle product active status
 */
exports.toggleProductStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found'
            });
        }

        product.isActive = !product.isActive;
        product.updatedAt = Date.now();
        await product.save();

        res.status(200).json({
            status: 'success',
            message: `Product ${product.isActive ? 'activated' : 'deactivated'} successfully`,
            data: product
        });
    } catch (error) {
        console.error('Toggle product status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to toggle product status'
        });
    }
};

/**
 * Delete product
 */
exports.deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndDelete(id);

        if (!product) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Product deleted successfully',
            data: product
        });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete product'
        });
    }
};

// ============= CATEGORY MANAGEMENT =============

/**
 * Get all categories
 */
exports.adminGetAllCategories = async (req, res, next) => {
    try {
        const categories = await Category.find();

        // Get product count for each category
        const categoriesWithCount = await Promise.all(
            categories.map(async (cat) => {
                const count = await Product.countDocuments({ category: cat._id });
                return {
                    ...cat.toObject(),
                    productCount: count
                };
            })
        );

        res.status(200).json({
            status: 'success',
            data: categoriesWithCount
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch categories'
        });
    }
};

/**
 * Create category
 */
exports.createCategory = async (req, res, next) => {
    try {
        const { name, description, image, isFeatured } = req.body;

        if (!name) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide category name'
            });
        }

        const newCategory = new Category({
            name,
            description: description || '',
            image: image || null,
            isFeatured: isFeatured || false, // ✅ thêm
        });

        await newCategory.save();

        res.status(201).json({
            status: 'success',
            message: 'Category created successfully',
            data: newCategory
        });
    } catch (error) {
        console.error('Create category error:', error);
        if (error.code === 11000) {
            return res.status(400).json({
                status: 'error',
                message: 'Category name already exists'
            });
        }
        res.status(500).json({
            status: 'error',
            message: 'Failed to create category'
        });
    }
};

/**
 * Update category
 */
exports.updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, image, isFeatured } = req.body;

        const category = await Category.findByIdAndUpdate(
            id,
            { name, description, image, isFeatured },
            { new: true, runValidators: true }
        );

        if (!category) {
            return res.status(404).json({
                status: 'error',
                message: 'Category not found'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Category updated successfully',
            data: category
        });
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update category'
        });
    }
};

/**
 * Delete category
 */
exports.deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if category has products
        const productCount = await Product.countDocuments({ category: id });
        if (productCount > 0) {
            return res.status(400).json({
                status: 'error',
                message: `Cannot delete category. It has ${productCount} product(s)`
            });
        }

        const category = await Category.findByIdAndDelete(id);

        if (!category) {
            return res.status(404).json({
                status: 'error',
                message: 'Category not found'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Category deleted successfully',
            data: category
        });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete category'
        });
    }
};

// ============= ORDER MANAGEMENT =============

/**
 * Get all orders with filters
 */
exports.adminGetAllOrders = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, search, dateFrom, dateTo } = req.query;
        const mongoose = require('mongoose');

        const conditions = [];
        if (status) conditions.push({ status });

        if (dateFrom || dateTo) {
            const d = {};
            if (dateFrom) d.$gte = new Date(dateFrom + 'T00:00:00.000Z');
            if (dateTo) d.$lte = new Date(dateTo + 'T23:59:59.999Z');
            conditions.push({ createdAt: d });
        }

        if (search && search.trim()) {
            const q = search.trim();
            const searchOr = [];

            const matchedUsers = await User.find({
                $or: [
                    { name: { $regex: q, $options: 'i' } },
                    { email: { $regex: q, $options: 'i' } },
                    { phone: { $regex: q, $options: 'i' } },
                ]
            }).select('_id').lean();
            if (matchedUsers.length > 0)
                searchOr.push({ userId: { $in: matchedUsers.map(u => u._id) } });

            if (/^[0-9a-fA-F]{24}$/.test(q))
                searchOr.push({ _id: new mongoose.Types.ObjectId(q) });

            if (/^[0-9a-fA-F]{6,23}$/.test(q))
                searchOr.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `^${q}`, options: 'i' } } });

            searchOr.push({ 'shippingAddress.fullName': { $regex: q, $options: 'i' } });
            searchOr.push({ 'shippingAddress.phone': { $regex: q, $options: 'i' } });

            if (searchOr.length > 0) conditions.push({ $or: searchOr });
        }

        const filter = conditions.length > 0 ? { $and: conditions } : {};
        const skip = (page - 1) * limit;

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .populate('userId', 'name email phone')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Order.countDocuments(filter),
        ]);

        res.status(200).json({
            status: 'success',
            data: {
                orders,
                pagination: { current: parseInt(page), pages: Math.ceil(total / limit), total }
            }
        });
    } catch (err) {
        console.error('[adminGetAllOrders]', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
};


// ── FIX 3: thêm confirmReturn — đặt sau exports.updateOrderStatus ─
// ════════════════════════════════════════════════════════════════════
// Thay thế exports.confirmReturn trong adminController.js
// ════════════════════════════════════════════════════════════════════
exports.confirmReturn = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order)
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng.' });
        if (order.status !== 'return_requested')
            return res.status(400).json({ status: 'error', message: 'Đơn hàng chưa có yêu cầu hoàn trả.' });

        order.status = 'returned';
        order.returnedAt = new Date();
        order.updatedAt = new Date();

        // ✅ Hoàn stock đúng variant
        for (const item of order.items) {
            await incrementStock(item.productId, item.quantity, item.color || '', item.size || '');
        }

        if (order.revenueRecorded) {
            order.revenueRecorded = false;
            await Promise.all(order.items.map(item =>
                Product.findByIdAndUpdate(item.productId, { $inc: { soldCount: -item.quantity } })
            ));
        }

        await order.save();
        res.status(200).json({ status: 'success', message: 'Xác nhận hoàn trả thành công.', data: order });
    } catch (err) {
        console.error('[confirmReturn]', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ════════════════════════════════════════════════════════════════════
// Thay thế exports.updateOrderStatus trong adminController.js
// ════════════════════════════════════════════════════════════════════
exports.updateOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, trackingNumber } = req.body;

        const validStatuses = [
            'pending', 'confirmed', 'processing', 'shipped',
            'delivered', 'cancelled', 'return_requested', 'returned'
        ];
        if (!validStatuses.includes(status))
            return res.status(400).json({ status: 'error', message: 'Invalid status' });

        const order = await Order.findById(id);
        if (!order)
            return res.status(404).json({ status: 'error', message: 'Order not found' });

        const prevStatus = order.status;
        order.status = status;
        order.updatedAt = new Date();
        if (trackingNumber) order.trackingNumber = trackingNumber;

        // delivered
        if (status === 'delivered' && prevStatus !== 'delivered') {
            order.paymentStatus = 'completed';
            order.deliveredAt = new Date();
            if (!order.revenueRecorded) {
                order.revenueRecorded = true;
                await Promise.all(order.items.map(item =>
                    Product.findByIdAndUpdate(item.productId, { $inc: { soldCount: item.quantity } })
                ));
            }
        }

        // ✅ returned → hoàn stock đúng variant
        if (status === 'returned' && prevStatus !== 'returned') {
            order.returnedAt = new Date();
            for (const item of order.items) {
                await incrementStock(item.productId, item.quantity, item.color || '', item.size || '');
            }
            if (order.revenueRecorded) {
                order.revenueRecorded = false;
                await Promise.all(order.items.map(item =>
                    Product.findByIdAndUpdate(item.productId, { $inc: { soldCount: -item.quantity } })
                ));
            }
        }

        // ✅ cancelled → hoàn stock đúng variant
        if (status === 'cancelled' && prevStatus !== 'cancelled') {
            for (const item of order.items) {
                await incrementStock(item.productId, item.quantity, item.color || '', item.size || '');
            }
            if (order.revenueRecorded) {
                order.revenueRecorded = false;
                await Promise.all(order.items.map(item =>
                    Product.findByIdAndUpdate(item.productId, { $inc: { soldCount: -item.quantity } })
                ));
            }
        }

        await order.save();
        await notifyOrderStatus(order, status, req);
        const populated = await Order.findById(order._id).populate('userId', 'name email phone');
        res.status(200).json({ status: 'success', message: 'Order status updated', data: populated });
    } catch (err) {
        console.error('[updateOrderStatus]', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
};

/**
 * Get order details
 */
exports.getOrderDetails = async (req, res, next) => {
    try {
        const { id } = req.params;

        const order = await Order.findById(id)
            .populate('userId', 'name email phone')
            .populate('items.productId', 'name price images');

        if (!order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found'
            });
        }

        res.status(200).json({
            status: 'success',
            data: order
        });
    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch order details'
        });
    }
};

/**
 * Update order status
 */
exports.updateOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, trackingNumber } = req.body;

        const validStatuses = [
            'pending', 'confirmed', 'processing', 'shipped',
            'delivered', 'cancelled', 'return_requested', 'returned'
        ];
        if (!validStatuses.includes(status))
            return res.status(400).json({ status: 'error', message: 'Invalid status' });

        const order = await Order.findById(id);
        if (!order)
            return res.status(404).json({ status: 'error', message: 'Order not found' });

        const prevStatus = order.status;
        order.status = status;
        order.updatedAt = new Date();
        if (trackingNumber) order.trackingNumber = trackingNumber;

        // ── delivered → set paymentStatus + deliveredAt + ghi nhận doanh thu ──
        if (status === 'delivered' && prevStatus !== 'delivered') {
            order.paymentStatus = 'completed';   // ✅ tự động đánh dấu đã thanh toán
            order.deliveredAt = new Date();    // ✅ mốc để tính 3 ngày hoàn trả

            if (!order.revenueRecorded) {
                order.revenueRecorded = true;
                await Promise.all(order.items.map(item =>
                    Product.findByIdAndUpdate(item.productId, { $inc: { soldCount: item.quantity } })
                ));
            }
        }

        // ── returned → hoàn kho + rollback doanh thu ────────────────────────
        if (status === 'returned' && prevStatus !== 'returned') {
            order.returnedAt = new Date();
            await Promise.all(order.items.map(item =>
                Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } })
            ));
            if (order.revenueRecorded) {
                order.revenueRecorded = false;
                await Promise.all(order.items.map(item =>
                    Product.findByIdAndUpdate(item.productId, { $inc: { soldCount: -item.quantity } })
                ));
            }
        }

        // ── cancelled → hoàn stock ───────────────────────────────────────────
        if (status === 'cancelled' && prevStatus !== 'cancelled') {
            await Promise.all(order.items.map(item =>
                Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } })
            ));
            if (order.revenueRecorded) {
                order.revenueRecorded = false;
                await Promise.all(order.items.map(item =>
                    Product.findByIdAndUpdate(item.productId, { $inc: { soldCount: -item.quantity } })
                ));
            }
        }

        await order.save();
        await notifyOrderStatus(order, status, req);

        const populated = await Order.findById(order._id).populate('userId', 'name email phone');
        res.status(200).json({ status: 'success', message: 'Order status updated', data: populated });
    } catch (err) {
        console.error('[updateOrderStatus]', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ============= USER MANAGEMENT =============

/**
 * Get all users
 */
exports.adminGetAllUsers = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search, role } = req.query;

        let filter = {};
        if (search) {
            filter.$or = [
                { email: new RegExp(search, 'i') },
                { name: new RegExp(search, 'i') }
            ];
        }
        if (role) {
            filter.role = role;
        }

        const skip = (page - 1) * limit;
        const users = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(filter);
        const pages = Math.ceil(total / limit);

        res.status(200).json({
            status: 'success',
            data: {
                users,
                pagination: {
                    current: parseInt(page),
                    pages,
                    total
                }
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch users'
        });
    }
};

/**
 * Update user role
 */
exports.updateUserRole = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        const validRoles = ['customer', 'admin'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid role'
            });
        }

        // Prevent removing the last admin
        if (role === 'customer') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount === 1) {
                const user = await User.findById(userId);
                if (user.role === 'admin') {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Cannot remove the last admin user'
                    });
                }
            }
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { role, updatedAt: Date.now() },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'User role updated successfully',
            data: user
        });
    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update user role'
        });
    }
};

/**
 * Get user order history
 */
exports.getUserOrderHistory = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const skip = (page - 1) * limit;
        const orders = await Order.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('items.productId', 'name price');

        const total = await Order.countDocuments({ userId });
        const pages = Math.ceil(total / limit);

        res.status(200).json({
            status: 'success',
            data: {
                orders,
                pagination: {
                    current: parseInt(page),
                    pages,
                    total
                }
            }
        });
    } catch (error) {
        console.error('Get user order history error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch user order history'
        });
    }
};
/**
 * Create user (admin)
 */
exports.adminCreateUser = async (req, res, next) => {
    try {
        const { name, email, password, phone, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ status: 'error', message: 'Vui lòng cung cấp tên, email và mật khẩu' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ status: 'error', message: 'Email đã tồn tại' });
        }

        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password,
            phone: phone || '',
            role: role || 'customer',
            isActive: true,
        });

        const result = user.toObject();
        delete result.password;

        res.status(201).json({ status: 'success', message: 'Tạo tài khoản thành công', data: result });
    } catch (error) {
        console.error('Admin create user error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ status: 'error', message: 'Email đã tồn tại' });
        }
        res.status(500).json({ status: 'error', message: 'Lỗi khi tạo tài khoản' });
    }
};

/**
 * Update user info (admin)
 */
exports.adminUpdateUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { name, phone, role, isActive, password } = req.body;

        // Nếu đổi role thành customer → kiểm tra không phải admin cuối
        if (role === 'customer') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            const target = await User.findById(userId);
            if (adminCount === 1 && target?.role === 'admin') {
                return res.status(400).json({ status: 'error', message: 'Không thể hạ quyền admin cuối cùng' });
            }
        }

        const updateData = { updatedAt: Date.now() };
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;
        if (role !== undefined) updateData.role = role;
        if (isActive !== undefined) updateData.isActive = isActive;

        // Nếu có đổi mật khẩu
        if (password) {
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        const user = await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');
        if (!user) return res.status(404).json({ status: 'error', message: 'Không tìm thấy người dùng' });

        res.status(200).json({ status: 'success', message: 'Cập nhật thành công', data: user });
    } catch (error) {
        console.error('Admin update user error:', error);
        res.status(500).json({ status: 'error', message: 'Lỗi khi cập nhật' });
    }
};

/**
 * Delete user (admin)
 */
exports.adminDeleteUser = async (req, res, next) => {
    try {
        const { userId } = req.params;

        // Không cho xóa admin cuối
        const target = await User.findById(userId);
        if (!target) return res.status(404).json({ status: 'error', message: 'Không tìm thấy người dùng' });

        if (target.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount === 1) {
                return res.status(400).json({ status: 'error', message: 'Không thể xóa admin cuối cùng' });
            }
        }

        await User.findByIdAndDelete(userId);
        res.status(200).json({ status: 'success', message: 'Đã xóa tài khoản' });
    } catch (error) {
        console.error('Admin delete user error:', error);
        res.status(500).json({ status: 'error', message: 'Lỗi khi xóa tài khoản' });
    }
};

/**
 * Toggle user active/inactive (admin)
 */
exports.adminToggleUserStatus = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ status: 'error', message: 'Không tìm thấy người dùng' });

        user.isActive = !user.isActive;
        user.updatedAt = Date.now();
        await user.save();

        res.status(200).json({
            status: 'success',
            message: `Tài khoản đã ${user.isActive ? 'kích hoạt' : 'vô hiệu hóa'}`,
            data: user,
        });
    } catch (error) {
        console.error('Admin toggle user status error:', error);
        res.status(500).json({ status: 'error', message: 'Lỗi khi thay đổi trạng thái' });
    }
};

// ============= REVIEW MANAGEMENT =============

/**
 * Get all reviews
 */
exports.adminGetAllReviews = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, productId, isVisible, rating } = req.query;
        const skip = (page - 1) * limit;
        // Lấy tất cả products có reviews
        const matchProduct = {};
        if (productId) matchProduct._id = mongoose.Types.ObjectId(productId);
        const products = await Product.find(matchProduct)
            .select('name reviews')
            .populate('reviews.userId', 'name email');
        // Flatten tất cả reviews
        let reviews = [];
        for (const product of products) {
            for (const review of product.reviews || []) {
                reviews.push({
                    ...review.toObject(),
                    productName: product.name,
                    productId: product._id,
                });
            }
        }
        if (isVisible === 'true') reviews = reviews.filter(r => r.isVisible === true);
        if (isVisible === 'false') reviews = reviews.filter(r => r.isVisible === false);
        if (rating && parseInt(rating) > 0) {
            reviews = reviews.filter(r => r.rating === parseInt(rating));
        }
        reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const total = reviews.length;
        const pages = Math.ceil(total / limit);
        const paginated = reviews.slice(skip, skip + parseInt(limit));

        res.status(200).json({
            status: 'success',
            data: {
                reviews: paginated,
                pagination: {
                    current: parseInt(page),
                    pages,
                    total
                }
            }
        });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch reviews'
        });
    }
};

/**
 * Delete review
 */
exports.deleteReview = async (req, res, next) => {
    try {
        const { productId, reviewId } = req.params;

        const product = await Product.findByIdAndUpdate(
            productId,
            { $pull: { reviews: { _id: reviewId } } },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Review deleted successfully',
            data: product
        });
    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete review'
        });
    }
};

// ============= VOUCHER MANAGEMENT =============

/**
 * Get all vouchers
 */
exports.adminGetAllVouchers = async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const skip = (page - 1) * limit;
        const vouchers = await Voucher.find()
            .populate('applicableProducts', 'name')
            .populate('applicableCategories', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Voucher.countDocuments();
        const pages = Math.ceil(total / limit);

        res.status(200).json({
            status: 'success',
            data: {
                vouchers,
                pagination: {
                    current: parseInt(page),
                    pages,
                    total
                }
            }
        });
    } catch (error) {
        console.error('Get vouchers error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch vouchers'
        });
    }
};

/**
 * Create voucher
 */
exports.createVoucher = async (req, res, next) => {
    try {
        const {
            code,
            description,
            discountType,
            discountValue,
            voucherType,
            applicableProducts,
            applicableCategories,
            maxUsageCount,
            maxUsagePerUser,
            startDate,
            endDate,
            minPurchaseAmount,
            maxDiscountAmount
        } = req.body;

        if (!code || !discountValue || !startDate || !endDate) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide all required fields'
            });
        }

        // Validate dates
        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({
                status: 'error',
                message: 'Start date must be before end date'
            });
        }

        const newVoucher = new Voucher({
            code: code.toUpperCase(),
            description,
            discountType: discountType || 'percentage',
            discountValue,
            voucherType: voucherType || 'all_products',
            applicableProducts: applicableProducts || [],
            applicableCategories: applicableCategories || [],
            maxUsageCount: maxUsageCount || null,
            maxUsagePerUser: maxUsagePerUser || 1,
            startDate,
            endDate,
            minPurchaseAmount: minPurchaseAmount || 0,
            maxDiscountAmount: maxDiscountAmount || null,
            isActive: true
        });

        await newVoucher.save();
        await newVoucher.populate('applicableProducts', 'name');
        await newVoucher.populate('applicableCategories', 'name');

        res.status(201).json({
            status: 'success',
            message: 'Voucher created successfully',
            data: newVoucher
        });
    } catch (error) {
        console.error('Create voucher error:', error);
        if (error.code === 11000) {
            return res.status(400).json({
                status: 'error',
                message: 'Voucher code already exists'
            });
        }
        res.status(500).json({
            status: 'error',
            message: 'Failed to create voucher'
        });
    }
};

/**
 * Update voucher
 */
exports.updateVoucher = async (req, res, next) => {
    try {
        const { voucherId } = req.params;
        const {
            description,
            discountValue,
            voucherType,
            applicableProducts,
            applicableCategories,
            maxUsageCount,
            maxUsagePerUser,
            startDate,
            endDate,
            minPurchaseAmount,
            maxDiscountAmount,
            isActive
        } = req.body;

        const updateData = {};
        if (description !== undefined) updateData.description = description;
        if (discountValue !== undefined) updateData.discountValue = discountValue;
        if (voucherType !== undefined) updateData.voucherType = voucherType;
        if (applicableProducts !== undefined) updateData.applicableProducts = applicableProducts;
        if (applicableCategories !== undefined) updateData.applicableCategories = applicableCategories;
        if (maxUsageCount !== undefined) updateData.maxUsageCount = maxUsageCount;
        if (maxUsagePerUser !== undefined) updateData.maxUsagePerUser = maxUsagePerUser;
        if (startDate !== undefined) updateData.startDate = startDate;
        if (endDate !== undefined) updateData.endDate = endDate;
        if (minPurchaseAmount !== undefined) updateData.minPurchaseAmount = minPurchaseAmount;
        if (maxDiscountAmount !== undefined) updateData.maxDiscountAmount = maxDiscountAmount;
        if (isActive !== undefined) updateData.isActive = isActive;

        updateData.updatedAt = Date.now();

        const voucher = await Voucher.findByIdAndUpdate(voucherId, updateData, { new: true })
            .populate('applicableProducts', 'name')
            .populate('applicableCategories', 'name');

        if (!voucher) {
            return res.status(404).json({
                status: 'error',
                message: 'Voucher not found'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Voucher updated successfully',
            data: voucher
        });
    } catch (error) {
        console.error('Update voucher error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update voucher'
        });
    }
};

/**
 * Delete voucher
 */
exports.deleteVoucher = async (req, res, next) => {
    try {
        const { voucherId } = req.params;

        const voucher = await Voucher.findByIdAndDelete(voucherId);

        if (!voucher) {
            return res.status(404).json({
                status: 'error',
                message: 'Voucher not found'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Voucher deleted successfully',
            data: voucher
        });
    } catch (error) {
        console.error('Delete voucher error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete voucher'
        });
    }
};
// Toggle review visibility
exports.toggleReviewVisibility = async (req, res, next) => {
    try {
        const { productId, reviewId } = req.params;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ status: 'error', message: 'Product not found' });
        }

        const review = product.reviews.id(reviewId);
        if (!review) {
            return res.status(404).json({ status: 'error', message: 'Review not found' });
        }

        review.isVisible = !review.isVisible;
        await product.save();

        res.status(200).json({
            status: 'success',
            message: `Review ${review.isVisible ? 'shown' : 'hidden'} successfully`,
            data: review,
        });
    } catch (error) {
        next(error);
    }
};