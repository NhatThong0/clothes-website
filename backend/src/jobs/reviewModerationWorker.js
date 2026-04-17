'use strict';

const Product = require('../model/Product');
const { notifyAdmin } = require('../modules/notification/notification.controller');
const {
    moderateReviewText,
    buildModerationUpdate,
    calculateReviewMetrics,
} = require('../modules/product/reviewModeration.service');

let workerHandle = null;
let isRunning = false;

async function processPendingReviews() {
    if (isRunning) return;
    isRunning = true;

    try {
        const products = await Product.find({ 'reviews.moderationStatus': 'processing' }).select('name reviews');

        for (const product of products) {
            let changed = false;

            for (const review of product.reviews || []) {
                if (review.moderationStatus !== 'processing') continue;

                const result = await moderateReviewText({
                    comment: review.comment,
                    userId: review.userId,
                });

                Object.assign(review, buildModerationUpdate(result));
                changed = true;

                if (result.status === 'pending') {
                    await notifyAdmin({
                        type: 'review',
                        title: 'Review cần duyệt',
                        message: `${product.name}: có review khả nghi cần kiểm tra thủ công.`,
                        icon: '🛡️',
                        color: 'orange',
                        link: '/admin/reviews',
                        meta: {
                            productId: product._id,
                            reviewId: review._id,
                            moderationScore: result.safeScore,
                        },
                    });
                }
            }

            if (changed) {
                const metrics = calculateReviewMetrics(product.reviews || []);
                product.averageRating = metrics.averageRating;
                product.rating = metrics.rating;
                await product.save();
            }
        }
    } catch (error) {
        console.error('[reviewModerationWorker] failed:', error);
    } finally {
        isRunning = false;
    }
}

function startReviewModerationWorker() {
    if (workerHandle) return workerHandle;

    processPendingReviews().catch((error) => {
        console.error('[reviewModerationWorker] initial run failed:', error);
    });

    workerHandle = setInterval(() => {
        processPendingReviews().catch((error) => {
            console.error('[reviewModerationWorker] scheduled run failed:', error);
        });
    }, 15000);

    return workerHandle;
}

module.exports = {
    startReviewModerationWorker,
    processPendingReviews,
};
