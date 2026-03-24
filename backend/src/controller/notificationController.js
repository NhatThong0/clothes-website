// controllers/notificationController.js
const Notification = require('../model/Notification');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — tạo thông báo từ bất kỳ nơi nào trong backend
// Dùng: await createNotification({ userId, type, title, message, icon, color, link, meta })
// ─────────────────────────────────────────────────────────────────────────────
const createNotification = async ({ userId, type, title, message, icon, color, link, meta }) => {
  try {
    await Notification.create({ userId, type, title, message, icon: icon || '🔔', color: color || 'blue', link: link || null, meta: meta || {} });
  } catch (err) {
    console.error('[Notification] create error:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PRESET HELPERS — gọi từ orderController, voucherController, ...
// ─────────────────────────────────────────────────────────────────────────────

// Đơn hàng
const notifyOrderStatus = async (order, status) => {
  const MAP = {
    confirmed:        { icon: '✅', color: 'blue',   title: 'Đơn hàng đã xác nhận',      msg: `Đơn #${String(order._id).slice(-8).toUpperCase()} đã được xác nhận và đang chuẩn bị.` },
    shipped:          { icon: '🚚', color: 'sky',    title: 'Đơn hàng đang giao',         msg: `Đơn #${String(order._id).slice(-8).toUpperCase()} đang trên đường giao đến bạn.` },
    delivered:        { icon: '📦', color: 'green',  title: 'Đơn hàng đã giao thành công',msg: `Đơn #${String(order._id).slice(-8).toUpperCase()} đã được giao. Xác nhận để đánh giá sản phẩm nhé!` },
    cancelled:        { icon: '❌', color: 'red',    title: 'Đơn hàng đã bị hủy',         msg: `Đơn #${String(order._id).slice(-8).toUpperCase()} đã bị hủy.` },
    return_approved:  { icon: '✔️', color: 'purple', title: 'Hoàn trả được duyệt',        msg: `Yêu cầu hoàn trả đơn #${String(order._id).slice(-8).toUpperCase()} đã được chấp nhận.` },
    return_rejected:  { icon: '🚫', color: 'red',    title: 'Hoàn trả bị từ chối',        msg: `Yêu cầu hoàn trả đơn #${String(order._id).slice(-8).toUpperCase()} đã bị từ chối.` },
    returned:         { icon: '💰', color: 'green',  title: 'Hoàn trả hoàn tất',          msg: `Đơn #${String(order._id).slice(-8).toUpperCase()} hoàn trả xong. Hoàn tiền đang được xử lý.` },
  };
  const cfg = MAP[status];
  if (!cfg) return;
  await createNotification({
    userId:  order.userId,
    type:    ['return_approved','return_rejected','returned'].includes(status) ? 'return' : 'order',
    title:   cfg.title,
    message: cfg.msg,
    icon:    cfg.icon,
    color:   cfg.color,
    link:    `/orders/${order._id}`,
    meta:    { orderId: order._id, status },
  });
};

// Voucher mới
const notifyNewVoucher = async (userIds, voucher) => {
  const notifications = userIds.map(uid => ({
    userId:    uid,
    type:      'voucher',
    title:     '🎁 Voucher mới dành cho bạn!',
    message:   `Mã "${voucher.code}" — giảm ${voucher.discountType === 'percentage' ? voucher.discountValue + '%' : voucher.discountValue.toLocaleString('vi-VN') + '₫'}. HSD: ${new Date(voucher.endDate).toLocaleDateString('vi-VN')}.`,
    icon:      '🎁',
    color:     'orange',
    link:      '/products',
    meta:      { voucherId: voucher._id, code: voucher.code },
    isRead:    false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  if (notifications.length > 0) await Notification.insertMany(notifications);
};

// Hệ thống (broadcast)
const notifySystem = async (userIds, { title, message, icon, link }) => {
  const notifications = userIds.map(uid => ({
    userId: uid, type: 'system',
    title, message, icon: icon || '📢', color: 'slate',
    link: link || null, meta: {}, isRead: false,
    createdAt: new Date(), updatedAt: new Date(),
  }));
  if (notifications.length > 0) await Notification.insertMany(notifications);
};

// ─────────────────────────────────────────────────────────────────────────────
// API CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/notifications — lấy danh sách (mới nhất 30 cái)
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId || req.userId;
    const limit  = Math.min(Number(req.query.limit) || 30, 50);

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    res.json({ status: 'success', data: { notifications, unreadCount } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /api/notifications/unread-count — chỉ lấy số chưa đọc (polling nhẹ)
const getUnreadCount = async (req, res) => {
  try {
    const userId     = req.user.userId || req.userId;
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    res.json({ status: 'success', data: { unreadCount } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// PUT /api/notifications/:id/read — đánh dấu 1 cái đã đọc
const markAsRead = async (req, res) => {
  try {
    const userId = req.user.userId || req.userId;
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId },
      { isRead: true }
    );
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// PUT /api/notifications/read-all — đánh dấu tất cả đã đọc
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId || req.userId;
    await Notification.updateMany({ userId, isRead: false }, { isRead: true });
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// DELETE /api/notifications/:id — xóa 1 thông báo
const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.userId || req.userId;
    await Notification.findOneAndDelete({ _id: req.params.id, userId });
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// DELETE /api/notifications — xóa tất cả
const deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user.userId || req.userId;
    await Notification.deleteMany({ userId });
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

module.exports = {
  // API controllers
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  // Helpers để gọi từ các controller khác
  createNotification,
  notifyOrderStatus,
  notifyNewVoucher,
  notifySystem,
};