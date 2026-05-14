#!/bin/bash

# N:N Search Setup Verification Script

echo "=================================="
echo "N:N Face Search - Setup Verification"
echo "=================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Not in optiexacta-studio directory${NC}"
    exit 1
fi

echo "📁 Project Directory: $(pwd)"
echo ""

# Check required files
echo "🔍 Checking required files..."
echo ""

files=(
    "nn_search.py:Python N:N script"
    "app/api/frs/nn-search/route.ts:API endpoint"
    "app/_comps/search-interface.tsx:Search UI component"
    "app/search/page.tsx:Search page"
    "NN_SEARCH_README.md:Documentation"
    "QUICK_START.md:Quick start guide"
)

all_good=true

for item in "${files[@]}"; do
    IFS=':' read -r file desc <<< "$item"
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $desc"
        echo -e "    ${YELLOW}→${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $desc"
        echo -e "    ${YELLOW}→${NC} $file (missing)"
        all_good=false
    fi
done

echo ""

# Check Node modules
echo "📦 Checking dependencies..."
if [ -d "node_modules" ]; then
    echo -e "  ${GREEN}✓${NC} Node modules installed"
else
    echo -e "  ${YELLOW}⚠${NC} Node modules not found. Run: npm install"
    all_good=false
fi

echo ""

# Check if Next.js dev server is running
echo "🔍 Checking if Next.js is running..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Next.js dev server is running"
    echo -e "    ${YELLOW}→${NC} http://localhost:3000"
    
    # Check if search page is accessible
    if curl -s http://localhost:3000/search > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} N:N Search page is accessible"
        echo -e "    ${YELLOW}→${NC} http://localhost:3000/search"
    else
        echo -e "  ${YELLOW}⚠${NC} Search page not accessible (may need restart)"
    fi
else
    echo -e "  ${YELLOW}⚠${NC} Next.js dev server is not running"
    echo -e "    Run: npm run dev"
fi

echo ""

# Check Python dependencies
echo "🐍 Checking Python dependencies..."
required_modules=("requests" "pandas" "openpyxl")
missing_modules=()

for module in "${required_modules[@]}"; do
    if python3 -c "import $module" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $module"
    else
        echo -e "  ${RED}✗${NC} $module (not installed)"
        missing_modules+=("$module")
        all_good=false
    fi
done

if [ ${#missing_modules[@]} -gt 0 ]; then
    echo ""
    echo -e "  ${YELLOW}Install missing modules:${NC}"
    echo "  pip install ${missing_modules[*]}"
fi

echo ""

# Check FRS API connectivity
echo "🌐 Checking FRS API connectivity..."
FRS_URL="http://172.203.130.108"

if curl -s --head --request GET "$FRS_URL" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} FRS API is reachable"
    echo -e "    ${YELLOW}→${NC} $FRS_URL"
else
    echo -e "  ${RED}✗${NC} FRS API is not reachable"
    echo -e "    ${YELLOW}→${NC} $FRS_URL"
    echo -e "    ${YELLOW}Note:${NC} This may be expected if on different network"
fi

echo ""
echo "=================================="

if $all_good; then
    echo -e "${GREEN}✅ Setup verification complete - All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Start Next.js: npm run dev"
    echo "2. Open browser: http://localhost:3000/search"
    echo "3. Upload probe and target images"
    echo "4. Start N:N search!"
else
    echo -e "${YELLOW}⚠️  Setup verification complete - Some issues found${NC}"
    echo ""
    echo "Please fix the issues above before proceeding."
fi

echo "=================================="
echo ""
