#!/bin/bash

# Script for testing Tauri signing locally
# Usage: ./scripts/test-tauri-signing.sh

set -e

echo "🔐 Testing Tauri macOS Code Signing Setup"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check environment variable
check_env_var() {
    local var_name=$1
    local var_value=${!var_name}
    
    if [[ -z "$var_value" ]]; then
        echo -e "${RED}❌ Missing required environment variable: $var_name${NC}"
        return 1
    else
        # Mask sensitive values in output
        if [[ "$var_name" == *"PASSWORD"* ]] || [[ "$var_name" == *"ID"* ]]; then
            echo -e "${GREEN}✅ $var_name is set${NC}"
        else
            echo -e "${GREEN}✅ $var_name: ${var_value:0:20}...${NC}"
        fi
        return 0
    fi
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ This script must be run on macOS${NC}"
    exit 1
fi

echo -e "\n${YELLOW}1. Checking environment variables...${NC}"

# Check required environment variables
required_vars=(
    "APPLE_SIGNING_IDENTITY"
    "APPLE_ID"
    "APPLE_PASSWORD"
    "APPLE_TEAM_ID"
)

all_vars_set=true
for var in "${required_vars[@]}"; do
    if ! check_env_var "$var"; then
        all_vars_set=false
    fi
done

if [[ "$all_vars_set" == false ]]; then
    echo -e "\n${RED}Please set all required environment variables before running this script.${NC}"
    echo "Add them to your ~/.zshrc or ~/.bash_profile:"
    echo '  export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"'
    echo '  export APPLE_ID="your-apple-id@example.com"'
    echo '  export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password'
    echo '  export APPLE_TEAM_ID="YOURTEAMID"'
    exit 1
fi

echo -e "\n${YELLOW}2. Checking signing identity in keychain...${NC}"

# Check if certificate is in keychain
if security find-identity -v -p codesigning | grep -q "$APPLE_SIGNING_IDENTITY"; then
    echo -e "${GREEN}✅ Signing identity found in keychain${NC}"
    security find-identity -v -p codesigning | grep "$APPLE_SIGNING_IDENTITY"
else
    echo -e "${RED}❌ Signing identity not found in keychain${NC}"
    echo "Available signing identities:"
    security find-identity -v -p codesigning
    exit 1
fi

echo -e "\n${YELLOW}3. Checking Tauri CLI installation...${NC}"

# Check if Tauri CLI is installed
if command -v tauri &> /dev/null; then
    echo -e "${GREEN}✅ Tauri CLI found: $(tauri --version)${NC}"
else
    echo -e "${YELLOW}⚠️  Tauri CLI not found globally, checking local installation...${NC}"
    if [[ -f "node_modules/.bin/tauri" ]] || [[ -f "../node_modules/.bin/tauri" ]]; then
        echo -e "${GREEN}✅ Local Tauri CLI found${NC}"
    else
        echo -e "${RED}❌ Tauri CLI not found. Install it with: bun add -D @tauri-apps/cli${NC}"
        exit 1
    fi
fi

echo -e "\n${YELLOW}4. Building server binaries...${NC}"

# Build server binaries
if bun run build-binaries; then
    echo -e "${GREEN}✅ Server binaries built successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Failed to build server binaries${NC}"
    echo "This is okay for testing signing - we'll create a dummy binary"
    
    # Create dummy binary for testing
    mkdir -p dist
    echo '#!/bin/bash' > dist/octoprompt-bundle
    echo 'echo "Dummy server for signing test"' >> dist/octoprompt-bundle
    chmod +x dist/octoprompt-bundle
fi

echo -e "\n${YELLOW}5. Preparing Tauri sidecars...${NC}"

# Prepare sidecars
if bun run prepare-tauri-sidecars; then
    echo -e "${GREEN}✅ Tauri sidecars prepared successfully${NC}"
else
    echo -e "${RED}❌ Failed to prepare Tauri sidecars${NC}"
    exit 1
fi

echo -e "\n${YELLOW}6. Building Tauri app with signing...${NC}"

# Change to client directory
cd packages/client

# Build the app
if bun run tauri:build; then
    echo -e "${GREEN}✅ Tauri app built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build Tauri app${NC}"
    exit 1
fi

echo -e "\n${YELLOW}7. Verifying code signature...${NC}"

# Find the built app
APP_PATH=$(find src-tauri/target/release/bundle/macos -name "*.app" -type d | head -1)

if [[ -z "$APP_PATH" ]]; then
    echo -e "${RED}❌ Could not find built app${NC}"
    exit 1
fi

echo "Found app at: $APP_PATH"

# Verify the signature
echo -e "\n${YELLOW}Signature details:${NC}"
codesign -dv --verbose=4 "$APP_PATH" 2>&1 | grep -E "(Authority|TeamIdentifier|Identifier|Signature)"

# Check if app is properly signed
if codesign --verify --deep --strict "$APP_PATH" 2>&1; then
    echo -e "${GREEN}✅ App signature is valid${NC}"
else
    echo -e "${RED}❌ App signature verification failed${NC}"
    exit 1
fi

# Check hardened runtime
echo -e "\n${YELLOW}Checking hardened runtime...${NC}"
if codesign -d --verbose "$APP_PATH" 2>&1 | grep -q "flags=0x10000(runtime)"; then
    echo -e "${GREEN}✅ Hardened runtime is enabled${NC}"
else
    echo -e "${RED}❌ Hardened runtime is not enabled${NC}"
    echo "This is required for notarization!"
fi

echo -e "\n${YELLOW}8. Checking notarization readiness...${NC}"

# Check notarization requirements
echo "Running spctl assessment..."
if spctl -a -vvv -t install "$APP_PATH" 2>&1 | grep -q "accepted"; then
    echo -e "${GREEN}✅ App is ready for notarization${NC}"
else
    echo -e "${YELLOW}⚠️  App may need notarization for distribution${NC}"
    echo "Note: This is expected for local builds. Notarization happens during CI/CD."
fi

echo -e "\n${YELLOW}9. Checking entitlements...${NC}"

# Display entitlements
codesign -d --entitlements - "$APP_PATH" 2>/dev/null | grep -A20 "<?xml"

echo -e "\n${GREEN}✅ Build and signing test complete!${NC}"
echo -e "\n${YELLOW}Summary:${NC}"
echo "- App location: $APP_PATH"
echo "- Signed with: $APPLE_SIGNING_IDENTITY"
echo "- Team ID: $APPLE_TEAM_ID"
echo -e "\n${YELLOW}Next steps for distribution:${NC}"
echo "1. The app will be automatically notarized when built in CI/CD"
echo "2. For manual notarization, use: xcrun notarytool submit <dmg-file>"
echo "3. To test the app, you may need to right-click and select 'Open' the first time"