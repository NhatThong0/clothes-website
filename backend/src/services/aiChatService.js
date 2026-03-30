const axios = require('axios');
const Product = require('../model/Product');

function trimText(s, max = 200) {
  const str = String(s ?? '');
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

async function getProductCandidates({ query, limit = 4 }) {
  const q = String(query ?? '').trim();
  if (!q) return [];

  // 1) Try text index search (fast if $text index exists)
  try {
    const byText = await Product.find(
      { isActive: { $ne: false }, $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .populate('category', 'name')
      .lean();

    if (Array.isArray(byText) && byText.length) return byText;
  } catch {
    // Ignore and fallback to regex search
  }

  // 2) Fallback: regex by keywords
  const keywords = q
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => s.length >= 2)
    .slice(0, 10);

  if (!keywords.length) return [];

  const pattern = keywords.join('|');
  const byRegex = await Product.find(
    {
      isActive: { $ne: false },
      $or: [
        { name: { $regex: pattern, $options: 'i' } },
        { description: { $regex: pattern, $options: 'i' } },
      ],
    },
  )
    .limit(limit)
    .populate('category', 'name')
    .lean();

  return byRegex || [];
}

async function generateAiReply({ conversationMessages, userMessage, productCandidates }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl =
    (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

  // Local (Ollama/LM Studio) thường không cần API key
  if (!apiKey && !isLocal) {
    return {
      answer: 'Hiện tại chatbot AI chưa được cấu hình (thiếu `OPENAI_API_KEY`).',
      suggestedProducts: [],
    };
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const systemPrompt = [
    'Bạn là trợ lý mua sắm cho Fashion Hub.',
    'Nhiệm vụ: trả lời câu hỏi của khách hàng và gợi ý sản phẩm phù hợp.',
    'Hãy trả lời bằng tiếng Việt.',
    'Quan trọng: Khi gợi ý sản phẩm, chỉ được sử dụng các sản phẩm trong danh sách “Sản phẩm gợi ý có thể liên quan” mà hệ thống cung cấp.',
    'Nếu không có sản phẩm phù hợp hoặc thiếu thông tin, hãy hỏi thêm 1-2 câu để làm rõ.',
    'Trả lời theo cách ngắn gọn, dễ đọc, thân thiện.',
  ].join('\n');

  const candidatesText = (productCandidates || [])
    .map((p, idx) => {
      const price = typeof p.price === 'number' ? p.price : Number(p.price || 0);
      const discount = typeof p.discount === 'number' ? p.discount : Number(p.discount || 0);
      const categoryName = p.category?.name || '';
      return `[${idx + 1}] ${p.name} | Giá: ${price.toLocaleString('vi-VN')} VNĐ | Giảm: ${discount}% | Danh mục: ${categoryName}\nMô tả: ${trimText(p.description, 160)}`;
    })
    .join('\n\n');

  const history = (conversationMessages || [])
    .slice(-10)
    .map(m => {
      const role = m.senderRole === 'user' ? 'user' : 'assistant';
      return { role, content: m.content };
    });

  const userPrompt = [
    `Khách hàng hỏi: ${userMessage}`,
    '',
    'Sản phẩm gợi ý có thể liên quan:',
    candidatesText ? candidatesText : '(Không có danh sách sản phẩm liên quan)',
    '',
    'Yêu cầu định dạng (CHỈ trả về JSON hợp lệ, không có markdown, không thêm ký tự ngoài JSON):',
    '{',
    '  "answer": "<văn bản trả lời tiếng Việt>",',
    '  "suggestedIndices": [1,2,3]',
    '}',
    'Quy tắc:',
    '- suggestedIndices chỉ được chứa các index tồn tại trong danh sách “Sản phẩm gợi ý có thể liên quan”.',
    '- Nếu không có sản phẩm phù hợp, hãy để suggestedIndices = [].',
    '- Không bịa đặt giá/thuộc tính; chỉ dùng dữ liệu hệ thống cung cấp.',
  ].join('\n');

  const payload = {
    model,
    temperature: 0.35,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userPrompt },
    ],
  };

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const resp = await axios.post(`${baseUrl}/chat/completions`, payload, { headers });

  const raw = resp.data?.choices?.[0]?.message?.content || '';
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Thử trích xuất phần JSON nếu model trả thêm text
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { /* ignore */ }
    }
  }

  const answer =
    parsed?.answer && String(parsed.answer).trim()
      ? String(parsed.answer).trim()
      : (raw && raw.trim()) || 'Mình chưa thể trả lời lúc này. Bạn có thể mô tả thêm chi tiết giúp mình?';

  const indices = Array.isArray(parsed?.suggestedIndices) ? parsed.suggestedIndices : [];
  const safeIndices = indices
    .map(i => Number(i))
    .filter(i => Number.isFinite(i) && i >= 1 && i <= (productCandidates?.length || 0))
    .slice(0, 3);

  const suggestedProducts = safeIndices
    .map(i => productCandidates[i - 1])
    .filter(Boolean);

  return { answer, suggestedProducts };
}

module.exports = {
  getProductCandidates,
  generateAiReply,
};

