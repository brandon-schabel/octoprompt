#!/bin/bash
# Simple Docker build script for Promptliano
# Usage: ./scripts/docker-build.sh [production|alpine|distroless]

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Default to alpine build
BUILD_TYPE="${1:-alpine}"

echo -e "${GREEN}Promptliano Docker Build${NC}"
echo "========================"

case "$BUILD_TYPE" in
    production)
        echo -e "${YELLOW}Building production image with 4-stage pattern...${NC}"
        docker build -f Dockerfile.production -t promptliano:production .
        IMAGE_NAME="promptliano:production"
        ;;
    
    alpine)
        echo -e "${YELLOW}Building Alpine-based image...${NC}"
        # First build binaries if not exists
        if [ ! -d "dist/promptliano-0.9.2-linux-x64" ]; then
            echo -e "${YELLOW}Building binaries first...${NC}"
            bun run scripts/build-binaries.ts
        fi
        docker build -f Dockerfile.alpine -t promptliano:alpine .
        IMAGE_NAME="promptliano:alpine"
        ;;
    
    distroless)
        echo -e "${YELLOW}Building distroless image...${NC}"
        # First build binaries if not exists
        if [ ! -d "dist/promptliano-0.9.2-linux-x64" ]; then
            echo -e "${YELLOW}Building binaries first...${NC}"
            bun run scripts/build-binaries.ts
        fi
        docker build -f Dockerfile.distroless -t promptliano:distroless .
        IMAGE_NAME="promptliano:distroless"
        ;;
    
    *)
        echo -e "${RED}Unknown build type: $BUILD_TYPE${NC}"
        echo "Usage: $0 [production|alpine|distroless]"
        exit 1
        ;;
esac

echo -e "\n${GREEN}✓ Build complete!${NC}"
docker images "$IMAGE_NAME"

echo -e "\n${GREEN}To run:${NC}"
echo -e "  docker run -d -p 3147:3147 -v promptliano-data:/data $IMAGE_NAME"

echo -e "\n${GREEN}To scan for vulnerabilities:${NC}"
echo -e "  ./scripts/docker-security-scan.sh $IMAGE_NAME"