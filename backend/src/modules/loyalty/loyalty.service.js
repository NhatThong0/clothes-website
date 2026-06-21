const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');

const User = require('../../model/User');
const LoyaltyTier = require('../../model/LoyaltyTier');
const LoyaltyPointRule = require('../../model/LoyaltyPointRule');
const LoyaltyPointLog = require('../../model/LoyaltyPointLog');

const pointEventBus = new EventEmitter();
pointEventBus.setMaxListeners(50);

let loyaltySeedPromise = null;

function tierIconKeyFromName(name) {
  const normalized = String(name || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('bronze')) return 'bronze';
  if (normalized.includes('silver')) return 'silver';
  if (normalized.includes('gold')) return 'gold';
  if (normalized.includes('platinum')) return 'platinum';
  if (normalized.includes('diamond')) return 'diamond';
  return normalized.replace(/\s+/g, '_');
}

function createHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function mapTierDoc(tier) {
  if (!tier) return null;
  return {
    id: String(tier._id),
    name: tier.name,
    min_points: Number(tier.minPoints) || 0,
    discount_percent: Number(tier.discountPercent) || 0,
    icon_key: tierIconKeyFromName(tier.name),
  };
}

function mapLoyaltySnapshot(row) {
  if (!row) return null;
  return {
    spendablePoints: Number(row.spendable_points) || 0,
    tierPoints: Number(row.tier_points) || 0,
    currentTierId: row.current_tier_id ? String(row.current_tier_id) : null,
    tier: {
      name: row.tier_name || null,
      minPoints: Number(row.tier_min_points) || 0,
      discountPercent: Number(row.tier_discount_percent) || 0,
      iconKey: row.tier_icon_key || null,
    },
    syncedAt: new Date(),
  };
}

function emptyLoyaltySnapshot(baseTier = null) {
  return {
    spendablePoints: 0,
    tierPoints: 0,
    currentTierId: baseTier?.id || null,
    tier: {
      name: baseTier?.name || null,
      minPoints: baseTier?.min_points || 0,
      discountPercent: baseTier?.discount_percent || 0,
      iconKey: baseTier?.icon_key || null,
    },
    syncedAt: new Date(),
  };
}

function mapSnapshotToRow(userId, loyalty) {
  return {
    user_id: String(userId),
    spendable_points: Number(loyalty?.spendablePoints) || 0,
    tier_points: Number(loyalty?.tierPoints) || 0,
    current_tier_id: loyalty?.currentTierId ? String(loyalty.currentTierId) : null,
    tier_name: loyalty?.tier?.name || null,
    tier_min_points: Number(loyalty?.tier?.minPoints) || 0,
    tier_discount_percent: Number(loyalty?.tier?.discountPercent) || 0,
    tier_icon_key: loyalty?.tier?.iconKey || null,
  };
}

async function ensureSeedData() {
  if (!loyaltySeedPromise) {
    loyaltySeedPromise = (async () => {
      const tierCount = await LoyaltyTier.countDocuments();
      if (tierCount === 0) {
        await LoyaltyTier.insertMany([
          { name: 'Bronze', minPoints: 0, discountPercent: 0, isActive: true },
          { name: 'Silver', minPoints: 1000, discountPercent: 3, isActive: true },
          { name: 'Gold', minPoints: 5000, discountPercent: 7, isActive: true },
        ]);
      }

      const ruleCount = await LoyaltyPointRule.countDocuments();
      if (ruleCount === 0) {
        await LoyaltyPointRule.insertMany([
          { actionType: 'PURCHASE', pointsPerUnit: 0.01, minOrderValue: 100000, maxPointsPerEvent: 2000, isActive: true },
          { actionType: 'REVIEW', pointsPerUnit: 50, minOrderValue: null, maxPointsPerEvent: 50, isActive: true },
          { actionType: 'SHARE', pointsPerUnit: 10, minOrderValue: null, maxPointsPerEvent: 10, isActive: true },
        ]);
      }
    })().catch((err) => {
      loyaltySeedPromise = null;
      throw err;
    });
  }

  return loyaltySeedPromise;
}

async function runWithOptionalTransaction(work) {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (err) {
    if (String(err.message || '').includes('Transaction numbers are only allowed')) {
      return work(null);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

function normalizeActionType(actionType) {
  const value = String(actionType || '').trim().toUpperCase();
  if (!['PURCHASE', 'REVIEW', 'SHARE'].includes(value)) {
    throw createHttpError(400, 'Unsupported actionType');
  }
  return value;
}

async function getBaseTier(session = null) {
  await ensureSeedData();
  const query = LoyaltyTier.findOne({ isActive: true }).sort({ minPoints: 1 });
  if (session) query.session(session);
  const tier = await query.lean();
  if (!tier) throw createHttpError(500, 'No tiers configured');
  return mapTierDoc(tier);
}

async function getApplicableRule(actionType, metadata, session = null) {
  await ensureSeedData();
  const orderValue = Number(metadata?.orderValue ?? 0);
  const query = LoyaltyPointRule.findOne({
    actionType,
    isActive: true,
    $or: [{ minOrderValue: null }, { minOrderValue: { $lte: Number.isFinite(orderValue) ? orderValue : 0 } }],
  }).sort({ minOrderValue: -1, createdAt: -1 });

  if (session) query.session(session);
  return query.lean();
}

function computePoints(rule, actionType, metadata) {
  const pointsPerUnit = Number(rule.pointsPerUnit);
  if (!Number.isFinite(pointsPerUnit) || pointsPerUnit <= 0) return 0;

  const units = actionType === 'PURCHASE'
    ? Number(metadata?.orderValue ?? 0)
    : Number(metadata?.units ?? 1);

  if (!Number.isFinite(units) || units <= 0) return 0;

  let points = Math.floor(units * pointsPerUnit);
  const maxPoints = Number(rule.maxPointsPerEvent);
  if (Number.isFinite(maxPoints) && maxPoints >= 0) {
    points = Math.min(points, Math.floor(maxPoints));
  }

  return Math.max(0, points);
}

async function ensureUserLoyaltySnapshot(userId, session = null) {
  const query = User.findById(userId);
  if (session) query.session(session);
  const user = await query;
  if (!user) throw createHttpError(404, 'User not found');

  if (user.loyalty?.tier?.name) {
    return user;
  }

  const baseTier = await getBaseTier(session);
  user.loyalty = emptyLoyaltySnapshot(baseTier);
  user.updatedAt = new Date();
  await user.save({ session });
  return user;
}

async function resolveTierForPoints(tierPoints, session = null) {
  await ensureSeedData();
  const query = LoyaltyTier.findOne({
    isActive: true,
    minPoints: { $lte: Number(tierPoints) || 0 },
  }).sort({ minPoints: -1 });

  if (session) query.session(session);
  const tier = await query.lean();
  return mapTierDoc(tier);
}

async function createPointLog(payload, session = null) {
  return LoyaltyPointLog.create([payload], session ? { session } : undefined);
}

async function handlePointEvent(userId, actionType, metadata = {}) {
  const normalizedActionType = normalizeActionType(actionType);
  const eventId = String(metadata.eventId || randomUUID());

  const result = await runWithOptionalTransaction(async (session) => {
    const user = await ensureUserLoyaltySnapshot(userId, session);
    const rule = await getApplicableRule(normalizedActionType, metadata, session);
    if (!rule) {
      throw createHttpError(400, `No active rule for actionType=${normalizedActionType}`);
    }

    const points = computePoints(rule, normalizedActionType, metadata);
    if (points <= 0) {
      return { eventId, applied: false, pointsAdded: 0, upgraded: false, tier: null, loyalty: null };
    }

    try {
      await createPointLog({
        eventId,
        userId: user._id,
        actionType: normalizedActionType,
        deltaSpendable: points,
        deltaTier: points,
        referenceType: metadata.referenceType ? String(metadata.referenceType) : null,
        referenceId: metadata.referenceId ? String(metadata.referenceId) : null,
        metadata: metadata || null,
      }, session);
    } catch (err) {
      if (err?.code === 11000) {
        return { eventId, applied: false, duplicated: true, pointsAdded: 0, upgraded: false, tier: null, loyalty: null };
      }
      throw err;
    }

    const currentLoyalty = user.loyalty || emptyLoyaltySnapshot(await getBaseTier(session));
    currentLoyalty.spendablePoints = (Number(currentLoyalty.spendablePoints) || 0) + points;
    currentLoyalty.tierPoints = (Number(currentLoyalty.tierPoints) || 0) + points;

    const tier = await resolveTierForPoints(currentLoyalty.tierPoints, session);
    const previousTierId = currentLoyalty.currentTierId ? String(currentLoyalty.currentTierId) : null;
    const nextTierId = tier?.id || previousTierId;

    currentLoyalty.currentTierId = nextTierId || null;
    currentLoyalty.tier = {
      name: tier?.name || null,
      minPoints: tier?.min_points || 0,
      discountPercent: tier?.discount_percent || 0,
      iconKey: tier?.icon_key || null,
    };
    currentLoyalty.syncedAt = new Date();

    user.loyalty = currentLoyalty;
    user.updatedAt = new Date();
    user.markModified('loyalty');
    await user.save({ session });

    return {
      eventId,
      applied: true,
      pointsAdded: points,
      upgraded: Boolean(nextTierId && previousTierId !== nextTierId),
      tier,
      loyalty: mapSnapshotToRow(user._id, currentLoyalty),
    };
  });

  if (result.applied) {
    await syncUserLoyaltySnapshot(userId, result.loyalty);
  }

  return result;
}

function emitPointEvent(userId, actionType, metadata = {}) {
  const eventId = String(metadata.eventId || randomUUID());
  const payload = { userId: String(userId), actionType, metadata: { ...metadata, eventId } };
  setImmediate(() => pointEventBus.emit('point_event', payload));
  return { eventId };
}

pointEventBus.on('point_event', async ({ userId, actionType, metadata }) => {
  try {
    await handlePointEvent(userId, actionType, metadata);
  } catch (err) {
    console.error('[Loyalty] handlePointEvent failed:', err.message);
  }
});

async function getUserPointsWithTier(userId) {
  const user = await ensureUserLoyaltySnapshot(userId);
  return mapSnapshotToRow(user._id, user.loyalty || emptyLoyaltySnapshot(await getBaseTier()));
}

async function syncUserLoyaltySnapshot(userId, loyaltyRow = null) {
  const loyalty = loyaltyRow || (await getUserPointsWithTier(userId));
  const snapshot = mapLoyaltySnapshot(loyalty) || emptyLoyaltySnapshot(await getBaseTier());

  await User.findByIdAndUpdate(
    String(userId),
    {
      $set: {
        loyalty: snapshot,
        updatedAt: Date.now(),
      },
    },
    { returnDocument: 'before' },
  );

  return snapshot;
}

async function getUserLoyaltyDetails(userId, { logLimit = 20 } = {}) {
  const loyalty = await getUserPointsWithTier(userId);
  const logs = await LoyaltyPointLog.find({ userId: String(userId) })
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(Number(logLimit) || 20, 100)))
    .lean();

  return {
    loyalty,
    logs: logs.map((log) => ({
      id: String(log._id),
      event_id: log.eventId,
      action_type: log.actionType,
      delta_spendable: log.deltaSpendable,
      delta_tier: log.deltaTier,
      reference_type: log.referenceType,
      reference_id: log.referenceId,
      metadata: log.metadata || null,
      created_at: log.createdAt,
    })),
  };
}

async function applyPointsForCheckout({ userId, orderValue, pointsToUse, referenceId, referenceType = 'ORDER' }) {
  const total = Number(orderValue);
  if (!Number.isFinite(total) || total <= 0) throw createHttpError(400, 'Invalid orderValue');

  const points = Math.floor(Number(pointsToUse));
  if (!Number.isFinite(points) || points < 0) throw createHttpError(400, 'Invalid pointsToUse');

  const rate = Number(process.env.LOYALTY_POINT_TO_CURRENCY_RATE || 1);
  if (!Number.isFinite(rate) || rate <= 0) throw createHttpError(500, 'Invalid LOYALTY_POINT_TO_CURRENCY_RATE');

  const discountAmount = points * rate;
  const maxDiscount = Math.floor(total * 0.2);
  if (discountAmount > maxDiscount) {
    throw createHttpError(400, 'Points discount cannot exceed 20% of order value');
  }

  if (points === 0) {
    return { applied: false, pointsUsed: 0, discountAmount: 0 };
  }

  const eventId = randomUUID();
  const result = await runWithOptionalTransaction(async (session) => {
    const user = await ensureUserLoyaltySnapshot(userId, session);

    try {
      await createPointLog({
        eventId,
        userId: user._id,
        actionType: 'REDEEM',
        deltaSpendable: -points,
        deltaTier: 0,
        referenceType: referenceType ? String(referenceType) : null,
        referenceId: referenceId ? String(referenceId) : null,
        metadata: { orderValue: total, pointsToUse: points, rate },
      }, session);
    } catch (err) {
      if (err?.code === 11000) {
        return { applied: false, duplicated: true, pointsUsed: 0, discountAmount: 0, loyalty: null };
      }
      throw err;
    }

    const currentLoyalty = user.loyalty || emptyLoyaltySnapshot(await getBaseTier(session));
    if ((Number(currentLoyalty.spendablePoints) || 0) < points) {
      throw createHttpError(400, 'Insufficient spendable points');
    }

    currentLoyalty.spendablePoints = (Number(currentLoyalty.spendablePoints) || 0) - points;
    currentLoyalty.syncedAt = new Date();
    user.loyalty = currentLoyalty;
    user.updatedAt = new Date();
    user.markModified('loyalty');
    await user.save({ session });

    return {
      applied: true,
      eventId,
      pointsUsed: points,
      discountAmount,
      loyalty: mapSnapshotToRow(user._id, currentLoyalty),
    };
  });

  if (result.applied) {
    await syncUserLoyaltySnapshot(userId, result.loyalty);
  }

  return result;
}

// ── Đổi điểm lấy voucher ─────────────────────────────────────────────────────
const LoyaltyReward = require('../../model/LoyaltyReward');
const Voucher       = require('../../model/Voucher');

const TIER_ORDER = { bronze: 0, silver: 1, gold: 2, platinum: 3 };

function generateVoucherCode(rewardId) {
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  const ts   = Date.now().toString(36).toUpperCase().slice(-4);
  return `LYL${ts}${rand}`;
}

async function getAvailableRewards(userId) {
  const user = await ensureUserLoyaltySnapshot(userId);
  const spendable  = Number(user.loyalty?.spendablePoints) || 0;
  const tierName   = (user.loyalty?.tier?.name || 'bronze').toLowerCase();
  const tierLevel  = TIER_ORDER[tierName] ?? 0;

  const rewards = await LoyaltyReward.find({ isActive: true }).lean();

  return rewards.map(r => {
    const reqLevel      = TIER_ORDER[r.requiredTier] ?? 0;
    const userEntry     = (r.redeemedBy || []).find(x => x.userId.toString() === userId.toString());
    const userRedeemed  = userEntry ? userEntry.count : 0;
    const withinPerUser = r.maxRedeemPerUser === null || userRedeemed < r.maxRedeemPerUser;
    const canRedeem     = spendable >= r.pointsRequired && tierLevel >= reqLevel
      && (r.maxRedeemCount === null || r.redeemedCount < r.maxRedeemCount)
      && withinPerUser;
    return { ...r, canRedeem, userPoints: spendable, userTier: tierName, userRedeemed };
  });
}

async function redeemReward(userId, rewardId) {
  const reward = await LoyaltyReward.findById(rewardId);
  if (!reward || !reward.isActive)
    throw createHttpError(404, 'Phần thưởng không tồn tại hoặc đã hết.');
  if (reward.maxRedeemCount !== null && reward.redeemedCount >= reward.maxRedeemCount)
    throw createHttpError(400, 'Phần thưởng này đã hết lượt đổi.');
  if (reward.maxRedeemPerUser !== null) {
    const userEntry = (reward.redeemedBy || []).find(r => r.userId.toString() === userId.toString());
    const userCount = userEntry ? userEntry.count : 0;
    if (userCount >= reward.maxRedeemPerUser)
      throw createHttpError(400, `Bạn đã đạt giới hạn ${reward.maxRedeemPerUser} lượt đổi cho phần thưởng này.`);
  }

  const eventId = randomUUID();

  const result = await runWithOptionalTransaction(async (session) => {
    const user = await ensureUserLoyaltySnapshot(userId, session);
    const spendable = Number(user.loyalty?.spendablePoints) || 0;
    const tierName  = (user.loyalty?.tier?.name || 'bronze').toLowerCase();
    const tierLevel = TIER_ORDER[tierName] ?? 0;
    const reqLevel  = TIER_ORDER[reward.requiredTier] ?? 0;

    if (tierLevel < reqLevel)
      throw createHttpError(403, `Cần hạng ${reward.requiredTier} để đổi phần thưởng này.`);
    if (spendable < reward.pointsRequired)
      throw createHttpError(400, `Không đủ điểm. Cần ${reward.pointsRequired}, hiện có ${spendable}.`);

    // 1. Ghi log trừ điểm
    await createPointLog({
      eventId,
      userId: user._id,
      actionType: 'REDEEM',
      deltaSpendable: -reward.pointsRequired,
      deltaTier: 0,
      referenceType: 'REWARD',
      referenceId: String(reward._id),
      metadata: { rewardName: reward.name, pointsRequired: reward.pointsRequired },
    }, session);

    // 2. Trừ điểm user
    user.loyalty.spendablePoints = spendable - reward.pointsRequired;
    user.loyalty.syncedAt = new Date();
    user.updatedAt = new Date();
    user.markModified('loyalty');
    await user.save({ session });

    // 3. Tạo voucher cá nhân hoá
    const now     = new Date();
    const endDate = new Date(now.getTime() + reward.voucherValidDays * 86400000);
    const code    = generateVoucherCode(reward._id);

    const [voucher] = await Voucher.create([{
      code,
      description:       `Đổi điểm: ${reward.name}`,
      discountType:      reward.discountType,
      discountValue:     reward.discountValue,
      maxDiscountAmount: reward.maxDiscountAmount,
      minPurchaseAmount: reward.minPurchaseAmount,
      voucherType:       'all_products',
      maxUsageCount:     1,
      maxUsagePerUser:   1,
      startDate:         now,
      endDate,
      isActive:          true,
      assignedTo:        user._id,
    }], session ? { session } : undefined);

    // 4. Tăng số lượt đã đổi của reward (toàn hệ thống + per user)
    const userAlreadyIn = reward.redeemedBy?.some(r => r.userId.toString() === userId.toString());
    if (userAlreadyIn) {
      await LoyaltyReward.findOneAndUpdate(
        { _id: reward._id, 'redeemedBy.userId': userId },
        { $inc: { redeemedCount: 1, 'redeemedBy.$.count': 1 } },
        session ? { session } : undefined
      );
    } else {
      await LoyaltyReward.findByIdAndUpdate(
        reward._id,
        { $inc: { redeemedCount: 1 }, $push: { redeemedBy: { userId, count: 1 } } },
        session ? { session } : undefined
      );
    }

    return {
      voucher,
      pointsUsed:     reward.pointsRequired,
      remainingPoints: user.loyalty.spendablePoints,
    };
  });

  await syncUserLoyaltySnapshot(userId);
  return result;
}

async function getUserVouchers(userId) {
  const vouchers = await Voucher.find({ assignedTo: userId }).sort({ createdAt: -1 }).lean();
  const now = new Date();
  return vouchers.map(v => {
    const isExpired = now > new Date(v.endDate);
    const isUsed    = v.maxUsageCount !== null && v.usageCount >= v.maxUsageCount;
    return {
      ...v,
      isExpired,
      isUsed,
      isValid: v.isActive && !isExpired && !isUsed,
    };
  });
}

module.exports = {
  emitPointEvent,
  handlePointEvent,
  getUserPointsWithTier,
  syncUserLoyaltySnapshot,
  getUserLoyaltyDetails,
  applyPointsForCheckout,
  getAvailableRewards,
  redeemReward,
  getUserVouchers,
};
