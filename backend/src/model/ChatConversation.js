const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    senderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['customer', 'admin'], required: true },
    content:    { type: String, required: true, trim: true, maxlength: 2000 },
    type:       { type: String, enum: ['text', 'image'], default: 'text' },
    isRead:     { type: Boolean, default: false },
    readAt:     { type: Date },
}, { timestamps: true });

const ChatConversationSchema = new mongoose.Schema({
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    messages:      [MessageSchema],
    status:        { type: String, enum: ['open', 'closed'], default: 'open' },
    lastMessage:   { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    unreadByAdmin: { type: Number, default: 0 },
    unreadByUser:  { type: Number, default: 0 },
}, { timestamps: true });

// userId đã có unique:true trong field definition → không cần khai báo lại
ChatConversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('ChatConversation', ChatConversationSchema);