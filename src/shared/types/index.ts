import { Request } from 'express';

export type UserRole = 'driver' | 'admin' | 'support';

export interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  isVerified: boolean;
}

export interface AuthRequest extends Request {
  user: AuthUser;
}

export type Platform = 'android' | 'ios';
export type RidePlatform = 'uber' | 'bolt' | 'other';
export type SubscriptionPlan = 'monthly' | 'annual';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';

export type EmergencyTriggerType = 'manual' | 'voice' | 'gesture' | 'hidden';
export type EmergencyStatus =
  | 'pending'
  | 'broadcasting'
  | 'responder_joined'
  | 'en_route'
  | 'arrived'
  | 'resolved'
  | 'cancelled'
  | 'timed_out';

export type ResponderStatus = 'notified' | 'accepted' | 'declined' | 'en_route' | 'arrived' | 'withdrew';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AiEventType = 'voice_trigger' | 'gesture_trigger' | 'anomaly';

export type NotificationDeliveryStatus = 'sent' | 'failed' | 'delivered';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10)));
  return { page, limit, offset: (page - 1) * limit };
}
