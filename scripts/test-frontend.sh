#!/bin/bash
#
# Frontend Testing script for TechModa
# Run frontend tests with various options
#

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Run frontend tests for TechModa"
    echo ""
    echo "Options:"
    echo "  -w, --watch           Run tests in watch mode"
    echo "  -c, --coverage        Run tests with coverage report"
    echo "  -u, --ui              Open Vitest UI"
    echo "  -f, --file PATTERN    Run tests matching file pattern"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run all tests once"
    echo "  $0 --watch            # Run tests in watch mode"
    echo "  $0 --coverage         # Run with coverage report"
    echo "  $0 --ui               # Open Vitest UI"
    echo "  $0 -f ProductCard     # Run ProductCard tests only"
    echo ""
    exit 1
}

# Check if frontend directory exists
if [ ! -d "frontend" ]; then
    echo -e "${YELLOW}⚠️  Frontend directory not found${NC}"
    echo "This script must be run from the project root"
    exit 1
fi

# Default values
WATCH_MODE=false
COVERAGE_MODE=false
UI_MODE=false
FILE_PATTERN=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -w|--watch)
            WATCH_MODE=true
            shift
            ;;
        -c|--coverage)
            COVERAGE_MODE=true
            shift
            ;;
        -u|--ui)
            UI_MODE=true
            shift
            ;;
        -f|--file)
            FILE_PATTERN="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Error: Unknown option $1"
            usage
            ;;
    esac
done

echo "=========================================="
echo "  TechModa - Frontend Tests"
echo "=========================================="
echo ""

# Check if node_modules exists
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    cd frontend
    npm install
    cd ..
    echo ""
fi

cd frontend

echo -e "${BLUE}📊 Test Configuration:${NC}"

# Build command
if [ "$UI_MODE" = true ]; then
    echo "   Mode: UI"
    echo ""
    echo "🚀 Opening Vitest UI in your browser..."
    npm run test:ui
elif [ "$COVERAGE_MODE" = true ]; then
    echo "   Mode: Coverage Report"
    echo ""
    echo "🔍 Running tests with coverage..."
    npm run test:coverage
    echo ""
    echo "=========================================="
    echo -e "${GREEN}✅ Coverage report generated!${NC}"
    echo ""
    echo "📄 View coverage report:"
    echo "   Open: frontend/coverage/index.html"
    echo "=========================================="
elif [ "$WATCH_MODE" = true ]; then
    echo "   Mode: Watch"
    if [ -n "$FILE_PATTERN" ]; then
        echo "   Filter: $FILE_PATTERN"
    fi
    echo ""
    echo "👀 Running tests in watch mode (Press Q to quit)..."
    if [ -n "$FILE_PATTERN" ]; then
        npm test -- --watch "$FILE_PATTERN"
    else
        npm test -- --watch
    fi
else
    echo "   Mode: Run Once"
    if [ -n "$FILE_PATTERN" ]; then
        echo "   Filter: $FILE_PATTERN"
    fi
    echo ""
    echo "🧪 Running tests..."
    if [ -n "$FILE_PATTERN" ]; then
        npm test -- "$FILE_PATTERN"
    else
        npm test
    fi
    echo ""
    echo "=========================================="
    echo -e "${GREEN}✅ Tests completed!${NC}"
    echo ""
    echo "💡 Useful commands:"
    echo "   Watch mode:     ./scripts/test-frontend.sh --watch"
    echo "   Coverage:       ./scripts/test-frontend.sh --coverage"
    echo "   UI:             ./scripts/test-frontend.sh --ui"
    echo "   Specific test:  ./scripts/test-frontend.sh -f ProductCard"
    echo "=========================================="
fi

cd ..
