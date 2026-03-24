import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../shared/utils/logger';
import { registerPresenceHandlers } from './handlers/presence.handler';
import { registerLocationHandlers } from './handlers/location.handler';
import { registerEmergencyHandlers } from './handlers/emergency.handler';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './socket.types';

let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function initSocketServer(httpServer: HttpServer): typeof io {
  io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: {
        origin: env.ALLOWED_ORIGINS.split(','),
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 30000,
      pingInterval: 10000,
      transports: ['websocket', 'polling'],
    }
  );

  // ── JWT auth middleware ──────────────────────────────────────────────────
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization as string)?.replace('Bearer ', '');

    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        sub: string;
        phone: string;
        role: string;
      };
      socket.data.userId = decoded.sub;
      socket.data.phone = decoded.phone;
      socket.data.role = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection handler ───────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const { userId } = socket.data;
    logger.debug('Socket connected', { userId, socketId: socket.id });

    // Auto-join user's private room
    socket.join(`driver:${userId}`);

    registerPresenceHandlers(socket);
    registerLocationHandlers(socket);
    registerEmergencyHandlers(socket, io);
  });

  logger.info('Socket.IO server initialized');
  return io;
}

export function getIO(): typeof io {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

// ── Helper to emit to a specific user's room ─────────────────────────────

export function emitToUser<K extends keyof ServerToClientEvents>(
  userId: string,
  event: K,
  ...args: Parameters<ServerToClientEvents[K]>
): void {
  getIO().to(`driver:${userId}`).emit(event, ...args);
}

export function emitToRoom<K extends keyof ServerToClientEvents>(
  room: string,
  event: K,
  ...args: Parameters<ServerToClientEvents[K]>
): void {
  getIO().to(room).emit(event, ...args);
}
