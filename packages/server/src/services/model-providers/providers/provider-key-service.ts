import { schema } from "shared";
import { eq, db } from "@db";
const { providerKeys, } = schema;

type ProviderKey = schema.ProviderKey;


type CreateProviderKeyInput = {
  provider: string;
  key: string;
};

type UpdateProviderKeyInput = {
  provider?: string;
  key?: string;
};

export class ProviderKeyService {
  async createKey(data: CreateProviderKeyInput): Promise<ProviderKey> {
    const [newKey] = await db.insert(providerKeys)
      .values({
        provider: data.provider,
        key: data.key,
      })
      .returning();
    return newKey;
  }

  async listKeys(): Promise<ProviderKey[]> {
    return db.select().from(providerKeys);
  }

  async getKeyById(id: string): Promise<ProviderKey | null> {
    const [found] = await db.select().from(providerKeys).where(eq(providerKeys.id, id)).limit(1);
    return found || null;
  }

  async updateKey(id: string, data: UpdateProviderKeyInput): Promise<ProviderKey | null> {
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

  async deleteKey(id: string): Promise<boolean> {
    const [deleted] = await db.delete(providerKeys).where(eq(providerKeys.id, id)).returning();
    return !!deleted;
  }
}