#!/usr/bin/env python3
"""
Test script to demonstrate debug logging in cmk_folder_utils.py
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import logging
from utils.cmk_folder_utils import (
    parse_folder_value, 
    normalize_folder_path, 
    build_checkmk_folder_path, 
    split_checkmk_folder_path
)

def test_folder_utils_debug():
    """Test folder utilities with debug logging enabled."""
    
    print("🔍 Testing CMK Folder Utils with DEBUG Logging")
    print("=" * 60)
    
    # Configure debug logging
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        force=True
    )
    
    print("\n🧪 Test 1: parse_folder_value with device data")
    print("-" * 40)
    
    # Mock device data
    device_data = {
        "name": "router-01", 
        "location": {"name": "datacenter-1"},
        "device_type": {"manufacturer": {"name": "Cisco"}},
        "_custom_field_data": {
            "net": "prod",
            "env": "production"
        }
    }
    
    # Test folder template parsing
    templates = [
        "/network/{name}",
        "/sites/{location}/devices", 
        "/env/{_custom_field_data.env}/{_custom_field_data.net}",
        "/mixed/{name}/{_custom_field_data.net}"
    ]
    
    for template in templates:
        print(f"\nTemplate: '{template}'")
        result = parse_folder_value(template, device_data)
        print(f"Result: '{result}'")
    
    print("\n🧪 Test 2: normalize_folder_path")
    print("-" * 40)
    
    paths_to_normalize = [
        "/network/devices/",
        "/network/devices",
        "/",
        "",
        "/single/",
        "/multiple/levels/deep/"
    ]
    
    for path in paths_to_normalize:
        print(f"\nNormalizing: '{path}'")
        result = normalize_folder_path(path)
        print(f"Result: '{result}'")
    
    print("\n🧪 Test 3: build_checkmk_folder_path")
    print("-" * 40)
    
    path_parts_list = [
        ["network", "routers"],
        ["sites", "datacenter-1", "switches"],
        [],
        ["single"],
        ["deep", "nested", "folder", "structure"]
    ]
    
    for parts in path_parts_list:
        print(f"\nBuilding from parts: {parts}")
        result = build_checkmk_folder_path(parts)
        print(f"Result: '{result}'")
    
    print("\n🧪 Test 4: split_checkmk_folder_path")
    print("-" * 40)
    
    paths_to_split = [
        "~network~routers",
        "~sites~datacenter-1~switches", 
        "/network/routers",
        "/",
        "~",
        "",
        "~single",
        "/single"
    ]
    
    for path in paths_to_split:
        print(f"\nSplitting: '{path}'")
        result = split_checkmk_folder_path(path)
        print(f"Result: {result}")
    
    print("\n" + "=" * 60)
    print("✅ Debug logging test completed!")
    print("\n💡 Notice how the debug messages show:")
    print("   • Input parameters and their values")
    print("   • Processing steps and intermediate results")
    print("   • Final output values")
    print("   • Variable resolution in templates")
    print("   • Path manipulation operations")

if __name__ == "__main__":
    test_folder_utils_debug()
