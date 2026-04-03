'use strict';

const AiConversation = require('../../model/AiConversation');
const {
  getProductCandidates,
  getUnavailableProductMatches,
  generateAiReply,
} = require('./ai-chat.service');
const { handleSizeConsultation } = require('./size-consultation.service');
const { validateObjectId } = require('../../utils/validators');

// ─────────────────────────────────────────────
// SECTION 1 — HELPERS
// ─────────────────────────────────────────────

/**
 * Chỉ expose các field cần thiết ra client.
 * Tránh leak raw DB object (internal IDs, sensitive fields...).
 */
function toSafeSuggestedProducts(products) {
  return (products || []).map((p) => ({
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

/**
 * Map lỗi từ service/LLM ra HTTP status code và message thân thiện.
 *
 * Tại sao không dùng chung 500/502?
 * - Client cần biết lỗi là tạm thời (timeout, server busy) hay cố định.
 * - 504 Gateway Timeout  → client có thể retry.
 * - 503 Service Unavailable → client biết service đang down.
 * - 429 Too Many Requests → client cần chờ.
 * - 500 → lỗi không xác định.
 */
function resolveErrorResponse(err) {
  const msg = err?.response?.data?.error?.message || err?.message || 'Internal Server Error';

  if (msg.includes('LLM_TIMEOUT')) {
    return { status: 504, message: 'Chatbot đang xử lý hơi lâu, bạn thử lại sau nhé!' };
  }
  if (msg.includes('LLM_MODEL_NOT_FOUND')) {
    return { status: 503, message: 'Model AI chưa sẵn sàng. Vui lòng liên hệ admin.' };
  }
  if (msg.includes('LLM_CONNECTION_REFUSED')) {
    return { status: 503, message: 'Chatbot tạm thời không khả dụng. Vui lòng thử lại sau.' };
  }
  if (msg.includes('LLM_RATE_LIMITED')) {
    return { status: 429, message: 'Chatbot đang bận, vui lòng đợi chút rồi thử lại.' };
  }
  if (msg.includes('LLM_BAD_REQUEST')) {
    return { status: 400, message: 'Câu hỏi không hợp lệ, bạn thử diễn đạt lại nhé.' };
  }

  const httpStatus = err?.response?.status;
  if (httpStatus && Number.isFinite(httpStatus)) {
    return { status: 502, message: msg };
  }

  return { status: 500, message: 'Đã có lỗi xảy ra. Vui lòng thử lại.' };
}

// ─────────────────────────────────────────────
// SECTION 2 — USER ENDPOINTS
// ─────────────────────────────────────────────

/**
 * GET /my
 * Lấy (hoặc tạo mới) conversation của user hiện tại.
 */
exports.getMyAiConversation = async (req, res) => {
  try {
    const userId = req.userId;

    let conv = await AiConversation.findOne({ userId }).populate('userId', 'name email avatar');

    if (!conv) {
      conv = await AiConversation.create({ userId, messages: [] });
      conv = await AiConversation.findById(conv._id).populate('userId', 'name email avatar');
    }

    res.json({ status: 'success', data: conv });
  } catch (err) {
    console.error('[getMyAiConversation] Error:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /my/send
 * Gửi tin nhắn và nhận reply từ AI.
 *
 * Flow:
 * 1. Validate input.
 * 2. Lưu user message vào DB bằng $push (atomic, tránh race condition).
 * 3. Song song: tìm sản phẩm còn hàng + hết hàng liên quan (Promise.all).
 * 4. Gọi AI để sinh reply.
 * 5. Lưu AI message bằng $push.
 * 6. Trả về cả 2 message cho client.
 */
exports.aiSendMessage = async (req, res) => {
  try {
    const userId = req.userId;
    const { content } = req.body;

    // ── 1. Validate ─────────────────────────────────────────────────────────
    const text = String(content ?? '').trim();
    if (!text) {
      return res.status(400).json({ status: 'error', message: 'Nội dung không được trống' });
    }

    // ── 2. Lưu user message (atomic $push) ──────────────────────────────────
    // Dùng findOneAndUpdate + $push thay vì find → push → save.
    // Lý do: nếu user gửi 2 tin liên tiếp, conv.save() lần 2 có thể
    // overwrite message của request đầu vì đang dùng object cũ trong memory.
    // $push + $setOnInsert đảm bảo upsert an toàn (tạo conv nếu chưa có).
    const conv = await AiConversation.findOneAndUpdate(
      { userId },
      {
        $push: { messages: { senderRole: 'user', content: text, readAt: null } },
        $set: { lastMessage: text.slice(0, 80), lastMessageAt: new Date() },
        $setOnInsert: { userId },
      },
      { upsert: true, new: true },
    );

    const savedUserMsg = conv.messages[conv.messages.length - 1];

    // ── 3. Tìm sản phẩm song song ────────────────────────────────────────────
    // Promise.all chạy 2 query DB đồng thời thay vì tuần tự.
    // Tiết kiệm ~50% thời gian chờ so với await riêng từng cái.
    //
    // productCandidates: sản phẩm còn hàng để gợi ý.
    // unavailableMatches: sản phẩm hết hàng — để chatbot nói đúng
    //   "món này hết rồi" thay vì im lặng hoặc gợi ý sai.
    const [productCandidates, unavailableMatches] = await Promise.all([
      getProductCandidates({ query: text, limit: 6 }),
      getUnavailableProductMatches({ query: text, limit: 3 }),
    ]);

    // ── 4. Sinh AI reply ─────────────────────────────────────────────────────
    // Slice 30 message gần nhất trước khi truyền vào service.
    // Service đã có token budget nhưng slice ở đây tránh truyền
    // mảng hàng trăm phần tử không cần thiết.
    const conversationMessages = conv.messages.slice(-30);

    const sizeReply = await handleSizeConsultation({
      conversation: conv,
      userMessage: text,
      productCandidates,
    });

    const aiReply = sizeReply || await generateAiReply({
      conversationMessages,
      userMessage: text,
      productCandidates,
      unavailableMatches,
    });

    // ── 5. Lưu AI message (atomic $push) ────────────────────────────────────
    // Không dùng conv.save() vì conv object đã cũ (AI mất 30-90s).
    // Trong thời gian đó có thể có request khác đã update conv trên DB.
    const aiContent = aiReply?.answer
      ? String(aiReply.answer).trim().slice(0, 4000)
      : 'Mình chưa thể trả lời lúc này. Bạn có thể hỏi lại chi tiết hơn nhé!';

    const aiMessagePayload = {
      senderRole: 'ai',
      content: aiContent,
      suggestedProducts: toSafeSuggestedProducts(aiReply?.suggestedProducts),
      readAt: null,
    };

    const updatedConv = await AiConversation.findByIdAndUpdate(
      conv._id,
      {
        $push: { messages: aiMessagePayload },
        $set: {
          lastMessage: aiContent.slice(0, 80),
          lastMessageAt: new Date(),
          ...(aiReply?.sizeRecommendationState
            ? { sizeRecommendation: aiReply.sizeRecommendationState }
            : {}),
        },
      },
      { new: true },
    );

    const savedAiMsg = updatedConv.messages[updatedConv.messages.length - 1];

    // ── 6. Response ──────────────────────────────────────────────────────────
    res.json({ status: 'success', data: { user: savedUserMsg, ai: savedAiMsg } });
  } catch (err) {
    console.error('[aiSendMessage] Error:', err.message);
    const { status, message } = resolveErrorResponse(err);
    res.status(status).json({ status: 'error', message });
  }
};

// ─────────────────────────────────────────────
// SECTION 3 — ADMIN ENDPOINTS
// ─────────────────────────────────────────────

/**
 * GET /admin/conversations
 * Danh sách tất cả conversation (không kèm messages để giảm payload).
 *
 * Thêm: trả về totalPages để client dễ render pagination.
 * Thêm: clamp page/limit để tránh query với giá trị vô lý (limit=99999).
 */
exports.adminGetAiConversations = async (req, res) => {
  try {
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const skip  = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      AiConversation.find()
        .populate('userId', 'name email avatar')
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-messages'),
      AiConversation.countDocuments(),
    ]);

    res.json({
      status: 'success',
      data: {
        conversations,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[adminGetAiConversations] Error:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * GET /admin/conversations/:id
 * Chi tiết 1 conversation kèm toàn bộ messages.
 */
exports.adminGetAiConversation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({ status: 'error', message: 'ID conversation không hợp lệ' });
    }

    const conv = await AiConversation.findById(id).populate('userId', 'name email avatar');

    if (!conv) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy conversation' });
    }

    res.json({ status: 'success', data: conv });
  } catch (err) {
    console.error('[adminGetAiConversation] Error:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};
