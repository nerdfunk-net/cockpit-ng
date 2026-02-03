#!/usr/bin/env python3
"""
Quick test script to verify the export functionality.

This script does a dry-run to check:
- Backend modules can be imported
- Database connection works
- Inventories can be retrieved
- Export format is correct

Usage:
    python test_export.py
"""

from __future__ import annotations

import os
import sys


def _prepend_backend_to_path() -> None:
    """Ensure backend is in path."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(os.path.dirname(script_dir))
    backend_path = os.path.join(repo_root, "backend")
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)


def test_imports():
    """Test that required modules can be imported."""
    print("Testing imports...")
    try:
        from repositories.inventory.inventory_repository import InventoryRepository
        from core.database import get_db_session
        from inventory_manager import inventory_manager
        print("✓ All imports successful")
        return True
    except ImportError as e:
        print(f"✗ Import error: {e}")
        return False


def test_database_connection():
    """Test database connection."""
    print("\nTesting database connection...")
    try:
        from core.database import get_db_session
        db = get_db_session()
        try:
            # Simple query to test connection
            result = db.execute("SELECT 1").scalar()
            print(f"✓ Database connection successful (result: {result})")
            return True
        finally:
            db.close()
    except Exception as e:
        print(f"✗ Database connection error: {e}")
        return False


def test_inventory_retrieval():
    """Test retrieving inventories from database."""
    print("\nTesting inventory retrieval...")
    try:
        from repositories.inventory.inventory_repository import InventoryRepository
        from core.database import get_db_session
        
        repo = InventoryRepository()
        db = get_db_session()
        try:
            inventories = db.query(repo.model).all()
            count = len(inventories)
            print(f"✓ Retrieved {count} inventories from database")
            
            if count > 0:
                # Show details of first inventory
                first = inventories[0]
                print(f"\n  Sample inventory:")
                print(f"    ID: {first.id}")
                print(f"    Name: {first.name}")
                print(f"    Scope: {first.scope}")
                print(f"    Active: {first.is_active}")
                print(f"    Created by: {first.created_by}")
            else:
                print("\n  Note: No inventories found in database")
                print("  This is normal for a new installation")
            
            return True
        finally:
            db.close()
    except Exception as e:
        print(f"✗ Inventory retrieval error: {e}")
        return False


def test_export_format():
    """Test export format generation."""
    print("\nTesting export format...")
    try:
        from inventory_manager import inventory_manager
        from repositories.inventory.inventory_repository import InventoryRepository
        from core.database import get_db_session
        import json
        
        repo = InventoryRepository()
        db = get_db_session()
        try:
            inventories = db.query(repo.model).limit(1).all()
            
            if not inventories:
                print("  Skipping (no inventories to test with)")
                return True
            
            # Convert to dict
            inventory_dict = inventory_manager._model_to_dict(inventories[0])
            
            # Test export format
            from export_all_inventories import create_export_data
            export_data = create_export_data(inventory_dict)
            
            # Validate structure
            assert "version" in export_data, "Missing version"
            assert export_data["version"] == 2, "Wrong version"
            assert "metadata" in export_data, "Missing metadata"
            assert "conditionTree" in export_data, "Missing conditionTree"
            assert "name" in export_data["metadata"], "Missing name in metadata"
            
            print("✓ Export format is valid")
            print(f"\n  Export structure:")
            print(f"    Version: {export_data['version']}")
            print(f"    Name: {export_data['metadata']['name']}")
            print(f"    Conditions: {len(export_data['conditionTree'].get('items', []))} items")
            
            return True
        finally:
            db.close()
    except Exception as e:
        print(f"✗ Export format error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("Inventory Export Test Suite")
    print("=" * 60)
    
    _prepend_backend_to_path()
    
    tests = [
        ("Imports", test_imports),
        ("Database Connection", test_database_connection),
        ("Inventory Retrieval", test_inventory_retrieval),
        ("Export Format", test_export_format),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"✗ Test '{name}' crashed: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✓ All tests passed! Export script is ready to use.")
        sys.exit(0)
    else:
        print("\n✗ Some tests failed. Please fix the issues before using export.")
        sys.exit(1)


if __name__ == "__main__":
    main()
