const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleWare/authenticateToken');
const authorizeAdmin    = require('../middleWare/authorizeAdmin');
const adminController   = require('../controller/adminController');

router.use(authenticateToken, authorizeAdmin);

// ============= DASHBOARD =============
router.get('/dashboard/stats',        adminController.getDashboardStats);
router.get('/dashboard/revenue',      adminController.getDashboardRevenue);       // ✅ thêm
router.get('/dashboard/categories',   adminController.getDashboardCategories);    // ✅ thêm
router.get('/dashboard/top-products', adminController.getDashboardTopProducts);   // ✅ thêm

// ============= PRODUCT MANAGEMENT =============
router.get   ('/products',                adminController.adminGetAllProducts);
router.post  ('/products',                adminController.createProduct);
router.put   ('/products/:id',            adminController.updateProduct);
router.put   ('/products/:id/toggle-status', adminController.toggleProductStatus);
router.delete('/products/:id',            adminController.deleteProduct);

// ============= CATEGORY MANAGEMENT =============
router.get   ('/categories',      adminController.adminGetAllCategories);
router.post  ('/categories',      adminController.createCategory);
router.put   ('/categories/:id',  adminController.updateCategory);
router.delete('/categories/:id',  adminController.deleteCategory);

// ============= ORDER MANAGEMENT =============
router.get('/orders',             adminController.adminGetAllOrders);
router.get('/orders/:id',         adminController.getOrderDetails);
router.put('/orders/:id/status',  adminController.updateOrderStatus);

// ============= USER MANAGEMENT =============
router.get   ('/users',                         adminController.adminGetAllUsers);
router.post  ('/users',                         adminController.adminCreateUser);
router.put   ('/users/:userId/role',            adminController.updateUserRole);
router.put   ('/users/:userId',                 adminController.adminUpdateUser);
router.put   ('/users/:userId/toggle-status',   adminController.adminToggleUserStatus);
router.delete('/users/:userId',                 adminController.adminDeleteUser);
router.get   ('/users/:userId/orders',          adminController.getUserOrderHistory);

// ============= REVIEW MANAGEMENT =============
router.get   ('/reviews',                              adminController.adminGetAllReviews);
router.delete('/reviews/:productId/:reviewId',         adminController.deleteReview);
router.put   ('/reviews/:productId/:reviewId/toggle',  adminController.toggleReviewVisibility);

// ============= VOUCHER MANAGEMENT =============
router.get   ('/vouchers',            adminController.adminGetAllVouchers);
router.post  ('/vouchers',            adminController.createVoucher);
router.put   ('/vouchers/:voucherId', adminController.updateVoucher);
router.delete('/vouchers/:voucherId', adminController.deleteVoucher);

module.exports = router;