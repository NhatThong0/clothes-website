const axios = require('axios');
const Product = require('../../model/Product');

function trimText(value, max = 200) {
  const text = String(value ?? '');
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

async function getProductCandidates({ query, limit = 4 }) {
  const normalizedQuery = String(query ?? '').trim();
  if (!normalizedQuery) return [];

  try {
    const textMatches = await Product.find(
      { isActive: { $ne: false }, $text: { $search: normalizedQuery } },
      { score: { $meta: 'textScore' } },
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .populate('category', 'name')
      .lean();

    if (Array.isArray(textMatches) && textMatches.length) {
      return textMatches;
    }
  } catch {
    // Fall back to regex search when the text index is unavailable.
  }

  const keywords = normalizedQuery
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part.length >= 2)
    .slice(0, 10);

  if (!keywords.length) return [];

  const pattern = keywords.join('|');
  return Product.find({
    isActive: { $ne: false },
    $or: [
      { name: { $regex: pattern, $options: 'i' } },
      { description: { $regex: pattern, $options: 'i' } },
    ],
  })
    .limit(limit)
    .populate('category', 'name')
    .lean();
}

async function generateAiReply({
  conversationMessages,
  userMessage,
  productCandidates,
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(
    /\/$/,
    '',
  );
  const isLocalModel = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

  if (!apiKey && !isLocalModel) {
    return {
      answer: 'Hien tai chatbot AI chua duoc cau hinh (thieu OPENAI_API_KEY).',
      suggestedProducts: [],
    };
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const systemPrompt = [
    'Ban la tro ly mua sam cho Fashion Hub.',
    'Nhiem vu: tra loi cau hoi cua khach hang va goi y san pham phu hop.',
    'Hay tra loi bang tieng Viet.',
    'Chi duoc goi y cac san pham nam trong danh sach he thong cung cap.',
    'Neu thieu thong tin, hay hoi them 1-2 cau de lam ro nhu cau.',
    'Tra loi ngan gon, de doc va than thien.',
  ].join('\n');

  const candidatesText = (productCandidates || [])
    .map((product, index) => {
      const price = typeof product.price === 'number' ? product.price : Number(product.price || 0);
      const discount =
        typeof product.discount === 'number' ? product.discount : Number(product.discount || 0);
      const categoryName = product.category?.name || '';

      return [
        `[${index + 1}] ${product.name}`,
        `Gia: ${price.toLocaleString('vi-VN')} VND`,
        `Giam: ${discount}%`,
        `Danh muc: ${categoryName}`,
        `Mo ta: ${trimText(product.description, 160)}`,
      ].join(' | ');
    })
    .join('\n');

  const history = (conversationMessages || []).slice(-10).map((message) => ({
    role: message.senderRole === 'user' ? 'user' : 'assistant',
    content: message.content,
  }));

  const userPrompt = [
    `Khach hang hoi: ${userMessage}`,
    '',
    'San pham goi y co the lien quan:',
    candidatesText || '(Khong co danh sach san pham lien quan)',
    '',
    'Chi tra ve JSON hop le:',
    '{',
    '  "answer": "<van ban tra loi tieng Viet>",',
    '  "suggestedIndices": [1,2,3]',
    '}',
    'Quy tac:',
    '- suggestedIndices chi chua cac index ton tai trong danh sach.',
    '- Neu khong co san pham phu hop, hay de suggestedIndices = [].',
    '- Khong bia dat gia hoac thuoc tinh ngoai du lieu he thong.',
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

  const response = await axios.post(`${baseUrl}/chat/completions`, payload, { headers });
  const rawContent = response.data?.choices?.[0]?.message?.content || '';

  let parsed = null;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        parsed = null;
      }
    }
  }

  const answer =
    parsed?.answer && String(parsed.answer).trim()
      ? String(parsed.answer).trim()
      : rawContent.trim() ||
        'Minh chua the tra loi luc nay. Ban co the mo ta them chi tiet giup minh?';

  const safeIndices = (Array.isArray(parsed?.suggestedIndices) ? parsed.suggestedIndices : [])
    .map((value) => Number(value))
    .filter(
      (value) => Number.isFinite(value) && value >= 1 && value <= (productCandidates?.length || 0),
    )
    .slice(0, 3);

  const suggestedProducts = safeIndices
    .map((index) => productCandidates[index - 1])
    .filter(Boolean);

  return { answer, suggestedProducts };
}

module.exports = {
  getProductCandidates,
  generateAiReply,
};
