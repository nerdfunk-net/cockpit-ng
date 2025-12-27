#!/bin/bash
# migrate-component.sh - Migrate a single component to new structure
# Usage: ./migrate-component.sh <old-path> <new-path>
#
# Example:
#   ./migrate-component.sh components/nautobot-export components/features/nautobot/export

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

if [ "$#" -ne 2 ]; then
    echo -e "${RED}Error: Incorrect number of arguments${NC}"
    echo "Usage: $0 <old-path> <new-path>"
    echo ""
    echo "Example:"
    echo "  $0 components/nautobot-export components/features/nautobot/export"
    exit 1
fi

OLD_PATH="$1"
NEW_PATH="$2"
SRC_DIR="/Users/mp/programming/cockpit-ng/frontend/src"

# Validation
if [ ! -e "$SRC_DIR/$OLD_PATH" ]; then
    echo -e "${RED}Error: $OLD_PATH does not exist${NC}"
    exit 1
fi

if [ -e "$SRC_DIR/$NEW_PATH" ]; then
    echo -e "${RED}Error: $NEW_PATH already exists${NC}"
    exit 1
fi

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Component Migration Script                       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Old Path:${NC} $OLD_PATH"
echo -e "${YELLOW}New Path:${NC} $NEW_PATH"
echo ""

# Ask for confirmation
read -p "Proceed with migration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Migration cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}[1/6]${NC} Creating parent directory..."
mkdir -p "$SRC_DIR/$(dirname "$NEW_PATH")"
echo -e "  ${GREEN}✓ Created${NC}"

echo ""
echo -e "${BLUE}[2/6]${NC} Moving component files..."
cd "$SRC_DIR"
git mv "$OLD_PATH" "$NEW_PATH"
echo -e "  ${GREEN}✓ Moved${NC}"

echo ""
echo -e "${BLUE}[3/6]${NC} Updating imports in moved files..."
# Determine import paths (remove 'components/' prefix and file extension)
OLD_IMPORT="@/${OLD_PATH#components/}"
OLD_IMPORT="${OLD_IMPORT%.tsx}"
OLD_IMPORT="${OLD_IMPORT%.ts}"

NEW_IMPORT="@/${NEW_PATH#components/}"
NEW_IMPORT="${NEW_IMPORT%.tsx}"
NEW_IMPORT="${NEW_IMPORT%.ts}"

if [ -d "$NEW_PATH" ]; then
    # It's a directory - update all files inside
    COUNT=$(find "$NEW_PATH" -type f \( -name "*.tsx" -o -name "*.ts" \) -exec \
        sed -i '' "s|${OLD_IMPORT}|${NEW_IMPORT}|g" {} \; -print | wc -l)
    echo -e "  ${GREEN}✓ Updated $COUNT files${NC}"
else
    echo -e "  ${YELLOW}⊘ Skipped (single file)${NC}"
fi

echo ""
echo -e "${BLUE}[4/6]${NC} Finding files that import from old path..."
# Create temp file for file list
TEMP_FILE=$(mktemp)
grep -r "${OLD_IMPORT}" . --include="*.tsx" --include="*.ts" 2>/dev/null | \
    cut -d: -f1 | sort -u > "$TEMP_FILE" || true

FILE_COUNT=$(wc -l < "$TEMP_FILE" | tr -d ' ')
echo -e "  ${GREEN}✓ Found $FILE_COUNT files to update${NC}"

echo ""
echo -e "${BLUE}[5/6]${NC} Updating imports in other files..."
if [ "$FILE_COUNT" -gt 0 ]; then
    while IFS= read -r file; do
        sed -i '' "s|${OLD_IMPORT}|${NEW_IMPORT}|g" "$file"
        echo -e "    ${GREEN}✓${NC} ${file#./}"
    done < "$TEMP_FILE"
fi
rm "$TEMP_FILE"

echo ""
echo -e "${BLUE}[6/6]${NC} Running build check..."
cd /Users/mp/programming/cockpit-ng/frontend

if npm run build > /tmp/migration-build.log 2>&1; then
    echo -e "  ${GREEN}✓ Build successful${NC}"

    echo ""
    echo -e "${YELLOW}Committing changes...${NC}"
    git add -A
    COMMIT_MSG="refactor: move ${OLD_PATH} to ${NEW_PATH}"
    git commit -m "$COMMIT_MSG"
    echo -e "  ${GREEN}✓ Committed${NC}"

    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Migration Complete!                                     ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Summary:${NC}"
    echo -e "  • Moved: ${OLD_PATH} → ${NEW_PATH}"
    echo -e "  • Updated: ${FILE_COUNT} files"
    echo -e "  • Build: ✓ Passed"
    echo -e "  • Git: ✓ Committed"
    echo ""
else
    echo -e "  ${RED}✗ Build failed${NC}"
    echo ""
    echo -e "${RED}Build errors (last 20 lines):${NC}"
    tail -20 /tmp/migration-build.log
    echo ""
    echo -e "${YELLOW}Rolling back changes...${NC}"
    git reset --hard HEAD
    echo -e "  ${GREEN}✓ Changes rolled back${NC}"
    exit 1
fi
