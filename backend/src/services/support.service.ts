import { Resend } from 'resend';
import { env } from '../config/env';

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

export interface SupportMessage {
  // From the form
  subject: string;
  message: string;
  // Captured automatically from the requesting user
  user_name: string;
  user_email?: string | null;
  user_role: string;
  // Where in the app they were when they hit the help button
  page_url?: string | null;
}

/**
 * Send a support request email via Resend. Throws if RESEND_API_KEY is not
 * configured so the route can return a clear 503.
 */
export async function sendSupportEmail(msg: SupportMessage): Promise<void> {
  const resend = getClient();
  if (!resend) {
    throw new Error('Support email is not configured (missing RESEND_API_KEY).');
  }

  const subject = `[${env.CLIENT_NAME}] ${msg.subject}`.slice(0, 250);

  // Plain-text fallback
  const text = [
    `New support request from ${env.CLIENT_NAME} Inventory Hub`,
    ``,
    `From: ${msg.user_name} (${msg.user_role})`,
    msg.user_email ? `Email: ${msg.user_email}` : 'Email: not on file',
    msg.page_url ? `Page: ${msg.page_url}` : '',
    ``,
    `Message:`,
    msg.message,
  ].filter(Boolean).join('\n');

  // HTML version with simple, readable layout
  const escapeHtml = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
    );
  const html = `
    <div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #c8202c; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">New support request</h2>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">${escapeHtml(env.CLIENT_NAME)} &middot; Inventory Hub</p>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: 0; padding: 20px; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; font-size: 14px; color: #374151;">
          <tr><td style="padding: 4px 0; width: 90px; color: #6b7280;">From:</td><td><strong>${escapeHtml(msg.user_name)}</strong> (${escapeHtml(msg.user_role)})</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Email:</td><td>${msg.user_email ? escapeHtml(msg.user_email) : '<em style="color:#9ca3af;">not on file</em>'}</td></tr>
          ${msg.page_url ? `<tr><td style="padding: 4px 0; color: #6b7280;">Page:</td><td><a href="${escapeHtml(msg.page_url)}" style="color: #c8202c;">${escapeHtml(msg.page_url)}</a></td></tr>` : ''}
        </table>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="font-size: 13px; color: #6b7280; margin: 0 0 6px;">Message:</p>
        <div style="white-space: pre-wrap; font-size: 14px; color: #111827; line-height: 1.5;">${escapeHtml(msg.message)}</div>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: `${env.SUPPORT_FROM_NAME} <${env.SUPPORT_FROM_EMAIL}>`,
    to: env.SUPPORT_TO_EMAIL,
    subject,
    text,
    html,
    // Critical: replies in Gmail go back to the user, not bounce to staff@
    replyTo: msg.user_email || undefined,
  });
}

export function isSupportConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}
