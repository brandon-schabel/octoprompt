import { db } from "@/utils/database";
import { CreateProviderKeyInputSchema, ProviderKey, ProviderKeySchema } from "shared/src/schemas/provider-key.schemas";
import { parseTimestamp } from "@/utils/parse-timestamp";

// Add a helper function to convert DB row to ProviderKey format
function mapDbRowToProviderKey(row: any): ProviderKey | null {
  if (!row) return null;


  const createdAtDate = parseTimestamp(row.created_at);
  const updatedAtDate = parseTimestamp(row.updated_at);

  if (!createdAtDate || !updatedAtDate) {
    console.warn(`Skipping row due to invalid or unparseable timestamp: ${JSON.stringify(row)}`);
    return null;
  }

  const mapped = {
    ...row,
    createdAt: createdAtDate.toISOString(),
    updatedAt: updatedAtDate.toISOString(),
  };
  delete mapped.created_at;
  delete mapped.updated_at;

  const parseResult = ProviderKeySchema.safeParse(mapped);
  if (!parseResult.success) {
    console.error(`Failed to parse provider key data: ${parseResult.error.message}`, mapped);
    return null;
  }
  return parseResult.data;
}

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
    const validatedInput = CreateProviderKeyInputSchema.parse(data); // Use the input schema here

    const stmt = db.prepare(`
      INSERT INTO provider_keys (provider, key, created_at, updated_at, id)
      VALUES (?, ?, unixepoch(), unixepoch(), lower(hex(randomblob(16)))) -- Use unixepoch() for integer timestamps
      RETURNING *
    `);
    const created = stmt.get(validatedInput.provider, validatedInput.key);
    if (!created) {
      throw new Error('Failed to create provider key or retrieve the created row.');
    }
    const result = mapDbRowToProviderKey(created);
    if (!result) {
      throw new Error('Failed to parse created provider key data after creation.'); // Adjusted error
    }
    return result;
  }

  async function listKeys(): Promise<ProviderKey[]> {
    const stmt = db.prepare(`SELECT * FROM provider_keys`);
    const rows = stmt.all();
    // Use the helper function, filter out nulls
    return rows.map(mapDbRowToProviderKey).filter((key): key is ProviderKey => key !== null);
  }

  async function getKeyById(id: string): Promise<ProviderKey | null> {
    const stmt = db.prepare(`SELECT * FROM provider_keys WHERE id = ? LIMIT 1`);
    const found = stmt.get(id);
    return mapDbRowToProviderKey(found);
  }

  async function updateKey(id: string, data: UpdateProviderKeyInput): Promise<ProviderKey | null> {
    const stmt = db.prepare(`
      UPDATE provider_keys
      SET
        provider = COALESCE(?, provider),
        key = COALESCE(?, key),
        updated_at = unixepoch() -- Use unixepoch() for integer timestamps
      WHERE id = ?
      RETURNING *
    `);
    const provider = data.provider ?? null;
    const key = data.key ?? null;
    const updated = stmt.get(provider, key, id);
    return mapDbRowToProviderKey(updated);
  }

  async function deleteKey(id: string): Promise<boolean> {
    const stmt = db.prepare(`DELETE FROM provider_keys WHERE id = ?`);
    const deletedInfo = stmt.run(id); // run() returns { changes, lastInsertRowid }
    return deletedInfo.changes > 0;
  }

  return {
    createKey: createKey,
    listKeys: listKeys,
    getKeyById: getKeyById,
    updateKey: updateKey,
    deleteKey: deleteKey,
  };
}

export const providerKeyService = createProviderKeyService();