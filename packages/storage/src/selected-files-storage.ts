import { type SelectedFiles, selectedFilesSchema } from '@octoprompt/schemas'
import { StorageV2 } from './storage-v2'
import { SQLiteDbManagerAdapter } from './sqlite-db-manager-adapter'

// Create storage instance for selected files
export const selectedFilesStorage = new StorageV2<SelectedFiles>({
  adapter: new SQLiteDbManagerAdapter('selected_files'),
  indexes: [
    { field: 'id', type: 'hash' },
    { field: 'data.projectId', type: 'btree' },
    { field: 'updated', type: 'btree' }
  ],
  cache: {
    maxSize: 100,
    ttl: 300000 // 5 minutes
  },
  schema: selectedFilesSchema
})
