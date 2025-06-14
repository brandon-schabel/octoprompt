import type { IndexManager } from './index-manager'

/**
 * Common query utilities for storage classes
 */

/**
 * Query an index and fetch entities by their IDs
 */
export async function queryByIndex<T extends { id: number }>(
  indexManager: IndexManager,
  indexName: string,
  query: any,
  getById: (id: number) => Promise<T | null>,
  sorter?: (a: T, b: T) => number
): Promise<T[]> {
  const ids = await indexManager.query(indexName, query)
  const results: T[] = []
  
  for (const id of ids) {
    const item = await getById(id)
    if (item) results.push(item)
  }
  
  return sorter ? results.sort(sorter) : results
}

/**
 * Search multiple text indexes and combine results
 */
export async function searchByFields<T extends { id: number }>(
  indexManager: IndexManager,
  searchQuery: string,
  indexNames: string[],
  getById: (id: number) => Promise<T | null>,
  options?: {
    sorter?: (a: T, b: T) => number
    preferredIndex?: string // Results from this index get higher priority
  }
): Promise<T[]> {
  const allIds = new Set<number>()
  const preferredIds = new Set<number>()
  
  // Search all indexes
  for (const indexName of indexNames) {
    const ids = await indexManager.searchText(indexName, searchQuery)
    ids.forEach(id => {
      allIds.add(id)
      if (indexName === options?.preferredIndex) {
        preferredIds.add(id)
      }
    })
  }
  
  // Fetch all entities
  const results: T[] = []
  for (const id of allIds) {
    const item = await getById(id)
    if (item) results.push(item)
  }
  
  // Sort with preference
  if (options?.preferredIndex && preferredIds.size > 0) {
    results.sort((a, b) => {
      const aPreferred = preferredIds.has(a.id)
      const bPreferred = preferredIds.has(b.id)
      
      if (aPreferred && !bPreferred) return -1
      if (!aPreferred && bPreferred) return 1
      
      return options.sorter ? options.sorter(a, b) : 0
    })
  } else if (options?.sorter) {
    results.sort(options.sorter)
  }
  
  return results
}

/**
 * Get entities within a date range
 */
export async function getByDateRange<T extends { id: number }>(
  indexManager: IndexManager,
  indexName: string,
  start: Date,
  end: Date,
  getById: (id: number) => Promise<T | null>,
  sorter?: (a: T, b: T) => number
): Promise<T[]> {
  const ids = await indexManager.queryRange(
    indexName,
    start.getTime(),
    end.getTime()
  )
  
  const results: T[] = []
  for (const id of ids) {
    const item = await getById(id)
    if (item) results.push(item)
  }
  
  return sorter ? results.sort(sorter) : results
}

/**
 * Get recent entities with pagination
 */
export async function getRecentEntities<T extends { updated: number }>(
  entities: T[],
  limit: number = 20,
  offset: number = 0,
  sortField: keyof T = 'updated' as keyof T
): T[] {
  return entities
    .sort((a, b) => (b[sortField] as any) - (a[sortField] as any))
    .slice(offset, offset + limit)
}

/**
 * Group entities by a field value
 */
export function groupByField<T>(
  entities: T[],
  field: keyof T
): Map<any, T[]> {
  const groups = new Map<any, T[]>()
  
  for (const entity of entities) {
    const value = entity[field]
    if (!groups.has(value)) {
      groups.set(value, [])
    }
    groups.get(value)!.push(entity)
  }
  
  return groups
}

/**
 * Get unique values for a field
 */
export function getUniqueFieldValues<T, K extends keyof T>(
  entities: T[],
  field: K
): Set<T[K]> {
  const values = new Set<T[K]>()
  
  for (const entity of entities) {
    const value = entity[field]
    if (value !== undefined && value !== null) {
      values.add(value)
    }
  }
  
  return values
}

/**
 * Common sorters
 */
export const commonSorters = {
  byUpdatedDesc: <T extends { updated: number }>(a: T, b: T) => b.updated - a.updated,
  byCreatedDesc: <T extends { created: number }>(a: T, b: T) => b.created - a.created,
  byUpdatedAsc: <T extends { updated: number }>(a: T, b: T) => a.updated - b.updated,
  byCreatedAsc: <T extends { created: number }>(a: T, b: T) => a.created - b.created,
  byName: <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name),
  byPath: <T extends { path: string }>(a: T, b: T) => a.path.localeCompare(b.path)
}