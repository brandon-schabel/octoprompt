#!/bin/bash

# Promptliano Pattern Performance Benchmark Runner
# Runs comprehensive performance tests for all pattern utilities

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Promptliano Pattern Performance Benchmarks${NC}"
echo -e "${BLUE}=============================================${NC}"

# Check if bun is available
if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Bun is not installed. Please install Bun first.${NC}"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "benchmarks" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory.${NC}"
    exit 1
fi

# Create results directory if it doesn't exist
mkdir -p benchmarks/results

# Parse command line arguments
EXPOSE_GC=false
MEMORY_LIMIT=""
PROFILE=false
ITERATIONS=""
HELP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --gc|--expose-gc)
            EXPOSE_GC=true
            shift
            ;;
        --memory-limit)
            MEMORY_LIMIT="--max-old-space-size=$2"
            shift 2
            ;;
        --profile)
            PROFILE=true
            shift
            ;;
        --iterations)
            ITERATIONS="--iterations=$2"
            shift 2
            ;;
        --help|-h)
            HELP=true
            shift
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            HELP=true
            shift
            ;;
    esac
done

if [ "$HELP" = true ]; then
    echo -e "${YELLOW}Usage: $0 [options]${NC}"
    echo
    echo "Options:"
    echo "  --gc, --expose-gc          Enable garbage collection analysis"
    echo "  --memory-limit SIZE        Set memory limit (e.g., 4096)"
    echo "  --profile                  Enable profiling"
    echo "  --iterations COUNT         Override default iteration count"
    echo "  --help, -h                 Show this help message"
    echo
    echo "Examples:"
    echo "  $0                         # Run with default settings"
    echo "  $0 --gc                    # Run with GC analysis"
    echo "  $0 --gc --memory-limit 4096 # Run with GC and 4GB memory limit"
    echo "  $0 --profile               # Run with profiling enabled"
    echo
    exit 0
fi

# Build the bun command
BUN_ARGS=""

if [ "$EXPOSE_GC" = true ]; then
    BUN_ARGS="$BUN_ARGS --expose-gc"
    echo -e "${GREEN}✅ Garbage collection analysis enabled${NC}"
fi

if [ ! -z "$MEMORY_LIMIT" ]; then
    BUN_ARGS="$BUN_ARGS $MEMORY_LIMIT"
    echo -e "${GREEN}✅ Memory limit set: $MEMORY_LIMIT${NC}"
fi

if [ "$PROFILE" = true ]; then
    BUN_ARGS="$BUN_ARGS --prof"
    echo -e "${GREEN}✅ Profiling enabled${NC}"
fi

# Show system information
echo
echo -e "${BLUE}📊 System Information${NC}"
echo "Node version: $(node --version 2>/dev/null || echo 'N/A')"
echo "Bun version: $(bun --version)"
echo "Platform: $(uname -s)"
echo "Architecture: $(uname -m)"
echo "Memory: $(free -h 2>/dev/null | grep '^Mem:' | awk '{print $2}' || echo 'N/A')"

# Check if TypeScript compilation is needed
echo
echo -e "${BLUE}🔧 Pre-flight checks${NC}"

# Verify all pattern files exist
PATTERN_FILES=(
    "packages/server/src/utils/route-helpers.ts"
    "packages/services/src/utils/error-factory.ts"
    "packages/schemas/src/schema-factories.ts"
    "packages/client/src/hooks/utils/hook-factory.ts"
    "packages/ui/src/components/data-table/column-factory.tsx"
)

for file in "${PATTERN_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Pattern file not found: $file${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ All pattern files found${NC}"

# Run type checking first
echo -e "${YELLOW}🔍 Running type checks...${NC}"
if ! bun run typecheck:schemas > /dev/null 2>&1; then
    echo -e "${RED}❌ Schema type checking failed${NC}"
    exit 1
fi

if ! bun run typecheck:services > /dev/null 2>&1; then
    echo -e "${RED}❌ Services type checking failed${NC}"
    exit 1
fi

if ! bun run typecheck:server > /dev/null 2>&1; then
    echo -e "${RED}❌ Server type checking failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Type checks passed${NC}"

# Clean up any previous benchmark results
echo -e "${YELLOW}🧹 Cleaning previous results...${NC}"
rm -f benchmarks/results/pattern-performance-results.json
rm -f benchmarks/results/benchmark-*.json

# Run the benchmark
echo
echo -e "${BLUE}🏃 Running benchmark suite...${NC}"
echo

# Add timestamp for result tracking
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
export BENCHMARK_TIMESTAMP=$TIMESTAMP

# Execute the benchmark
BENCHMARK_CMD="bun $BUN_ARGS run benchmarks/pattern-performance.ts $ITERATIONS"

echo -e "${YELLOW}Executing: $BENCHMARK_CMD${NC}"
echo

# Capture the exit code
if eval $BENCHMARK_CMD; then
    BENCHMARK_EXIT_CODE=0
else
    BENCHMARK_EXIT_CODE=$?
fi

echo
echo -e "${BLUE}📈 Benchmark completed${NC}"

# Check if results file was created
RESULTS_FILE="benchmarks/results/pattern-performance-results.json"
if [ -f "$RESULTS_FILE" ]; then
    echo -e "${GREEN}✅ Results saved to $RESULTS_FILE${NC}"
    
    # Show quick summary
    echo
    echo -e "${BLUE}📊 Quick Summary${NC}"
    if command -v jq &> /dev/null; then
        echo "Baseline performance (μs):"
        cat "$RESULTS_FILE" | jq -r '
            .suite.baseline | 
            to_entries[] | 
            "  \(.key): \(.value | . * 100 | round / 100)"
        '
        
        TOTAL_TESTS=$(cat "$RESULTS_FILE" | jq '.suite.results | length')
        PASSED_TESTS=$(cat "$RESULTS_FILE" | jq '[.suite.results[] | select(.success)] | length')
        FAILED_TESTS=$((TOTAL_TESTS - PASSED_TESTS))
        
        echo
        echo "Test Results: ${PASSED_TESTS}/${TOTAL_TESTS} passed"
        
        if [ $FAILED_TESTS -gt 0 ]; then
            echo -e "${RED}⚠️  $FAILED_TESTS tests failed${NC}"
        fi
    else
        echo -e "${YELLOW}ℹ️  Install jq for detailed result analysis${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Results file not found${NC}"
fi

# Check for profiling output
if [ "$PROFILE" = true ]; then
    echo
    echo -e "${BLUE}📊 Profiling output${NC}"
    ls -la isolate-*.log 2>/dev/null || echo "No profiling files found"
fi

# Performance recommendations
echo
echo -e "${BLUE}💡 Performance Recommendations${NC}"
echo "1. Run benchmarks regularly to catch regressions"
echo "2. Use --gc flag for memory analysis"
echo "3. Monitor baseline trends over time"
echo "4. Profile slow operations with --profile"

# Archive results with timestamp
if [ -f "$RESULTS_FILE" ]; then
    cp "$RESULTS_FILE" "benchmarks/results/benchmark-$TIMESTAMP.json"
    echo -e "${GREEN}✅ Results archived as benchmark-$TIMESTAMP.json${NC}"
fi

echo
if [ $BENCHMARK_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}🎉 Benchmark suite completed successfully!${NC}"
else
    echo -e "${RED}❌ Benchmark suite failed with exit code $BENCHMARK_EXIT_CODE${NC}"
fi

exit $BENCHMARK_EXIT_CODE