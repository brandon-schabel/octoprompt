# File Services Architecture

This directory contains the unified file services system that powers Promptliano's file synchronization, search, and suggestion capabilities. The system is designed for performance, accuracy, and token efficiency.

## Overview

The file services system consists of several key components:

- **File Sync Service**: Unified service for watching, syncing, and managing project files
- **File Search Service**: Fast semantic search using FTS5, TF-IDF, and intelligent caching
- **File Relevance Service**: Relevance scoring for file suggestions based on tickets/tasks
- **File Indexing Service**: Indexing pipeline for fast semantic search capabilities
- **File Suggestion Strategy Service**: Token-optimized AI-powered file suggestions

## Core Services

### File Sync Service (`file-sync-service-unified.ts`)

The unified file sync service combines multiple file management capabilities:

**Key Features:**

- Real-time file watching with change detection
- Batch file synchronization with checksums
- Ignore patterns (.gitignore integration)
- Code analysis (imports/exports)
- Content truncation for large files
- Automatic search indexing

**Core Functions:**

```typescript
// Sync entire project
await syncProject(project)

// Sync specific folder
await syncProjectFolder(project, 'src/components')

// File watching
const plugin = createFileChangePlugin()
await plugin.start(project)

// Watchers management
const manager = createWatchersManager()
await manager.startWatchingProject(project)
```

**Sync Process:**

1. Load ignore rules (.gitignore + defaults)
2. Scan filesystem for text files
3. Compare with database records using checksums
4. Batch create/update/delete operations
5. Index new/updated files for search
6. Remove deleted files from search index

### File Search Service (`file-search-service.ts`)

Sub-millisecond file search with multiple search modes:

**Search Types:**

- **Semantic**: TF-IDF + FTS5 with keyword extraction
- **Exact**: Precise string matching
- **Fuzzy**: Trigram-based fuzzy matching
- **Regex**: Pattern-based search

**Performance Features:**

- 5-minute intelligent caching
- FTS5 virtual tables for fast full-text search
- Batch indexing and processing
- Token count optimization

**Usage:**

```typescript
// Search by query
const results = await fileSearchService.search(projectId, {
  query: 'authentication',
  searchType: 'semantic',
  limit: 20
})

// Search by ticket context
const results = await fileSearchService.searchByTicket(ticket)

// Search by keywords
const results = await fileSearchService.searchByKeywords(projectId, ['login', 'auth', 'user'])
```

### File Relevance Service (`file-relevance-service.ts`)

Multi-factor relevance scoring for intelligent file suggestions:

**Scoring Factors:**

- **Keyword Score (40%)**: Text matching with ticket content
- **Path Score (20%)**: Path-based relevance
- **Type Score (15%)**: File type associations
- **Recency Score (15%)**: Recent modification bonus
- **Import Score (10%)**: Import relationship analysis

**Configuration:**

```typescript
const config = {
  weights: {
    keyword: 0.4,
    path: 0.2,
    type: 0.15,
    recency: 0.15,
    import: 0.1
  },
  maxFiles: 100,
  minScore: 0.1
}

fileRelevanceService.updateConfig(config)
```

### File Indexing Service (`file-indexing-service.ts`)

Handles the indexing pipeline for fast search:

**Index Components:**

- **FTS5 Table**: Full-text search with porter stemming
- **Metadata Table**: TF-IDF vectors and file metadata
- **Keywords Table**: Extracted keywords with scores
- **Trigrams Table**: For fuzzy search support

**Indexing Process:**

```typescript
// Index single file
await fileIndexingService.indexFile(file, forceReindex)

// Batch index files
const result = await fileIndexingService.indexFiles(files)
// Returns: { indexed: 45, skipped: 12, failed: 0 }

// Get indexing stats
const stats = await fileIndexingService.getIndexingStats(projectId)
```

### File Suggestion Strategy Service (`file-suggestion-strategy-service.ts`)

Token-optimized file suggestions with multiple strategies:

**Strategies:**

- **Fast**: Pure relevance scoring (no AI, ultra-compact format)
- **Balanced**: Pre-filter + AI refinement (medium model, compact format)
- **Thorough**: Comprehensive analysis (high model, standard format)

**Token Optimization:**

- 60-70% token reduction compared to XML format
- Compact JSON representations
- Pre-filtering reduces AI processing load

**Usage:**

```typescript
const response = await fileSuggestionStrategyService.suggestFiles(
  ticket,
  'balanced', // strategy
  10,         // max results
  'focus on authentication components' // user context
)

// Returns: FileSuggestionResponse with metadata
{
  suggestions: [123, 456, 789],
  scores: [...relevanceScores],
  metadata: {
    totalFiles: 1250,
    analyzedFiles: 50,
    strategy: 'balanced',
    processingTime: 245,
    tokensSaved: 15420
  }
}
```

## Utility Services

### File Importance Scorer (`utils/file-importance-scorer.ts`)

Calculates file importance based on multiple factors:

**Scoring Factors:**

- File type weights (service files = 3.0, components = 1.5)
- Directory importance (src/ = 2.0, tests/ = 0.5)
- Import/export counts
- File size optimization
- Recency scoring

### Compact File Formatter (`utils/compact-file-formatter.ts`)

Token-efficient file representations:

**Formats:**

- **Ultra**: ~50 chars/file (id + path only)
- **Compact**: ~100 chars/file (+ brief summary)
- **Standard**: ~150 chars/file (+ type + timestamp)

**Token Savings:**

```typescript
const savings = calculateTokenSavings(files)
// Typical savings: 60-70% reduction
// Old XML: ~500 chars/file
// New JSON: ~100 chars/file
```

### File Suggestion Utils (`utils/file-suggestion-utils.ts`)

Helper functions for file processing:

- Keyword extraction with stop word filtering
- Text relevance calculation (Jaccard similarity)
- File merging and deduplication
- Pattern-based filtering
- Performance metrics tracking

## Performance Optimizations

### Search Performance

- **FTS5 Integration**: Sub-millisecond full-text search
- **Intelligent Caching**: 5-minute TTL with hit count tracking
- **Batch Processing**: 100-file batches for indexing
- **Pre-filtering**: Reduce AI processing load by 80%

### Token Efficiency

- **Compact Formats**: 60-70% token reduction
- **Smart Pre-filtering**: Only send relevant files to AI
- **Strategy-based Processing**: Match strategy to project size
- **Truncation**: Large files truncated for summarization

### Memory Management

- **Streaming Operations**: Large file handling
- **Connection Pooling**: Database connection reuse
- **Garbage Collection**: Cache cleanup intervals
- **Lazy Loading**: Index on demand

## Database Schema

### FTS5 Virtual Table

```sql
CREATE VIRTUAL TABLE file_search_fts USING fts5(
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
```

### Metadata Table

```sql
CREATE TABLE file_search_metadata (
  file_id TEXT PRIMARY KEY,
  project_id INTEGER NOT NULL,
  tf_idf_vector BLOB,        -- TF-IDF calculations
  keyword_vector TEXT,       -- Top keywords JSON
  last_indexed INTEGER NOT NULL,
  file_size INTEGER,
  token_count INTEGER,
  language TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
```

## Configuration

### File Extensions (Allowed)

```typescript
const ALLOWED_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.md',
  '.json',
  '.yaml',
  '.yml',
  '.css',
  '.scss',
  '.html',
  '.sql',
  '.prisma',
  '.zod.ts'
]
```

### Default Exclusions

```typescript
const DEFAULT_EXCLUSIONS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.vscode',
  '.idea',
  'venv',
  '.DS_Store',
  '*.log',
  '*.tmp',
  'coverage'
]
```

## Error Handling

### Sync Errors

- Permission denied handling
- Large file truncation
- Checksum validation
- Atomic transactions

### Search Errors

- Invalid regex patterns
- Index corruption recovery
- Cache invalidation
- Fallback mechanisms

### Indexing Errors

- JSON parsing failures
- Database constraint violations
- Memory limit handling
- Partial index recovery

## Testing

### Test Coverage

- Utility functions: 100% tested
- Core sync logic: Integration tests required
- Search functionality: Mock-based unit tests
- Performance: Benchmark tests available

### Test Structure

```typescript
describe('File Services', () => {
  // Utility function tests (isolated)
  describe('computeChecksum', () => { ... })
  describe('isValidChecksum', () => { ... })

  // Integration tests (with mocks)
  describe('syncProject', () => { ... })
  describe('searchService', () => { ... })
})
```

## Best Practices

### File Synchronization

1. Always use checksums for change detection
2. Batch operations for performance
3. Handle file system errors gracefully
4. Index immediately after sync
5. Use atomic transactions

### Search Implementation

1. Pre-filter before AI processing
2. Cache frequently accessed results
3. Use appropriate search types
4. Monitor index coverage
5. Handle large result sets

### Suggestion Optimization

1. Choose strategy based on project size
2. Provide meaningful user context
3. Monitor token usage
4. Use compact formats appropriately
5. Track performance metrics

## Integration Patterns

### With MCP Tools

```typescript
// Project manager integration
const suggestions = await fileSuggestionStrategyService.suggestFiles(
  ticket,
  await FileSuggestionStrategyService.recommendStrategy(projectId)
)

// Ticket manager integration
const results = await fileSearchService.searchByTicket(ticket)
```

### With UI Components

```typescript
// File browser integration
const files = await getProjectFiles(projectId)
const important = sortFilesByImportance(files)

// Search interface
const searchResults = await fileSearchService.search(projectId, {
  query: userInput,
  searchType: userPreference
})
```

This file services architecture provides a robust, performant, and token-efficient foundation for Promptliano's file management capabilities. The system scales from small projects to large codebases while maintaining sub-millisecond search performance and intelligent file suggestions.
