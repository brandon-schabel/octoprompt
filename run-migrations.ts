#!/usr/bin/env bun

import { runMigrations } from './packages/storage/src/migrations/run-migrations'

console.log('Running database migrations...')

runMigrations()
  .then(() => {
    console.log('Migrations completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
