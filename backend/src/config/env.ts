import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  QBO_CLIENT_ID: process.env.QBO_CLIENT_ID || '',
  QBO_CLIENT_SECRET: process.env.QBO_CLIENT_SECRET || '',
  QBO_REDIRECT_URI: process.env.QBO_REDIRECT_URI || '',
  QBO_ENVIRONMENT: process.env.QBO_ENVIRONMENT || 'sandbox',
  SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN || '',
  SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT || 'sandbox',
  SQUARE_WEBHOOK_SIGNATURE_KEY: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '',
  SQUARE_APP_ID: process.env.SQUARE_APP_ID || '',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  // Support / contact form
 AZURE_TENANT_ID: process.env.AZURE_TENANT_ID || '',
AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID || '',
AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET || '',
  // Domain-verified address used as the From on outbound support emails.
  // Defaults to a hub@ alias on the staff domain.
  SUPPORT_FROM_EMAIL: process.env.SUPPORT_FROM_EMAIL || 'support@arkhub.us',
  // Display name shown in the recipient's From column.
  SUPPORT_FROM_NAME: process.env.SUPPORT_FROM_NAME || 'Ark Support',
  // Inbox that receives the support emails (forwarding rules live here).
  SUPPORT_TO_EMAIL: process.env.SUPPORT_TO_EMAIL || 'support@arkhub.us',
  // Subject prefix that lets one inbox route per-client (e.g. "Goodman Classic").
  CLIENT_NAME: process.env.CLIENT_NAME || 'Goodman Classic',
};
