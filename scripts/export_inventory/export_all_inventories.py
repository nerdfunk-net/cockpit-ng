#!/usr/bin/env python3
"""
Export all inventories from the database to JSON files.

This script exports all inventories (both active and inactive) from the
PostgreSQL database to JSON files in the export format compatible with
the Import feature.

Usage:
    python export_all_inventories.py [--output-dir OUTPUT_DIR] [--active-only] [--single-file]

Options:
    --output-dir DIR    Directory to save exported files (default: ./exports)
    --active-only       Export only active inventories (default: all)
    --single-file       Export all inventories to a single JSON file
    --help             Show this help message

Each exported JSON file contains:
    - version: Format version (2)
    - metadata: Inventory metadata (name, description, scope, etc.)
    - conditionTree: The condition tree structure

Examples:
    # Export all inventories to ./exports directory (one file per inventory)
    python export_all_inventories.py

    # Export only active inventories
    python export_all_inventories.py --active-only

    # Export to custom directory
    python export_all_inventories.py --output-dir /path/to/exports

    # Export all inventories to a single file
    python export_all_inventories.py --single-file
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


def _prepend_backend_to_path() -> None:
    """
    Ensure the backend directory is importable so we can import
    project modules without installing the package.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(os.path.dirname(script_dir))
    backend_path = os.path.join(repo_root, "backend")
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Export all inventories from database to JSON files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./exports",
        help="Directory to save exported files (default: ./exports)",
    )
    parser.add_argument(
        "--active-only",
        action="store_true",
        help="Export only active inventories",
    )
    parser.add_argument(
        "--single-file",
        action="store_true",
        help="Export all inventories to a single JSON file",
    )
    return parser.parse_args()


def convert_conditions_to_tree(conditions: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Convert conditions to condition tree format.

    Args:
        conditions: List of conditions (can be flat or tree format)

    Returns:
        Condition tree or None if invalid
    """
    if not conditions:
        return None

    # Check if it's already in tree format (Version 2)
    if len(conditions) > 0:
        first_item = conditions[0]
        if isinstance(first_item, dict) and "version" in first_item and first_item["version"] == 2:
            return first_item.get("tree")

    # Legacy flat format - convert to tree
    # This should rarely happen with new data, but good for backwards compatibility
    tree = {
        "type": "root",
        "internalLogic": "AND",
        "items": []
    }

    for condition in conditions:
        if isinstance(condition, dict):
            # Create a condition item
            item = {
                "id": f"item-{len(tree['items']) + 1}",
                "field": condition.get("field", ""),
                "operator": condition.get("operator", ""),
                "value": condition.get("value", "")
            }
            tree["items"].append(item)

    return tree if tree["items"] else None


def create_export_data(inventory: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create export data structure for an inventory.

    Args:
        inventory: Inventory dictionary from database

    Returns:
        Export data dictionary
    """
    # Convert conditions to tree format
    condition_tree = convert_conditions_to_tree(inventory.get("conditions", []))

    if not condition_tree:
        # If no valid conditions, create an empty tree
        condition_tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": []
        }

    # Create export data
    export_data = {
        "version": 2,
        "metadata": {
            "name": inventory.get("name", "Unnamed"),
            "description": inventory.get("description", ""),
            "scope": inventory.get("scope", "global"),
            "exportedAt": datetime.utcnow().isoformat() + "Z",
            "exportedBy": "export_script",
            "originalId": inventory.get("id"),
            "created_by": inventory.get("created_by", "unknown"),
            "created_at": inventory.get("created_at"),
            "updated_at": inventory.get("updated_at"),
            "is_active": inventory.get("is_active", True),
        },
        "conditionTree": condition_tree,
    }

    return export_data


def sanitize_filename(name: str) -> str:
    """
    Sanitize inventory name for use as filename.

    Args:
        name: Inventory name

    Returns:
        Sanitized filename
    """
    # Replace invalid characters with hyphens
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        name = name.replace(char, "-")

    # Remove leading/trailing whitespace and dots
    name = name.strip(". ")

    # Replace multiple hyphens/spaces with single hyphen
    while "--" in name or "  " in name:
        name = name.replace("--", "-").replace("  ", " ")

    name = name.replace(" ", "-")

    # Convert to lowercase
    name = name.lower()

    # Limit length
    if len(name) > 100:
        name = name[:100]

    return name or "unnamed"


def export_inventories(
    output_dir: str,
    active_only: bool = False,
    single_file: bool = False,
) -> None:
    """
    Export all inventories from database to JSON files.

    Args:
        output_dir: Directory to save exported files
        active_only: Export only active inventories
        single_file: Export all to a single file
    """
    # Import backend modules
    try:
        from repositories.inventory.inventory_repository import InventoryRepository
    except ImportError as e:
        print(f"Error: Failed to import backend modules: {e}")
        print("Make sure you're running this script from the project root")
        sys.exit(1)

    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"Exporting inventories to: {output_path.absolute()}")
    print(f"Active only: {active_only}")
    print(f"Single file: {single_file}")
    print("-" * 60)

    # Initialize repository
    repo = InventoryRepository()

    # Get all inventories directly from the database
    # We use a simple query to get all inventories
    try:
        from core.database import get_db_session

        db = get_db_session()
        try:
            if active_only:
                inventories = db.query(repo.model).filter(repo.model.is_active).all()
            else:
                inventories = db.query(repo.model).all()

            print(f"Found {len(inventories)} inventories")

            if not inventories:
                print("No inventories found in database")
                return

            # Convert to dictionaries using inventory_manager
            from inventory_manager import inventory_manager

            inventory_dicts = [inventory_manager._model_to_dict(inv) for inv in inventories]

        finally:
            db.close()

    except Exception as e:
        print(f"Error retrieving inventories from database: {e}")
        sys.exit(1)

    # Export inventories
    if single_file:
        # Export all to a single file
        all_exports = []
        for inventory in inventory_dicts:
            export_data = create_export_data(inventory)
            all_exports.append(export_data)

        # Create filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"all_inventories_{timestamp}.json"
        filepath = output_path / filename

        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(all_exports, f, indent=2, ensure_ascii=False)
            print(f"\n✓ Exported {len(all_exports)} inventories to: {filename}")
            print(f"  File size: {filepath.stat().st_size / 1024:.2f} KB")
        except Exception as e:
            print(f"\n✗ Error writing file {filename}: {e}")

    else:
        # Export each inventory to a separate file
        success_count = 0
        error_count = 0

        for inventory in inventory_dicts:
            try:
                export_data = create_export_data(inventory)

                # Create filename from inventory name and ID
                name_part = sanitize_filename(inventory.get("name", "unnamed"))
                id_part = inventory.get("id", "0")
                filename = f"inventory-{name_part}-{id_part}.json"
                filepath = output_path / filename

                # Write to file
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(export_data, f, indent=2, ensure_ascii=False)

                print(f"✓ {filename}")
                success_count += 1

            except Exception as e:
                print(f"✗ Error exporting inventory '{inventory.get('name', 'unknown')}': {e}")
                error_count += 1

        # Summary
        print("-" * 60)
        print(f"Export complete!")
        print(f"  Success: {success_count}")
        print(f"  Errors: {error_count}")
        print(f"  Output directory: {output_path.absolute()}")


def main() -> None:
    """Main entry point."""
    # Ensure backend is in path
    _prepend_backend_to_path()

    # Parse arguments
    args = parse_args()

    # Run export
    try:
        export_inventories(
            output_dir=args.output_dir,
            active_only=args.active_only,
            single_file=args.single_file,
        )
    except KeyboardInterrupt:
        print("\n\nExport cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
