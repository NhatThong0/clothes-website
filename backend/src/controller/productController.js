const Product  = require('../model/Product');
const Category = require('../model/Category');
const Order    = require('../model/Order');
const { validateObjectId } = require('../utils/validators');

// ── Helper ────────────────────────────────────────────────────────────────────
const getSoldMap = async (productIds) => {
    const data = await Order.aggregate([
        { $match: { status: { $in: ['delivered', 'shipped', 'confirmed'] } } },
        { $unwind: '$items' },
        { $match: { 'items.productId': { $in: productIds } } },
        { $group: { _id: '$items.productId', soldCount: { $sum: '$items.quantity' } } },
    ]);
    const map = {};
    data.forEach(s => { map[s._id.toString()] = s.soldCount; });
    return map;
};

// ── GET /api/products ─────────────────────────────────────────────────────────
exports.getAllProducts = async (req, res, next) => {
    try {
        const {
            category, minPrice, maxPrice, search,
            sort = 'newest', page = 1, limit = 12,
            type, newWithinDays,
        } = req.query;

        let filter = { isActive: { $ne: false } };
        if (category) filter.category = category;
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = parseInt(minPrice);
            if (maxPrice) filter.price.$lte = parseInt(maxPrice);
        }
        if (search) {
            filter.$or = [
                { name:        { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }
        if (type === 'sale') filter.discount = { $gt: 0 };
        if (type === 'new') {
            const days = parseInt(newWithinDays) || 30;
            const since = new Date();
            since.setDate(since.getDate() - days);
            filter.createdAt = { $gte: since };
        }

        let sortObj = {};
        switch (sort) {
            case 'price-low':  sortObj = { price: 1 };      break;
            case 'price-high': sortObj = { price: -1 };     break;
            case 'newest':     sortObj = { createdAt: -1 }; break;
            case 'discount':   sortObj = { discount: -1 };  break;
            default:           sortObj = { createdAt: -1 };
        }

        const skip     = (parseInt(page) - 1) * parseInt(limit);
        const products = await Product.find(filter)
            .populate('category')
            .sort(sortObj)
            .skip(skip)
            .limit(parseInt(limit));

        const total   = await Product.countDocuments(filter);
        const soldMap = await getSoldMap(products.map(p => p._id));

        const result = products.map(p => ({
            ...p.toObject(),
            soldCount: soldMap[p._id.toString()] || p.soldCount || 0,
        }));

        res.status(200).json({
            status: 'success',
            data:   result,
            pagination: {
                total,
                page:  parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        next(error);
    }
};

// ── GET /api/products/:id ─────────────────────────────────────────────────────
exports.getProductById = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!validateObjectId(id))
            return res.status(400).json({ status: 'error', message: 'Invalid product ID' });

        const product = await Product.findById(id)
            .populate('category')
            .populate('reviews.userId', 'name email avatar');

        if (!product)
            return res.status(404).json({ status: 'error', message: 'Product not found' });

        const soldMap = await getSoldMap([product._id]);
        const result  = {
            ...product.toObject(),
            soldCount: soldMap[product._id.toString()] || product.soldCount || 0,
        };

        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        next(error);
    }
};

// ── POST /api/products (Admin) ────────────────────────────────────────────────
exports.createProduct = async (req, res, next) => {
    try {
        const {
            name, description, price, discount,
            category, images, features,
            variants, // [{ color, size, stock, sku?, price? }]
        } = req.body;

        if (!name || !description || !price || !category) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }

        const product = new Product({
            name, description, price,
            discount: discount || 0,
            category,
            images:   images   || [],
            features: features || [],
            variants: variants || [],
        });

        await product.save();
        await product.populate('category');

        res.status(201).json({ status: 'success', message: 'Product created successfully', data: product });
    } catch (error) {
        next(error);
    }
};

// ── PUT /api/products/:id (Admin) ─────────────────────────────────────────────
exports.updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!validateObjectId(id))
            return res.status(400).json({ status: 'error', message: 'Invalid product ID' });

        // Nếu có variants trong body → tính lại stock tổng
        const updateData = { ...req.body, updatedAt: new Date() };
        if (updateData.variants?.length) {
            updateData.stock  = updateData.variants.reduce((s, v) => s + (v.stock || 0), 0);
            updateData.colors = [...new Set(updateData.variants.map(v => v.color))];
            updateData.sizes  = [...new Set(updateData.variants.map(v => v.size))];
        }

        const product = await Product.findByIdAndUpdate(id, updateData, {
            new: true, runValidators: true,
        }).populate('category');

        if (!product)
            return res.status(404).json({ status: 'error', message: 'Product not found' });

        res.status(200).json({ status: 'success', message: 'Product updated successfully', data: product });
    } catch (error) {
        next(error);
    }
};

// ── DELETE /api/products/:id (Admin) ─────────────────────────────────────────
exports.deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!validateObjectId(id))
            return res.status(400).json({ status: 'error', message: 'Invalid product ID' });

        const product = await Product.findByIdAndDelete(id);
        if (!product)
            return res.status(404).json({ status: 'error', message: 'Product not found' });

        res.status(200).json({ status: 'success', message: 'Product deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// ── GET /api/products/featured ────────────────────────────────────────────────
exports.getFeaturedProducts = async (req, res, next) => {
    try {
        const { limit = 6 } = req.query;

        const salesData = await Order.aggregate([
            { $match: { status: { $in: ['delivered', 'shipped', 'confirmed'] } } },
            { $unwind: '$items' },
            { $group: { _id: '$items.productId', soldCount: { $sum: '$items.quantity' } } },
            { $sort: { soldCount: -1 } },
            { $limit: parseInt(limit) },
        ]);

        const productIds = salesData.map(s => s._id);
        const soldMap    = {};
        salesData.forEach(s => { soldMap[s._id.toString()] = s.soldCount; });

        let products = [];
        if (productIds.length > 0) {
            products = await Product.find({ _id: { $in: productIds }, isActive: { $ne: false } })
                .populate('category');
        }

        if (products.length < parseInt(limit)) {
            const existingIds = products.map(p => p._id.toString());
            const extra = await Product.find({ _id: { $nin: existingIds }, isActive: { $ne: false } })
                .populate('category')
                .sort({ createdAt: -1 })
                .limit(parseInt(limit) - products.length);
            products = [...products, ...extra];
        }

        const result = products.map(p => ({
            ...p.toObject(),
            soldCount: soldMap[p._id.toString()] || p.soldCount || 0,
        })).sort((a, b) => b.soldCount - a.soldCount);

        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        next(error);
    }
};

// ── GET /api/products/categories ─────────────────────────────────────────────
exports.getCategories = async (req, res, next) => {
    try {
        const categories = await Category.find();
        res.status(200).json({ status: 'success', data: categories });
    } catch (error) {
        next(error);
    }
};

// ── Reviews ───────────────────────────────────────────────────────────────────
exports.addReview = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const { rating, comment, images } = req.body;

        if (!rating || !comment)
            return res.status(400).json({ status: 'error', message: 'Rating and comment are required' });

        const product = await Product.findById(id);
        if (!product) return res.status(404).json({ status: 'error', message: 'Product not found' });

        const hasPurchased = await Order.findOne({ userId, status: 'delivered', 'items.productId': id });
        if (!hasPurchased)
            return res.status(403).json({ status: 'error', message: 'Bạn cần mua và nhận sản phẩm trước khi đánh giá' });

        const alreadyReviewed = product.reviews?.find(r => r.userId?.toString() === userId);
        if (alreadyReviewed)
            return res.status(400).json({ status: 'error', message: 'Bạn đã đánh giá sản phẩm này rồi' });

        const review = { userId, rating: parseInt(rating), comment, images: images || [], isVisible: true, createdAt: new Date() };
        product.reviews = product.reviews || [];
        product.reviews.push(review);

        const totalRating = product.reviews.reduce((acc, r) => acc + r.rating, 0);
        product.averageRating = Math.round((totalRating / product.reviews.length) * 10) / 10;

        await product.save();
        res.status(201).json({ status: 'success', message: 'Review added successfully', data: review });
    } catch (error) {
        next(error);
    }
};

exports.getProductReviews = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id).populate('reviews.userId', 'name');
        if (!product) return res.status(404).json({ status: 'error', message: 'Product not found' });

        const reviews = (product.reviews || [])
            .filter(r => r.isVisible)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.status(200).json({ status: 'success', data: reviews });
    } catch (error) {
        next(error);
    }
};

exports.updateReview = async (req, res, next) => {
    try {
        const { id, reviewId } = req.params;
        const userId = req.userId;
        const { rating, comment, images } = req.body;

        const product = await Product.findById(id);
        if (!product) return res.status(404).json({ status: 'error', message: 'Product not found' });

        const review = product.reviews.id(reviewId);
        if (!review) return res.status(404).json({ status: 'error', message: 'Review not found' });
        if (review.userId.toString() !== userId)
            return res.status(403).json({ status: 'error', message: 'Không có quyền sửa đánh giá này' });

        if (rating)  review.rating  = parseInt(rating);
        if (comment) review.comment = comment;
        if (images)  review.images  = images;

        const totalRating = product.reviews.reduce((acc, r) => acc + r.rating, 0);
        product.averageRating = Math.round((totalRating / product.reviews.length) * 10) / 10;

        await product.save();
        res.status(200).json({ status: 'success', message: 'Review updated', data: review });
    } catch (error) {
        next(error);
    }
};

exports.deleteReview = async (req, res, next) => {
    try {
        const { id, reviewId } = req.params;
        const userId = req.userId;

        const product = await Product.findById(id);
        if (!product) return res.status(404).json({ status: 'error', message: 'Product not found' });

        const review = product.reviews.id(reviewId);
        if (!review) return res.status(404).json({ status: 'error', message: 'Review not found' });
        if (review.userId.toString() !== userId)
            return res.status(403).json({ status: 'error', message: 'Không có quyền xóa đánh giá này' });

        product.reviews.pull(reviewId);
        if (product.reviews.length > 0) {
            const totalRating = product.reviews.reduce((acc, r) => acc + r.rating, 0);
            product.averageRating = Math.round((totalRating / product.reviews.length) * 10) / 10;
        } else {
            product.averageRating = 0;
        }

        await product.save();
        res.status(200).json({ status: 'success', message: 'Review deleted' });
    } catch (error) {
        next(error);
    }
};

exports.getMyReview = async (req, res, next) => {
    try {
        const { id }   = req.params;
        const userId   = req.userId;
        const product  = await Product.findById(id);
        if (!product) return res.status(404).json({ status: 'error', message: 'Product not found' });

        const review = product.reviews?.find(r => r.userId?.toString() === userId);
        res.status(200).json({ status: 'success', data: review || null });
    } catch (error) {
        next(error);
    }
};