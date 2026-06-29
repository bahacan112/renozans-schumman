/**
 * SMTP mailer (nodemailer) for transactional emails.
 */
import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465, // implicit TLS on 465
  auth: { user: config.smtp.user, pass: config.smtp.pass },
});

/** Confirm SMTP host/port/auth are valid (no email sent). */
export function verifyMailer() {
  return transporter.verify();
}

const GOLD = '#d4af37';
const CYAN = '#00e5ff';
const BG = '#05050a';
const CARD = '#0e0e1a';

function resetEmailHtml(code: string): string {
  return `<!doctype html>
<html lang="tr">
<body style="margin:0;padding:0;background:${BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${CARD};border:1px solid rgba(212,175,55,0.25);border-radius:20px;overflow:hidden;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <!-- Header -->
        <tr><td align="center" style="padding:32px 24px 8px 24px;">
          <div style="font-size:40px;line-height:1;">🌌</div>
          <div style="margin-top:12px;font-size:18px;font-weight:800;letter-spacing:2px;color:${GOLD};">SCHUMANN RESONANCE</div>
          <div style="margin-top:4px;font-size:12px;color:#8e8ea8;">Cosmic Portal</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:24px;">
          <p style="margin:0 0 6px 0;font-size:16px;font-weight:700;color:#ffffff;">Password reset</p>
          <p style="margin:0 0 20px 0;font-size:13px;line-height:1.6;color:#b9b9cc;">
            Use this code to reset your password.<br>
            Enter it in the app. The code works for <strong style="color:#fff;">10 minutes</strong>.
          </p>

          <!-- Code -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:8px 0 22px 0;">
              <div style="display:inline-block;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.35);border-radius:14px;padding:16px 28px;">
                <span style="font-family:'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${CYAN};">${code}</span>
              </div>
            </td></tr>
          </table>

          <p style="margin:0;font-size:12px;line-height:1.6;color:#8e8ea8;">
            Did not ask for this? You can ignore this email. Your account stays safe.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding:18px 24px 28px 24px;border-top:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:11px;color:rgba(255,255,255,0.35);">Schumann Cosmic Portal &copy; 2026</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendResetCode(to: string, code: string): Promise<void> {
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: `Your password reset code: ${code}`,
    text: `Schumann Resonance - Password reset\n\nYour code: ${code}\nUse this code to reset your password. It works for 10 minutes.\n\nDid not ask for this? You can ignore this email.`,
    html: resetEmailHtml(code),
  });
}
