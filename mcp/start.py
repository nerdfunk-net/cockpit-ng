#!/usr/bin/env python3
"""
Startup script for Cockpit MCP Server.
This script properly initializes the MCP server and handles the protocol communication.
"""

import sys
import os

# Add paths for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Import our server
from server import mcp

def main():
    """Main entry point for the MCP server."""
    print("🚀 Starting Cockpit MCP Server...")
    print("📍 Server ready to accept MCP connections")
    print("🔐 Authentication: API key required")
    print("📚 Available resources: cockpit://devices, cockpit://device/{id}/config")
    print("🛠️  Available tools: scan_network, backup_device_configuration, sync_inventory, onboard_device, compare_configurations")
    print("⏹️  Press Ctrl+C to stop\n")
    
    try:
        # Run the MCP server
        # The FastMCP server handles all MCP protocol communication
        mcp.run()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down MCP server...")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Error starting MCP server: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()