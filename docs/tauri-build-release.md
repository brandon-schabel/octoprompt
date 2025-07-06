# Tauri Build and Release Guide

This guide covers the automated build and release process for Promptliano's Tauri desktop application.

## Overview

Promptliano uses GitHub Actions to automatically build and release desktop applications for Windows, macOS, and Linux. The build system creates both:

- **Desktop Applications**: Native Tauri apps with embedded web view
- **Server Binaries**: Standalone server executables included as sidecars

## Build Architecture

### Platforms Supported

- **macOS**: Universal (Intel + Apple Silicon), Intel-only, and ARM-only builds
- **Windows**: x64 builds with MSI and EXE installers
- **Linux**: AppImage, DEB, and RPM packages

### GitHub Actions Workflows

#### 1. Continuous Integration (`tauri-build.yml`)

- **Triggers**: Push to main, pull requests, manual dispatch
- **Purpose**: Validate builds across all platforms
- **Artifacts**: Uploaded for 7-day retention

#### 2. Release Workflow (`tauri-release.yml`)

- **Triggers**: Version tags (`v*` or `tauri-v*`), manual dispatch
- **Purpose**: Create production releases with all artifacts
- **Output**: GitHub release with all platform binaries

## Local Development

### Prerequisites

- Bun (latest version)
- Rust (stable toolchain)
- Platform-specific dependencies:
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `libwebkit2gtk-4.0-dev` and related packages
  - **Windows**: Visual Studio Build Tools

### Development Commands

```bash
# Install dependencies
bun install

# Prepare development sidecar
bun run prepare-dev-sidecar

# Run Tauri in development mode
bun run tauri:dev

# Build for current platform
bun run tauri:build

# Build with sidecar included
bun run tauri:build:with-sidecar

# Platform-specific builds
bun run tauri:build:mac        # Universal macOS
bun run tauri:build:mac-intel  # Intel-only macOS
bun run tauri:build:mac-arm    # Apple Silicon only
bun run tauri:build:windows    # Windows x64
bun run tauri:build:linux      # Linux x64
```

## Release Process

### Automatic Releases

1. **Tag Creation**: Push a version tag

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Automated Build**: GitHub Actions will:
   - Create a draft release
   - Build all platform binaries
   - Upload artifacts to the release
   - Publish the release when complete

### Manual Release

1. Go to Actions → Tauri Release workflow
2. Click "Run workflow"
3. Enter tag name (e.g., `v1.0.0`)
4. Monitor the build progress

## Code Signing

### macOS Code Signing

To enable macOS code signing, add these secrets to your GitHub repository:

- `APPLE_CERTIFICATE`: Base64-encoded .p12 certificate
- `APPLE_CERTIFICATE_PASSWORD`: Certificate password
- `APPLE_SIGNING_IDENTITY`: Identity from certificate (e.g., "Developer ID Application: Your Name")
- `APPLE_ID`: Your Apple ID email
- `APPLE_PASSWORD`: App-specific password
- `APPLE_TEAM_ID`: Your Apple Developer Team ID

### Windows Code Signing

For Windows code signing, add:

- `WINDOWS_CERTIFICATE`: Base64-encoded .pfx certificate
- `WINDOWS_CERTIFICATE_PASSWORD`: Certificate password

### Tauri Updater Signing

For auto-updater functionality:

1. Generate signing keys:

   ```bash
   cd packages/client
   bun run tauri:signer generate
   ```

2. Add to GitHub secrets:
   - `TAURI_SIGNING_PRIVATE_KEY`: Private key for signing updates
   - `TAURI_SIGNING_PUBLIC_KEY`: Public key (also add to tauri.conf.json)

## Configuration

### Tauri Configuration (`packages/client/src-tauri/tauri.conf.json`)

Key settings:

- **identifier**: `com.promptliano.app`
- **productName**: `Promptliano`
- **version**: Keep synchronized with package.json
- **updater**: Configured for GitHub releases
- **bundle**: Includes server binary as external binary

### Version Management

Versions must be synchronized across:

1. `package.json` (root)
2. `packages/client/package.json`
3. `packages/client/src-tauri/tauri.conf.json`
4. `packages/client/src-tauri/Cargo.toml`

## Troubleshooting

### Build Failures

#### macOS Universal Build Issues

- Ensure both x86_64 and aarch64 Rust targets are installed
- Check that dependencies support both architectures

#### Linux Build Dependencies

Install required packages:

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.0-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

#### Windows Build Tools

- Install Visual Studio Build Tools with C++ workload
- Ensure Windows SDK is installed

### Release Issues

#### Draft Release Not Publishing

- Check all build jobs completed successfully
- Verify artifacts were uploaded
- Check GitHub Actions logs for errors

#### Missing Artifacts

- Ensure build paths in workflow match actual output
- Check platform-specific bundle locations
- Verify upload-artifact paths

### Auto-Updater Issues

#### Updates Not Detected

1. Verify updater configuration in `tauri.conf.json`
2. Check GitHub release has `latest.json` asset
3. Ensure version in release is higher than installed version
4. Verify signing keys match between build and update

#### Update Installation Failures

- Check code signing certificates are valid
- Verify update manifest is properly formatted
- Ensure proper permissions for installation

## Best Practices

### Security

1. Never commit signing certificates or keys
2. Use GitHub secrets for sensitive data
3. Enable code signing for production releases
4. Regular security updates for dependencies

### Performance

1. Use artifact caching in workflows
2. Build frontend once, reuse across platforms
3. Parallel builds where possible
4. Optimize binary size with Rust release flags

### Maintenance

1. Keep Tauri and dependencies updated
2. Test builds on all platforms before release
3. Monitor GitHub Actions usage and costs
4. Regular cleanup of old artifacts

## Additional Resources

- [Tauri Documentation](https://tauri.app/docs/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Rust Cross-Compilation Guide](https://rust-lang.github.io/rustup/cross-compilation.html)
- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [Windows App Certification](https://docs.microsoft.com/en-us/windows/uwp/publish/)

## Support

For issues or questions:

1. Check existing GitHub issues
2. Review workflow logs for specific errors
3. Consult Tauri community resources
4. Create detailed bug reports with logs
