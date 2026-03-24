export interface ServerToClientEvents {
  'emergency:new': (payload: EmergencyNewPayload) => void;
  'emergency:status_changed': (payload: EmergencyStatusChangedPayload) => void;
  'emergency:responder_accepted': (payload: ResponderAcceptedPayload) => void;
  'emergency:location_update': (payload: LocationUpdatePayload) => void;
  'responder:eta_update': (payload: EtaUpdatePayload) => void;
  'error': (payload: { code: string; message: string }) => void;
}

export interface ClientToServerEvents {
  'presence:go_online': (data: Record<string, never>, callback?: AckCallback) => void;
  'presence:go_offline': (data: Record<string, never>, callback?: AckCallback) => void;
  'location:update': (data: LocationUpdateData, callback?: AckCallback) => void;
  'emergency:location_update': (data: EmergencyLocationData, callback?: AckCallback) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  phone: string;
  role: string;
}

// ── Payload types ────────────────────────────────────────────────────────────

export interface EmergencyNewPayload {
  sessionId: string;
  sessionCode: string;
  userId: string;
  triggerType: string;
  latitude: number;
  longitude: number;
  address?: string;
  startedAt: string;
}

export interface EmergencyStatusChangedPayload {
  sessionId: string;
  status: string;
  updatedAt: string;
}

export interface ResponderAcceptedPayload {
  sessionId: string;
  responderUserId: string;
  acceptedAt: string;
}

export interface LocationUpdatePayload {
  sessionId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
}

export interface EtaUpdatePayload {
  sessionId: string;
  responderUserId: string;
  etaMinutes: number;
}

export interface LocationUpdateData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

export interface EmergencyLocationData {
  sessionId: string;
  latitude: number;
  longitude: number;
}

type AckCallback = (result: { ok: boolean; error?: string }) => void;
