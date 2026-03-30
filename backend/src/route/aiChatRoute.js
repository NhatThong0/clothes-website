const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleWare/authenticateToken');
const authorizeAdmin = require('../middleWare/authorizeAdmin');

const aiChatCtrl = require('../controller/aiChatController');

router.get('/my', authenticateToken, aiChatCtrl.getMyAiConversation);
router.post('/my/send', authenticateToken, aiChatCtrl.aiSendMessage);

// ── Admin routes ─────────────────────────────────────────────────────────────
router.get('/admin/conversations', authenticateToken, authorizeAdmin, aiChatCtrl.adminGetAiConversations);
router.get('/admin/conversations/:id', authenticateToken, authorizeAdmin, aiChatCtrl.adminGetAiConversation);

module.exports = router;

