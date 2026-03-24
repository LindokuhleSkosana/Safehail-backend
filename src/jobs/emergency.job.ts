import { Worker } from 'bullmq';
import { emergencyQueue, registerWorker } from './queue';
import { query } from '../config/db';
import { env } from '../config/env';
import { logger } from '../shared/utils/logger';

const TIMEOUT_MINUTES = 30;

export interface EmergencyTimeoutJobData {
  sessionId: string;
}

export async function scheduleEmergencyTimeout(sessionId: string): Promise<void> {
  await emergencyQueue.add(
    'emergency:timeout',
    { sessionId } satisfies EmergencyTimeoutJobData,
    {
      jobId: `timeout:${sessionId}`,
      delay: TIMEOUT_MINUTES * 60 * 1000,
    }
  );
  logger.debug('Emergency timeout job scheduled', { sessionId, minutes: TIMEOUT_MINUTES });
}

export async function cancelEmergencyTimeout(sessionId: string): Promise<void> {
  const job = await emergencyQueue.getJob(`timeout:${sessionId}`);
  if (job) {
    await job.remove();
    logger.debug('Emergency timeout job cancelled', { sessionId });
  }
}

export function startEmergencyWorker(): void {
  const worker = new Worker<EmergencyTimeoutJobData>(
    'emergency',
    async (job) => {
      if (job.name !== 'emergency:timeout') return;

      const { sessionId } = job.data;

      // Only time out if still in an active state
      const result = await query<{ status: string }>(
        'SELECT status FROM emergency_sessions WHERE id = $1',
        [sessionId]
      );

      if (!result.rows[0]) return;

      const activeStatuses = ['broadcasting', 'responder_joined', 'en_route', 'pending'];
      if (!activeStatuses.includes(result.rows[0].status)) {
        logger.debug('Emergency already resolved — skipping timeout', { sessionId });
        return;
      }

      await query(
        `UPDATE emergency_sessions
         SET status = 'timed_out', resolved_at = NOW()
         WHERE id = $1`,
        [sessionId]
      );

      logger.info('Emergency session timed out', { sessionId });

      // Audit log
      await query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
         VALUES ('emergency.timed_out', 'emergency_sessions', $1, $2)`,
        [sessionId, JSON.stringify({ reason: 'auto_timeout', minutes: TIMEOUT_MINUTES })]
      );
    },
    { connection: { url: env.REDIS_URL } }
  );

  registerWorker(worker);
  logger.info('Emergency worker started');
}
