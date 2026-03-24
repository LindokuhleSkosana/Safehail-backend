import { Socket } from 'socket.io';
import { setOnline, setOffline } from '../../modules/presence/presence.service';
import { logger } from '../../shared/utils/logger';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '../socket.types';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerPresenceHandlers(socket: AppSocket): void {
  const userId = socket.data.userId;

  socket.on('presence:go_online', async (_data, callback) => {
    try {
      await setOnline(userId, socket.id);
      socket.join(`driver:${userId}`);
      logger.debug('Socket: driver online', { userId, socketId: socket.id });
      callback?.({ ok: true });
    } catch (err) {
      logger.error('presence:go_online error', { userId, error: (err as Error).message });
      callback?.({ ok: false, error: 'Failed to go online' });
    }
  });

  socket.on('presence:go_offline', async (_data, callback) => {
    try {
      await setOffline(userId);
      socket.leave(`driver:${userId}`);
      logger.debug('Socket: driver offline', { userId });
      callback?.({ ok: true });
    } catch (err) {
      logger.error('presence:go_offline error', { userId, error: (err as Error).message });
      callback?.({ ok: false, error: 'Failed to go offline' });
    }
  });

  socket.on('disconnect', async () => {
    try {
      await setOffline(userId);
      logger.debug('Socket: driver disconnected', { userId, socketId: socket.id });
    } catch (err) {
      logger.error('Socket disconnect cleanup error', { userId, error: (err as Error).message });
    }
  });
}
