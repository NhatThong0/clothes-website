const mongoose = require('mongoose');

const SuggestedProductSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: false, default: 0 },
    discount: { type: Number, required: false, default: 0, min: 0, max: 100 },
    categoryName: { type: String, required: false, default: '' },
    image: { type: String, required: false, default: '' },
    stock: { type: Number, required: false, default: 0, min: 0 },
    rating: { type: Number, required: false, default: 0 },
  },
  { _id: false }
);

const AiMessageSchema = new mongoose.Schema(
  {
    senderRole: { type: String, enum: ['user', 'ai'], required: true },
    content: { type: String, required: true, trim: true, maxlength: 4000 },
    // Chỉ gắn khi senderRole='ai'
    suggestedProducts: { type: [SuggestedProductSchema], default: [] },
    readAt: { type: Date },
  },
  { timestamps: true }
);

const AiConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    messages: { type: [AiMessageSchema], default: [] },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

AiConversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('AiConversation', AiConversationSchema);

