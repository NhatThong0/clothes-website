const express = require('express');

const router = express.Router();
const auth = require('../../middleware/authenticateToken');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getAdminNotifications,
  getAdminUnreadCount,
  markAdminAsRead,
  markAllAdminAsRead,
  deleteAdminNotification,
  deleteAllAdminNotifications,
} = require('./notification.controller');

router.use(auth);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.delete('/', deleteAllNotifications);
router.delete('/:id', deleteNotification);

const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin' && req.role !== 'admin') {
    return res.status(403).json({ status: 'error', message: 'Access denied. Admin only.' });
  }
  next();
};

router.get('/admin', isAdmin, getAdminNotifications);
router.get('/admin/unread-count', isAdmin, getAdminUnreadCount);
router.put('/admin/read-all', isAdmin, markAllAdminAsRead);
router.put('/admin/:id/read', isAdmin, markAdminAsRead);
router.delete('/admin', isAdmin, deleteAllAdminNotifications);
router.delete('/admin/:id', isAdmin, deleteAdminNotification);

module.exports = router;
