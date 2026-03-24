import { Worker } from 'bullmq';
import { presenceQueue, registerWorker } from './queue';
import { query } from '../config/db';
import { env } from '../config/env';
import { logger } from '../shared/utils/logger';

// Mark drivers as offline if last_seen_at is older than 5 minutes
const STALE_THRESHOLD_MINUTES = 5;

export function startPresenceWorker(): void {
  // Schedule a repeating cleanup job
  presenceQueue.add(
    'presence:cleanup',
    {},
    {
      repeat: { every: 60 * 1000 }, // every minute
      jobId: 'presence:cleanup:recurring',
    }
  ).catch((err) => logger.error('Failed to schedule presence cleanup', { error: err.message }));

  const worker = new Worker(
    'presence',
    async (job) => {
      if (job.name !== 'presence:cleanup') return;

      const result = await query(
        `UPDATE driver_presence
         SET is_online = false, updated_at = NOW()
         WHERE is_online = true
           AND last_seen_at < NOW() - INTERVAL '${STALE_THRESHOLD_MINUTES} minutes'
         RETURNING user_id`
      );

      if (result.rowCount > 0) {
        logger.info('Cleaned stale presence records', { count: result.rowCount });
      }
    },
    { connection: { url: env.REDIS_URL } }
  );

  registerWorker(worker);
  logger.info('Presence worker started');
}
