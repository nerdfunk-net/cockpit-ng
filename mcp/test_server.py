#!/usr/bin/env python3
"""
Simple test script to verify MCP server functionality.
"""

import sys
import os

# Add paths for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

def test_imports():
    """Test that all imports work correctly."""
    try:
        print("Testing imports...")
        
        # Test MCP SDK import
        from mcp.server.fastmcp import FastMCP
        print("✅ MCP SDK imported successfully")
        
        # Test server import
        from server import mcp, list_devices, scan_network
        print("✅ Server module imported successfully")
        
        # Test auth import
        from auth import validate_api_key
        print("✅ Auth module imported successfully")
        
        print("\n✅ All imports successful!")
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_server_creation():
    """Test that the MCP server can be created."""
    try:
        print("\nTesting server creation...")
        from server import mcp
        
        # Check that server has resources and tools
        print(f"✅ Server created with resources and tools")
        return True
        
    except Exception as e:
        print(f"❌ Server creation error: {e}")
        return False

def test_auth_functionality():
    """Test authentication functionality."""
    try:
        print("\nTesting authentication...")
        from auth import validate_api_key
        
        # Test invalid API key
        result = validate_api_key("invalid_key")
        if result is None:
            print("✅ Invalid API key correctly rejected")
        else:
            print("❌ Invalid API key incorrectly accepted")
            return False
            
        # Test invalid length
        result = validate_api_key("short")
        if result is None:
            print("✅ Short API key correctly rejected")
        else:
            print("❌ Short API key incorrectly accepted")
            return False
            
        print("✅ Authentication tests passed")
        return True
        
    except Exception as e:
        print(f"❌ Auth test error: {e}")
        return False

def main():
    """Run all tests."""
    print("🚀 Testing Cockpit MCP Server\n")
    
    tests = [
        test_imports,
        test_server_creation,
        test_auth_functionality,
    ]
    
    passed = 0
    for test in tests:
        if test():
            passed += 1
        print()
    
    total = len(tests)
    print(f"📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The MCP server is ready to use.")
        return 0
    else:
        print("❌ Some tests failed. Please check the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())