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

const SizeProfileSchema = new mongoose.Schema(
  {
    gender: { type: String, default: '' },
    fitPreference: { type: String, default: '' },
    heightCm: { type: Number, min: 0 },
    weightKg: { type: Number, min: 0 },
    chestCm: { type: Number, min: 0 },
    waistCm: { type: Number, min: 0 },
    hipCm: { type: Number, min: 0 },
    footLengthCm: { type: Number, min: 0 },
  },
  { _id: false }
);

const SizeRecommendationSchema = new mongoose.Schema(
  {
    active: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['idle', 'collecting_measurements', 'recommended'],
      default: 'idle',
    },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
    productName: { type: String, default: '' },
    categoryKey: { type: String, default: '' },
    sizeChartId: { type: mongoose.Schema.Types.ObjectId, ref: 'SizeChart', required: false },
    measurements: { type: SizeProfileSchema, default: () => ({}) },
    missingFields: { type: [String], default: [] },
    lastAskedFields: { type: [String], default: [] },
    recommendedSize: { type: String, default: '' },
    confidence: { type: Number, default: 0 },
    reasoning: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AiConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    messages: { type: [AiMessageSchema], default: [] },
    sizeRecommendation: { type: SizeRecommendationSchema, default: () => ({}) },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

AiConversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('AiConversation', AiConversationSchema);

