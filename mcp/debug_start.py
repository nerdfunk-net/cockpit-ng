#!/usr/bin/env python3
"""
Debug startup script for Cockpit MCP Server.
"""

import sys
import os

print("🔍 Debug: Starting MCP server...")

# Add paths for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
print("🔍 Debug: Added backend path to sys.path")

try:
    # Import our server
    print("🔍 Debug: Importing server module...")
    from server import mcp
    print("🔍 Debug: Server module imported successfully")
    
    print("🚀 Starting Cockpit MCP Server...")
    print("📍 Server ready to accept MCP connections")
    print("🔐 Authentication: API key required")
    print("📚 Available resources: cockpit://devices, cockpit://device/{id}/config")
    print("🛠️  Available tools: scan_network, backup_device_configuration, sync_inventory, onboard_device, compare_configurations")
    print("⏹️  Press Ctrl+C to stop\n")
    
    print("🔍 Debug: About to call mcp.run()...")
    # Run the MCP server
    mcp.run()
    print("🔍 Debug: mcp.run() completed")
    
except ImportError as e:
    print(f"❌ Import Error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("🔍 Debug: Script completed")