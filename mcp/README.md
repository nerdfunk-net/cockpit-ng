# Cockpit MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with access to Cockpit's network automation capabilities including device management, configuration backup, network scanning, and inventory synchronization.

## Overview

This MCP server acts as a bridge between AI assistants (like Claude Desktop) and the Cockpit network automation platform. It provides standardized access to:

- **Device Management**: List and manage network devices in inventory
- **Configuration Backup**: Create and manage device configuration backups  
- **Network Scanning**: Discover devices on network ranges
- **Inventory Sync**: Synchronize device inventory with Nautobot
- **Device Onboarding**: Add new devices to the system
- **Configuration Comparison**: Compare device configurations

## Architecture

The server is built using the official [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk) and provides:

- **Resources**: Read-only data access (device lists, configurations)
- **Tools**: Actions with side effects (scanning, backup, sync)
- **Authentication**: API key-based authentication using Cockpit user database
- **Type Safety**: Pydantic models for structured input/output validation

## Prerequisites

- Python 3.11+
- Access to a running Cockpit backend (default: http://127.0.0.1:8000)
- Valid API key from a Cockpit user account

## Installation

### Option 1: Using pip (Recommended)

```bash
cd mcp

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Or install directly
pip install mcp httpx pydantic python-dotenv requests pytest pytest-asyncio
```

### Option 2: Using uv

```bash
# Install uv if you haven't already
curl -LsSf https://astral.sh/uv/install.sh | sh

# Navigate to the MCP directory
cd mcp

# Install dependencies
uv sync

# Install development dependencies (optional)
uv sync --extra dev
```

## Configuration

Create a `.env` file in the `mcp` directory:

```env
# Cockpit API Configuration
COCKPIT_API_URL=http://127.0.0.1:8000
COCKPIT_API_TIMEOUT=30

# Development API Key (optional, for testing)
COCKPIT_API_KEY=your-42-character-api-key-here

# Data Directory (optional)
DATA_DIRECTORY=../data
```

### Getting an API Key

**IMPORTANT**: You need a valid API key from the Cockpit backend to use the MCP server.

1. **Start the Cockpit backend server**:
   ```bash
   cd backend
   ./startup.sh
   ```

2. **Open the web interface**: Navigate to http://127.0.0.1:8000 in your browser

3. **Log in**: Use your admin username and password

4. **Generate API key**: 
   - Go to Profile settings (usually in the top-right menu)
   - Look for "API Key Management" section
   - Generate a new 42-character API key
   - **Copy this key - you'll need it for Claude Desktop**

5. **Test the API key** (optional):
   ```bash
   curl -X POST -H "X-Api-Key: YOUR-42-CHARACTER-API-KEY" \
     -H "Content-Type: application/json" \
     http://127.0.0.1:8000/auth/api-key-login
   ```

If the test returns a JWT token, your API key is working!

## Running the Server

### Option 1: Direct Python Execution (Recommended for testing)

```bash
# Navigate to the MCP directory
cd mcp

# Install dependencies first (if using pip)
pip install mcp httpx pydantic python-dotenv requests

# Test the server setup (optional)
python test_server.py

# Run the server directly
python start.py
```

### Option 2: Using uv (For development environment)

```bash
# Navigate to the MCP directory  
cd mcp

# Install dependencies
uv sync

# Run the server
uv run --no-project python start.py
```

The server will start and be available for MCP clients to connect to.

## MCP Client Integration

### Claude Desktop

Add the server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Option 1: Virtual Environment Python (Recommended)
```json
{
  "mcpServers": {
    "cockpit": {
      "command": "/Users/mp/programming/cockpit-ng/mcp/.venv/bin/python",
      "args": ["/Users/mp/programming/cockpit-ng/mcp/start.py"],
      "env": {
        "COCKPIT_API_KEY": "your-42-character-api-key-here"
      }
    }
  }
}
```

Option 2: Using cwd (Alternative)
```json
{
  "mcpServers": {
    "cockpit": {
      "command": ".venv/bin/python",
      "args": ["start.py"],
      "cwd": "/Users/mp/programming/cockpit-ng/mcp",
      "env": {
        "COCKPIT_API_KEY": "your-42-character-api-key-here"
      }
    }
  }
}
```

Option 2: Using uv
```json
{
  "mcpServers": {
    "cockpit": {
      "command": "uv",
      "args": ["run", "--no-project", "python", "start.py"],
      "cwd": "/path/to/cockpit-ng/mcp",
      "env": {
        "COCKPIT_API_KEY": "your-42-character-api-key-here"
      }
    }
  }
}
```

### Other MCP Clients

The server implements the standard MCP protocol and can be used with any MCP-compatible client.

## Available Resources

### `cockpit://devices`
List all devices in the inventory with details including:
- Device ID and name
- IP address
- Device type
- Status
- Location

### `cockpit://device/{device_id}/config`
Get the current configuration for a specific device.

## Available Tools

### `scan_network`
Scan a network range to discover devices.

**Parameters:**
- `network_range` (string): CIDR notation (e.g., "192.168.1.0/24")

### `backup_device_configuration`
Create a backup of device configuration.

**Parameters:**
- `device_id` (string): Unique identifier of the device

### `sync_inventory`
Synchronize device inventory with Nautobot.

**Parameters:** None

### `onboard_device`
Add a new device to the inventory.

**Parameters:**
- `device_name` (string): Name of the device
- `ip_address` (string): IP address of the device
- `device_type` (string): Type of device (router, switch, etc.)
- `location` (string, optional): Location of the device

### `compare_configurations`
Compare two device configurations.

**Parameters:**
- `device_id` (string): Device identifier
- `config1_id` (string): First configuration ID
- `config2_id` (string): Second configuration ID

## Authentication

The server uses API key authentication that integrates with the Cockpit user management system:

1. API keys are stored in the user profiles database
2. Keys must be exactly 42 characters long
3. Keys are validated against active user accounts
4. Authentication context is maintained for the duration of requests

## Testing

Run the test suite:

```bash
# Using uv
uv run pytest

# Using pip/python
python -m pytest tests/
```

Test coverage includes:
- Authentication functionality
- HTTP client operations
- MCP resource endpoints
- MCP tool endpoints
- Error handling

## Docker Deployment

Build and run the container:

```bash
# Build the image
docker build -t cockpit-mcp .

# Run the container
docker run -p 8001:8001 \
  -e COCKPIT_API_URL=http://host.docker.internal:8000 \
  -e COCKPIT_API_KEY=your-api-key \
  cockpit-mcp
```

## Development

### Project Structure

```
mcp/
├── server.py              # Main MCP server implementation
├── auth.py                # Authentication module
├── requirements.txt       # Python dependencies
├── tests/
│   ├── test_mcp_sdk.py    # Test suite for MCP functionality
│   └── __init__.py
├── Dockerfile             # Container configuration
└── README.md             # This file
```

### Adding New Tools

To add a new MCP tool:

1. Define the function with appropriate type hints
2. Add the `@mcp.tool()` decorator
3. Implement the logic using `CockpitAPIClient`
4. Add tests for the new functionality

Example:

```python
@mcp.tool()
async def my_new_tool(param1: str, param2: int) -> Dict[str, Any]:
    """Description of what this tool does."""
    api_key = get_api_key_from_context()
    client = CockpitAPIClient(api_key)
    
    try:
        response = await client.post("/my-endpoint", json={
            "param1": param1,
            "param2": param2
        })
        return response
    except Exception as e:
        logger.error(f"Tool failed: {e}")
        raise
```

### Adding New Resources

To add a new MCP resource:

1. Define the function with appropriate return type
2. Add the `@mcp.resource("uri://path")` decorator
3. Implement data fetching logic
4. Add tests for the resource

## Troubleshooting

### Connection Issues

- Ensure the Cockpit backend is running on the configured URL
- Check that the API key is valid and belongs to an active user
- Verify network connectivity between MCP server and backend

### Authentication Errors

- Confirm API key is exactly 42 characters
- Check that the user account is active
- Ensure the user profiles database is accessible

### MCP Client Issues

- Verify the client configuration matches the server setup
- Check that environment variables are properly set
- Review client logs for connection details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is part of the Cockpit network automation platform.