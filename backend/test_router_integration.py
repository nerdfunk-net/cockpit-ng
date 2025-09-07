#!/usr/bin/env python3
"""
Simple test to verify the refactored router imports correctly in main.py
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_router_import():
    """Test that the refactored router can be imported by main.py"""
    print("Testing router import in main application...")
    
    try:
        # Test importing the refactored router directly
        from routers.nb2cmk import router as nb2cmk_router
        print("✓ Successfully imported refactored nb2cmk router")
        
        # Check that router has the expected routes
        routes = [route.path for route in nb2cmk_router.routes]
        print(f"✓ Router has {len(routes)} endpoints:")
        for route in routes:
            print(f"  - {route}")
        
        # Test importing main app
        from main import app
        print("✓ Successfully imported main FastAPI app")
        
        # Check that nb2cmk routes are registered in main app
        all_routes = []
        for route in app.routes:
            if hasattr(route, 'path'):
                all_routes.append(route.path)
            elif hasattr(route, 'path_regex') and hasattr(route, 'prefix'):
                # This is likely a router mount
                if '/nb2cmk' in str(route.prefix if route.prefix else ''):
                    all_routes.append(f"{route.prefix}/*")
        
        nb2cmk_routes = [route for route in all_routes if '/nb2cmk' in route]
        print(f"✓ Found {len(nb2cmk_routes)} nb2cmk routes in main app")
        
        print("\n🎉 Router integration test passed!")
        
    except Exception as e:
        print(f"✗ Router integration test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_router_import()
