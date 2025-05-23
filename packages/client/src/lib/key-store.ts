import { ProviderKey } from '@/generated/types.gen';

// Re-define or import a simplified StoredKey type if ProviderKey is too complex or has API-specific parts
// For now, let's assume ProviderKey can be stored directly or we'll adapt it.
// If ProviderKey has methods or non-serializable parts, we'll need a plain object type.
export type StoredKey = ProviderKey; // Or a simpler version like { id: string; name: string; key: string; provider: string; createdAt?: string; updatedAt?: string; }

export interface IKeyStore {
    getAllKeys(): Promise<StoredKey[]>;
    getKeyById(id: string): Promise<StoredKey | null>;
    createKey(keyData: Omit<StoredKey, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<StoredKey, 'id'>>): Promise<StoredKey>;
    updateKey(id: string, updates: Partial<Omit<StoredKey, 'id' | 'createdAt' | 'updatedAt'>>): Promise<StoredKey | null>;
    deleteKey(id: string): Promise<boolean>;
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

    async getKeyById(id: string): Promise<StoredKey | null> {
        const items = await this.getAllKeys();
        return items.find(item => item.id === id) || null;
    }

    async createKey(keyData: Omit<StoredKey, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<StoredKey, 'id'>>): Promise<StoredKey> {
        const items = await this.getAllKeys();
        const newKey: StoredKey = {
            ...keyData,
            id: keyData.id || this.generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        } as StoredKey; // Cast needed if StoredKey has more non-optional fields from ProviderKey
        items.push(newKey);
        localStorage.setItem(LOCAL_STORAGE_PROVIDER_KEYS, JSON.stringify(items));
        return newKey;
    }

    async updateKey(id: string, updates: Partial<Omit<StoredKey, 'id' | 'createdAt' | 'updatedAt'>>): Promise<StoredKey | null> {
        const items = await this.getAllKeys();
        const itemIndex = items.findIndex(item => item.id === id);
        if (itemIndex === -1) {
            return null;
        }
        items[itemIndex] = {
            ...items[itemIndex],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(LOCAL_STORAGE_PROVIDER_KEYS, JSON.stringify(items));
        return items[itemIndex];
    }

    async deleteKey(id: string): Promise<boolean> {
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