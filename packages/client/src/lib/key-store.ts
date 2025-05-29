import { ProviderKey } from 'shared/src/schemas/provider-key.schemas';

// Re-define or import a simplified StoredKey type if ProviderKey is too complex or has API-specific parts
// For now, let's assume ProviderKey can be stored directly or we'll adapt it.
// If ProviderKey has methods or non-serializable parts, we'll need a plain object type.
export type StoredKey = ProviderKey; // Or a simpler version like { id: number; name: string; key: string; provider: string; createdAt?: string; updatedAt?: string; }

export interface IKeyStore {
    getAllKeys(): Promise<StoredKey[]>;
    getKeyById(id: number): Promise<StoredKey | null>;
    createKey(keyData: Omit<StoredKey, 'id' | 'created' | 'updated'> & Partial<Pick<StoredKey, 'id'>>): Promise<StoredKey>;
    updateKey(id: number, updates: Partial<Omit<StoredKey, 'id' | 'created' | 'updated'>>): Promise<StoredKey | null>;
    deleteKey(id: number): Promise<boolean>;
}

const LOCAL_STORAGE_PROVIDER_KEYS = 'providerApiKeys';

export class LocalStorageKeyStore implements IKeyStore {
    private generateId(): string {
        return `key_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
    }

    async getAllKeys(): Promise<StoredKey[]> {
        const itemsJson = localStorage.getItem(LOCAL_STORAGE_PROVIDER_KEYS);
        return itemsJson ? JSON.parse(itemsJson) : [];
    }

    async getKeyById(id: number): Promise<StoredKey | null> {
        const items = await this.getAllKeys();
        return items.find(item => item.id === id) || null;
    }

    async createKey(keyData: Omit<StoredKey, 'id' | 'created' | 'updated'> & Partial<Pick<StoredKey, 'id'>>): Promise<StoredKey> {
        const items = await this.getAllKeys();
        const newKey: StoredKey = {
            ...keyData,
            id: keyData.id || this.generateId(),
            // unix timestamp in milliseconds
            created: new Date().getTime(),
            updated: new Date().getTime(),
        } as StoredKey; // Cast needed if StoredKey has more non-optional fields from ProviderKey
        items.push(newKey);
        localStorage.setItem(LOCAL_STORAGE_PROVIDER_KEYS, JSON.stringify(items));
        return newKey;
    }

    async updateKey(id: number, updates: Partial<Omit<StoredKey, 'id' | 'created' | 'updated'>>): Promise<StoredKey | null> {
        const items = await this.getAllKeys();
        const itemIndex = items.findIndex(item => item.id === id);
        if (itemIndex === -1) {
            return null;
        }
        items[itemIndex] = {
            ...items[itemIndex],
            ...updates,
            updated: new Date().getTime(),
        };
        localStorage.setItem(LOCAL_STORAGE_PROVIDER_KEYS, JSON.stringify(items));
        return items[itemIndex];
    }

    async deleteKey(id: number): Promise<boolean> {
        let items = await this.getAllKeys();
        const initialLength = items.length;
        items = items.filter(item => item.id !== id);
        if (items.length < initialLength) {
            localStorage.setItem(LOCAL_STORAGE_PROVIDER_KEYS, JSON.stringify(items));
            return true;
        }
        return false;
    }
}

// Store Factory
let currentKeyStore: IKeyStore | null = null;

export function getKeyStoreInstance(): IKeyStore {
    if (!currentKeyStore) {
        // Defaulting to LocalStorageKeyStore as per the request
        currentKeyStore = new LocalStorageKeyStore();
        console.log("KeyStore initialized with LocalStorageKeyStore.");
    }
    return currentKeyStore;
}

// Optional: function to set a different store implementation (e.g., for API or testing)
// export function setKeyStoreImplementation(store: IKeyStore): void {
//   currentKeyStore = store;
// } 