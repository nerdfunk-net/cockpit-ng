# Logging Configuration

This document describes how to control logging levels in the Cockpit application using the `LOG_LEVEL` environment variable.

## Overview

The Cockpit application supports configurable logging levels to help with debugging and operational monitoring. You can control the verbosity of logs by setting the `LOG_LEVEL` environment variable.

## Default Behavior

- **Default Level**: `INFO`
- **Format**: `%(asctime)s - %(name)s - %(levelname)s - %(message)s`
- **Output**: Both application logs and access logs are enabled

## Available Log Levels

The following log levels are available (from most verbose to least verbose):

| Level | Description | Use Case |
|-------|-------------|----------|
| `DEBUG` | Very detailed diagnostic information | Development, troubleshooting |
| `INFO` | General information about application operation | Normal production use |
| `WARNING` | Warning messages about potential issues | Production monitoring |
| `ERROR` | Error messages for handled exceptions | Production monitoring |
| `CRITICAL` | Critical errors that may cause application failure | Production monitoring |

## Usage Examples

### Docker Container

**Default logging (INFO level):**
```bash
docker run -p 8000:8000 cockpit-ng
```

**Debug logging (shows all debug messages):**
```bash
docker run -p 8000:8000 -e LOG_LEVEL=DEBUG cockpit-ng
```

**Quiet logging (warnings and errors only):**
```bash
docker run -p 8000:8000 -e LOG_LEVEL=WARNING cockpit-ng
```

### Docker Compose

```yaml
version: '3.8'
services:
  cockpit:
    image: cockpit-ng
    ports:
      - "8000:8000"
    environment:
      - LOG_LEVEL=DEBUG  # Set desired log level
```

### Local Development

```bash
# Set environment variable before starting
export LOG_LEVEL=DEBUG
python backend/start.py

# Or inline
LOG_LEVEL=DEBUG python backend/start.py
```

## Debug Messages

When `LOG_LEVEL=DEBUG` is set, you will see additional debug information including:

- **Startup Configuration**: Debug messages showing the configured log level
- **Nautobot Service**: Connection and configuration details
- **Network Scanning**: Detailed ping attempts and credential testing
- **Template Management**: File operations and template processing
- **Git Operations**: Repository management and remote URL handling

## Testing Log Levels

A test script is provided to demonstrate the different log levels:

```bash
./test-log-levels.sh
```

This script will:
1. Build the container with default settings
2. Start the container with INFO level (default)
3. Start the container with DEBUG level
4. Show the difference in log output

## Production Recommendations

- **Production**: Use `INFO` level for normal operations
- **Troubleshooting**: Temporarily switch to `DEBUG` level when investigating issues
- **High-volume environments**: Consider `WARNING` level to reduce log noise
- **Monitoring**: Use `ERROR` or `WARNING` levels for log aggregation systems

## Implementation Details

The LOG_LEVEL feature is implemented through:

1. **Environment Variable**: `LOG_LEVEL` (defaults to `INFO`)
2. **Configuration**: Read in `backend/config.py` 
3. **Application**: Applied in `backend/start.py` and `backend/start_isolated.py`
4. **Container**: Passed through supervisor configuration in `docker/supervisord.conf`

The logging configuration uses Python's standard `logging` module with `basicConfig()` and is applied to both the FastAPI application and the uvicorn server.
