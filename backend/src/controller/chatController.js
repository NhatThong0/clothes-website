const Conversation = require('../model/ChatConversation');

// ── io singleton ──────────────────────────────────────────────────────────────
let _io = null;
exports.setIo = (io) => { _io = io; };

// ── Helper emit ───────────────────────────────────────────────────────────────
function emitNewMessage(conv, savedMsg) {
    if (!_io) return;
    const payload = { convId: conv._id, message: savedMsg };

    if (savedMsg.senderRole === 'admin') {
        // Admin gửi → user nhận
        _io.to(`user:${conv.userId}`).emit('chat:message', payload);
    } else {
        // User/customer gửi → admin nhận
        _io.to('admins').emit('chat:message', payload);
        _io.to('admins').emit('chat:unread_update', {
            convId:        conv._id,
            userId:        conv.userId,
            unreadByAdmin: conv.unreadByAdmin,
            lastMessage:   conv.lastMessage,
            lastMessageAt: conv.lastMessageAt,
        });
    }
}

// ── User: lấy / tạo conversation ─────────────────────────────────────────────
exports.getMyConversation = async (req, res) => {
    try {
        const userId = req.userId;
        let conv = await Conversation.findOne({ userId })
            .populate('userId', 'name email avatar');
        if (!conv) {
            conv = await Conversation.create({ userId, messages: [] });
            conv = await Conversation.findById(conv._id).populate('userId', 'name email avatar');
        }
        res.json({ status: 'success', data: conv });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

// ── User: gửi tin nhắn (REST) ─────────────────────────────────────────────────
exports.userSendMessage = async (req, res) => {
    try {
        const userId      = req.userId;
        const { content } = req.body;
        if (!content?.trim())
            return res.status(400).json({ status: 'error', message: 'Nội dung không được trống' });

        let conv = await Conversation.findOne({ userId });
        if (!conv) conv = await Conversation.create({ userId, messages: [] });

        conv.messages.push({ senderId: userId, senderRole: 'customer', content: content.trim(), readAt: null });
        conv.lastMessage   = content.trim().slice(0, 80);
        conv.lastMessageAt = new Date();
        conv.unreadByAdmin += 1;
        await conv.save();

        const saved = conv.messages[conv.messages.length - 1];
        emitNewMessage(conv, saved); // ← emit ngay sau save
        res.json({ status: 'success', data: saved });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

// ── User: đánh dấu đã đọc ────────────────────────────────────────────────────
exports.userMarkRead = async (req, res) => {
    try {
        const conv = await Conversation.findOne({ userId: req.userId });
        if (!conv) return res.status(404).json({ status: 'error', message: 'Not found' });
        conv.messages.forEach(m => { if (m.senderRole === 'admin' && !m.readAt) m.readAt = new Date(); });
        conv.unreadByUser = 0;
        await conv.save();
        res.json({ status: 'success' });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

// ── Admin: danh sách conversations ───────────────────────────────────────────
exports.adminGetConversations = async (req, res) => {
    try {
        const { page = 1, limit = 30 } = req.query;
        const [conversations, total] = await Promise.all([
            Conversation.find()
                .populate('userId', 'name email avatar')
                .sort({ lastMessageAt: -1 })
                .skip((page - 1) * limit)
                .limit(Number(limit))
                .select('-messages'),
            Conversation.countDocuments(),
        ]);
        res.json({ status: 'success', data: { conversations, total } });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

// ── Admin: chi tiết 1 conversation ───────────────────────────────────────────
exports.adminGetConversation = async (req, res) => {
    try {
        const conv = await Conversation.findById(req.params.id)
            .populate('userId', 'name email avatar');
        if (!conv) return res.status(404).json({ status: 'error', message: 'Not found' });
        res.json({ status: 'success', data: conv });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

// ── Admin: gửi tin nhắn (REST) ────────────────────────────────────────────────
exports.adminSendMessage = async (req, res) => {
    try {
        const adminId     = req.userId;
        const { content } = req.body;
        if (!content?.trim())
            return res.status(400).json({ status: 'error', message: 'Nội dung không được trống' });

        const conv = await Conversation.findById(req.params.id);
        if (!conv) return res.status(404).json({ status: 'error', message: 'Không tìm thấy' });

        conv.messages.push({ senderId: adminId, senderRole: 'admin', content: content.trim(), readAt: null });
        conv.lastMessage   = content.trim().slice(0, 80);
        conv.lastMessageAt = new Date();
        conv.unreadByUser += 1;
        await conv.save();

        const saved = conv.messages[conv.messages.length - 1];
        emitNewMessage(conv, saved); // ← emit ngay sau save
        res.json({ status: 'success', data: saved });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

// ── Admin: đánh dấu đã đọc ───────────────────────────────────────────────────
exports.adminMarkRead = async (req, res) => {
    try {
        const conv = await Conversation.findById(req.params.id);
        if (!conv) return res.status(404).json({ status: 'error', message: 'Not found' });
        conv.messages.forEach(m => { if (m.senderRole !== 'admin' && !m.readAt) m.readAt = new Date(); });
        conv.unreadByAdmin = 0;
        await conv.save();
        res.json({ status: 'success' });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

// ── Admin: tổng unread ────────────────────────────────────────────────────────
exports.adminUnreadCount = async (req, res) => {
    try {
        const result = await Conversation.aggregate([
            { $group: { _id: null, total: { $sum: '$unreadByAdmin' } } }
        ]);
        res.json({ status: 'success', data: { count: result[0]?.total || 0 } });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

// ── Admin: toggle open/closed ─────────────────────────────────────────────────
exports.adminToggleStatus = async (req, res) => {
    try {
        const conv = await Conversation.findById(req.params.id);
        if (!conv) return res.status(404).json({ status: 'error', message: 'Not found' });
        conv.isOpen = !conv.isOpen;
        await conv.save();
        res.json({ status: 'success', data: { isOpen: conv.isOpen } });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

// ── Socket: chỉ xử lý typing + read ─────────────────────────────────────────
exports.registerChatHandlers = (io, socket) => {
    const { userId, role } = socket.data;
    const isUser  = role === 'user' || role === 'customer';
    const isAdmin = role === 'admin';

    if (isUser)  socket.join(`user:${userId}`);
    if (isAdmin) socket.join('admins');

    // console.log(`[Socket] connected userId=${userId} role=${role}`);

    // typing — không lưu DB, chỉ relay qua socket
    socket.on('chat:typing', ({ convId, isTyping }) => {
        if (isUser) {
            io.to('admins').emit('chat:typing', { convId, userId, isTyping });
        } else {
            Conversation.findById(convId).then(conv => {
                if (conv) io.to(`user:${conv.userId}`).emit('chat:typing', { convId, isTyping });
            }).catch(() => {});
        }
    });

    // read ack
    socket.on('chat:read', async ({ convId }) => {
        try {
            const conv = await Conversation.findById(convId);
            if (!conv) return;
            if (isAdmin) {
                conv.messages.forEach(m => { if (m.senderRole !== 'admin' && !m.readAt) m.readAt = new Date(); });
                conv.unreadByAdmin = 0;
            } else {
                conv.messages.forEach(m => { if (m.senderRole === 'admin' && !m.readAt) m.readAt = new Date(); });
                conv.unreadByUser = 0;
            }
            await conv.save();
            io.to(`user:${conv.userId}`).emit('chat:read_ack', { convId });
            io.to('admins').emit('chat:read_ack', { convId });
        } catch { /* silent */ }
    });

    socket.on('disconnect', () => {
        // console.log(`[Socket] disconnected userId=${userId} role=${role}`);
    });
};