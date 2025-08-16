#!/bin/bash
# Docker Security Scanning Script for Promptliano
# Performs comprehensive security analysis of Docker images

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
IMAGE_NAME="${1:-promptliano:latest}"
SCAN_TYPE="${2:-full}"
OUTPUT_FORMAT="${3:-table}"

echo -e "${BLUE}Docker Security Scanner for Promptliano${NC}"
echo "========================================"
echo -e "Image: ${YELLOW}${IMAGE_NAME}${NC}"
echo -e "Scan Type: ${YELLOW}${SCAN_TYPE}${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to scan with Docker Scout (if available)
scan_with_scout() {
    echo -e "\n${BLUE}Running Docker Scout security scan...${NC}"
    if command_exists "docker-scout"; then
        docker scout cves "$IMAGE_NAME" --format "$OUTPUT_FORMAT"
        docker scout recommendations "$IMAGE_NAME"
    else
        echo -e "${YELLOW}Docker Scout not installed. Install with: docker scout install${NC}"
        return 1
    fi
}

# Function to scan with Trivy (recommended)
scan_with_trivy() {
    echo -e "\n${BLUE}Running Trivy security scan...${NC}"
    if command_exists "trivy"; then
        # Comprehensive vulnerability scan
        trivy image --severity HIGH,CRITICAL "$IMAGE_NAME"
        
        if [ "$SCAN_TYPE" == "full" ]; then
            # Additional checks for full scan
            echo -e "\n${BLUE}Checking for misconfigurations...${NC}"
            trivy image --scanners misconfig "$IMAGE_NAME"
            
            echo -e "\n${BLUE}Checking for secrets...${NC}"
            trivy image --scanners secret "$IMAGE_NAME"
        fi
    else
        echo -e "${YELLOW}Trivy not installed. Install with:${NC}"
        echo "  brew install trivy (macOS)"
        echo "  docker run -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image $IMAGE_NAME"
        return 1
    fi
}

# Function to scan with Grype
scan_with_grype() {
    echo -e "\n${BLUE}Running Grype vulnerability scan...${NC}"
    if command_exists "grype"; then
        grype "$IMAGE_NAME" -o "$OUTPUT_FORMAT"
    else
        echo -e "${YELLOW}Grype not installed. Install with:${NC}"
        echo "  brew install grype (macOS)"
        echo "  curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin"
        return 1
    fi
}

# Function to check image configuration
check_image_config() {
    echo -e "\n${BLUE}Checking image configuration...${NC}"
    
    # Check if running as non-root
    USER=$(docker inspect "$IMAGE_NAME" --format='{{.Config.User}}')
    if [ -z "$USER" ] || [ "$USER" == "root" ] || [ "$USER" == "0" ]; then
        echo -e "${RED}✗ Image runs as root user (CRITICAL)${NC}"
        ISSUES=$((ISSUES + 1))
    else
        echo -e "${GREEN}✓ Image runs as non-root user: $USER${NC}"
    fi
    
    # Check for health check
    HEALTHCHECK=$(docker inspect "$IMAGE_NAME" --format='{{.Config.Healthcheck}}')
    if [ "$HEALTHCHECK" == "<nil>" ]; then
        echo -e "${YELLOW}⚠ No HEALTHCHECK defined${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✓ HEALTHCHECK is defined${NC}"
    fi
    
    # Check exposed ports
    PORTS=$(docker inspect "$IMAGE_NAME" --format='{{range $p, $conf := .Config.ExposedPorts}}{{$p}} {{end}}')
    echo -e "${BLUE}Exposed ports:${NC} $PORTS"
    
    # Check environment variables for sensitive data
    echo -e "\n${BLUE}Checking for sensitive environment variables...${NC}"
    ENVS=$(docker inspect "$IMAGE_NAME" --format='{{range .Config.Env}}{{println .}}{{end}}')
    
    # Check for common sensitive patterns
    if echo "$ENVS" | grep -qiE "(password|secret|key|token|api)" | grep -v "DATABASE_PATH"; then
        echo -e "${YELLOW}⚠ Potential sensitive data in environment variables${NC}"
        echo "$ENVS" | grep -iE "(password|secret|key|token|api)" | grep -v "DATABASE_PATH"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✓ No obvious sensitive data in environment variables${NC}"
    fi
    
    # Check image size
    SIZE=$(docker inspect "$IMAGE_NAME" --format='{{.Size}}' | numfmt --to=iec-i --suffix=B)
    echo -e "\n${BLUE}Image size:${NC} $SIZE"
    
    # Check base image
    BASE_IMAGE=$(docker inspect "$IMAGE_NAME" --format='{{index .RepoDigests 0}}' 2>/dev/null || echo "Unknown")
    echo -e "${BLUE}Base image digest:${NC} $BASE_IMAGE"
}

# Function to analyze Dockerfile best practices
analyze_dockerfile() {
    echo -e "\n${BLUE}Analyzing Dockerfile best practices...${NC}"
    
    if command_exists "hadolint"; then
        # Find Dockerfile used for this image
        DOCKERFILE="Dockerfile"
        if [ -f "Dockerfile.production" ]; then
            DOCKERFILE="Dockerfile.production"
        fi
        
        echo -e "Analyzing: $DOCKERFILE"
        hadolint "$DOCKERFILE" || true
    else
        echo -e "${YELLOW}Hadolint not installed. Install with:${NC}"
        echo "  brew install hadolint (macOS)"
        echo "  docker run --rm -i hadolint/hadolint < Dockerfile"
    fi
}

# Function to check runtime security
check_runtime_security() {
    echo -e "\n${BLUE}Checking runtime security...${NC}"
    
    # Start a temporary container to check capabilities
    CONTAINER_ID=$(docker create "$IMAGE_NAME")
    
    # Check capabilities
    CAPS=$(docker inspect "$CONTAINER_ID" --format='{{.HostConfig.CapAdd}}')
    if [ "$CAPS" != "[]" ] && [ "$CAPS" != "<nil>" ]; then
        echo -e "${YELLOW}⚠ Additional capabilities granted: $CAPS${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✓ No additional capabilities${NC}"
    fi
    
    # Check if privileged
    PRIVILEGED=$(docker inspect "$CONTAINER_ID" --format='{{.HostConfig.Privileged}}')
    if [ "$PRIVILEGED" == "true" ]; then
        echo -e "${RED}✗ Container runs in privileged mode (CRITICAL)${NC}"
        ISSUES=$((ISSUES + 1))
    else
        echo -e "${GREEN}✓ Container is not privileged${NC}"
    fi
    
    # Clean up
    docker rm "$CONTAINER_ID" >/dev/null 2>&1
}

# Function to generate security report
generate_report() {
    echo -e "\n${BLUE}Security Scan Summary${NC}"
    echo "====================="
    echo -e "Image: ${YELLOW}${IMAGE_NAME}${NC}"
    echo -e "Scan Date: $(date)"
    
    if [ "$ISSUES" -gt 0 ]; then
        echo -e "\n${RED}Critical Issues: $ISSUES${NC}"
    fi
    
    if [ "$WARNINGS" -gt 0 ]; then
        echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
    fi
    
    if [ "$ISSUES" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
        echo -e "\n${GREEN}✓ No critical security issues found${NC}"
    fi
    
    # Save report to file
    REPORT_FILE="security-report-$(date +%Y%m%d-%H%M%S).txt"
    echo -e "\nSaving detailed report to: ${YELLOW}${REPORT_FILE}${NC}"
}

# Main execution
ISSUES=0
WARNINGS=0

# Check if image exists
if ! docker inspect "$IMAGE_NAME" >/dev/null 2>&1; then
    echo -e "${RED}Error: Image '$IMAGE_NAME' not found${NC}"
    echo "Please build the image first or specify a valid image name"
    exit 1
fi

# Run security scans based on available tools
echo -e "${BLUE}Starting security analysis...${NC}"

# Try multiple scanners
SCANNER_FOUND=false

if scan_with_trivy; then
    SCANNER_FOUND=true
elif scan_with_grype; then
    SCANNER_FOUND=true
elif scan_with_scout; then
    SCANNER_FOUND=true
fi

if [ "$SCANNER_FOUND" = false ]; then
    echo -e "\n${RED}No vulnerability scanner found!${NC}"
    echo -e "${YELLOW}Please install at least one of: Trivy, Grype, or Docker Scout${NC}"
    echo -e "\nRecommended: ${GREEN}brew install trivy${NC}"
fi

# Always run these checks
check_image_config
check_runtime_security

if [ "$SCAN_TYPE" == "full" ]; then
    analyze_dockerfile
fi

# Generate final report
generate_report

# Exit with appropriate code
if [ "$ISSUES" -gt 0 ]; then
    exit 1
elif [ "$WARNINGS" -gt 0 ]; then
    exit 0
else
    exit 0
fi