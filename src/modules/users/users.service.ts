import { query } from '../../config/db';
import { AppError } from '../../shared/middleware/error.middleware';

export interface UserPublic {
  id: string;
  phone: string;
  email: string | null;
  role: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export async function getUserById(userId: string): Promise<UserPublic> {
  const result = await query<{
    id: string;
    phone: string;
    email: string | null;
    role: string;
    is_verified: boolean;
    is_active: boolean;
    created_at: string;
  }>(
    'SELECT id, phone, email, role, is_verified, is_active, created_at FROM users WHERE id = $1',
    [userId]
  );

  if (!result.rows[0]) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const u = result.rows[0];
  return {
    id: u.id,
    phone: u.phone,
    email: u.email,
    role: u.role,
    isVerified: u.is_verified,
    isActive: u.is_active,
    createdAt: u.created_at,
  };
}

export async function suspendUser(userId: string, actorId: string): Promise<void> {
  const result = await query(
    'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
    [userId]
  );
  if (result.rowCount === 0) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  await query(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id)
     VALUES ($1, 'user.suspend', 'users', $2)`,
    [actorId, userId]
  );
}
