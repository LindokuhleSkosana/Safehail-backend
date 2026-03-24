import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDB } from './config/db';
import { connectRedis } from './config/redis';
import { initFirebase } from './config/firebase';
import { initSocketServer } from './sockets/socket.server';
import { startEmergencyWorker } from './jobs/emergency.job';
import { startPresenceWorker } from './jobs/presence.job';
import { closeQueues } from './jobs/queue';
import { logger } from './shared/utils/logger';

const httpServer = http.createServer(app);

async function start(): Promise<void> {
  try {
    // ── External connections ─────────────────────────────────────────────
    await connectDB();
    await connectRedis();

    // ── Firebase (optional — degrades gracefully if not configured) ──────
    initFirebase();

    // ── Socket.IO ────────────────────────────────────────────────────────
    initSocketServer(httpServer);

    // ── Background workers ───────────────────────────────────────────────
    startEmergencyWorker();
    startPresenceWorker();

    // ── Start HTTP server ────────────────────────────────────────────────
    httpServer.listen(env.PORT, () => {
      logger.info(`SafeHail API running on port ${env.PORT}`, {
        env: env.NODE_ENV,
        port: env.PORT,
      });
    });
  } catch (err) {
    logger.error('Failed to start server', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    process.exit(1);
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully`);

  httpServer.close(async () => {
    logger.info('HTTP server closed');
    try {
      await closeQueues();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    }
  });

  // Force exit after 15 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 15_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

start();
