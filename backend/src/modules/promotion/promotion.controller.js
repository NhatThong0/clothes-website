const Promotion     = require('../../model/Promotion');
const LoyaltyAccount = require('../../model/LoyaltyAccount');

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
const validatePromotion = async (promo, userId, orderAmount, itemCount = 1) => {
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
// Dùng cho cả: nhập mã coupon, check auto-apply, flash sale
const validatePromotionCode = async (req, res) => {
    try {
        const { code, orderAmount, itemCount } = req.body;
        const userId = req.user?.userId || req.userId;

        if (!code) return res.status(400).json({ status: 'error', message: 'Vui lòng nhập mã.' });

        // Tìm theo code — chấp nhận tất cả loại có code (coupon, flash_sale, holiday, discount)
        const promo = await Promotion.findOne({ code: code.toUpperCase() });
        if (!promo) return res.status(404).json({ status: 'error', message: 'Mã khuyến mãi không tồn tại.' });

        await validatePromotion(promo, userId, orderAmount || 0, itemCount || 1);

        const discountAmount = calcDiscount(promo, orderAmount || 0);
        const isFreeship = promo.discountType === 'freeship';

        res.status(200).json({
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
                isFreeship,
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

        // Nếu có code → check unique (áp dụng cho mọi loại có code)
        if (body.code) {
            const exists = await Promotion.findOne({ code: body.code.toUpperCase() });
            if (exists) return res.status(400).json({ status: 'error', message: 'Mã khuyến mãi đã tồn tại.' });
        }

        // Coupon bắt buộc phải có code
        if (body.type === 'coupon' && !body.code) {
            return res.status(400).json({ status: 'error', message: 'Loại Coupon bắt buộc phải có mã code.' });
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

        const promo = await Promotion.findByIdAndUpdate(req.params.id, next, { new: true, runValidators: true });
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
