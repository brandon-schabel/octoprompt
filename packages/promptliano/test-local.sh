#!/bin/bash
# test-local.sh - Test the Promptliano CLI locally

set -e

echo "🧪 Testing Promptliano CLI Locally"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Build the package
echo "📦 Building package..."
bun run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

echo ""
echo "🔍 Testing commands..."
echo ""

# Test help
echo "1. Testing help command:"
bun run src/index.ts --help
echo ""

# Test version
echo "2. Testing version command:"
bun run src/index.ts --version
echo ""

# Test doctor command
echo "3. Testing doctor command:"
bun run src/index.ts doctor
echo ""

echo "=================================="
echo -e "${GREEN}✅ Local tests completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Run 'npm link' to test globally"
echo "2. Run 'npm pack' to create tarball"
echo "3. Test with 'npx ./promptliano-*.tgz'"