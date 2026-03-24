import { query } from '../../config/db';
import { AppError } from '../../shared/middleware/error.middleware';
import { logger } from '../../shared/utils/logger';
import { AiEventType } from '../../shared/types';

export interface IngestAiEventInput {
  userId: string;
  eventType: AiEventType;
  rawSignal?: Record<string, unknown>;
  confidence?: number;
  actionTaken?: string;
}

export interface AiEvent {
  id: string;
  userId: string;
  eventType: AiEventType;
  rawSignal: Record<string, unknown> | null;
  confidence: number | null;
  actionTaken: string | null;
  flaggedForReview: boolean;
  createdAt: string;
}

export interface FeatureFlag {
  flagKey: string;
  enabled: boolean;
  rolloutPercentage: number;
  description: string | null;
}

export async function ingestEvent(input: IngestAiEventInput): Promise<AiEvent> {
  const { userId, eventType, rawSignal, confidence, actionTaken } = input;

  // Check if the relevant feature flag is enabled for this user
  const flagKey = eventTypeToFlagKey(eventType);
  const isEnabled = await isFlagEnabledForUser(flagKey, userId);

  if (!isEnabled) {
    throw new AppError(
      403,
      'FEATURE_DISABLED',
      `AI feature '${flagKey}' is not enabled for your account`
    );
  }

  // Flag for review if confidence is high or event type is critical
  const flaggedForReview = (confidence ?? 0) >= 0.95 || eventType === 'anomaly';

  const result = await query<{
    id: string; user_id: string; event_type: AiEventType; raw_signal: Record<string, unknown> | null;
    confidence: number | null; action_taken: string | null; flagged_for_review: boolean; created_at: string;
  }>(
    `INSERT INTO ai_events (user_id, event_type, raw_signal, confidence, action_taken, flagged_for_review)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userId,
      eventType,
      rawSignal ? JSON.stringify(rawSignal) : null,
      confidence ?? null,
      actionTaken ?? null,
      flaggedForReview,
    ]
  );

  logger.info('AI event ingested', {
    userId,
    eventType,
    confidence,
    flaggedForReview,
    eventId: result.rows[0].id,
  });

  return mapEvent(result.rows[0]);
}

export async function getFeatureFlags(userId: string): Promise<FeatureFlag[]> {
  const result = await query<{
    flag_key: string; enabled: boolean; rollout_percentage: number; description: string | null;
  }>('SELECT flag_key, enabled, rollout_percentage, description FROM ai_feature_flags ORDER BY flag_key');

  // Determine per-user enablement based on rollout percentage
  return result.rows.map((flag) => ({
    flagKey: flag.flag_key,
    enabled: isUserInRollout(userId, flag.flag_key, flag.rollout_percentage) && flag.enabled,
    rolloutPercentage: flag.rollout_percentage,
    description: flag.description,
  }));
}

async function isFlagEnabledForUser(flagKey: string, userId: string): Promise<boolean> {
  const result = await query<{ enabled: boolean; rollout_percentage: number }>(
    'SELECT enabled, rollout_percentage FROM ai_feature_flags WHERE flag_key = $1',
    [flagKey]
  );

  if (!result.rows[0] || !result.rows[0].enabled) return false;
  return isUserInRollout(userId, flagKey, result.rows[0].rollout_percentage);
}

function isUserInRollout(userId: string, flagKey: string, percentage: number): boolean {
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;
  // Deterministic hash-based rollout — same user always gets same result
  const hash = userId
    .split('')
    .reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
  const bucket = hash % 100;
  return bucket < percentage;
}

function eventTypeToFlagKey(eventType: AiEventType): string {
  const map: Record<AiEventType, string> = {
    voice_trigger: 'voice_trigger_detection',
    gesture_trigger: 'gesture_detection',
    anomaly: 'anomaly_detection',
  };
  return map[eventType];
}

function mapEvent(row: {
  id: string; user_id: string; event_type: AiEventType; raw_signal: Record<string, unknown> | null;
  confidence: number | null; action_taken: string | null; flagged_for_review: boolean; created_at: string;
}): AiEvent {
  return {
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    rawSignal: row.raw_signal,
    confidence: row.confidence,
    actionTaken: row.action_taken,
    flaggedForReview: row.flagged_for_review,
    createdAt: row.created_at,
  };
}
