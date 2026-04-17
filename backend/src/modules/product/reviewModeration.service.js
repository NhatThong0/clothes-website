'use strict';

const axios = require('axios');
const Order = require('../../model/Order');

const SHORT_REVIEW_WORD_LIMIT = Number(process.env.REVIEW_SHORT_WORD_LIMIT || 3);
const TRUSTED_DELIVERED_ORDER_THRESHOLD = Number(process.env.REVIEW_TRUSTED_ORDER_THRESHOLD || 2);
const AUTO_REJECT_THRESHOLD = Number(process.env.REVIEW_AUTO_REJECT_THRESHOLD || 0.2);
const AUTO_APPROVE_THRESHOLD = Number(process.env.REVIEW_AUTO_APPROVE_THRESHOLD || 0.8);

const VIETNAMESE_SLANG_REPLACEMENTS = [
    { pattern: /d[\W_]*m/gi, value: 'dm' },
    { pattern: /d[\W_]*c[\W_]*m/gi, value: 'dcm' },
    { pattern: /đ[\W_]*m/gi, value: 'dm' },
    { pattern: /v[\W_]*c[\W_]*l/gi, value: 'vcl' },
    { pattern: /l[\W_]*o[\W_]*n/gi, value: 'lon' },
    { pattern: /c[\W_]*a[\W_]*c/gi, value: 'cac' },
];

const TOXIC_PATTERNS = [
    /\bdm\b/gi,
    /\bdcm\b/gi,
    /\bvcl\b/gi,
    /\bcac\b/gi,
    /\blon\b/gi,
    /\bdit\b/gi,
    /\bdeo me\b/gi,
    /\bshit\b/gi,
    /\bfuck\b/gi,
];

const AD_PATTERNS = [
    /\b(inbox|ib|zalo|telegram|tele|facebook|fb|tiktok|lien he|liên hệ)\b/gi,
    /\b(0\d{8,10}|\+84\d{8,10})\b/g,
    /\bhttps?:\/\/\S+\b/gi,
    /\bwww\.\S+\b/gi,
    /@\w+/g,
];

const SPAM_PATTERNS = [
    /(.)\1{5,}/g,
    /\b(?:good|ok|tot|dep|hay)(?:\s+(?:good|ok|tot|dep|hay)){2,}\b/gi,
];

function stripVietnameseDiacritics(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd');
}

function normalizeReviewText(value) {
    let normalized = String(value || '').toLowerCase();
    VIETNAMESE_SLANG_REPLACEMENTS.forEach(({ pattern, value: replacement }) => {
        normalized = normalized.replace(pattern, replacement);
    });

    return stripVietnameseDiacritics(normalized)
        .replace(/[^a-z0-9@:/.\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function countWords(value) {
    return normalizeReviewText(value).split(' ').filter(Boolean).length;
}

function countPatternMatches(text, patterns) {
    return patterns.reduce((count, pattern) => {
        const matches = text.match(pattern);
        return count + (matches ? matches.length : 0);
    }, 0);
}

function calculateRepetitionPenalty(text) {
    const compact = String(text || '').replace(/\s+/g, '');
    if (!compact) return 0;

    const diversity = new Set(compact.split('')).size / compact.length;
    if (diversity < 0.18) return 0.2;
    if (diversity < 0.3) return 0.08;
    return 0;
}

async function getUserTrustSignals(userId) {
    const deliveredOrders = await Order.countDocuments({ userId, status: 'delivered' });
    return {
        deliveredOrders,
        trustedBuyer: deliveredOrders >= TRUSTED_DELIVERED_ORDER_THRESHOLD,
    };
}

function buildHeuristicModeration({ rawText, normalizedText, trustSignals }) {
    const wordCount = countWords(rawText);
    const adHits = countPatternMatches(normalizedText, AD_PATTERNS);
    const toxicHits = countPatternMatches(normalizedText, TOXIC_PATTERNS);
    const spamHits = countPatternMatches(normalizedText, SPAM_PATTERNS);
    const repetitionPenalty = calculateRepetitionPenalty(normalizedText);
    const suspiciousScore = Math.max(
        0,
        Math.min(1, (adHits * 0.28) + (toxicHits * 0.34) + (spamHits * 0.18) + repetitionPenalty),
    );
    const safeScore = 1 - suspiciousScore;
    const isShortTrusted = trustSignals.trustedBuyer && wordCount <= SHORT_REVIEW_WORD_LIMIT && adHits === 0 && toxicHits === 0;

    const reasons = [];
    if (adHits > 0) reasons.push('Có dấu hiệu quảng cáo hoặc kéo người dùng ra ngoài');
    if (toxicHits > 0) reasons.push('Có từ ngữ tục tĩu hoặc công kích');
    if (spamHits > 0 || repetitionPenalty > 0) reasons.push('Có dấu hiệu spam hoặc lặp nội dung');
    if (wordCount <= SHORT_REVIEW_WORD_LIMIT) reasons.push('Review rất ngắn');
    if (isShortTrusted) reasons.push('Review ngắn nhưng user có lịch sử mua hàng uy tín');

    if (isShortTrusted) {
        return {
            safeScore: 0.98,
            status: 'approved',
            decision: 'trusted_short_auto_approve',
            source: 'skip',
            reasons,
            summary: reasons[reasons.length - 1] || 'Trusted short review',
            flags: { spam: false, advertising: false, toxic: false, suspicious: false, shortTrusted: true },
        };
    }

    let status = 'pending';
    let decision = 'human_review';
    if (safeScore <= AUTO_REJECT_THRESHOLD) {
        status = 'rejected';
        decision = 'auto_reject';
    } else if (safeScore >= AUTO_APPROVE_THRESHOLD) {
        status = 'approved';
        decision = 'auto_approve';
    }

    return {
        safeScore,
        status,
        decision,
        source: 'rule',
        reasons,
        summary: reasons[0] || 'Review bình thường',
        flags: {
            spam: spamHits > 0 || repetitionPenalty > 0,
            advertising: adHits > 0,
            toxic: toxicHits > 0,
            suspicious: status === 'pending',
            shortTrusted: false,
        },
    };
}

async function runAiModeration({ rawText, normalizedText, heuristic }) {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const isLocalModel = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

    if (!apiKey && !isLocalModel) return null;

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

        const response = await axios.post(`${baseUrl}/chat/completions`, {
            model,
            temperature: 0,
            max_tokens: 250,
            messages: [
                { role: 'system', content: 'Chỉ trả về JSON hợp lệ cho bài toán moderation review tiếng Việt.' },
                {
                    role: 'user',
                    content: [
                        'Trả về JSON: {"safeScore":0.0,"flags":{"spam":false,"advertising":false,"toxic":false},"reasons":["..."],"summary":"..."}',
                        `Review gốc: ${JSON.stringify(rawText)}`,
                        `Review chuẩn hóa: ${JSON.stringify(normalizedText)}`,
                        `Heuristic ban đầu: ${JSON.stringify({ safeScore: heuristic.safeScore, flags: heuristic.flags, reasons: heuristic.reasons })}`,
                    ].join('\n'),
                },
            ],
        }, { headers, timeout: 12000 });

        const content = response.data?.choices?.[0]?.message?.content || '';
        const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || content;
        const parsed = JSON.parse(jsonText);

        if (typeof parsed.safeScore !== 'number') return null;

        return {
            safeScore: Math.max(0, Math.min(1, parsed.safeScore)),
            flags: {
                spam: Boolean(parsed.flags?.spam),
                advertising: Boolean(parsed.flags?.advertising),
                toxic: Boolean(parsed.flags?.toxic),
            },
            reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map((item) => String(item)).slice(0, 6) : [],
            summary: String(parsed.summary || '').trim(),
        };
    } catch (error) {
        console.error('[reviewModeration] AI moderation failed:', error.message);
        return null;
    }
}

function mergeModerationSignals(heuristic, aiResult) {
    if (!aiResult) return heuristic;

    const safeScore = Math.max(0, Math.min(1, (heuristic.safeScore * 0.45) + (aiResult.safeScore * 0.55)));
    const reasons = [...new Set([...(heuristic.reasons || []), ...(aiResult.reasons || [])])].slice(0, 6);

    let status = 'pending';
    let decision = 'human_review';
    if (safeScore <= AUTO_REJECT_THRESHOLD) {
        status = 'rejected';
        decision = 'auto_reject';
    } else if (safeScore >= AUTO_APPROVE_THRESHOLD) {
        status = 'approved';
        decision = 'auto_approve';
    }

    return {
        safeScore,
        status,
        decision,
        source: 'hybrid',
        reasons,
        summary: aiResult.summary || heuristic.summary,
        flags: {
            spam: heuristic.flags.spam || aiResult.flags.spam,
            advertising: heuristic.flags.advertising || aiResult.flags.advertising,
            toxic: heuristic.flags.toxic || aiResult.flags.toxic,
            suspicious: status === 'pending',
            shortTrusted: heuristic.flags.shortTrusted,
        },
    };
}

async function moderateReviewText({ comment, userId }) {
    const rawText = String(comment || '').trim();
    const normalizedText = normalizeReviewText(rawText);
    const trustSignals = await getUserTrustSignals(userId);
    const heuristic = buildHeuristicModeration({ rawText, normalizedText, trustSignals });

    if (heuristic.decision === 'trusted_short_auto_approve') {
        return { ...heuristic, normalizedText };
    }

    const aiResult = await runAiModeration({ rawText, normalizedText, heuristic });
    const finalResult = mergeModerationSignals(heuristic, aiResult);
    return { ...finalResult, normalizedText };
}

function buildModerationUpdate(result) {
    return {
        isVisible: result.status === 'approved',
        moderationStatus: result.status,
        moderationDecision: result.decision,
        moderationSource: result.source,
        moderationScore: result.safeScore,
        moderationReasons: result.reasons || [],
        moderationFlags: {
            spam: Boolean(result.flags?.spam),
            advertising: Boolean(result.flags?.advertising),
            toxic: Boolean(result.flags?.toxic),
            suspicious: Boolean(result.flags?.suspicious),
            shortTrusted: Boolean(result.flags?.shortTrusted),
        },
        moderationTextNormalized: result.normalizedText || '',
        moderationSummary: result.summary || '',
        moderationProcessedAt: new Date(),
    };
}

function calculateReviewMetrics(reviews = []) {
    const approvedReviews = reviews.filter((review) => review.moderationStatus === 'approved' && review.isVisible !== false);
    if (!approvedReviews.length) {
        return { averageRating: 0, rating: 0 };
    }

    const totalRating = approvedReviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0);
    const averageRating = Math.round((totalRating / approvedReviews.length) * 10) / 10;

    return { averageRating, rating: averageRating };
}

module.exports = {
    moderateReviewText,
    buildModerationUpdate,
    calculateReviewMetrics,
    normalizeReviewText,
};
