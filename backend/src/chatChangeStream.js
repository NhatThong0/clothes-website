// ════════════════════════════════════════════════════════════════════════════
// chatChangeStream.js
// Theo dõi collection ChatConversation bằng MongoDB Change Streams.
// Khi có tin nhắn mới → tự động emit Socket.io đến đúng room.
// Không cần gọi io.emit() trong controller nữa.
//
// Yêu cầu: MongoDB phải chạy ở chế độ Replica Set (hoặc Atlas).
// Local dev: dùng `mongod --replSet rs0` hoặc Docker replica set.
// ════════════════════════════════════════════════════════════════════════════

const Conversation = require('./model/ChatConversation');

let changeStream = null;

/**
 * Khởi động Change Stream watcher.
 * Gọi một lần duy nhất sau khi Mongoose kết nối DB và io đã sẵn sàng.
 *
 * @param {import('socket.io').Server} io
 */
function startChatChangeStream(io) {
    // Chỉ watch thao tác update (tin nhắn mới được push vào messages[])
    const pipeline = [
        {
            $match: {
                operationType: { $in: ['update', 'replace'] },
            },
        },
    ];

    const options = {
        fullDocument: 'updateLookup', // trả về document đầy đủ sau khi update
    };

    try {
        changeStream = Conversation.watch(pipeline, options);
        
    } catch (err) {
        console.error('[ChangeStream] Failed to start:', err.message);
        
        return;
    }

    changeStream.on('change', (event) => {
        try {
            const conv = event.fullDocument;
            if (!conv || !conv.messages?.length) return;

            // Lấy tin nhắn mới nhất vừa được thêm vào
            const lastMsg = conv.messages[conv.messages.length - 1];

            // Chỉ xử lý update mới — tránh replay khi server restart
            // Dùng lastMessageAt của conv thay vì createdAt của message (đáng tin hơn)
            const age = Date.now() - new Date(conv.lastMessageAt).getTime();
            if (age > 8000) {
                console.log(`[ChangeStream] Skipped old event age=${age}ms`);
                return;
            }

            const payload = {
                convId:  conv._id,
                message: lastMsg,
            };

            // ── Emit đến đúng room ──────────────────────────────────────────
            if (lastMsg.senderRole === 'admin') {
                // Admin gửi → notify user
                io.to(`user:${conv.userId}`).emit('chat:message', payload);
                console.log(`[ChangeStream] → user:${conv.userId} (admin msg)`);
            } else {
                // User/customer gửi → notify admin
                io.to('admins').emit('chat:message', payload);
                io.to('admins').emit('chat:unread_update', {
                    convId:        conv._id,
                    userId:        conv.userId,
                    unreadByAdmin: conv.unreadByAdmin,
                    lastMessage:   conv.lastMessage,
                    lastMessageAt: conv.lastMessageAt,
                });
                console.log(`[ChangeStream] → admins (user msg)`);
            }
        } catch (err) {
            console.error('[ChangeStream] Error processing change event:', err);
        }
    });

    changeStream.on('error', (err) => {
        if (err.message.includes('replica set') || err.message.includes('replSet')) {

            return;
        }
        // Các lỗi khác → reconnect sau 5 giây
        setTimeout(() => {
            
            startChatChangeStream(io);
        }, 5000);
    });

    changeStream.on('close', () => {
        
    });
}

/**
 * Dừng Change Stream (dùng khi graceful shutdown).
 */
function stopChatChangeStream() {
    if (changeStream) {
        changeStream.close();
        changeStream = null;
        
    }
}

module.exports = { startChatChangeStream, stopChatChangeStream };