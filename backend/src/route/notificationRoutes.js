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