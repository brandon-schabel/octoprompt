/** 
 * File: packages/server/src/services/model-providers/providers/provider-key-service.ts
 * 
 * Converted from a class-based service to a more functional approach.
 * 
 * This service manages provider API keys in the database.
 */

import { schema } from "shared";
import { eq, db } from "@db";

const { providerKeys } = schema;

export type ProviderKey = schema.ProviderKey;

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
    const [newKey] = await db.insert(providerKeys)
      .values({
        provider: data.provider,
        key: data.key,
      })
      .returning();

    return newKey;
  }

  async function listKeys(): Promise<ProviderKey[]> {
    return db.select().from(providerKeys);
  }

  async function getKeyById(id: string): Promise<ProviderKey | null> {
    const [found] = await db
      .select()
      .from(providerKeys)
      .where(eq(providerKeys.id, id))
      .limit(1);

    return found || null;
  }

  async function updateKey(id: string, data: UpdateProviderKeyInput): Promise<ProviderKey | null> {
    const [updated] = await db.update(providerKeys)
      .set({
        ...(data.provider ? { provider: data.provider } : {}),
        ...(data.key ? { key: data.key } : {}),
        updatedAt: new Date(),
      })
      .where(eq(providerKeys.id, id))
      .returning();

    return updated || null;
  }

  async function deleteKey(id: string): Promise<boolean> {
    const [deleted] = await db.delete(providerKeys)
      .where(eq(providerKeys.id, id))
      .returning();

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