// controllers/notificationController.js
const Notification      = require('../model/Notification');
const AdminNotification = require('../model/AdminNotification');
const { pool } = require('../db/mysql');

// ── Helper: emit real-time đến user ──────────────────────────────────────────
// controllers/notificationController.js
const emitToUser = (req, userId, notification) => {
    try {
        const io = req?.app?.get('io');
        if (!io) {
            console.error('[🚨] KHÔNG LẤY ĐƯỢC IO TỪ REQ.APP');
            return;
        }
        console.log(`[🚀] Đang bắn thông báo tới: user:${userId}`);
        io.to(`user:${userId}`).emit('notification', notification);
    } catch (err) {
        console.error('[Socket] emit error:', err.message);
    }
};

const createNotification = async (data, req = null) => {
    const { userId, type, title, message, icon, color, link, meta } = data;
    try {
        // 1. CHUẨN HÓA ID
        const targetUserId = String(userId._id || userId);

        // 2. LƯU DATABASE
        const notif = await Notification.create({
            userId: targetUserId,
            type, title, message,
            icon: icon || '🔔',
            color: color || 'blue',
            link: link || null,
            meta: meta || {},
        });
        
        // ── LƯU SANG MYSQL ───────────────────────────────────────────────────────
        try {
            await pool.query(
                `INSERT INTO notifications (id, userId, type, title, message, icon, color, link, meta, createdAt) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [notif._id.toString(), targetUserId, type, title, message, icon || '🔔', color || 'blue', link || null, JSON.stringify(meta || {})]
            );
        } catch (mysqlErr) {
            console.error("❌ MySQL Save Error (Notification):", mysqlErr.message);
        }

        // 3. EMIT REAL-TIME
        const io = req?.app?.get('io');
        if (io) {
            const roomName = `user:${targetUserId}`;
            const clients = io.sockets.adapter.rooms.get(roomName);
            console.log(`[🚀] Kiểm tra Room [${roomName}]:`, clients ? `Đang có ${clients.size} thiết bị kết nối` : 'TRỐNG (Không có ai trong phòng)');
            io.to(roomName).emit('notification', notif.toObject());
        }

        return notif;
    } catch (err) {
        console.error('[Notification Error]:', err.message);
    }
};

// ── Preset: thông báo theo trạng thái đơn hàng ───────────────────────────────
const notifyOrderStatus = async (order, status, req = null) => {
    const id = String(order._id).slice(-8).toUpperCase();
    const MAP = {
        confirmed: { icon: '✅', color: 'blue', title: 'Đơn hàng đã xác nhận', msg: `Đơn #${id} đã được xác nhận và đang chuẩn bị.` },
        shipped: { icon: '🚚', color: 'sky', title: 'Đơn hàng đang giao', msg: `Đơn #${id} đang trên đường giao đến bạn.` },
        delivered: { icon: '📦', color: 'green', title: 'Đơn hàng đã giao thành công', msg: `Đơn #${id} đã được giao. Xác nhận để đánh giá nhé!` },
        cancelled: { icon: '❌', color: 'red', title: 'Đơn hàng đã bị hủy', msg: `Đơn #${id} đã bị hủy.` },
        return_approved: { icon: '✔️', color: 'purple', title: 'Hoàn trả được duyệt', msg: `Yêu cầu hoàn trả đơn #${id} đã được chấp nhận.` },
        return_rejected: { icon: '🚫', color: 'red', title: 'Hoàn trả bị từ chối', msg: `Yêu cầu hoàn trả đơn #${id} đã bị từ chối.` },
        returned: { icon: '💰', color: 'green', title: 'Hoàn trả hoàn tất', msg: `Đơn #${id} hoàn trả xong. Hoàn tiền đang được xử lý.` },
    };
    const cfg = MAP[status];
    if (!cfg) return;
    await createNotification({
        userId: order.userId,
        type: ['return_approved', 'return_rejected', 'returned'].includes(status) ? 'return' : 'order',
        title: cfg.title,
        message: cfg.msg,
        icon: cfg.icon,
        color: cfg.color,
        link: `/orders/${order._id}`,
        meta: { orderId: order._id, status },
    }, req);
};

// ── Preset: voucher mới ───────────────────────────────────────────────────────
const notifyNewVoucher = async (userIds, voucher, req = null) => {
    const notifications = userIds.map(uid => ({
        userId: uid,
        type: 'voucher',
        title: '🎁 Voucher mới dành cho bạn!',
        message: `Mã "${voucher.code}" — giảm ${voucher.discountType === 'percentage' ? voucher.discountValue + '%' : voucher.discountValue.toLocaleString('vi-VN') + '₫'}. HSD: ${new Date(voucher.endDate).toLocaleDateString('vi-VN')}.`,
        icon: '🎁',
        color: 'orange',
        link: '/products',
        meta: { voucherId: voucher._id, code: voucher.code },
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    }));
    if (notifications.length > 0) {
        await Notification.insertMany(notifications);
        
        // ── LƯU SANG MYSQL ───────────────────────────────────────────────────────
        try {
            for (const n of notifications) {
                await pool.query(
                    `INSERT INTO notifications (id, userId, type, title, message, icon, color, link, meta, createdAt) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [/* MongoDB doesn't give _id before insertMany unless we specify */ null, n.userId, n.type, n.title, n.message, n.icon, n.color, n.link, JSON.stringify(n.meta), n.createdAt]
                );
            }
        } catch (mysqlErr) {
            console.error("❌ MySQL Save Error (Bulk Notification):", mysqlErr.message);
        }
        // Emit real-time cho từng user
        if (req) {
            const io = req.app?.get('io');
            if (io) {
                notifications.forEach((n, i) => {
                    io.to(`user:${String(userIds[i])}`).emit('notification', n);
                });
            }
        }
    }
};

// ── Preset: thông báo hệ thống ────────────────────────────────────────────────
const notifySystem = async (userIds, { title, message, icon, link }, req = null) => {
    const notifications = userIds.map(uid => ({
        userId: uid, type: 'system', title, message,
        icon: icon || '📢', color: 'slate', link: link || null,
        meta: {}, isRead: false, createdAt: new Date(), updatedAt: new Date(),
    }));
    if (notifications.length > 0) {
        await Notification.insertMany(notifications);
        if (req) {
            const io = req.app?.get('io');
            if (io) notifications.forEach((n, i) => io.to(`user:${String(userIds[i])}`).emit('notification', n));
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// API CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/notifications
const getNotifications = async (req, res) => {
    try {
        const userId = req.user.userId || req.userId;
        const limit = Math.min(Number(req.query.limit) || 30, 50);
        const [notifications, unreadCount] = await Promise.all([
            Notification.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean(),
            Notification.countDocuments({ userId, isRead: false }),
        ]);
        res.json({ status: 'success', data: { notifications, unreadCount } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// GET /api/notifications/unread-count
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.userId || req.userId;
        const unreadCount = await Notification.countDocuments({ userId, isRead: false });
        res.json({ status: 'success', data: { unreadCount } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PUT /api/notifications/:id/read
const markAsRead = async (req, res) => {
    try {
        const userId = req.user.userId || req.userId;
        await Notification.findOneAndUpdate({ _id: req.params.id, userId }, { isRead: true });
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PUT /api/notifications/read-all
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.userId || req.userId;
        await Notification.updateMany({ userId, isRead: false }, { isRead: true });
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
    try {
        const userId = req.user.userId || req.userId;
        await Notification.findOneAndDelete({ _id: req.params.id, userId });
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// DELETE /api/notifications
const deleteAllNotifications = async (req, res) => {
    try {
        const userId = req.user.userId || req.userId;
        await Notification.deleteMany({ userId });
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN NOTIFICATION HELPERS & API
// ═══════════════════════════════════════════════════════════════════════════

// Helper: emit real-time đến room admin:global
const notifyAdmin = async (data, req = null) => {
    const { type, title, message, icon, color, link, meta } = data;
    try {
        const notif = await AdminNotification.create({
            type, title, message,
            icon:  icon  || '🔔',
            color: color || 'blue',
            link:  link  || null,
            meta:  meta  || {},
        });

        // ── LƯU SANG MYSQL ───────────────────────────────────────────────────────
        try {
            await pool.query(
                `INSERT INTO admin_notifications (id, type, title, message, icon, color, link, meta, createdAt) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [notif._id.toString(), type, title, message, icon || '🔔', color || 'blue', link || null, JSON.stringify(meta || {})]
            );
        } catch (mysqlErr) {
            console.error("❌ MySQL Save Error (AdminNotification):", mysqlErr.message);
        }

        const io = req?.app?.get('io');
        if (io) {
            const room    = 'admin:global';
            const clients = io.sockets.adapter.rooms.get(room);
            const count   = clients ? clients.size : 0;
            console.log(`[🚀 Admin Notification] Sending to room [${room}]. Clients online: ${count}`);
            io.to(room).emit('admin:notification', notif.toObject());
        } else {
            console.error('[🚨] io instance NOT found in req.app during notifyAdmin');
        }
        return notif;
    } catch (err) {
        console.error('[AdminNotification Error]:', err.message);
    }
};

// Preset: đơn hàng mới từ user
const notifyAdminNewOrder = async (order, req = null) => {
    const id   = String(order._id).slice(-8).toUpperCase();
    const name = order.shippingAddress?.fullName || 'Khách hàng';
    await notifyAdmin({
        type:    'order',
        title:   '🛒 Đơn hàng mới',
        message: `${name} vừa đặt đơn #${id} — ${order.total?.toLocaleString('vi-VN')}₫`,
        icon:    '🛒', color: 'blue',
        link:    `/admin/orders/${order._id}`,
        meta:    { orderId: order._id },
    }, req);
};

// Preset: user xác nhận đã nhận hàng
const notifyAdminDeliveryConfirmed = async (order, req = null) => {
    const id = String(order._id).slice(-8).toUpperCase();
    await notifyAdmin({
        type:    'order',
        title:   '✅ Xác nhận giao hàng',
        message: `Khách hàng đã xác nhận nhận đơn #${id}.`,
        icon:    '✅', color: 'green',
        link:    `/admin/orders/${order._id}`,
        meta:    { orderId: order._id },
    }, req);
};

// Preset: user gửi yêu cầu hoàn trả
const notifyAdminReturnRequest = async (order, req = null) => {
    const id = String(order._id).slice(-8).toUpperCase();
    await notifyAdmin({
        type:    'return',
        title:   '↩️ Yêu cầu hoàn trả',
        message: `Đơn #${id} có yêu cầu hoàn trả. Lý do: ${order.returnReason || 'Không rõ'}`,
        icon:    '↩️', color: 'orange',
        link:    `/admin/orders/${order._id}`,
        meta:    { orderId: order._id },
    }, req);
};

// Preset: user mới đăng ký
const notifyAdminNewUser = async (user, req = null) => {
    await notifyAdmin({
        type:    'user',
        title:   '👤 Người dùng mới',
        message: `${user.name || user.email} vừa đăng ký tài khoản.`,
        icon:    '👤', color: 'purple',
        link:    `/admin/users`,
        meta:    { userId: user._id },
    }, req);
};

// ── Admin Notification API controllers ────────────────────────────────────────
const getAdminNotifications = async (req, res) => {
    try {
        const limit  = Math.min(Number(req.query.limit) || 30, 50);
        const [notifications, unreadCount] = await Promise.all([
            AdminNotification.find().sort({ createdAt: -1 }).limit(limit).lean(),
            AdminNotification.countDocuments({ isRead: false }),
        ]);
        res.json({ status: 'success', data: { notifications, unreadCount } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

const getAdminUnreadCount = async (req, res) => {
    try {
        const unreadCount = await AdminNotification.countDocuments({ isRead: false });
        res.json({ status: 'success', data: { unreadCount } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

const markAdminAsRead = async (req, res) => {
    try {
        await AdminNotification.findByIdAndUpdate(req.params.id, { isRead: true });
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

const markAllAdminAsRead = async (req, res) => {
    try {
        await AdminNotification.updateMany({ isRead: false }, { isRead: true });
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

const deleteAdminNotification = async (req, res) => {
    try {
        await AdminNotification.findByIdAndDelete(req.params.id);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

const deleteAllAdminNotifications = async (req, res) => {
    try {
        await AdminNotification.deleteMany({});
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

module.exports = {
    getNotifications, getUnreadCount,
    markAsRead, markAllAsRead,
    deleteNotification, deleteAllNotifications,
    // User helpers
    createNotification, notifyOrderStatus, notifyNewVoucher, notifySystem,
    // Admin helpers
    notifyAdmin, notifyAdminNewOrder, notifyAdminDeliveryConfirmed,
    notifyAdminReturnRequest, notifyAdminNewUser,
    // Admin API controllers
    getAdminNotifications, getAdminUnreadCount,
    markAdminAsRead, markAllAdminAsRead,
    deleteAdminNotification, deleteAllAdminNotifications,
};