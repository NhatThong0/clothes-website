const axios = require('axios');
const User = require('../../model/User');
const { hasSmtpConfig, sendMail } = require('../../utils/email');

const DEFAULT_SUBJECT = 'Uu dai moi danh rieng cho ban';

function stripCodeFence(value) {
    return String(value || '')
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/i, '')
        .trim();
}

function parseJsonResponse(raw) {
    const clean = stripCodeFence(raw);

    try {
        return JSON.parse(clean);
    } catch {
        const match = clean.match(/\{[\s\S]*\}/);
        if (!match) return null;

        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}

function normalizeMarketingContent(content) {
    const subject = String(content?.subject || DEFAULT_SUBJECT).trim().slice(0, 120);
    const preheader = String(content?.preheader || '').trim().slice(0, 180);
    const text = String(content?.text || '').trim();
    const html = String(content?.html || '').trim();

    return {
        subject,
        preheader,
        text: text || `${subject}\n\n${preheader}`,
        html: html || `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
                <p>${preheader || subject}</p>
            </div>
        `,
    };
}

function buildFallbackContent({ campaignGoal, offer, productFocus, ctaText }) {
    const subject = offer
        ? `Uu dai moi: ${offer}`
        : DEFAULT_SUBJECT;
    const preheader = campaignGoal
        ? `Shop co goi y moi cho ban: ${campaignGoal}`
        : 'Kham pha nhung san pham va uu dai moi nhat tu shop.';
    const cta = ctaText || 'Mua ngay';
    const focus = productFocus || 'cac san pham moi nhat';

    return normalizeMarketingContent({
        subject,
        preheader,
        text: `${preheader}\n\n${offer ? `Uu dai: ${offer}\n` : ''}Hay xem ngay ${focus} tai cua hang.\n\n${cta}`,
        html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:640px;margin:0 auto">
                <p style="display:none;max-height:0;overflow:hidden">${preheader}</p>
                <h1 style="font-size:28px;margin:0 0 12px">${subject}</h1>
                <p style="font-size:16px;color:#444">${preheader}</p>
                ${offer ? `<p style="font-size:18px;font-weight:700">Uu dai: ${offer}</p>` : ''}
                <p>Hay ghe shop de xem ${focus} va chon mon do phu hop voi ban.</p>
                <a href="${process.env.CLIENT_URL || '#'}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700">${cta}</a>
            </div>
        `,
    });
}

async function generateMarketingContent(input) {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const isLocalModel = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

    if (!apiKey && !isLocalModel) {
        return {
            ...buildFallbackContent(input),
            aiUsed: false,
            fallbackReason: 'OPENAI_API_KEY is not configured',
        };
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const prompt = `
Ban la chuyen gia email marketing cho shop thoi trang DaClothes.
Hay tao mot email marketing bang tieng Viet, than thien, thuyet phuc, khong noi qua su that.

Thong tin chien dich:
- Muc tieu: ${input.campaignGoal || 'Tang doanh so va keo khach quay lai mua sam'}
- Uu dai: ${input.offer || 'Khong co uu dai cu the'}
- San pham/nhom san pham tap trung: ${input.productFocus || 'San pham thoi trang moi'}
- Gioi tinh/doi tuong: ${input.audience || 'Khach hang da dang ky tai khoan'}
- Giong van: ${input.tone || 'Tre trung, lich su, ro rang'}
- CTA: ${input.ctaText || 'Mua ngay'}
- Link cua hang: ${process.env.CLIENT_URL || 'http://localhost:5173'}

Tra ve JSON hop le, khong markdown:
{
  "subject": "toi da 80 ky tu",
  "preheader": "toi da 140 ky tu",
  "text": "plain text email",
  "html": "HTML email hoan chinh, inline style co ban, co nut CTA"
}
`;

    const response = await axios.post(`${baseUrl}/chat/completions`, {
        model,
        temperature: 0.7,
        max_tokens: 1600,
        messages: [
            {
                role: 'system',
                content: 'You write concise, compliant marketing emails in Vietnamese and always return valid JSON.',
            },
            { role: 'user', content: prompt },
        ],
    }, { headers, timeout: 20000 });

    const raw = response.data?.choices?.[0]?.message?.content || '';
    const parsed = parseJsonResponse(raw);

    if (!parsed) {
        return {
            ...buildFallbackContent(input),
            aiUsed: false,
            fallbackReason: 'AI response could not be parsed',
        };
    }

    return {
        ...normalizeMarketingContent(parsed),
        aiUsed: true,
    };
}

async function getMarketingRecipients({ search, limit } = {}) {
    const filter = {
        role: { $ne: 'admin' },
        isActive: true,
        emailVerified: { $ne: false },
        email: { $exists: true, $ne: '' },
    };

    if (search) {
        filter.$or = [
            { email: new RegExp(search, 'i') },
            { name: new RegExp(search, 'i') },
        ];
    }

    const query = User.find(filter)
        .select('name email createdAt lastLoginAt')
        .sort({ createdAt: -1 });

    if (limit) query.limit(Number(limit));

    return query.lean();
}

async function sendBulkMarketingEmail({ recipients, subject, html, text, preheader }) {
    const result = {
        total: recipients.length,
        sent: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        smtpConfigured: hasSmtpConfig(),
    };

    for (const recipient of recipients) {
        try {
            const personalizedHtml = String(html || '').replace(/\{\{\s*name\s*\}\}/gi, recipient.name || 'ban');
            const personalizedText = String(text || '').replace(/\{\{\s*name\s*\}\}/gi, recipient.name || 'ban');
            const info = await sendMail({
                to: recipient.email,
                subject,
                text: personalizedText || preheader || subject,
                html: personalizedHtml,
            });

            if (info?.skipped) result.skipped += 1;
            else result.sent += 1;
        } catch (error) {
            result.failed += 1;
            result.errors.push({
                email: recipient.email,
                message: error.message,
            });
        }
    }

    return result;
}

module.exports = {
    generateMarketingContent,
    getMarketingRecipients,
    sendBulkMarketingEmail,
};
