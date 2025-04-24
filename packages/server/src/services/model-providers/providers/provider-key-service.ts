import { db } from "@/utils/database";
import { ProviderKey, ProviderKeySchema } from "shared/src/schemas/provider-key.schemas";

export type CreateProviderKeyInput = {
  provider: string;
  key: string;
};

export type UpdateProviderKeyInput = {
  provider?: string;
  key?: string;
};


/**
 * Returns an object of functions to create, list, update, and delete provider keys.
 */
export function createProviderKeyService() {
  async function createKey(data: CreateProviderKeyInput): Promise<ProviderKey> {
    const stmt = db.prepare(`
      INSERT INTO provider_keys (provider, key, created_at, updated_at, id)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, lower(hex(randomblob(16))))
      RETURNING *
    `);
    const created = stmt.get(data.provider, data.key);
    if (!created) {
      throw new Error('Failed to create provider key');
    }
    return ProviderKeySchema.parse(created);
  }

  async function listKeys(): Promise<ProviderKey[]> {
    const stmt = db.prepare(`SELECT * FROM provider_keys`);
    const rows = stmt.all();
    // return rows.map(ProviderKeySchema.parse);
    return rows.map((row: any) => ProviderKeySchema.parse(row));
  }

  async function getKeyById(id: string): Promise<ProviderKey | null> {
    const stmt = db.prepare(`SELECT * FROM provider_keys WHERE id = ? LIMIT 1`);
    const found = stmt.get(id);
    if (!found) return null;
    return ProviderKeySchema.parse(found);
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
    return ProviderKeySchema.parse(updated);
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