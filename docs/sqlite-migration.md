# SQLite Migration Guide

This guide explains how to migrate your existing JSON-based data storage to the new SQLite database.

## Overview

The migration script (`scripts/migrate-to-sqlite.ts`) will:

1. Read all existing JSON files from the `packages/server/data/` directory
2. Validate each record with appropriate Zod schemas
3. Migrate data to SQLite in the correct order:
   - Provider keys
   - Projects
   - Project files
   - Chats
   - Chat messages
   - Prompts (if any)
   - Prompt projects (if any)
   - MCP configurations (if any)
4. Create indexes for optimal performance
5. Handle errors gracefully with detailed logging
6. Show progress for large migrations
7. Create a backup before migration (unless disabled)

## Prerequisites

- Ensure your server is stopped before running the migration
- Have sufficient disk space for the backup (approximately 2x your current data size)

## Usage

### Basic Migration

```bash
# Run the full migration
bun run migrate:sqlite
```

### Options

```bash
# Show help
bun run scripts/migrate-to-sqlite.ts --help

# Test without making changes (recommended first step)
bun run migrate:sqlite:dry

# Run with verbose logging
bun run scripts/migrate-to-sqlite.ts --verbose

# Resume an interrupted migration
bun run scripts/migrate-to-sqlite.ts --resume

# Skip backup creation (not recommended)
bun run scripts/migrate-to-sqlite.ts --no-backup

# Combine options
bun run scripts/migrate-to-sqlite.ts --dry-run --verbose
```

## Migration Process

### 1. Test with Dry Run

Always start with a dry run to see what will be migrated:

```bash
bun run migrate:sqlite:dry --verbose
```

This will:
- Show which files will be migrated
- Display record counts
- Identify any validation errors
- NOT make any changes to your data

### 2. Create Backup

By default, the migration creates a backup in `data/backup-[timestamp]/`. You can verify the backup was created successfully before proceeding.

### 3. Run Migration

```bash
bun run migrate:sqlite --verbose
```

The migration will:
- Show progress for each data type
- Report any errors immediately
- Save state for resumption if interrupted
- Optimize the database after completion

### 4. Verify Migration

After migration:
1. Check the summary for any failed records
2. Start your server and verify data is accessible
3. The original JSON files remain untouched

## Resuming Failed Migrations

If the migration is interrupted:

```bash
# Resume from where it left off
bun run scripts/migrate-to-sqlite.ts --resume
```

The migration state is saved in `data/.migration-state.json` and tracks:
- Which tables have been completed
- Any errors encountered
- Progress statistics

## Troubleshooting

### Common Issues

1. **"File not found" warnings**: Normal for optional data types (prompts, MCP configs)
2. **Validation errors**: Records that don't match the schema will be skipped and logged
3. **Disk space**: Ensure you have space for both the backup and the new SQLite database

### Error Recovery

If errors occur:
1. Check the error details in the migration output
2. Fix any data issues in the original JSON files
3. Re-run with `--resume` to continue

### Manual Verification

Check the SQLite database directly:

```bash
# Open SQLite CLI
sqlite3 data/octoprompt.db

# List tables
.tables

# Count records
SELECT COUNT(*) FROM projects;
SELECT COUNT(*) FROM chats;
SELECT COUNT(*) FROM project_files;

# Exit
.quit
```

## Performance

The SQLite database provides:
- Faster queries with indexes
- Better concurrency handling
- Reduced memory usage for large datasets
- Atomic transactions
- Built-in backup capabilities

## Rollback

If you need to rollback:
1. Stop the server
2. Delete `data/octoprompt.db`
3. The original JSON files remain untouched
4. Restore from backup if needed: `cp -r data/backup-[timestamp]/* packages/server/data/`

## Next Steps

After successful migration:
1. Monitor server performance
2. Original JSON files can be archived or removed later
3. Use SQLite's built-in backup tools for future backups