import { Socket } from 'socket.io';
import { updateLocation } from '../../modules/location/location.service';
import { logger } from '../../shared/utils/logger';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '../socket.types';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerLocationHandlers(socket: AppSocket): void {
  const userId = socket.data.userId;

  socket.on('location:update', async (data, callback) => {
    try {
      if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
        callback?.({ ok: false, error: 'Invalid coordinates' });
        return;
      }

      await updateLocation({
        userId,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        heading: data.heading,
        speed: data.speed,
      });

      callback?.({ ok: true });
    } catch (err) {
      logger.error('location:update error', { userId, error: (err as Error).message });
      callback?.({ ok: false, error: 'Location update failed' });
    }
  });
}
