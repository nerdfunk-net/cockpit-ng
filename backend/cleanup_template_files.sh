#!/bin/bash
#
# Template File Cleanup Script
#
# This script removes old template files from the file system after
# successful migration to database-only storage.
#
# Run this ONLY after verifying that all templates work correctly
# from the database.
#
# Usage: bash cleanup_template_files.sh [--backup|--delete]
#

set -e

TEMPLATE_DIR="../data/templates"
BACKUP_DIR="../data/templates.backup.$(date +%Y%m%d_%H%M%S)"

echo "========================================================================"
echo "Template File Cleanup Script"
echo "========================================================================"
echo ""

# Check if template directory exists
if [ ! -d "$TEMPLATE_DIR" ]; then
    echo "✗ Template directory not found: $TEMPLATE_DIR"
    exit 1
fi

# Count files
FILE_COUNT=$(find "$TEMPLATE_DIR" -type f | wc -l | tr -d ' ')
DISK_USAGE=$(du -sh "$TEMPLATE_DIR" | cut -f1)

echo "Found $FILE_COUNT template files using $DISK_USAGE of disk space"
echo ""

# Show list of files
echo "Files to be processed:"
find "$TEMPLATE_DIR" -type f -exec basename {} \; | head -20
if [ $FILE_COUNT -gt 20 ]; then
    echo "... and $(($FILE_COUNT - 20)) more files"
fi
echo ""

# Process based on argument
if [ "$1" == "--backup" ]; then
    echo "Creating backup before cleanup..."
    echo "Backup location: $BACKUP_DIR"
    echo ""
    read -p "Create backup? (yes/no): " confirm

    if [ "$confirm" == "yes" ]; then
        mv "$TEMPLATE_DIR" "$BACKUP_DIR"
        mkdir -p "$TEMPLATE_DIR"
        echo "✓ Backup created successfully"
        echo "✓ Original files moved to: $BACKUP_DIR"
        echo ""
        echo "To restore: mv \"$BACKUP_DIR\" \"$TEMPLATE_DIR\""
    else
        echo "Backup cancelled"
        exit 0
    fi

elif [ "$1" == "--delete" ]; then
    echo "⚠️  WARNING: This will PERMANENTLY DELETE all template files!"
    echo "⚠️  Make sure templates work from database before proceeding."
    echo ""
    read -p "Type 'DELETE' to confirm permanent deletion: " confirm

    if [ "$confirm" == "DELETE" ]; then
        find "$TEMPLATE_DIR" -type f -delete
        echo "✓ All template files deleted"
        echo "✓ Directory kept: $TEMPLATE_DIR"
    else
        echo "Deletion cancelled"
        exit 0
    fi

else
    echo "Usage: $0 [--backup|--delete]"
    echo ""
    echo "Options:"
    echo "  --backup   Move files to backup directory (safe, recommended)"
    echo "  --delete   Permanently delete files (use with caution)"
    echo ""
    echo "Recommendation: Use --backup first, test for a few days,"
    echo "then delete backup if everything works correctly."
    exit 1
fi

echo ""
echo "========================================================================"
echo "Cleanup Complete"
echo "========================================================================"
