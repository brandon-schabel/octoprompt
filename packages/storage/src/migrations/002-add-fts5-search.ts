import type { Database } from 'bun:sqlite'
import { DatabaseManager } from '../database-manager'

/**
 * Migration to add FTS5 full-text search capabilities for fast file searching
 */
export const addFTS5SearchMigration = {
  version: 2,
  description: 'Add FTS5 full-text search tables and indexes for fast semantic file search',
  
  up: (db: Database) => {
    // Create FTS5 virtual table for file content search
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS file_search_fts USING fts5(
        file_id UNINDEXED,
        project_id UNINDEXED,
        path,
        name,
        extension UNINDEXED,
        content,
        summary,
        keywords,
        tokenize = 'porter unicode61 remove_diacritics 2'
      )
    `)

    // Create table for TF-IDF vectors and semantic metadata
    db.exec(`
      CREATE TABLE IF NOT EXISTS file_search_metadata (
        file_id TEXT PRIMARY KEY,
        project_id INTEGER NOT NULL,
        tf_idf_vector BLOB,
        keyword_vector TEXT,
        last_indexed INTEGER NOT NULL,
        file_size INTEGER,
        token_count INTEGER,
        language TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Create indexes for fast lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_file_search_metadata_project 
      ON file_search_metadata(project_id)
    `)
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_file_search_metadata_indexed 
      ON file_search_metadata(last_indexed)
    `)

    // Create search cache table
    db.exec(`
      CREATE TABLE IF NOT EXISTS search_cache (
        cache_key TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        project_id INTEGER NOT NULL,
        results TEXT NOT NULL,
        score_data TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        hit_count INTEGER DEFAULT 0
      )
    `)

    // Create index for cache cleanup
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_search_cache_expires 
      ON search_cache(expires_at)
    `)

    // Create keyword extraction table
    db.exec(`
      CREATE TABLE IF NOT EXISTS file_keywords (
        file_id TEXT NOT NULL,
        keyword TEXT NOT NULL,
        frequency INTEGER NOT NULL,
        tf_score REAL NOT NULL,
        idf_score REAL,
        PRIMARY KEY (file_id, keyword)
      )
    `)

    // Create indexes for keyword lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_file_keywords_keyword 
      ON file_keywords(keyword)
    `)
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_file_keywords_file 
      ON file_keywords(file_id)
    `)

    // Create trigram index for fuzzy matching
    db.exec(`
      CREATE TABLE IF NOT EXISTS file_trigrams (
        trigram TEXT NOT NULL,
        file_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (trigram, file_id, position)
      )
    `)

    // Create index for trigram lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_file_trigrams_file 
      ON file_trigrams(file_id)
    `)

    console.log('[Migration] FTS5 search tables and indexes created successfully')
  },

  down: (db: Database) => {
    // Drop all created tables and indexes
    db.exec(`DROP TABLE IF EXISTS file_search_fts`)
    db.exec(`DROP TABLE IF EXISTS file_search_metadata`)
    db.exec(`DROP TABLE IF EXISTS search_cache`)
    db.exec(`DROP TABLE IF EXISTS file_keywords`)
    db.exec(`DROP TABLE IF EXISTS file_trigrams`)
    
    console.log('[Migration] FTS5 search tables removed')
  }
}