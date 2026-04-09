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
    { new: false },
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

module.exports = {
  emitPointEvent,
  handlePointEvent,
  getUserPointsWithTier,
  syncUserLoyaltySnapshot,
  getUserLoyaltyDetails,
  applyPointsForCheckout,
};
