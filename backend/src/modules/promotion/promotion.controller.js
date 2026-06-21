const Promotion     = require('../../model/Promotion');
const LoyaltyAccount = require('../../model/LoyaltyAccount');
const Voucher       = require('../../model/Voucher');

// ── Helper: tính discount amount ──────────────────────────────────────────────
const calcDiscount = (promo, orderAmount) => {
    if (promo.discountType === 'freeship') return 0; // handled separately
    let discount = 0;
    if (promo.discountType === 'percentage') {
        discount = (orderAmount * promo.discountValue) / 100;
        if (promo.maxDiscountAmount) discount = Math.min(discount, promo.maxDiscountAmount);
    } else {
        discount = promo.discountValue;
    }
    return Math.min(discount, orderAmount);
};

// ── Helper: validate một promotion với context ─────────────────────────────────
const validatePromotion = async (promo, userId, orderAmount, itemCount = 1, cartProductIds = []) => {
    const now = new Date();

    if (!promo.isActive)          throw { status: 400, message: 'Khuyến mãi không còn hoạt động.' };
    if (now < promo.startDate)    throw { status: 400, message: 'Khuyến mãi chưa bắt đầu.' };
    if (now > promo.endDate)      throw { status: 400, message: 'Khuyến mãi đã kết thúc.' };

    if (promo.maxUsageCount !== null && promo.usageCount >= promo.maxUsageCount) {
        throw { status: 400, message: 'Khuyến mãi đã hết lượt sử dụng.' };
    }
    if (orderAmount < promo.minOrderAmount) {
        throw {
            status: 400,
            message: `Đơn hàng tối thiểu ${promo.minOrderAmount.toLocaleString('vi-VN')}₫ để áp dụng.`,
        };
    }
    if (promo.minQuantity > 0 && itemCount < promo.minQuantity) {
        throw { status: 400, message: `Cần ít nhất ${promo.minQuantity} sản phẩm để áp dụng.` };
    }

    // userScope: kiểm tra đối tượng người dùng
    if (promo.userScope === 'specific' && userId) {
        const allowed = (promo.allowedUsers || []).map(String);
        if (!allowed.includes(String(userId))) {
            throw { status: 403, message: 'Voucher này không dành cho bạn.' };
        }
    }

    // applyTo scope: nếu có giới hạn sản phẩm/danh mục
    if (promo.applyTo === 'specific_products' && promo.productIds?.length > 0 && cartProductIds.length > 0) {
        const allowed = promo.productIds.map(String);
        const hasMatch = cartProductIds.some(pid => allowed.includes(String(pid)));
        if (!hasMatch) throw { status: 400, message: 'Mã không áp dụng cho sản phẩm trong giỏ hàng.' };
    }
    if (promo.applyTo === 'specific_categories' && promo.categoryIds?.length > 0 && cartProductIds.length > 0) {
        const Product = require('../../model/Product');
        const cartProducts = await Product.find({ _id: { $in: cartProductIds } }).select('category').lean();
        const cartCategoryIds = cartProducts.map(p => String(p.category)).filter(Boolean);
        const allowed = promo.categoryIds.map(String);
        const hasMatch = cartCategoryIds.some(cid => allowed.includes(cid));
        if (!hasMatch) throw { status: 400, message: 'Mã không áp dụng cho danh mục sản phẩm trong giỏ hàng.' };
    }

    // Flash sale: check remaining + giờ
    if (promo.type === 'flash_sale') {
        if (promo.flashSaleRemaining !== null && promo.flashSaleRemaining <= 0) {
            throw { status: 400, message: 'Flash sale đã hết slot.' };
        }
        if (promo.flashSaleHour?.start && promo.flashSaleHour?.end) {
            const hhmm  = now.toTimeString().slice(0, 5);
            if (hhmm < promo.flashSaleHour.start || hhmm > promo.flashSaleHour.end) {
                throw {
                    status: 400,
                    message: `Flash sale chỉ áp dụng từ ${promo.flashSaleHour.start} đến ${promo.flashSaleHour.end}.`,
                };
            }
        }
    }

    // Loyalty: check tier
    if (promo.type === 'loyalty' && promo.loyaltyTier !== 'all' && userId) {
        const acc = await LoyaltyAccount.findOne({ userId });
        if (!acc || acc.tier !== promo.loyaltyTier) {
            throw { status: 400, message: `Chỉ dành cho hạng ${promo.loyaltyTier}.` };
        }
    }

    // Coupon per-user limit
    if (promo.type === 'coupon' && userId) {
        const usage = promo.usedBy.find(u => u.userId.toString() === userId.toString());
        if (usage && usage.usedCount >= promo.maxUsagePerUser) {
            throw { status: 400, message: 'Bạn đã dùng hết lượt cho mã này.' };
        }
    }

    return true;
};

// ── POST /api/promotions/validate ─────────────────────────────────────────────
// Dùng cho cả: nhập mã coupon, check auto-apply, flash sale, và loyalty voucher
const validatePromotionCode = async (req, res) => {
    try {
        const { code, orderAmount, itemCount, productIds: cartProductIds } = req.body;
        const userId = req.user?.userId || req.userId;

        if (!code) return res.status(400).json({ status: 'error', message: 'Vui lòng nhập mã.' });

        const upperCode = code.toUpperCase();

        // 1. Tìm trong Promotion trước
        const promo = await Promotion.findOne({ code: upperCode });
        if (promo) {
            await validatePromotion(promo, userId, orderAmount || 0, itemCount || 1, cartProductIds || []);
            const discountAmount = calcDiscount(promo, orderAmount || 0);
            return res.status(200).json({
                status: 'success',
                data: {
                    _id:               promo._id,
                    code:              promo.code,
                    name:              promo.name,
                    type:              promo.type,
                    discountType:      promo.discountType,
                    discountValue:     promo.discountValue,
                    maxDiscountAmount: promo.maxDiscountAmount,
                    minOrderAmount:    promo.minOrderAmount,
                    discountAmount,
                    isFreeship:        promo.discountType === 'freeship',
                },
            });
        }

        // 2. Fallback: tìm trong Voucher (voucher đổi điểm thưởng)
        const voucher = await Voucher.findOne({ code: upperCode });
        if (!voucher) return res.status(404).json({ status: 'error', message: 'Mã không tồn tại.' });

        const now = new Date();
        if (!voucher.isActive)                                           throw { status: 400, message: 'Voucher đã bị vô hiệu hóa.' };
        if (now < voucher.startDate)                                     throw { status: 400, message: 'Voucher chưa đến ngày áp dụng.' };
        if (now > voucher.endDate)                                       throw { status: 400, message: 'Voucher đã hết hạn.' };
        if (voucher.maxUsageCount !== null && voucher.usageCount >= voucher.maxUsageCount)
            throw { status: 400, message: 'Voucher đã hết lượt sử dụng.' };
        if ((orderAmount || 0) < voucher.minPurchaseAmount)
            throw { status: 400, message: `Đơn hàng tối thiểu ${voucher.minPurchaseAmount.toLocaleString('vi-VN')}₫ để dùng voucher này.` };
        if (userId && voucher.assignedTo && voucher.assignedTo.toString() !== userId.toString())
            throw { status: 403, message: 'Voucher này không thuộc về bạn.' };
        if (userId) {
            const userUsage = voucher.usedBy?.find(u => u.userId.toString() === userId.toString());
            if (userUsage && userUsage.usedCount >= voucher.maxUsagePerUser)
                throw { status: 400, message: 'Bạn đã dùng hết lượt cho voucher này.' };
        }

        let discountAmount = 0;
        if (voucher.discountType === 'percentage') {
            discountAmount = ((orderAmount || 0) * voucher.discountValue) / 100;
            if (voucher.maxDiscountAmount) discountAmount = Math.min(discountAmount, voucher.maxDiscountAmount);
        } else {
            discountAmount = voucher.discountValue;
        }
        discountAmount = Math.min(discountAmount, orderAmount || 0);

        return res.status(200).json({
            status: 'success',
            data: {
                _id:               voucher._id,
                code:              voucher.code,
                name:              voucher.description || voucher.code,
                type:              'loyalty_voucher',
                discountType:      voucher.discountType,
                discountValue:     voucher.discountValue,
                maxDiscountAmount: voucher.maxDiscountAmount,
                minOrderAmount:    voucher.minPurchaseAmount,
                discountAmount,
                isFreeship:        false,
            },
        });
    } catch (err) {
        res.status(err.status || 400).json({ status: 'error', message: err.message });
    }
};

// ── GET /api/promotions/auto-apply ────────────────────────────────────────────
// Homepage / checkout tự động lấy promo đang active (holiday, discount)
const getAutoApplyPromotions = async (req, res) => {
    try {
        const { orderAmount = 0, itemCount = 1 } = req.query;
        const userId = req.user?.userId || req.userId;
        const now    = new Date();

        const promos = await Promotion.find({
            isActive:  true,
            autoApply: true,
            startDate: { $lte: now },
            endDate:   { $gte: now },
            type:      { $in: ['discount', 'holiday', 'loyalty'] },
        });

        const valid = [];
        for (const p of promos) {
            try {
                await validatePromotion(p, userId, Number(orderAmount), Number(itemCount));
                valid.push({
                    _id:           p._id,
                    name:          p.name,
                    type:          p.type,
                    discountType:  p.discountType,
                    discountValue: p.discountValue,
                    discountAmount: calcDiscount(p, Number(orderAmount)),
                    isFreeship:    p.discountType === 'freeship',
                    holidayName:   p.holidayName,
                });
            } catch { /* skip invalid */ }
        }

        res.status(200).json({ status: 'success', data: valid });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── GET /api/promotions/loyalty/my ───────────────────────────────────────────
// User xem điểm & tier của mình
const getMyLoyalty = async (req, res) => {
    try {
        const userId = req.user.userId || req.userId;
        let acc = await LoyaltyAccount.findOne({ userId }).lean();
        if (!acc) {
            // Tạo mới nếu chưa có
            acc = await LoyaltyAccount.create({ userId });
            acc = acc.toObject();
        }

        const tierInfo    = LoyaltyAccount.getTierInfo(acc.tier);
        const nextTier    = LoyaltyAccount.TIERS.find(t => t.min > acc.totalPointsEarned);
        const pointsToNext = nextTier ? nextTier.min - acc.totalPointsEarned : 0;

        res.status(200).json({
            status: 'success',
            data: {
                points:           acc.points,
                totalPointsEarned:acc.totalPointsEarned,
                tier:             acc.tier,
                tierLabel:        tierInfo.label,
                tierDiscount:     tierInfo.discount,
                nextTier:         nextTier?.name || null,
                pointsToNext,
                history:          acc.history?.slice(0, 20) || [],
            },
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── Admin CRUD ────────────────────────────────────────────────────────────────

const getPromotions = async (req, res) => {
    try {
        const { page = 1, limit = 20, type, isActive } = req.query;
        const filter = {};
        if (type)     filter.type = type;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const [promos, total] = await Promise.all([
            Promotion.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(Number(limit))
                .select('-usedBy')
                .lean(),
            Promotion.countDocuments(filter),
        ]);

        res.status(200).json({
            status: 'success',
            data: {
                promotions: promos,
                pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
            },
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

const createPromotion = async (req, res) => {
    try {
        const body = req.body;

        // Validate dates
        if (new Date(body.startDate) >= new Date(body.endDate)) {
            return res.status(400).json({ status: 'error', message: 'Ngày kết thúc phải sau ngày bắt đầu.' });
        }

        // Sinh mã ngẫu nhiên nếu không nhập
        if (!body.code) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code;
            do {
                code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
            } while (await Promotion.findOne({ code }));
            body.code = code;
        } else {
            body.code = body.code.toUpperCase();
            const exists = await Promotion.findOne({ code: body.code });
            if (exists) return res.status(400).json({ status: 'error', message: 'Mã khuyến mãi đã tồn tại.' });
        }

        // Flash sale: require slot + items[{productId, price}], init remaining
        if (body.type === 'flash_sale') {
            const stock = Number(body.flashSaleStock);
            if (!Number.isFinite(stock) || stock <= 0) {
                return res.status(400).json({ status: 'error', message: 'Flash sale requires slot > 0.' });
            }

            let items = Array.isArray(body.flashSaleItems) ? body.flashSaleItems : [];

            // Backward-compat: if client still sends productIds + flashSalePrice
            if ((!items || items.length === 0) && Array.isArray(body.productIds) && body.productIds.length > 0) {
                const price = Number(body.flashSalePrice);
                if (Number.isFinite(price) && price > 0) {
                    items = body.productIds.map((productId) => ({ productId, price }));
                }
            }

            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ status: 'error', message: 'Flash sale requires at least 1 product + price.' });
            }

            const normalized = [];
            for (const it of items) {
                const productId = it?.productId;
                const price = Number(it?.price);
                if (!productId) {
                    return res.status(400).json({ status: 'error', message: 'Flash sale item missing productId.' });
                }
                if (!Number.isFinite(price) || price <= 0) {
                    return res.status(400).json({ status: 'error', message: 'Flash sale item price must be > 0.' });
                }
                normalized.push({ productId, price });
            }

            body.flashSaleItems = normalized;
            body.productIds = normalized.map((it) => it.productId);
            body.applyTo = 'specific_products';
            body.flashSaleRemaining = stock;
        }

        const promo = await Promotion.create(body);
        res.status(201).json({ status: 'success', data: promo });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ status: 'error', message: 'Mã đã tồn tại.' });
        res.status(500).json({ status: 'error', message: err.message });
    }
};

const updatePromotion = async (req, res) => {
    try {
        const existing = await Promotion.findById(req.params.id);
        if (!existing) return res.status(404).json({ status: 'error', message: 'Not found.' });

        const next = { ...req.body };
        const start = next.startDate ? new Date(next.startDate) : existing.startDate;
        const end = next.endDate ? new Date(next.endDate) : existing.endDate;

        if (start >= end) {
            return res.status(400).json({ status: 'error', message: 'endDate must be after startDate.' });
        }

        const type = next.type || existing.type;
        if (type === 'flash_sale') {
            if (next.flashSaleStock !== undefined && next.flashSaleRemaining === undefined) {
                const now = new Date();
                if (now < start) next.flashSaleRemaining = Number(next.flashSaleStock);
            }

            if (Array.isArray(next.flashSaleItems)) {
                next.flashSaleItems = next.flashSaleItems
                    .filter((it) => it?.productId)
                    .map((it) => ({ productId: it.productId, price: Number(it.price) }));
                next.productIds = next.flashSaleItems.map((it) => it.productId);
                next.applyTo = 'specific_products';
            } else if (next.productIds) {
                next.applyTo = 'specific_products';
            }
        }

        const promo = await Promotion.findByIdAndUpdate(req.params.id, next, { returnDocument: 'after', runValidators: true });
        if (!promo) return res.status(404).json({ status: 'error', message: 'Không tìm thấy khuyến mãi.' });
        res.status(200).json({ status: 'success', data: promo });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

const deletePromotion = async (req, res) => {
    try {
        const promo = await Promotion.findByIdAndDelete(req.params.id);
        if (!promo) return res.status(404).json({ status: 'error', message: 'Không tìm thấy khuyến mãi.' });
        res.status(200).json({ status: 'success', message: 'Đã xóa khuyến mãi.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

const togglePromotion = async (req, res) => {
    try {
        const promo = await Promotion.findById(req.params.id);
        if (!promo) return res.status(404).json({ status: 'error', message: 'Không tìm thấy.' });
        promo.isActive = !promo.isActive;
        await promo.save();
        res.status(200).json({ status: 'success', data: promo });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── Admin: xem loyalty của user bất kỳ ───────────────────────────────────────
const getUserLoyalty = async (req, res) => {
    try {
        const acc = await LoyaltyAccount.findOne({ userId: req.params.userId }).lean();
        if (!acc) return res.status(404).json({ status: 'error', message: 'Chưa có tài khoản loyalty.' });
        res.status(200).json({ status: 'success', data: acc });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── GET /api/promotions/available ────────────────────────────────────────────
// Trả về tất cả voucher user có thể dùng (không cần nhập mã)
const getAvailableVouchers = async (req, res) => {
    try {
        const userId     = req.user?.userId || req.userId;
        const orderAmount = Number(req.query.orderAmount) || 0;
        const now        = new Date();

        const promos = await Promotion.find({
            isActive:  true,
            startDate: { $lte: now },
            endDate:   { $gte: now },
            code:      { $exists: true, $ne: null },
            type:      { $nin: ['flash_sale'] },
            $or: [
                { userScope: { $exists: false } },
                { userScope: 'all' },
                { userScope: 'specific', allowedUsers: userId },
            ],
        }).select('-usedBy -flashSaleItems').lean();

        const valid = [];
        for (const p of promos) {
            if (p.maxUsageCount !== null && p.usageCount >= p.maxUsageCount) continue;
            if (p.type === 'flash_sale' && p.flashSaleRemaining !== null && p.flashSaleRemaining <= 0) continue;

            let discountAmount = 0;
            if (orderAmount > 0 && orderAmount >= p.minOrderAmount) {
                discountAmount = calcDiscount(p, orderAmount);
            }

            valid.push({
                _id:               p._id,
                code:              p.code,
                name:              p.name,
                description:       p.description,
                type:              p.type,
                discountType:      p.discountType,
                discountValue:     p.discountValue,
                maxDiscountAmount: p.maxDiscountAmount,
                minOrderAmount:    p.minOrderAmount,
                endDate:           p.endDate,
                usageCount:        p.usageCount,
                maxUsageCount:     p.maxUsageCount,
                userScope:         p.userScope || 'all',
                discountAmount,
                applicable:        orderAmount === 0 || orderAmount >= p.minOrderAmount,
                isFreeship:        p.discountType === 'freeship',
            });
        }

        // Sắp xếp: áp dụng được lên trước, giảm nhiều hơn lên đầu
        valid.sort((a, b) => {
            if (a.applicable !== b.applicable) return b.applicable - a.applicable;
            return b.discountAmount - a.discountAmount;
        });

        return res.json({ status: 'success', data: valid });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── Admin: điều chỉnh điểm thủ công ──────────────────────────────────────────
const adjustLoyaltyPoints = async (req, res) => {
    try {
        const { userId, points, description } = req.body;
        let acc = await LoyaltyAccount.findOne({ userId });
        if (!acc) acc = await LoyaltyAccount.create({ userId });

        acc.points            += Number(points);
        acc.totalPointsEarned += Math.max(0, Number(points));
        acc.tier = LoyaltyAccount.getTier(acc.totalPointsEarned);
        acc.history.push({ type: 'adjust', points: Number(points), description: description || 'Điều chỉnh thủ công' });
        await acc.save();

        res.status(200).json({ status: 'success', data: acc });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

module.exports = {
    validatePromotionCode,
    getAutoApplyPromotions,
    getAvailableVouchers,
    getMyLoyalty,
    getPromotions,
    createPromotion,
    updatePromotion,
    deletePromotion,
    togglePromotion,
    getUserLoyalty,
    adjustLoyaltyPoints,
    // export helpers để dùng trong orderController
    validatePromotion,
    calcDiscount,
};
