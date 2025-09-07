#!/usr/bin/env python3
"""
Test script to demonstrate the logging functionality in the cockpit-ng app.
This script shows that the app supports multiple log levels including DEBUG and INFO.
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import Settings

def test_logging_levels():
    """Test different logging levels to show they work."""
    import logging
    
    print("🔍 Testing Cockpit-NG Application Logging Support")
    print("=" * 60)
    
    # Get current settings
    settings = Settings()
    
    print(f"📋 Current Configuration:")
    print(f"   • LOG_LEVEL from env: {os.getenv('LOG_LEVEL', 'not set')}")
    print(f"   • Settings log_level: {settings.log_level}")
    print(f"   • Numeric level: {getattr(logging, settings.log_level, 'UNKNOWN')}")
    print()
    
    # Configure logging like the app does
    logging.basicConfig(
        level=getattr(logging, settings.log_level),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        force=True  # Override any existing configuration
    )
    
    logger = logging.getLogger(__name__)
    
    print("🧪 Testing all log levels:")
    print()
    
    # Test all log levels
    print("Attempting to log at different levels...")
    print("(You should see messages based on your LOG_LEVEL setting)")
    print()
    
    logger.debug("🐛 DEBUG: This is a debug message - detailed info for developers")
    logger.info("ℹ️  INFO: This is an info message - general information")
    logger.warning("⚠️  WARNING: This is a warning message - something might be wrong")
    logger.error("❌ ERROR: This is an error message - something went wrong")
    logger.critical("🚨 CRITICAL: This is a critical message - something is seriously wrong")
    
    print()
    print("✅ Log level test completed!")
    print()
    
    # Show what levels would be visible for different settings
    print("📊 Log Level Hierarchy (what you'd see at each level):")
    levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
    level_values = {level: getattr(logging, level) for level in levels}
    current_level_value = getattr(logging, settings.log_level)
    
    for level in levels:
        level_value = level_values[level]
        if level_value >= current_level_value:
            status = "✅ VISIBLE"
        else:
            status = "❌ HIDDEN"
        print(f"   • {level:8} ({level_value:2d}) - {status}")
    
    print()
    print("🎯 To change log level, set the LOG_LEVEL environment variable:")
    print("   export LOG_LEVEL=DEBUG    # Show all messages")
    print("   export LOG_LEVEL=INFO     # Show info and above (default)")
    print("   export LOG_LEVEL=WARNING  # Show warnings and above only")
    print("   export LOG_LEVEL=ERROR    # Show errors and above only")
    print()
    print("🔧 The app will pick up the LOG_LEVEL from:")
    print("   1. Environment variable LOG_LEVEL")
    print("   2. .env file setting")
    print("   3. Default to INFO if not set")

if __name__ == "__main__":
    test_logging_levels()
