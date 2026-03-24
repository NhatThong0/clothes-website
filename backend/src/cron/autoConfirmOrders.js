const cron                           = require('node-cron');
const { autoConfirmDeliveredOrders } = require('../controller/orderController');
 
const startAutoConfirmCron = () => {
    // Chạy mỗi giờ (0 * * * *)
    cron.schedule('0 * * * *', async () => {
        console.log('[Cron] Running auto-confirm delivered orders...');
        await autoConfirmDeliveredOrders(null, null);
    });
    console.log('[Cron] Auto-confirm cron started (every hour)');
};
 
module.exports = { startAutoConfirmCron };
 