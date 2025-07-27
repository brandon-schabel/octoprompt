# Provider Key Encryption

Promptliano automatically encrypts all provider API keys using AES-256-GCM encryption to ensure they are not stored in plain text.

## How It Works

### Automatic Setup

Encryption is enabled automatically:

1. **First Run**: When you add your first API key, Promptliano automatically generates a secure encryption key
2. **Key Storage**: The encryption key is stored in your platform's application data directory:
   - **macOS**: `~/Library/Application Support/Promptliano/encryption.key`
   - **Windows**: `%APPDATA%\Promptliano\encryption.key`
   - **Linux**: `~/.local/share/promptliano/encryption.key`
3. **Zero Configuration**: No manual setup required - it just works!

### Migrating Existing Keys

If you have existing unencrypted keys, run the migration:

```bash
bun run migrate:encrypt-keys
```

## How It Works

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Derivation**: PBKDF2 with SHA-256 (100,000 iterations)
- **Storage**: Encrypted keys are stored with their IV, authentication tag, and salt
- **Backward Compatibility**: The system can handle both encrypted and unencrypted keys

## Security Details

1. **Encryption Key**: Automatically generated and stored securely in your app data directory
2. **File Permissions**: Key file is restricted to owner read/write only (0600)
3. **Per-Key Salt**: Each API key gets a unique salt for key derivation
4. **Per-Key IV**: Each encryption operation uses a unique initialization vector
5. **Authentication**: GCM mode provides built-in authentication to detect tampering
6. **Memory Safety**: Keys are only decrypted when needed and not kept in memory

## Manual Configuration (Optional)

If you prefer to manage your own encryption key:

1. Set the `PROMPTLIANO_ENCRYPTION_KEY` environment variable
2. Promptliano will use your key instead of generating one

```bash
# Generate a key manually
bun run generate-encryption-key

# Add to your environment
export PROMPTLIANO_ENCRYPTION_KEY=<your-key>
```

## API Changes

The encryption is transparent to the API consumers:

- Creating keys: Automatically encrypted before storage
- Retrieving keys: Automatically decrypted when accessed
- Listing keys: Censored endpoint shows masked keys, uncensored endpoint decrypts

## Troubleshooting

### Missing Encryption Key

If the encryption key file is deleted:

1. You'll lose access to encrypted API keys
2. Remove affected keys from the UI
3. Re-add your API keys (a new encryption key will be generated)

### Decryption Failures

If keys fail to decrypt:

1. Ensure the correct encryption key is set
2. Check if the key was encrypted with a different encryption key
3. Review error logs for specific decryption errors

### Migration Issues

If migration fails:

1. Ensure all existing keys have valid data
2. Check database connectivity
3. Verify write permissions to the database and app data directory

### Backup Recommendation

Back up your encryption key file along with your database to ensure you can always decrypt your API keys.
