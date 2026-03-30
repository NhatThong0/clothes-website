const AiConversation = require('../model/AiConversation');
const { getProductCandidates, generateAiReply } = require('../services/aiChatService');
const { validateObjectId } = require('../utils/validators');

function toSafeSuggestedProducts(products) {
  return (products || []).map(p => ({
    productId: p._id,
    name: p.name,
    price: p.price,
    discount: p.discount || 0,
    categoryName: p.category?.name || '',
    image: p.images?.[0] || '',
    stock: p.stock || 0,
    rating: p.rating || 0,
  }));
}

exports.getMyAiConversation = async (req, res) => {
  try {
    const userId = req.userId;
    let conv = await AiConversation.findOne({ userId }).populate('userId', 'name email avatar');
    if (!conv) {
      conv = await AiConversation.create({ userId, messages: [] });
      conv = await AiConversation.findById(conv._id).populate('userId', 'name email avatar');
    }
    res.json({ status: 'success', data: conv });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
};

exports.aiSendMessage = async (req, res) => {
  try {
    const userId = req.userId;
    const { content } = req.body;
    const text = String(content ?? '').trim();
    if (!text) return res.status(400).json({ status: 'error', message: 'Nội dung không được trống' });

    let conv = await AiConversation.findOne({ userId });
    if (!conv) conv = await AiConversation.create({ userId, messages: [] });

    conv.messages.push({ senderRole: 'user', content: text, readAt: null });
    conv.lastMessage = text.slice(0, 80);
    conv.lastMessageAt = new Date();
    await conv.save();
    const savedUserMsg = conv.messages[conv.messages.length - 1];

    // Lấy candidates và sinh reply
    const productCandidates = await getProductCandidates({ query: text, limit: 6 });
    const conversationMessages = conv.messages;
    const aiReply = await generateAiReply({
      conversationMessages,
      userMessage: text,
      productCandidates,
    });

    const aiMessage = {
      senderRole: 'ai',
      content: aiReply?.answer ? String(aiReply.answer).trim() : 'Mình chưa thể trả lời lúc này. Bạn có thể hỏi lại chi tiết hơn nhé!',
      suggestedProducts: toSafeSuggestedProducts(aiReply?.suggestedProducts),
      readAt: null,
    };

    // Bảo vệ giới hạn độ dài
    aiMessage.content = aiMessage.content.slice(0, 4000);

    conv.messages.push(aiMessage);
    conv.lastMessage = aiMessage.content.slice(0, 80);
    conv.lastMessageAt = new Date();
    await conv.save();

    const savedAiMsg = conv.messages[conv.messages.length - 1];
    res.json({ status: 'success', data: { user: savedUserMsg, ai: savedAiMsg } });
  } catch (e) {
    const status = e?.response?.status;
    const remoteMessage = e?.response?.data?.error?.message || e?.response?.data?.message;
    const message = remoteMessage || e?.message || 'Internal Server Error';
    console.error('[AI Chat] Error:', message);
    res.status(status && Number.isFinite(status) ? 502 : 500).json({
      status: 'error',
      message,
    });
  }
};

// ── Admin: list AI conversations ─────────────────────────────────────────────
exports.adminGetAiConversations = async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const [conversations, total] = await Promise.all([
      AiConversation.find()
        .populate('userId', 'name email avatar')
        .sort({ lastMessageAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .select('-messages'),
      AiConversation.countDocuments(),
    ]);
    res.json({ status: 'success', data: { conversations, total } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
};

// ── Admin: get 1 AI conversation ─────────────────────────────────────────────
exports.adminGetAiConversation = async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateObjectId(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid conversation ID' });
    }
    const conv = await AiConversation.findById(id).populate('userId', 'name email avatar');
    if (!conv) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.json({ status: 'success', data: conv });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
};

