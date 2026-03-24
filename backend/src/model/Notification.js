// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Loại thông báo
    type: {
      type: String,
      enum: ['order', 'voucher', 'return', 'system'],
      required: true,
    },

    // Tiêu đề & nội dung
    title:   { type: String, required: true },
    message: { type: String, required: true },

    // Icon emoji hiển thị (frontend dùng)
    icon: { type: String, default: '🔔' },

    // Màu accent: blue | green | orange | red | purple | slate
    color: { type: String, default: 'blue' },

    // Link điều hướng khi click (VD: /orders/abc123)
    link: { type: String, default: null },

    // Đã đọc chưa
    isRead: { type: Boolean, default: false, index: true },

    // Metadata tuỳ loại (orderId, voucherId, ...)
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Index tổng hợp để query nhanh
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);