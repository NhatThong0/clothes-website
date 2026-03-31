const Conversation = require('../../model/ChatConversation');

// ── io singleton ──────────────────────────────────────────────────────────────
let _io = null;
exports.setIo = (io) => { _io = io; };

// ── Helper emit ───────────────────────────────────────────────────────────────
function emitNewMessage(conv, savedMsg, req = null) {
    const io = req?.app?.get('io') || _io;
    if (!io) {
        console.error('[🚨 Chat] Cannot emit message: io instance NOT found');
        return;
    }

    const payload = { convId: conv._id, message: savedMsg };
    const targetUserId = String(conv.userId);

    const room = `user:${targetUserId}`;

    if (savedMsg.senderRole === 'admin') {
        const clients = io.sockets.adapter.rooms.get(room);
        console.log(`[🚀 Chat] Server -> User [${targetUserId}]. Room: ${room}, Clients: ${clients ? clients.size : 0}`);
        io.to(room).emit('chat:message', payload);
    } else if (savedMsg.senderRole === 'customer') {
        console.log(`[🚀 Chat] Server -> Admins. Room: admins`);
        io.to('admins').emit('chat:message', payload);
        // Để phía user cập nhật activeConv (tránh mất message optimistic khi bot trả lời)
        io.to(room).emit('chat:message', payload);
        io.to('admins').emit('chat:unread_update', {
            convId:        conv._id,
            userId:        targetUserId,
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
        // Tách kênh chatbot AI khỏi kênh chat với admin:
        // không trả về message có senderRole='ai' ở endpoint này.
        conv.messages = (conv.messages || []).filter(m => m.senderRole !== 'ai');
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
        emitNewMessage(conv, saved, req);
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
        conv.messages = (conv.messages || []).filter(m => m.senderRole !== 'ai');
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
        emitNewMessage(conv, saved, req);
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
        conv.messages.forEach(m => { if (m.senderRole === 'customer' && !m.readAt) m.readAt = new Date(); });
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
        conv.status = conv.status === 'open' ? 'closed' : 'open';
        await conv.save();
        res.json({ status: 'success', data: { status: conv.status } });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
};

// ── Socket: xử lý Typing + Read + Join ──────────────────────────────────────
exports.registerChatHandlers = (io, socket) => {
    const userId = String(socket.data.userId);
    const role   = socket.data.role;

    const isUser  = role === 'user' || role === 'customer';
    const isAdmin = role === 'admin';

    if (isUser) {
        socket.join(`user:${userId}`);
        console.log(`[Socket Chat] Customer ${userId} joined room: user:${userId}`);
    }
    if (isAdmin) {
        socket.join('admins');
        console.log(`[Socket Chat] Admin ${userId} joined room: admins`);
    }

    // typing 
    socket.on('chat:typing', ({ convId, isTyping }) => {
        if (isUser) {
            io.to('admins').emit('chat:typing', { convId, userId, isTyping });
        } else {
            Conversation.findById(convId).then(conv => {
                if (conv) {
                    const room = `user:${conv.userId}`;
                    io.to(room).emit('chat:typing', { convId, isTyping });
                }
            }).catch(() => {});
        }
    });

    // Support legacy typing events from Admin page
    socket.on('typing_start', ({ conversationId }) => {
        if (isAdmin) {
            Conversation.findById(conversationId).then(conv => {
                if (conv) io.to(`user:${conv.userId}`).emit('chat:typing', { convId: conversationId, isTyping: true });
            });
        }
    });
    socket.on('typing_stop', ({ conversationId }) => {
        if (isAdmin) {
            Conversation.findById(conversationId).then(conv => {
                if (conv) io.to(`user:${conv.userId}`).emit('chat:typing', { convId: conversationId, isTyping: false });
            });
        }
    });

    // read ack
    socket.on('chat:read', async ({ convId }) => {
        try {
            const conv = await Conversation.findById(convId);
            if (!conv) return;
            const targetUserRoom = `user:${conv.userId}`;

            if (isAdmin) {
                conv.messages.forEach(m => { if (m.senderRole === 'customer' && !m.readAt) m.readAt = new Date(); });
                conv.unreadByAdmin = 0;
            } else {
                conv.messages.forEach(m => {
                    if (m.senderRole === 'admin' && !m.readAt) m.readAt = new Date();
                });
                conv.unreadByUser = 0;
            }
            await conv.save();
            io.to(targetUserRoom).emit('chat:read_ack', { convId });
            io.to('admins').emit('chat:read_ack', { convId });
        } catch { /* silent */ }
    });

    socket.on('disconnect', () => {
        // console.log(`[Socket] disconnected userId=${userId} role=${role}`);
    });
};
