import { db } from "@/utils/database";
import { CreateProviderKeyInputSchema, ProviderKey, ProviderKeySchema, UpdateProviderKeyInput } from "shared/src/schemas/provider-key.schemas";
import { parseTimestamp } from "@/utils/parse-timestamp";
import { ApiError } from "shared";
import { z } from "@hono/zod-openapi";

// Add a helper function to convert DB row to ProviderKey format
function mapDbRowToProviderKey(row: any): ProviderKey | null {
  if (!row) return null;

  const createdAtDate = parseTimestamp(row.created_at);
  const updatedAtDate = parseTimestamp(row.updated_at);

  if (!createdAtDate || !updatedAtDate) {
    console.warn(`Skipping provider key row due to invalid or unparseable timestamp: ${JSON.stringify(row)}`);
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
    console.error(`Failed to parse provider key data: ${parseResult.error.message}`, { rawData: row, mappedData: mapped, error: parseResult.error.flatten() });
    return null;
  }
  return parseResult.data;
}

export type CreateProviderKeyInput = z.infer<typeof CreateProviderKeyInputSchema>;

/**
 * Returns an object of functions to create, list, update, and delete provider keys.
 */
export function createProviderKeyService() {
  async function createKey(data: CreateProviderKeyInput): Promise<ProviderKey> {
    const stmt = db.prepare(`
      INSERT INTO provider_keys (provider, key, created_at, updated_at, id)
      VALUES (?, ?, unixepoch(), unixepoch(), lower(hex(randomblob(16))))
      RETURNING *
    `);
    const createdRow = stmt.get(data.provider, data.key) as any;
    if (!createdRow) {
      throw new ApiError(500, 'Failed to create provider key: database did not return created row.', 'DB_CREATE_FAILED');
    }
    const result = mapDbRowToProviderKey(createdRow);
    if (!result) {
      throw new ApiError(500, 'Failed to parse newly created provider key data. Data integrity issue.', 'PROVIDER_KEY_CREATE_PARSE_FAILED', { createdRow });
    }
    return result;
  }

  async function listKeys(): Promise<ProviderKey[]> {
    const stmt = db.prepare(`SELECT * FROM provider_keys ORDER BY provider, created_at DESC`);
    const rows = stmt.all() as any[];
    
    const results = rows.map(row => {
        const key = mapDbRowToProviderKey(row);
        if (!key) {
            console.error('Failed to parse a provider key during list operation. Skipping row.', { row });
        }
        return key;
    }).filter((key): key is ProviderKey => key !== null);
    
    return results;
  }

  async function getKeyById(id: string): Promise<ProviderKey> {
    const stmt = db.prepare(`SELECT * FROM provider_keys WHERE id = ? LIMIT 1`);
    const foundRow = stmt.get(id) as any;
    if (!foundRow) {
      throw new ApiError(404, `Provider key with ID ${id} not found.`, 'PROVIDER_KEY_NOT_FOUND');
    }
    const result = mapDbRowToProviderKey(foundRow);
    if (!result) {
      throw new ApiError(500, `Failed to parse provider key data for ID ${id}. Data integrity issue.`, 'PROVIDER_KEY_PARSE_FAILED', { id, foundRow });
    }
    return result;
  }

  async function updateKey(id: string, data: UpdateProviderKeyInput): Promise<ProviderKey> {
    const stmt = db.prepare(`
      UPDATE provider_keys
      SET
        provider = COALESCE(?, provider),
        key = COALESCE(?, key),
        updated_at = unixepoch()
      WHERE id = ?
      RETURNING *
    `);
    const provider = data.provider ?? null;
    const key = data.key ?? null;
    const updatedRow = stmt.get(provider, key, id) as any;

    if (!updatedRow) {
      throw new ApiError(404, `Provider key with ID ${id} not found for update.`, 'PROVIDER_KEY_NOT_FOUND_FOR_UPDATE');
    }
    const result = mapDbRowToProviderKey(updatedRow);
    if (!result) {
      throw new ApiError(500, `Failed to parse updated provider key data for ID ${id}. Data integrity issue.`, 'PROVIDER_KEY_UPDATE_PARSE_FAILED', { id, updatedRow });
    }
    return result;
  }

  async function deleteKey(id: string): Promise<void> {
    const stmt = db.prepare(`DELETE FROM provider_keys WHERE id = ?`);
    const deletedInfo = stmt.run(id);
    if (deletedInfo.changes === 0) {
      throw new ApiError(404, `Provider key with ID ${id} not found for deletion.`, 'PROVIDER_KEY_NOT_FOUND_FOR_DELETE');
    }
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