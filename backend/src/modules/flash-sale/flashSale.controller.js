const Promotion = require('../../model/Promotion');
const Product = require('../../model/Product');

const getActiveFlashSales = async (req, res) => {
  try {
    const now = new Date();

    const promotions = await Promotion.find({
      type: 'flash_sale',
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .sort({ startDate: 1 })
      .lean();

    const productIds = [
      ...new Set(
        promotions
          .flatMap((promotion) => promotion.productIds || [])
          .map((id) => String(id)),
      ),
    ];

    const products = productIds.length
      ? await Product.find({ _id: { $in: productIds }, isActive: { $ne: false } })
          .select('name price discount images stock')
          .lean()
      : [];

    const productMap = new Map(products.map((product) => [String(product._id), product]));

    res.status(200).json({
      status: 'success',
      data: {
        now: now.toISOString(),
        promotions: promotions.map((promotion) => ({
          ...promotion,
          // Backward-compat
          products: (promotion.productIds || []).map((id) => productMap.get(String(id))).filter(Boolean),
          // Preferred: per-product prices
          items: (Array.isArray(promotion.flashSaleItems) && promotion.flashSaleItems.length > 0
            ? promotion.flashSaleItems
            : (promotion.productIds || []).map((productId) => ({ productId, price: promotion.flashSalePrice }))
          )
            .map((it) => ({
              product: productMap.get(String(it.productId)) || null,
              productId: String(it.productId),
              price: it.price,
            }))
            .filter((it) => it.product && Number(it.price) > 0),
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

const reserveFlashSale = async (req, res) => {
  try {
    const { id } = req.params;
    const quantity = Math.max(1, Math.floor(Number(req.body?.quantity ?? 1)));
    const now = new Date();

    const updated = await Promotion.findOneAndUpdate(
      {
        _id: id,
        type: 'flash_sale',
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        flashSaleRemaining: { $gte: quantity },
      },
      { $inc: { flashSaleRemaining: -quantity } },
      { new: true },
    ).lean();

    if (!updated) {
      return res.status(400).json({ status: 'error', message: 'Flash sale sold out or not active.' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('flash-sale:remaining', {
        promotionId: String(updated._id),
        remaining: updated.flashSaleRemaining,
      });

      if (updated.flashSaleRemaining <= 0) {
        io.emit('flash-sale:update', {
          kind: 'sold_out',
          promotionId: String(updated._id),
        });
      }
    }

    return res.status(200).json({
      status: 'success',
      data: {
        promotionId: String(updated._id),
        remaining: updated.flashSaleRemaining,
      },
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

module.exports = {
  getActiveFlashSales,
  reserveFlashSale,
};
