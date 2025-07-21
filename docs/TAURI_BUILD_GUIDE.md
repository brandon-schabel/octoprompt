# Tauri Build Guide for OctoPrompt

This guide explains how to build and release OctoPrompt's Tauri desktop application.

## Quick Start

### Local Development Build (No Code Signing)

```bash
./scripts/release-tauri.sh --skip-signing
```

### Production Build (with Code Signing)

```bash
# macOS Universal Binary with Notarization
./scripts/release-tauri.sh --universal --notarize
```

## Build Scripts Overview

### 1. `build-tauri-app.sh`

Main build script that handles:

- Environment verification
- Dependency installation
- Server binary building
- Tauri app compilation
- Code signing (macOS)
- Notarization (optional)

**Usage:**

```bash
./scripts/build-tauri-app.sh [options]

Options:
  --universal      Build universal macOS binary (Intel + Apple Silicon)
  --skip-signing   Skip code signing (for testing)
  --notarize       Submit for notarization after building (macOS only)
  --target <arch>  Specify target architecture
  --help           Show help message
```

### 2. `create-release-bundles.sh`

Packages built artifacts into distribution-ready bundles:

- Renames files with consistent naming
- Creates platform-specific folders
- Generates README files
- Creates checksums
- Builds release archive

**Output Structure:**

```
release-bundles/
├── macOS/
│   ├── OctoPrompt-v1.0.0-macOS-Intel.dmg
│   ├── OctoPrompt-v1.0.0-macOS-AppleSilicon.dmg
│   ├── OctoPrompt-v1.0.0-macOS-Universal.dmg
│   └── README.txt
├── Windows/
│   ├── OctoPrompt-v1.0.0-Windows-x64-Setup.exe
│   └── README.txt
├── Linux/
│   ├── OctoPrompt-v1.0.0-Linux-x86_64.AppImage
│   ├── OctoPrompt-v1.0.0-Linux-amd64.deb
│   ├── OctoPrompt-v1.0.0-Linux-x86_64.rpm
│   └── README.txt
├── README.md
├── checksums.txt
└── OctoPrompt-v1.0.0-all-platforms.tar.gz
```

### 3. `release-tauri.sh`

Convenience wrapper that runs both build and bundle scripts.

## Platform-Specific Builds

### macOS

#### Intel Only

```bash
./scripts/build-tauri-app.sh --target x86_64-apple-darwin
```

#### Apple Silicon Only

```bash
./scripts/build-tauri-app.sh --target aarch64-apple-darwin
```

#### Universal (Recommended for Distribution)

```bash
./scripts/build-tauri-app.sh --universal
```

### Windows (Cross-compile from macOS/Linux)

```bash
# Install Windows target first
rustup target add x86_64-pc-windows-msvc

# Build
./scripts/build-tauri-app.sh --target x86_64-pc-windows-msvc
```

### Linux

```bash
# Default build
./scripts/build-tauri-app.sh
```

## Code Signing Setup (macOS)

### Prerequisites

1. Apple Developer Account ($99/year)
2. Developer ID Application certificate
3. App-specific password for notarization

### Environment Variables

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password
export APPLE_TEAM_ID="YOURTEAMID"
```

### Test Your Setup

```bash
./scripts/check-signing-setup.sh
```

## Build Workflow

### 1. Development Build

For local testing without code signing:

```bash
./scripts/release-tauri.sh --skip-signing
```

### 2. Test Release Build

Build with signing but without notarization:

```bash
./scripts/release-tauri.sh
```

### 3. Production Release

Full build with notarization:

```bash
./scripts/release-tauri.sh --universal --notarize
```

### 4. GitHub Release

After building:

```bash
# Create GitHub release with all artifacts
cd release-bundles
gh release create v1.0.0 \
  *.tar.gz \
  macOS/*.dmg \
  Windows/*.exe \
  Linux/*.{deb,AppImage,rpm} \
  --title "OctoPrompt v1.0.0" \
  --notes-file ../CHANGELOG.md
```

## Troubleshooting

### Build Fails with "Server binary build failed"

The script will automatically create a dummy binary for testing. This is fine for UI development.

### Code Signing Issues

```bash
# Verify certificate is installed
security find-identity -v -p codesigning

# Check signing identity format
echo $APPLE_SIGNING_IDENTITY
```

### Notarization Fails

```bash
# Check notarization log
xcrun notarytool log <submission-id> \
  --apple-id $APPLE_ID \
  --password $APPLE_PASSWORD \
  --team-id $APPLE_TEAM_ID
```

### Universal Binary Issues

Ensure you have both targets installed:

```bash
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin
```

## CI/CD Integration

For GitHub Actions, use the workflow at `.github/workflows/tauri-release.yml`. It automatically:

1. Builds for all platforms
2. Signs and notarizes macOS builds
3. Creates GitHub releases
4. Uploads all artifacts

Trigger with:

```bash
git tag app-v1.0.0
git push origin app-v1.0.0
```

## Best Practices

1. **Always test locally first** with `--skip-signing`
2. **Version consistency**: Ensure package.json and Cargo.toml versions match
3. **Clean builds**: The script automatically cleans previous builds
4. **Verify signatures** before distribution
5. **Keep checksums**: Always distribute with checksums.txt

## Security Notes

- Never commit certificates or passwords
- Use GitHub secrets for CI/CD
- Rotate app-specific passwords periodically
- Verify all binaries are signed before distribution

For more details on code signing, see [MACOS_SIGNING_SETUP.md](./MACOS_SIGNING_SETUP.md).
