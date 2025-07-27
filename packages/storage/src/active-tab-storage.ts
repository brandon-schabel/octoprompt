import { type ActiveTab, activeTabSchema } from '@promptliano/schemas'
import { StorageV2 } from './storage-v2'
import { SQLiteDbManagerAdapter } from './sqlite-db-manager-adapter'

// Create storage instance for active tabs
export const activeTabStorage = new StorageV2<ActiveTab>({
  adapter: new SQLiteDbManagerAdapter('active_tabs'),
  indexes: [
    { field: 'id', type: 'hash' },
    { field: 'data.projectId', type: 'hash' }, // hash index for fast project lookups
    { field: 'updated', type: 'btree' }
  ],
  cache: {
    maxSize: 50,
    ttl: 60000 // 1 minute - shorter TTL since active tab changes frequently
  },
  schema: activeTabSchema
})
