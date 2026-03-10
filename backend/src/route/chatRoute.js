const express  = require('express');
const router   = express.Router();
const chatCtrl = require('../controller/chatController');

// ✅ FIX: dùng require trực tiếp, KHÔNG destructure — khớp với cách adminRoute dùng
const authenticateToken = require('../middleWare/authenticateToken');
const authorizeAdmin    = require('../middleWare/authorizeAdmin');

// ── User routes ───────────────────────────────────────────────────────────────
router.get ('/my',       authenticateToken, chatCtrl.getMyConversation);
router.post('/my/send',  authenticateToken, chatCtrl.userSendMessage);   // ← REST fallback cho ChatWidget
router.post('/my/read',  authenticateToken, chatCtrl.userMarkRead);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get ('/admin/conversations',              authenticateToken, authorizeAdmin, chatCtrl.adminGetConversations);
router.get ('/admin/unread-count',               authenticateToken, authorizeAdmin, chatCtrl.adminUnreadCount);
router.get ('/admin/conversations/:id',          authenticateToken, authorizeAdmin, chatCtrl.adminGetConversation);
router.post('/admin/conversations/:id/send',     authenticateToken, authorizeAdmin, chatCtrl.adminSendMessage);
router.post('/admin/conversations/:id/read',     authenticateToken, authorizeAdmin, chatCtrl.adminMarkRead);
router.patch('/admin/conversations/:id/status',  authenticateToken, authorizeAdmin, chatCtrl.adminToggleStatus);

module.exports = router;