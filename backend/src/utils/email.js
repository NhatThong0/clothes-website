let nodemailer = null;

try {
    nodemailer = require('nodemailer');
} catch {
    nodemailer = null;
}

function hasSmtpConfig() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendMail({ to, subject, text, html }) {
    if (!hasSmtpConfig() || !nodemailer) {
        console.log(`[Email fallback] To: ${to} | Subject: ${subject} | ${text}`);
        return { skipped: true };
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    return transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        html,
    });
}

async function sendRegistrationOtp(email, code) {
    const subject = 'Ma OTP xac nhan dang ky';
    const text = `Ma OTP xac nhan email cua ban la ${code}. Ma co hieu luc trong 10 phut.`;
    const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
            <h2>Xac nhan email dang ky</h2>
            <p>Ma OTP cua ban la:</p>
            <p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
            <p>Ma co hieu luc trong 10 phut. Neu ban khong tao tai khoan, vui long bo qua email nay.</p>
        </div>
    `;

    return sendMail({ to: email, subject, text, html });
}

module.exports = {
    hasSmtpConfig,
    sendMail,
    sendRegistrationOtp,
};
