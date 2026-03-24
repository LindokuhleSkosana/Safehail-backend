import { Queue, Worker, QueueOptions } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../shared/utils/logger';

const connection = {
  url: env.REDIS_URL,
};

const defaultQueueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
};

// ── Queue instances ─────────────────────────────────────────────────────────

export const emergencyQueue = new Queue('emergency', defaultQueueOptions);
export const notificationQueue = new Queue('notifications', defaultQueueOptions);
export const presenceQueue = new Queue('presence', defaultQueueOptions);

// ── Worker registry (call startWorkers() in server.ts) ──────────────────────

const workers: Worker[] = [];

export function registerWorker(worker: Worker): void {
  worker.on('completed', (job) => {
    logger.debug('Job completed', { queue: job.queueName, jobId: job.id, name: job.name });
  });
  worker.on('failed', (job, err) => {
    logger.error('Job failed', {
      queue: job?.queueName,
      jobId: job?.id,
      name: job?.name,
      error: err.message,
    });
  });
  workers.push(worker);
}

export async function closeQueues(): Promise<void> {
  await Promise.all([
    emergencyQueue.close(),
    notificationQueue.close(),
    presenceQueue.close(),
    ...workers.map((w) => w.close()),
  ]);
  logger.info('All queues and workers closed');
}
