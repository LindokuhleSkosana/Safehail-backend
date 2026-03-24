import { query } from '../../config/db';
import { parsePagination } from '../../shared/types';
import { suspendUser } from '../users/users.service';

export async function listUsers(queryParams: Record<string, unknown>): Promise<{
  users: unknown[]; total: number; page: number; limit: number;
}> {
  const { page, limit, offset } = parsePagination(queryParams);
  const role = queryParams.role as string | undefined;
  const isActive = queryParams.isActive !== undefined
    ? queryParams.isActive === 'true'
    : undefined;

  const conditions: string[] = [];
  const params: unknown[] = [limit, offset];
  let idx = 3;

  if (role) {
    conditions.push(`role = $${idx++}`);
    params.push(role);
  }
  if (isActive !== undefined) {
    conditions.push(`is_active = $${idx++}`);
    params.push(isActive);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [users, countResult] = await Promise.all([
    query<{
      id: string; phone: string; email: string | null; role: string;
      is_verified: boolean; is_active: boolean; created_at: string;
    }>(
      `SELECT id, phone, email, role, is_verified, is_active, created_at
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM users ${whereClause}`,
      params.slice(2)
    ),
  ]);

  return {
    users: users.rows.map((u) => ({
      id: u.id,
      phone: u.phone,
      email: u.email,
      role: u.role,
      isVerified: u.is_verified,
      isActive: u.is_active,
      createdAt: u.created_at,
    })),
    total: parseInt(countResult.rows[0].count, 10),
    page,
    limit,
  };
}

export async function listIncidentsAdmin(queryParams: Record<string, unknown>): Promise<{
  incidents: unknown[]; total: number; page: number; limit: number;
}> {
  const { page, limit, offset } = parsePagination(queryParams);

  const [incidents, countResult] = await Promise.all([
    query(
      `SELECT ir.id, ir.session_id, ir.user_id, ir.summary, ir.severity, ir.created_at,
              u.phone AS user_phone
       FROM incident_reports ir
       JOIN users u ON u.id = ir.user_id
       ORDER BY ir.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    query<{ count: string }>('SELECT COUNT(*) AS count FROM incident_reports'),
  ]);

  return {
    incidents: incidents.rows,
    total: parseInt(countResult.rows[0].count, 10),
    page,
    limit,
  };
}

export async function listAiEvents(queryParams: Record<string, unknown>): Promise<{
  events: unknown[]; total: number; page: number; limit: number;
}> {
  const { page, limit, offset } = parsePagination(queryParams);
  const flaggedOnly = queryParams.flaggedOnly === 'true';

  const whereClause = flaggedOnly ? 'WHERE flagged_for_review = true' : '';

  const [events, countResult] = await Promise.all([
    query(
      `SELECT ae.*, u.phone AS user_phone
       FROM ai_events ae
       JOIN users u ON u.id = ae.user_id
       ${whereClause}
       ORDER BY ae.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ai_events ${whereClause}`
    ),
  ]);

  return {
    events: events.rows,
    total: parseInt(countResult.rows[0].count, 10),
    page,
    limit,
  };
}

export async function listAuditLogs(queryParams: Record<string, unknown>): Promise<{
  logs: unknown[]; total: number; page: number; limit: number;
}> {
  const { page, limit, offset } = parsePagination(queryParams);

  const [logs, countResult] = await Promise.all([
    query(
      `SELECT al.*, u.phone AS actor_phone
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_user_id
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    query<{ count: string }>('SELECT COUNT(*) AS count FROM audit_logs'),
  ]);

  return {
    logs: logs.rows,
    total: parseInt(countResult.rows[0].count, 10),
    page,
    limit,
  };
}

export { suspendUser };
