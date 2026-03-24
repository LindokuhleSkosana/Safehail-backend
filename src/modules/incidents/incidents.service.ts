import { query } from '../../config/db';
import { AppError } from '../../shared/middleware/error.middleware';
import { parsePagination } from '../../shared/types';
import { IncidentSeverity } from '../../shared/types';

export interface IncidentReport {
  id: string;
  sessionId: string | null;
  userId: string;
  summary: string;
  severity: IncidentSeverity;
  createdAt: string;
}

export async function listIncidents(
  userId: string,
  queryParams: Record<string, unknown>
): Promise<{ incidents: IncidentReport[]; total: number; page: number; limit: number }> {
  const { page, limit, offset } = parsePagination(queryParams);

  const [incidents, countResult] = await Promise.all([
    query<{
      id: string; session_id: string | null; user_id: string;
      summary: string; severity: IncidentSeverity; created_at: string;
    }>(
      `SELECT id, session_id, user_id, summary, severity, created_at
       FROM incident_reports
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
    query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM incident_reports WHERE user_id = $1',
      [userId]
    ),
  ]);

  return {
    incidents: incidents.rows.map(mapIncident),
    total: parseInt(countResult.rows[0].count, 10),
    page,
    limit,
  };
}

export async function getIncidentById(
  incidentId: string,
  userId: string
): Promise<IncidentReport> {
  const result = await query<{
    id: string; session_id: string | null; user_id: string;
    summary: string; severity: IncidentSeverity; created_at: string;
  }>(
    'SELECT id, session_id, user_id, summary, severity, created_at FROM incident_reports WHERE id = $1',
    [incidentId]
  );

  if (!result.rows[0]) {
    throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  }

  // Drivers can only see their own incidents; admins can see all
  if (result.rows[0].user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Not your incident');
  }

  return mapIncident(result.rows[0]);
}

function mapIncident(row: {
  id: string; session_id: string | null; user_id: string;
  summary: string; severity: IncidentSeverity; created_at: string;
}): IncidentReport {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    summary: row.summary,
    severity: row.severity,
    createdAt: row.created_at,
  };
}
