const Voucher = require('../model/Voucher');
const { validateVoucherCode, calcVoucherDiscount } = require('./orderController');

// ── POST /api/vouchers/validate — Frontend gọi khi nhập mã ───────────────────
const validateVoucher = async (req, res) => {
    try {
        const { code, orderAmount } = req.body;
        const userId = req.user?.id || req.user?._id;

        if (!code) {
            return res.status(400).json({ status: 'error', message: 'Vui lòng nhập mã voucher.' });
        }
        if (!orderAmount || orderAmount <= 0) {
            return res.status(400).json({ status: 'error', message: 'Giá trị đơn hàng không hợp lệ.' });
        }

        const voucher      = await validateVoucherCode(code, userId, orderAmount);
        const discountAmount = calcVoucherDiscount(voucher, orderAmount);

        res.status(200).json({
            status: 'success',
            data: {
                code:              voucher.code,
                description:       voucher.description,
                discountType:      voucher.discountType,
                discountValue:     voucher.discountValue,
                maxDiscountAmount: voucher.maxDiscountAmount,
                minPurchaseAmount: voucher.minPurchaseAmount,
                discountAmount,   // số tiền thực tế được giảm
            },
        });
    } catch (err) {
        res.status(err.status || 400).json({ status: 'error', message: err.message });
    }
};

// ── Admin CRUD ────────────────────────────────────────────────────────────────

// GET /api/vouchers — Admin lấy danh sách
const getVouchers = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const [vouchers, total] = await Promise.all([
            Voucher.find()
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(Number(limit))
                .select('-usedBy') // không cần gửi array usedBy về
                .lean(),
            Voucher.countDocuments(),
        ]);
        res.status(200).json({
            status: 'success',
            data: {
                vouchers,
                pagination: {
                    total,
                    page:  Number(page),
                    pages: Math.ceil(total / limit),
                    limit: Number(limit),
                },
            },
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// POST /api/vouchers — Admin tạo voucher
const createVoucher = async (req, res) => {
    try {
        const {
            code, description, discountType, discountValue,
            maxDiscountAmount, minPurchaseAmount, voucherType,
            maxUsageCount, maxUsagePerUser, startDate, endDate,
        } = req.body;

        // Validate
        if (!code || !discountType || discountValue === undefined || !startDate || !endDate) {
            return res.status(400).json({ status: 'error', message: 'Thiếu thông tin bắt buộc.' });
        }
        if (discountType === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
            return res.status(400).json({ status: 'error', message: 'Phần trăm giảm phải từ 1–100.' });
        }
        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({ status: 'error', message: 'Ngày kết thúc phải sau ngày bắt đầu.' });
        }

        const existing = await Voucher.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(400).json({ status: 'error', message: 'Mã voucher đã tồn tại.' });
        }

        const voucher = await Voucher.create({
            code: code.toUpperCase(),
            description:       description || '',
            discountType,
            discountValue:     Number(discountValue),
            maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
            minPurchaseAmount: Number(minPurchaseAmount || 0),
            voucherType:       voucherType || 'all_products',
            maxUsageCount:     maxUsageCount ? Number(maxUsageCount) : null,
            maxUsagePerUser:   Number(maxUsagePerUser || 1),
            startDate:         new Date(startDate),
            endDate:           new Date(endDate),
        });

        res.status(201).json({ status: 'success', data: voucher });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ status: 'error', message: 'Mã voucher đã tồn tại.' });
        }
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PUT /api/vouchers/:id — Admin cập nhật
const updateVoucher = async (req, res) => {
    try {
        const {
            description, discountType, discountValue,
            maxDiscountAmount, minPurchaseAmount, voucherType,
            maxUsageCount, maxUsagePerUser, startDate, endDate, isActive,
        } = req.body;

        const voucher = await Voucher.findByIdAndUpdate(
            req.params.id,
            {
                description,
                discountType,
                discountValue:     discountValue !== undefined ? Number(discountValue) : undefined,
                maxDiscountAmount: maxDiscountAmount != null ? Number(maxDiscountAmount) : null,
                minPurchaseAmount: minPurchaseAmount !== undefined ? Number(minPurchaseAmount) : undefined,
                voucherType,
                maxUsageCount:     maxUsageCount != null ? Number(maxUsageCount) : null,
                maxUsagePerUser:   maxUsagePerUser !== undefined ? Number(maxUsagePerUser) : undefined,
                startDate:         startDate ? new Date(startDate) : undefined,
                endDate:           endDate   ? new Date(endDate)   : undefined,
                isActive:          isActive  !== undefined ? isActive : undefined,
            },
            { new: true, runValidators: true }
        );

        if (!voucher) return res.status(404).json({ status: 'error', message: 'Không tìm thấy voucher.' });
        res.status(200).json({ status: 'success', data: voucher });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// DELETE /api/vouchers/:id — Admin xóa
const deleteVoucher = async (req, res) => {
    try {
        const voucher = await Voucher.findByIdAndDelete(req.params.id);
        if (!voucher) return res.status(404).json({ status: 'error', message: 'Không tìm thấy voucher.' });
        res.status(200).json({ status: 'success', message: 'Đã xóa voucher.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

module.exports = { validateVoucher, getVouchers, createVoucher, updateVoucher, deleteVoucher };