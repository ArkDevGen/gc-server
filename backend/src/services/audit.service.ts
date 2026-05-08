import { query } from '../config/database';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'ITEM_CREATED'
  | 'ITEM_UPDATED'
  | 'ITEM_DELETED'
  | 'PO_CREATED'
  | 'PO_UPDATED'
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'QUOTE_CREATED'
  | 'QUOTE_UPDATED'
  | 'BUILD_CREATED'
  | 'BUILD_UPDATED';

interface AuditParams {
  userId?: string | null;
  username?: string | null;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, ip_address, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::inet, $7)`,
      [
        params.userId ?? null,
        params.username ?? null,
        params.action,
        params.resourceType ?? null,
        params.resourceId ?? null,
        params.ipAddress ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ]
    );
  } catch (err) {
    // Never let audit logging break a request
    console.error('Audit log write failed:', err);
  }
}

export function getIp(req: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first.trim();
  }
  return req.socket.remoteAddress;
}
