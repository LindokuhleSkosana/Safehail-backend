import { query } from '../../config/db';
import { AppError } from '../../shared/middleware/error.middleware';

const MAX_CONTACTS = 5;

export interface TrustedContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship: string | null;
  notifyOnEmergency: boolean;
  createdAt: string;
}

export interface CreateContactInput {
  userId: string;
  name: string;
  phone: string;
  relationship?: string;
  notifyOnEmergency?: boolean;
}

export async function listContacts(userId: string): Promise<TrustedContact[]> {
  const result = await query<{
    id: string; user_id: string; name: string; phone: string;
    relationship: string | null; notify_on_emergency: boolean; created_at: string;
  }>(
    'SELECT * FROM trusted_contacts WHERE user_id = $1 ORDER BY created_at',
    [userId]
  );
  return result.rows.map(mapContact);
}

export async function createContact(input: CreateContactInput): Promise<TrustedContact> {
  const count = await query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM trusted_contacts WHERE user_id = $1',
    [input.userId]
  );

  if (parseInt(count.rows[0].count, 10) >= MAX_CONTACTS) {
    throw new AppError(
      409,
      'MAX_CONTACTS_REACHED',
      `You can only have up to ${MAX_CONTACTS} trusted contacts`
    );
  }

  const result = await query<{
    id: string; user_id: string; name: string; phone: string;
    relationship: string | null; notify_on_emergency: boolean; created_at: string;
  }>(
    `INSERT INTO trusted_contacts (user_id, name, phone, relationship, notify_on_emergency)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.userId,
      input.name,
      input.phone,
      input.relationship ?? null,
      input.notifyOnEmergency ?? true,
    ]
  );

  return mapContact(result.rows[0]);
}

export async function updateContact(
  contactId: string,
  userId: string,
  updates: Partial<Omit<CreateContactInput, 'userId'>>
): Promise<TrustedContact> {
  const existing = await query<{ id: string }>(
    'SELECT id FROM trusted_contacts WHERE id = $1 AND user_id = $2',
    [contactId, userId]
  );
  if (!existing.rows[0]) {
    throw new AppError(404, 'CONTACT_NOT_FOUND', 'Trusted contact not found');
  }

  const result = await query<{
    id: string; user_id: string; name: string; phone: string;
    relationship: string | null; notify_on_emergency: boolean; created_at: string;
  }>(
    `UPDATE trusted_contacts
     SET
       name                = COALESCE($3, name),
       phone               = COALESCE($4, phone),
       relationship        = COALESCE($5, relationship),
       notify_on_emergency = COALESCE($6, notify_on_emergency)
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [
      contactId,
      userId,
      updates.name ?? null,
      updates.phone ?? null,
      updates.relationship ?? null,
      updates.notifyOnEmergency ?? null,
    ]
  );

  return mapContact(result.rows[0]);
}

export async function deleteContact(contactId: string, userId: string): Promise<void> {
  const result = await query(
    'DELETE FROM trusted_contacts WHERE id = $1 AND user_id = $2',
    [contactId, userId]
  );
  if (result.rowCount === 0) {
    throw new AppError(404, 'CONTACT_NOT_FOUND', 'Trusted contact not found');
  }
}

function mapContact(row: {
  id: string; user_id: string; name: string; phone: string;
  relationship: string | null; notify_on_emergency: boolean; created_at: string;
}): TrustedContact {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    phone: row.phone,
    relationship: row.relationship,
    notifyOnEmergency: row.notify_on_emergency,
    createdAt: row.created_at,
  };
}
