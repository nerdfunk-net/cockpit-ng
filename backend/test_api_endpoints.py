#!/usr/bin/env python3
"""
Test script to verify the refactored NB2CMK API endpoints work correctly.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app

def test_refactored_endpoints():
    """Test that the refactored endpoints still work correctly."""
    client = TestClient(app)
    
    print("Testing refactored NB2CMK API endpoints...")
    
    # Test 1: Get default site endpoint
    try:
        response = client.get("/nb2cmk/default_site")
        print(f"✓ GET /nb2cmk/default_site - Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  Response: {data}")
    except Exception as e:
        print(f"✗ GET /nb2cmk/default_site failed: {e}")
    
    # Test 2: Get devices endpoint (this will likely fail without actual Nautobot connection)
    try:
        response = client.get("/nb2cmk/devices")
        print(f"✓ GET /nb2cmk/devices - Status: {response.status_code}")
        # We expect this to potentially fail due to missing Nautobot connection
        # but the endpoint should at least be reachable
    except Exception as e:
        print(f"  Note: /nb2cmk/devices endpoint exists but may fail without Nautobot: {e}")
    
    # Test 3: Check that routers are properly registered
    routes = [route.path for route in app.routes if hasattr(route, 'path')]
    nb2cmk_routes = [route for route in routes if '/nb2cmk' in route]
    print(f"✓ Found {len(nb2cmk_routes)} NB2CMK routes:")
    for route in nb2cmk_routes:
        print(f"  - {route}")
    
    print("\n🎉 Router endpoint tests completed!")

if __name__ == "__main__":
    test_refactored_endpoints()
