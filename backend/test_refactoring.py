"""
Test script to verify the refactored nb2cmk functionality.
"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

async def test_basic_functionality():
    """Test basic functionality of the refactored services."""
    
    print("Testing refactored NB2CMK services...")
    
    try:
        # Test config service
        from services.cmk_config_service import config_service
        print("✓ Config service import successful")
        
        default_site = config_service.get_default_site()
        print(f"✓ Default site: {default_site}")
        
        # Test device normalization service
        from services.cmk_device_normalization_service import device_normalization_service
        print("✓ Device normalization service import successful")
        
        # Test utils
        from utils.cmk_site_utils import get_device_site, get_device_folder
        from utils.cmk_folder_utils import parse_folder_value, normalize_folder_path
        print("✓ Utility functions import successful")
        
        # Test folder utils
        test_folder = normalize_folder_path("/test/folder/")
        print(f"✓ Folder normalization: '/test/folder/' -> '{test_folder}'")
        
        # Test folder template parsing
        test_template = parse_folder_value("/test/{name}", {"name": "device1"})
        print(f"✓ Template parsing: '/test/{{name}}' with name='device1' -> '{test_template}'")
        
        # Test models
        from models.nb2cmk import DeviceExtensions, DeviceComparison
        print("✓ Pydantic models import successful")
        
        # Test main service
        from services.cmk_nb2cmk_service import nb2cmk_service
        print("✓ Main NB2CMK service import successful")
        
        # Test default site endpoint
        default_site_response = nb2cmk_service.get_default_site()
        print(f"✓ Default site response: {default_site_response.default_site}")
        
        print("\n🎉 All basic functionality tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_basic_functionality())
    sys.exit(0 if success else 1)
