const Promotion = require('../model/Promotion');

let intervalHandle = null;
let lastSnapshotKey = null;

const buildSnapshotKey = (promotions) =>
  (promotions || [])
    .map((p) => `${p._id}:${p.flashSaleRemaining ?? ''}:${p.startDate}:${p.endDate}`)
    .sort()
    .join('|');

const startFlashSaleCron = (io, { intervalMs = 5000 } = {}) => {
  if (intervalHandle) return;

  const tick = async () => {
    try {
      const now = new Date();
      const promotions = await Promotion.find({
        type: 'flash_sale',
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
        .select('_id name productIds flashSaleRemaining flashSalePrice flashSaleItems startDate endDate')
        .sort({ startDate: 1 })
        .lean();

      const snapshotKey = buildSnapshotKey(promotions);
      if (snapshotKey === lastSnapshotKey) return;
      lastSnapshotKey = snapshotKey;

      if (io) {
        io.emit('flash-sale:update', {
          now: now.toISOString(),
          promotions,
        });
      }
    } catch (err) {
      console.error('[FlashSaleCron] tick error:', err.message);
    }
  };

  // initial broadcast
  tick();
  intervalHandle = setInterval(tick, intervalMs);
  console.log(`[Cron] Flash sale broadcast started (${intervalMs}ms)`);
};

module.exports = { startFlashSaleCron };
