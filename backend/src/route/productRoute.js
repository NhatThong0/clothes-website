const express = require('express');
const router = express.Router();
const {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    getFeaturedProducts,
    getCategories,
    addReview,
    getProductReviews, 
    updateReview,
    deleteReview,
    getMyReview,
    
} = require('../controller/productController');
const authenticateToken = require('../middleWare/authenticateToken');

// Public routes
router.get('/', getAllProducts);
router.get('/featured', getFeaturedProducts);
router.get('/categories', getCategories);
router.get('/:id', getProductById);

// Add review (requires authentication)
router.post('/:id/reviews', authenticateToken, addReview);
router.get('/:id/reviews', getProductReviews); 
// Admin routes (creating, updating, deleting products - would require admin check middleware)
router.post('/', authenticateToken, createProduct);
router.put('/:id', authenticateToken, updateProduct);
router.delete('/:id', authenticateToken, deleteProduct);

module.exports = router;

router.get('/', getAllProducts);
router.get('/featured', getFeaturedProducts);
router.get('/categories', getCategories);
router.get('/:id', getProductById);
router.get('/:id/reviews', getProductReviews);

// Auth required
router.post('/:id/reviews', authenticateToken, addReview);
router.get('/:id/reviews/my', authenticateToken, getMyReview);
router.put('/:id/reviews/:reviewId', authenticateToken, updateReview);
router.delete('/:id/reviews/:reviewId', authenticateToken, deleteReview);

// Admin
router.post('/', authenticateToken, createProduct);
router.put('/:id', authenticateToken, updateProduct);
router.delete('/:id', authenticateToken, deleteProduct);