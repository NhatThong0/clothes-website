// models/AdminNotification.js
const mongoose = require('mongoose');

const adminNotificationSchema = new mongoose.Schema(
  {
    type:    { type: String, enum: ['order', 'return', 'user', 'system'], required: true },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    icon:    { type: String, default: '🔔' },
    color:   { type: String, default: 'blue' },
    link:    { type: String, default: null }, // Link to admin page: e.g., /admin/orders/:id
    isRead:  { type: Boolean, default: false, index: true },
    meta:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

adminNotificationSchema.index({ isRead: 1, createdAt: -1 });
adminNotificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminNotification', adminNotificationSchema);
