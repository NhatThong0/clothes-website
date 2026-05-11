'use strict';

const { Router } = require('express');
const auth       = require('../../middleware/authenticateToken');
const optAuth    = require('../../middleware/optionalAuth');
const ctrl       = require('./recommendation.controller');

const router = Router();

// View tracking (auth optional — guests không track)
router.post('/view/:productId', optAuth, ctrl.trackView);

// Personalized (auth required)
router.get('/for-you',                    auth, ctrl.forYou);
router.get('/wishlist',                   auth, ctrl.getWishlist);
router.post('/wishlist/:productId',       auth, ctrl.toggleWishlist);
router.get('/wishlist/check/:productId',  auth, ctrl.checkWishlist);

// Public
router.get('/related/:productId', ctrl.related);
router.get('/popular',            ctrl.popular);

module.exports = router;
