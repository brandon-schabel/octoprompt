#!/usr/bin/env bun

import { providerKeyStorage } from '../provider-key-storage'
import { encryptKey } from '@promptliano/shared/src/utils/crypto'
import type { ProviderKey } from '@promptliano/schemas'

/**
 * Migration script to encrypt existing provider keys
 */
async function migrateProviderKeys() {
  console.log('Starting provider key encryption migration...')

  try {
    // Encryption key will be automatically generated if not exists
    console.log('Checking encryption key...')

    // Read all provider keys
    const allKeys = await providerKeyStorage.readProviderKeys()
    const keyIds = Object.keys(allKeys)

    if (keyIds.length === 0) {
      console.log('No provider keys found. Migration complete.')
      return
    }

    console.log(`Found ${keyIds.length} provider keys to process...`)

    let encryptedCount = 0
    let skippedCount = 0
    let errorCount = 0

    // Process each key
    for (const keyId of keyIds) {
      const key = allKeys[keyId]
      
      if (!key) {
        console.log(`Key ${keyId} not found, skipping...`)
        continue
      }

      // Skip if already encrypted
      if (key.encrypted) {
        console.log(`Key ${keyId} (${key.name}) is already encrypted, skipping...`)
        skippedCount++
        continue
      }

      try {
        console.log(`Encrypting key ${keyId} (${key.name})...`)

        // Encrypt the key
        const encryptedData = await encryptKey(key.key)

        // Update the key with encrypted data
        const updatedKey: ProviderKey = {
          ...key,
          key: encryptedData.encrypted,
          encrypted: true,
          iv: encryptedData.iv,
          tag: encryptedData.tag,
          salt: encryptedData.salt,
          updated: Date.now()
        }

        // Save the updated key
        await providerKeyStorage.upsertProviderKey(updatedKey)
        encryptedCount++
        console.log(`✓ Successfully encrypted key ${keyId} (${key.name})`)
      } catch (error) {
        console.error(`✗ Failed to encrypt key ${keyId} (${key.name}):`, error)
        errorCount++
      }
    }

    console.log('\nMigration Summary:')
    console.log(`- Total keys: ${keyIds.length}`)
    console.log(`- Encrypted: ${encryptedCount}`)
    console.log(`- Skipped (already encrypted): ${skippedCount}`)
    console.log(`- Errors: ${errorCount}`)

    if (errorCount > 0) {
      console.error('\n⚠️  Some keys failed to encrypt. Please check the errors above.')
      process.exit(1)
    } else {
      console.log('\n✅ Migration completed successfully!')
    }
  } catch (error) {
    console.error('Fatal error during migration:', error)
    process.exit(1)
  }
}

// Run the migration
migrateProviderKeys()
