import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import 'express-async-errors';

import { env } from './config/env';
import { logger } from './shared/utils/logger';
import { generalRateLimit } from './shared/middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './shared/middleware/error.middleware';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import driversRoutes from './modules/drivers/drivers.routes';
import presenceRoutes from './modules/presence/presence.routes';
import locationRoutes from './modules/location/location.routes';
import emergencyRoutes from './modules/emergency/emergency.routes';
import respondersRoutes from './modules/responders/responders.routes';
import trustedContactsRoutes from './modules/trusted-contacts/trusted-contacts.routes';
import subscriptionsRoutes from './modules/subscriptions/subscriptions.routes';
import incidentsRoutes from './modules/incidents/incidents.routes';
import aiEventsRoutes from './modules/ai-events/ai-events.routes';
import adminRoutes from './modules/admin/admin.routes';

const app = express();

// ── Security headers ──────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production',
  })
);

// ── CORS ─────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })
);

// ── Compression ───────────────────────────────────────────────────────────
app.use(compression());

// ── Raw body capture (for webhook signature verification) ──────────────────
app.use(
  '/api/v1/subscriptions/revenuecat-webhook',
  express.raw({ type: 'application/json' }),
  (req: Request & { rawBody?: string }, _res: Response, next) => {
    req.rawBody = req.body.toString('utf8');
    next();
  }
);

// ── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ── HTTP request logging ──────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.http(msg.trim()) },
      skip: (req) => req.url === '/health',
    })
  );
}

// ── General rate limit ────────────────────────────────────────────────────
app.use('/api', generalRateLimit);

// ── Health check (no auth, no rate limit) ────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
    env: env.NODE_ENV,
  });
});

// ── API routes ────────────────────────────────────────────────────────────
const API = '/api/v1';

app.use(`${API}/auth`, authRoutes);
app.use(`${API}/drivers`, driversRoutes);
app.use(`${API}/presence`, presenceRoutes);
app.use(`${API}/location`, locationRoutes);
app.use(`${API}/emergency`, emergencyRoutes);
app.use(`${API}/responders`, respondersRoutes);
app.use(`${API}/trusted-contacts`, trustedContactsRoutes);
app.use(`${API}/subscriptions`, subscriptionsRoutes);
app.use(`${API}/incidents`, incidentsRoutes);
app.use(`${API}/ai`, aiEventsRoutes);
app.use(`${API}/admin`, adminRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ── Global error handler ──────────────────────────────────────────────────
app.use(errorHandler);

export default app;
