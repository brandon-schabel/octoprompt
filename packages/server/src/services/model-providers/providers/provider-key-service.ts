import { db } from "@/utils/database";
import { ProviderKey } from "shared/schema";
import { ProviderKeyReadSchema } from "shared/src/utils/database/db-schemas";

export type CreateProviderKeyInput = {
  provider: string;
  key: string;
};

export type UpdateProviderKeyInput = {
  provider?: string;
  key?: string;
};

function mapProviderKey(row: any): ProviderKey {
  const mapped = {
    id: row.id,
    provider: row.provider,
    key: row.key,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
  const validated = ProviderKeyReadSchema.parse(mapped);
  return {
    ...validated,
    createdAt: new Date(validated.createdAt),
    updatedAt: new Date(validated.updatedAt)
  };
}

/**
 * Returns an object of functions to create, list, update, and delete provider keys.
 */
export function createProviderKeyService() {
  async function createKey(data: CreateProviderKeyInput): Promise<ProviderKey> {
    const stmt = db.prepare(`
      INSERT INTO provider_keys (provider, key, created_at, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `);
    const created = stmt.get(data.provider, data.key);
    if (!created) {
      throw new Error('Failed to create provider key');
    }
    return mapProviderKey(created);
  }

  async function listKeys(): Promise<ProviderKey[]> {
    const stmt = db.prepare(`SELECT * FROM provider_keys`);
    const rows = stmt.all();
    return rows.map(mapProviderKey);
  }

  async function getKeyById(id: string): Promise<ProviderKey | null> {
    const stmt = db.prepare(`SELECT * FROM provider_keys WHERE id = ? LIMIT 1`);
    const found = stmt.get(id);
    if (!found) return null;
    return mapProviderKey(found);
  }

  async function updateKey(id: string, data: UpdateProviderKeyInput): Promise<ProviderKey | null> {
    const stmt = db.prepare(`
      UPDATE provider_keys 
      SET 
        provider = COALESCE(?, provider),
        key = COALESCE(?, key),
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
      RETURNING *
    `);
    const provider = data.provider ?? null;
    const key = data.key ?? null;
    const updated = stmt.get(provider, key, id);
    if (!updated) return null;
    return mapProviderKey(updated);
  }

  async function deleteKey(id: string): Promise<boolean> {
    const stmt = db.prepare(`DELETE FROM provider_keys WHERE id = ? RETURNING *`);
    const deleted = stmt.get(id);
    return !!deleted;
  }

  return {
    createKey,
    listKeys,
    getKeyById,
    updateKey,
    deleteKey,
  };
}

export const providerKeyService = createProviderKeyService();