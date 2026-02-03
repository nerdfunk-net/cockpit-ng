#!/bin/bash
#
# Example usage script for inventory export
# This demonstrates various ways to use the export_all_inventories.py script
#

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "Inventory Export Examples"
echo "=========================================="
echo ""

# Example 1: Basic export
echo "Example 1: Export all inventories to ./exports"
echo "Command: python export_all_inventories.py"
echo ""
# Uncomment to run:
# python "$SCRIPT_DIR/export_all_inventories.py"

# Example 2: Active only
echo "Example 2: Export only active inventories"
echo "Command: python export_all_inventories.py --active-only"
echo ""
# Uncomment to run:
# python "$SCRIPT_DIR/export_all_inventories.py" --active-only

# Example 3: Custom output directory
echo "Example 3: Export to custom directory"
echo "Command: python export_all_inventories.py --output-dir /tmp/inventory_exports"
echo ""
# Uncomment to run:
# python "$SCRIPT_DIR/export_all_inventories.py" --output-dir /tmp/inventory_exports

# Example 4: Single file
echo "Example 4: Export all to a single JSON file"
echo "Command: python export_all_inventories.py --single-file"
echo ""
# Uncomment to run:
# python "$SCRIPT_DIR/export_all_inventories.py" --single-file

# Example 5: Timestamped backup
echo "Example 5: Create timestamped backup"
BACKUP_DIR="./backups/inventory_$(date +%Y%m%d_%H%M%S)"
echo "Command: python export_all_inventories.py --output-dir $BACKUP_DIR"
echo ""
# Uncomment to run:
# python "$SCRIPT_DIR/export_all_inventories.py" --output-dir "$BACKUP_DIR"

# Example 6: All options combined
echo "Example 6: Active inventories, custom dir, single file"
echo "Command: python export_all_inventories.py --active-only --output-dir ./production_backup --single-file"
echo ""
# Uncomment to run:
# python "$SCRIPT_DIR/export_all_inventories.py" --active-only --output-dir ./production_backup --single-file

echo "=========================================="
echo "To run these examples:"
echo "1. Edit this file and uncomment the desired example"
echo "2. Or run the commands directly from the terminal"
echo "=========================================="
