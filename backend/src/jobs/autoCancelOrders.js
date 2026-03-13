const Order   = require('../model/Order');
const Product = require('../model/Product');
const Voucher = require('../model/Voucher');

const autoCancelUnpaidOrders = async () => {
    try {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000); // 👈 30 phút

        const expiredOrders = await Order.find({
            paymentMethod: 'vnpay',
            paymentStatus: { $in: ['pending', 'failed'] },
            status:        { $nin: ['cancelled', 'delivered', 'returned', 'return_requested'] },
            createdAt:     { $lt: thirtyMinutesAgo },
        });

        for (const order of expiredOrders) {
            order.status    = 'cancelled';
            order.updatedAt = new Date();
            await order.save();

            await Promise.all(order.items.map(item =>
                Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } })
            ));

            if (order.voucherCode) {
                await Voucher.findOneAndUpdate(
                    { code: order.voucherCode },
                    { $inc: { usageCount: -1 } }
                );
            }

            console.log(`[AutoCancel] Đã hủy đơn ${order._id} — chưa thanh toán sau 30 phút`);
        }
    } catch (err) {
        console.error('[AutoCancel] Error:', err.message);
    }
};

module.exports = autoCancelUnpaidOrders;