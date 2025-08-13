#!/bin/bash

# Generate documentation for all packages with TypeDoc
# Usage: ./scripts/generate-docs.sh [--clean] [--serve]

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
CLEAN=false
SERVE=false
MARKDOWN=false

for arg in "$@"
do
    case $arg in
        --clean)
        CLEAN=true
        shift
        ;;
        --serve)
        SERVE=true
        shift
        ;;
        --markdown)
        MARKDOWN=true
        shift
        ;;
        --help)
        echo "Usage: $0 [--clean] [--serve] [--markdown]"
        echo "  --clean    Clean existing docs before generating"
        echo "  --serve    Serve docs after generation"
        echo "  --markdown Generate markdown format instead of HTML"
        exit 0
        ;;
    esac
done

# List of packages with TypeDoc configuration
PACKAGES=(
    "packages/prompt-engineer"
    "packages/ui"
    "packages/schemas"
    "packages/services"
    "packages/storage"
    "packages/shared"
    "packages/api-client"
)

echo -e "${BLUE}📚 Promptliano Documentation Generator${NC}"
echo -e "${BLUE}=====================================\n${NC}"

# Function to generate docs for a package
generate_package_docs() {
    local package_path=$1
    local package_name=$(basename $package_path)
    
    echo -e "${YELLOW}📦 Processing ${package_name}...${NC}"
    
    cd "$package_path"
    
    # Clean if requested
    if [ "$CLEAN" = true ]; then
        echo "   Cleaning old documentation..."
        bun run docs:clean 2>/dev/null || true
    fi
    
    # Generate documentation
    if [ "$MARKDOWN" = true ]; then
        echo "   Generating markdown documentation..."
        bun run docs:markdown
    else
        echo "   Generating HTML documentation..."
        bun run docs:generate
    fi
    
    echo -e "${GREEN}   ✓ Documentation generated for ${package_name}${NC}\n"
    
    cd - > /dev/null
}

# Check if TypeDoc is installed
echo -e "${BLUE}Checking TypeDoc installation...${NC}"
if ! bun pm ls | grep -q "typedoc"; then
    echo -e "${YELLOW}Installing TypeDoc and plugins...${NC}"
    bun add -D typedoc typedoc-plugin-markdown typedoc-plugin-missing-exports typedoc-plugin-mermaid
fi

# Generate documentation for each package
echo -e "\n${BLUE}Generating documentation for all packages...${NC}\n"

for package in "${PACKAGES[@]}"
do
    if [ -d "$package" ]; then
        generate_package_docs "$package"
    else
        echo -e "${RED}   ✗ Package not found: $package${NC}"
    fi
done

# Create root documentation index
echo -e "${BLUE}Creating root documentation index...${NC}"

cat > docs/index.html <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Promptliano Documentation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            background: #f5f5f5;
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #007acc;
            padding-bottom: 0.5rem;
        }
        .packages {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-top: 2rem;
        }
        .package-card {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .package-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        .package-card h2 {
            margin-top: 0;
            color: #007acc;
        }
        .package-card p {
            color: #666;
            margin: 0.5rem 0;
        }
        .package-card a {
            display: inline-block;
            margin-top: 1rem;
            padding: 0.5rem 1rem;
            background: #007acc;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            transition: background 0.2s;
        }
        .package-card a:hover {
            background: #005a9e;
        }
    </style>
</head>
<body>
    <h1>🚀 Promptliano Documentation</h1>
    <p>API documentation for all Promptliano packages</p>
    
    <div class="packages">
        <div class="package-card">
            <h2>@promptliano/prompt-engineer</h2>
            <p>Advanced prompt optimization and engineering framework</p>
            <a href="../packages/prompt-engineer/docs/api/index.html">View Documentation</a>
        </div>
        
        <div class="package-card">
            <h2>@promptliano/ui</h2>
            <p>React component library with shadcn/ui components</p>
            <a href="../packages/ui/docs/api/index.html">View Documentation</a>
        </div>
        
        <div class="package-card">
            <h2>@promptliano/schemas</h2>
            <p>Zod schemas and validation for the entire ecosystem</p>
            <a href="../packages/schemas/docs/api/index.html">View Documentation</a>
        </div>
        
        <div class="package-card">
            <h2>@promptliano/services</h2>
            <p>Business logic and service layer implementations</p>
            <a href="../packages/services/docs/api/index.html">View Documentation</a>
        </div>
        
        <div class="package-card">
            <h2>@promptliano/storage</h2>
            <p>SQLite storage layer with migrations and caching</p>
            <a href="../packages/storage/docs/api/index.html">View Documentation</a>
        </div>
        
        <div class="package-card">
            <h2>@promptliano/shared</h2>
            <p>Shared utilities and types across all packages</p>
            <a href="../packages/shared/docs/api/index.html">View Documentation</a>
        </div>
        
        <div class="package-card">
            <h2>@promptliano/api-client</h2>
            <p>Type-safe API client for Promptliano services</p>
            <a href="../packages/api-client/docs/api/index.html">View Documentation</a>
        </div>
    </div>
    
    <p style="margin-top: 3rem; text-align: center; color: #666;">
        Generated on $(date '+%Y-%m-%d %H:%M:%S')
    </p>
</body>
</html>
EOF

echo -e "${GREEN}✓ Root documentation index created${NC}\n"

# Serve documentation if requested
if [ "$SERVE" = true ]; then
    echo -e "${BLUE}Starting documentation server...${NC}"
    echo -e "${YELLOW}Documentation will be available at: http://localhost:3000${NC}\n"
    npx serve docs
fi

echo -e "${GREEN}✅ Documentation generation complete!${NC}"
echo -e "${BLUE}View the documentation at: docs/index.html${NC}"