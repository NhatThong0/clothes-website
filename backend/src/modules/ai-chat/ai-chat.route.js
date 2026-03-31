const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/authenticateToken');
const authorizeAdmin = require('../../middleware/authorizeAdmin');

const aiChatCtrl = require('./ai-chat.controller');

router.get('/my', authenticateToken, aiChatCtrl.getMyAiConversation);
router.post('/my/send', authenticateToken, aiChatCtrl.aiSendMessage);

// ── Admin routes ─────────────────────────────────────────────────────────────
router.get('/admin/conversations', authenticateToken, authorizeAdmin, aiChatCtrl.adminGetAiConversations);
router.get('/admin/conversations/:id', authenticateToken, authorizeAdmin, aiChatCtrl.adminGetAiConversation);

module.exports = router;

