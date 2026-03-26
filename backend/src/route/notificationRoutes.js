// routes/notificationRoutes.js
const express = require('express');
const router  = express.Router();
const auth       = require('../middleWare/authenticateToken'); // middleware xác thực của bạn

const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} = require('../controller/notificationController');

// Tất cả routes đều cần đăng nhập
router.use(auth);

router.get('/',                    getNotifications);       // GET  /api/notifications
router.get('/unread-count',        getUnreadCount);         // GET  /api/notifications/unread-count
router.put('/read-all',            markAllAsRead);          // PUT  /api/notifications/read-all
router.put('/:id/read',            markAsRead);             // PUT  /api/notifications/:id/read
router.delete('/',                 deleteAllNotifications); // DELETE /api/notifications
router.delete('/:id',              deleteNotification);     // DELETE /api/notifications/:id

// ── ADMIN ROUTES ─────────────────────────────────────────────────────────────
const {
  getAdminNotifications, getAdminUnreadCount,
  markAdminAsRead, markAllAdminAsRead,
  deleteAdminNotification, deleteAllAdminNotifications,
} = require('../controller/notificationController');

// Helper: check admin
const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin' && req.role !== 'admin') {
    return res.status(403).json({ status: 'error', message: 'Access denied. Admin only.' });
  }
  next();
};

router.get('/admin',               isAdmin, getAdminNotifications);
router.get('/admin/unread-count',  isAdmin, getAdminUnreadCount);
router.put('/admin/read-all',      isAdmin, markAllAdminAsRead);
router.put('/admin/:id/read',      isAdmin, markAdminAsRead);
router.delete('/admin',            isAdmin, deleteAllAdminNotifications);
router.delete('/admin/:id',        isAdmin, deleteAdminNotification);

module.exports = router;


// ─── Cách dùng trong app.js / server.js ───────────────────────────────────────
// const notificationRoutes = require('./routes/notificationRoutes');
// app.use('/api/notifications', notificationRoutes);

// ─── Cách tích hợp vào orderController.js ─────────────────────────────────────
// Thêm vào đầu file orderController.js:
//   const { notifyOrderStatus } = require('./notificationController');
//
// Trong updateOrderStatus, sau khi order.save(), thêm:
//   await notifyOrderStatus(order, status);
//
// Ví dụ cụ thể (đặt ngay sau `await order.save()`):
//
//   const updatedOrder = await Order.findById(order._id);
//   await notifyOrderStatus(updatedOrder, status);