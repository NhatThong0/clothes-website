import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '@features/shared/services/apiClient';

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500';

const emptyBrief = {
  campaignGoal: '',
  offer: '',
  productFocus: '',
  audience: 'Khách hàng đã đăng ký tài khoản',
  tone: 'Trẻ trung, lịch sự, rõ ràng',
  ctaText: 'Mua ngay',
};

const emptyEmail = {
  subject: '',
  preheader: '',
  text: '',
  html: '',
};

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function AdminMarketingEmail() {
  const [brief, setBrief] = useState(emptyBrief);
  const [email, setEmail] = useState(emptyEmail);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [maxRecipients, setMaxRecipients] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [recipientInfo, setRecipientInfo] = useState({ total: 0, recipients: [] });
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [error, setError] = useState('');

  const previewHtml = useMemo(() => ({ __html: email.html || '<p>Chưa có nội dung email.</p>' }), [email.html]);

  const setBriefField = (key, value) => setBrief((current) => ({ ...current, [key]: value }));
  const setEmailField = (key, value) => setEmail((current) => ({ ...current, [key]: value }));

  const loadRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const params = new URLSearchParams();
      if (recipientSearch.trim()) params.set('search', recipientSearch.trim());
      if (maxRecipients) params.set('limit', maxRecipients);
      const response = await apiClient.get(`/admin/marketing/recipients?${params.toString()}`);
      setRecipientInfo(response.data?.data || { total: 0, recipients: [] });
    } catch (err) {
      setError(err.response?.data?.message || 'Không lấy được danh sách người nhận.');
    } finally {
      setLoadingRecipients(false);
    }
  };

  useEffect(() => {
    loadRecipients();
  }, []);

  const generateEmail = async () => {
    setError('');
    setSendResult(null);
    setGenerating(true);
    try {
      const response = await apiClient.post('/admin/marketing/generate', brief);
      const data = response.data?.data || {};
      setEmail({
        subject: data.subject || '',
        preheader: data.preheader || '',
        text: data.text || '',
        html: data.html || '',
      });
      if (!data.aiUsed) {
        setSendResult({
          note: data.fallbackReason
            ? `AI chưa được dùng: ${data.fallbackReason}. Hệ thống đã tạo nội dung mẫu.`
            : 'Hệ thống đã tạo nội dung mẫu.',
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không tạo được nội dung AI.');
    } finally {
      setGenerating(false);
    }
  };

  const sendEmail = async ({ test = false } = {}) => {
    if (!email.subject.trim() || !email.html.trim()) {
      setError('Vui lòng tạo hoặc nhập tiêu đề và nội dung HTML trước khi gửi.');
      return;
    }
    if (test && !testEmail.trim()) {
      setError('Vui lòng nhập email nhận thử.');
      return;
    }
    if (!test && !window.confirm(`Gửi email marketing tới ${recipientInfo.total} khách hàng?`)) return;

    setError('');
    setSendResult(null);
    setSending(true);
    try {
      const payload = {
        ...email,
        search: recipientSearch.trim() || undefined,
        maxRecipients: maxRecipients || undefined,
        testEmail: test ? testEmail.trim() : undefined,
      };
      const response = await apiClient.post('/admin/marketing/send', payload);
      setSendResult(response.data?.data || null);
      if (!test) loadRecipients();
    } catch (err) {
      setError(err.response?.data?.message || 'Không gửi được email marketing.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 px-6 py-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Email Marketing</h1>
            <p className="mt-0.5 text-sm text-slate-400">Tạo nội dung bằng AI và gửi hàng loạt tới khách hàng đã đăng ký</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
            {loadingRecipients ? 'Đang đếm...' : `${recipientInfo.total} email khả dụng`}
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-6 xl:grid-cols-[420px_1fr]">
        <section className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Brief cho AI</h2>
            <div className="mt-4 space-y-4">
              <Field label="Mục tiêu chiến dịch">
                <textarea className={`${inputCls} min-h-[84px] resize-none`} value={brief.campaignGoal} onChange={(e) => setBriefField('campaignGoal', e.target.value)} placeholder="Ví dụ: giới thiệu bộ sưu tập hè, kéo khách quay lại mua..." />
              </Field>
              <Field label="Ưu đãi">
                <input className={inputCls} value={brief.offer} onChange={(e) => setBriefField('offer', e.target.value)} placeholder="Ví dụ: giảm 20% cho đơn từ 500K" />
              </Field>
              <Field label="Sản phẩm tập trung">
                <input className={inputCls} value={brief.productFocus} onChange={(e) => setBriefField('productFocus', e.target.value)} placeholder="Ví dụ: áo thun, sneaker, flash sale cuối tuần" />
              </Field>
              <Field label="Đối tượng">
                <input className={inputCls} value={brief.audience} onChange={(e) => setBriefField('audience', e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Giọng văn">
                  <input className={inputCls} value={brief.tone} onChange={(e) => setBriefField('tone', e.target.value)} />
                </Field>
                <Field label="CTA">
                  <input className={inputCls} value={brief.ctaText} onChange={(e) => setBriefField('ctaText', e.target.value)} />
                </Field>
              </div>
              <button onClick={generateEmail} disabled={generating} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">
                {generating ? 'AI đang tạo...' : 'Tạo nội dung bằng AI'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Người nhận</h2>
            <div className="mt-4 space-y-4">
              <Field label="Lọc email / tên">
                <input className={inputCls} value={recipientSearch} onChange={(e) => setRecipientSearch(e.target.value)} placeholder="Để trống để gửi tất cả khách hàng" />
              </Field>
              <Field label="Giới hạn số người nhận" hint="Hữu ích khi muốn gửi theo từng đợt nhỏ.">
                <input className={inputCls} type="number" min="1" value={maxRecipients} onChange={(e) => setMaxRecipients(e.target.value)} placeholder="Không giới hạn" />
              </Field>
              <button onClick={loadRecipients} disabled={loadingRecipients} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                {loadingRecipients ? 'Đang cập nhật...' : 'Cập nhật danh sách'}
              </button>
              <div className="max-h-44 overflow-y-auto rounded-xl bg-slate-50 p-3">
                {recipientInfo.recipients.slice(0, 8).map((user) => (
                  <div key={user._id || user.email} className="flex items-center justify-between border-b border-white py-2 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{user.name || 'Khách hàng'}</p>
                      <p className="text-xs text-slate-400">{user.email}</p>
                    </div>
                  </div>
                ))}
                {!recipientInfo.recipients.length && <p className="text-sm text-slate-400">Chưa có người nhận phù hợp.</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</div>}
          {sendResult?.note && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{sendResult.note}</div>}
          {sendResult && !sendResult.note && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              Kết quả: gửi thành công {sendResult.sent}, fallback log {sendResult.skipped}, lỗi {sendResult.failed}/{sendResult.total}.
              {!sendResult.smtpConfigured && ' SMTP chưa cấu hình nên email được log ở console backend.'}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900">Nội dung email</h2>
              <div className="flex gap-2">
                <input className="w-64 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="email gửi thử" />
                <button onClick={() => sendEmail({ test: true })} disabled={sending} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Gửi thử</button>
                <button onClick={() => sendEmail()} disabled={sending} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-black disabled:opacity-50">
                  {sending ? 'Đang gửi...' : 'Gửi hàng loạt'}
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Subject">
                <input className={inputCls} value={email.subject} onChange={(e) => setEmailField('subject', e.target.value)} placeholder="Tiêu đề email" />
              </Field>
              <Field label="Preheader">
                <input className={inputCls} value={email.preheader} onChange={(e) => setEmailField('preheader', e.target.value)} placeholder="Dòng xem trước trong hộp thư" />
              </Field>
              <Field label="Plain text">
                <textarea className={`${inputCls} min-h-[120px] resize-y`} value={email.text} onChange={(e) => setEmailField('text', e.target.value)} />
              </Field>
              <Field label="HTML email" hint="Có thể dùng {{name}} để cá nhân hóa tên khách hàng.">
                <textarea className={`${inputCls} min-h-[240px] resize-y font-mono text-xs`} value={email.html} onChange={(e) => setEmailField('html', e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Xem trước</h2>
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Subject</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{email.subject || 'Chưa có tiêu đề'}</p>
              {email.preheader && <p className="mt-1 text-sm text-slate-500">{email.preheader}</p>}
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-4" dangerouslySetInnerHTML={previewHtml} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
