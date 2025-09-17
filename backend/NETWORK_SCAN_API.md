# Network Scan API Endpoint

## Overview

The new `/api/jobs/scan-network/{cidr}` endpoint provides efficient network discovery using either traditional ping or fping for bulk scanning.

## Endpoint Details

**URL**: `POST /api/jobs/scan-network/{cidr}`

**Authentication**: Required (JWT token)

**Parameters**:
- `cidr` (path parameter): Network in CIDR notation (URL-encoded)

**Request Body**:
```json
{
  "ping_mode": "fping",     // "ping" or "fping" (default: "fping")
  "timeout": 1.5,           // Ping timeout in seconds (default: 1.5, range: 0.1-10.0)
  "max_concurrent": 10      // Max concurrent pings for "ping" mode (default: 10, range: 1-100)
}
```

**Response**:
```json
{
  "job_id": "network_scan_1234567890",
  "status": "started",
  "message": "Network scan started for 192.168.1.0/24"
}
```

## Usage Examples

### 1. Scan using fping (recommended for large networks)
```bash
curl -X POST "http://localhost:8000/api/jobs/scan-network/192.168.1.0%2F24" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"ping_mode": "fping"}'
```

### 2. Scan using traditional ping
```bash
curl -X POST "http://localhost:8000/api/jobs/scan-network/10.0.0.0%2F28" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"ping_mode": "ping", "max_concurrent": 5, "timeout": 2.0}'
```

### 3. Check job status
```bash
curl -X GET "http://localhost:8000/api/jobs/{job_id}" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

## Job Results

The scan results are stored in the job's `result_data` field:

```json
{
  "job": {
    "id": "network_scan_1234567890",
    "type": "network-scan",
    "status": "completed",
    "result_data": {
      "cidr": "192.168.1.0/24",
      "ping_mode": "fping",
      "total_targets": 254,
      "alive_hosts": ["192.168.1.1", "192.168.1.10", "192.168.1.50"],
      "unreachable_count": 251,
      "scan_duration": 2.34,
      "started_at": "2025-09-17T10:30:00Z",
      "completed_at": "2025-09-17T10:30:02Z"
    }
  }
}
```

## Features

- **Dual Ping Modes**: 
  - `fping`: Fast bulk scanning (recommended)
  - `ping`: Traditional individual host pinging
- **Async Execution**: Non-blocking background job processing
- **Progress Tracking**: Real-time scan progress updates
- **CIDR Support**: Full CIDR notation support with validation
- **Error Handling**: Comprehensive error handling and reporting
- **Job Integration**: Full integration with existing job management system

## Performance Considerations

- **fping mode**: Much faster for large networks, scans entire CIDR ranges in parallel
- **ping mode**: Better for small networks or when fping is not available
- **Network Size Limits**: Networks larger than /16 are rejected for safety
- **Concurrency**: Configurable concurrency limits prevent system overload

## Error Handling

Common error scenarios:
- Invalid CIDR notation → HTTP 400
- Networks too large (>/16) → HTTP 400  
- Missing fping binary → Falls back to ping mode
- Authentication required → HTTP 401

## Integration Notes

The endpoint integrates seamlessly with the existing job management system:
- Uses APScheduler for background execution
- Stores results in the job database
- Provides real-time progress updates
- Supports standard job querying endpoints