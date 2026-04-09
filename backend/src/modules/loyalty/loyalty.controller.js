const loyaltyService = require('./loyalty.service');

async function getMe(req, res, next) {
  try {
    const userId = req.userId || req.user?.userId;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const data = await loyaltyService.getUserPointsWithTier(userId);
    return res.status(200).json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
}

// For testing / manual triggering from client services
async function postEvent(req, res, next) {
  try {
    const userId = req.userId || req.user?.userId;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const { actionType, metadata } = req.body || {};
    const { eventId } = loyaltyService.emitPointEvent(userId, actionType, metadata || {});

    // Accepted (async)
    return res.status(202).json({ status: 'success', message: 'Event queued', data: { eventId } });
  } catch (err) {
    next(err);
  }
}

async function checkout(req, res, next) {
  try {
    const userId = req.userId || req.user?.userId;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    const { orderValue, pointsToUse, referenceId } = req.body || {};
    const result = await loyaltyService.applyPointsForCheckout({
      userId,
      orderValue,
      pointsToUse,
      referenceId,
      referenceType: 'ORDER',
    });

    return res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe,
  postEvent,
  checkout,
};

