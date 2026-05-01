import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { env } from '../config/env';

let graphClient: Client | null = null;

function getClient(): Client | null {
  if (!env.AZURE_TENANT_ID || !env.AZURE_CLIENT_ID || !env.AZURE_CLIENT_SECRET) return null;
  if (!graphClient) {
    const credential = new ClientSecretCredential(
      env.AZURE_TENANT_ID,
      env.AZURE_CLIENT_ID,
      env.AZURE_CLIENT_SECRET
    );
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default'],
    });
    graphClient = Client.initWithMiddleware({ authProvider });
  }
  return graphClient;
}

export interface SupportMessage {
  subject: string;
  message: string;
  user_name: string;
  user_email?: string | null;
  user_role: string;
  page_url?: string | null;
}

export async function sendSupportEmail(msg: SupportMessage): Promise<void> {
  const client = getClient();
  if (!client) {
    throw new Error('Support email is not configured (missing Azure credentials).');
  }

  const subject = `[${env.CLIENT_NAME}] ${msg.subject}`.slice(0, 250);

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

  await client.api(`/users/${env.SUPPORT_FROM_EMAIL}/sendMail`).post({
    message: {
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: env.SUPPORT_TO_EMAIL } }],
      replyTo: msg.user_email ? [{ emailAddress: { address: msg.user_email } }] : undefined,
    },
  });
}

export function isSupportConfigured(): boolean {
  return Boolean(env.AZURE_TENANT_ID && env.AZURE_CLIENT_ID && env.AZURE_CLIENT_SECRET);
}
