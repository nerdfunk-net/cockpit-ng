# Cockpit Ping Agent

Lightweight Python agent that runs on remote network hosts to probe IP reachability on behalf of Cockpit. Receives device+IP lists from the Cockpit backend via Redis Pub/Sub and returns per-IP latency results.

## Features

- **Network Reachability Probing**: Ping multiple devices and IPs concurrently
- **Redis Pub/Sub**: Real-time command delivery via Redis
- **Health Monitoring**: Automatic heartbeat every 30s
- **Command Buffering**: Queue commands locally when Redis is unavailable
- **Pluggable Architecture**: Easy to add custom commands

## Architecture

```
Cockpit Backend → Redis Pub/Sub → Cockpit Ping Agent → ping(ip)
                                          ↓
                                    Send Response
```

## Installation

### Prerequisites

- Python 3.9+
- Redis access to Cockpit Redis server
- `ping` binary available on the host (standard on all Linux/macOS)

### Step 1: Create Agent User

```bash
sudo useradd -r -s /bin/bash -d /opt/cockpit-agent cockpit-agent
sudo mkdir -p /opt/cockpit-agent
sudo chown cockpit-agent:cockpit-agent /opt/cockpit-agent
```

### Step 2: Install Agent

```bash
sudo cp -r scripts/cockpit_agent_ping/* /opt/cockpit-agent/
sudo chown -R cockpit-agent:cockpit-agent /opt/cockpit-agent

sudo -u cockpit-agent python3 -m venv /opt/cockpit-agent/venv
sudo -u cockpit-agent /opt/cockpit-agent/venv/bin/pip install -r /opt/cockpit-agent/requirements.txt
```

### Step 3: Configure

```bash
sudo cp /opt/cockpit-agent/.env.example /opt/cockpit-agent/.env
sudo nano /opt/cockpit-agent/.env
```

**Required settings:**
```bash
REDIS_HOST=cockpit.example.com
REDIS_PASSWORD=your_redis_password
```

### Step 4: Install systemd Service

```bash
sudo cp /opt/cockpit-agent/cockpit-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cockpit-agent
sudo systemctl start cockpit-agent
sudo systemctl status cockpit-agent
```

## Supported Commands

### `echo` — Health Check

```json
{
  "command_id": "test-1",
  "command": "echo",
  "params": { "message": "hello" }
}
```

Response:
```json
{
  "command_id": "test-1",
  "status": "success",
  "output": "hello",
  "error": null,
  "execution_time_ms": 0,
  "timestamp": 1711620000
}
```

---

### `ping` — Network Reachability Probe

Send a list of Nautobot devices with their associated IP addresses. The agent pings every IP concurrently and returns latency or marks it unreachable.

**Request:**
```json
{
  "command_id": "uuid-here",
  "command": "ping",
  "params": {
    "devices": [
      {
        "device_name": "router1",
        "device_id": "abc-123",
        "ip_addresses": ["192.168.1.1", "10.0.0.1/24"]
      },
      {
        "device_name": "switch2",
        "ip_addresses": ["10.0.0.2"]
      }
    ],
    "count": 3,
    "timeout": 5
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `devices` | array | required | List of devices to probe |
| `devices[].device_name` | string | required | Human-readable name (e.g. Nautobot device name) |
| `devices[].device_id` | string | optional | Nautobot UUID — passed through unchanged for correlation |
| `devices[].ip_addresses` | array | required | IP addresses to ping; CIDR notation (`10.0.0.1/24`) is accepted |
| `count` | int | 3 | ICMP packets sent per IP |
| `timeout` | int | 5 | Per-ping wait timeout in seconds |

**Response:**
```json
{
  "command_id": "uuid-here",
  "status": "success",
  "output": {
    "results": [
      {
        "device_name": "router1",
        "device_id": "abc-123",
        "ip_results": [
          {
            "ip_address": "192.168.1.1",
            "reachable": true,
            "latency_ms": 12.4,
            "packet_loss_percent": 0
          },
          {
            "ip_address": "10.0.0.1",
            "reachable": false,
            "latency_ms": null,
            "packet_loss_percent": 100
          }
        ]
      },
      {
        "device_name": "switch2",
        "device_id": null,
        "ip_results": [
          {
            "ip_address": "10.0.0.2",
            "reachable": true,
            "latency_ms": 0.573,
            "packet_loss_percent": 0
          }
        ]
      }
    ],
    "total_devices": 2,
    "reachable_count": 2,
    "unreachable_count": 1
  },
  "error": null,
  "execution_time_ms": 3200,
  "timestamp": 1711620000
}
```

`reachable_count` / `unreachable_count` count individual IPs, not devices.

## Manual Testing

```bash
# Check agent registration
redis-cli -h cockpit.example.com -a your_password HGETALL agents:$(hostname)

# Subscribe to responses
redis-cli -h cockpit.example.com -a your_password SUBSCRIBE cockpit-agent-response:$(hostname)

# Send echo command
redis-cli -h cockpit.example.com -a your_password PUBLISH cockpit-agent:$(hostname) \
  '{"command_id":"1","command":"echo","params":{"message":"hello"}}'

# Send ping command
redis-cli -h cockpit.example.com -a your_password PUBLISH cockpit-agent:$(hostname) \
  '{"command_id":"2","command":"ping","params":{"devices":[{"device_name":"localhost","ip_addresses":["127.0.0.1","192.0.2.1"]}]}}'
```

`192.0.2.1` is TEST-NET-1 (RFC 5737) — guaranteed unreachable, useful for testing the `not_reachable` path.

## Security

- **No shell injection**: `asyncio.create_subprocess_exec()` with list args — no shell=True
- **IP validation**: All addresses validated with Python's `ipaddress` module before use
- **Concurrency cap**: `PING_MAX_CONCURRENCY` semaphore prevents resource exhaustion
- **No privilege escalation**: Relies on the OS setuid `ping` binary; the agent process itself runs as non-root `cockpit-agent`

## Troubleshooting

### Agent won't start

```bash
sudo journalctl -u cockpit-agent -n 50
# Common: Redis connection failed → check REDIS_HOST/PASSWORD
```

### Pings always unreachable

```bash
# Test ping manually as the agent user
sudo -u cockpit-agent ping -c 3 127.0.0.1
# If that fails, ping binary is missing or lacks setuid bit
```

### Agent appears offline

```bash
# Check last_heartbeat timestamp
redis-cli HGETALL agents:$(hostname)
# Should be < 90 seconds ago
```

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis server host |
| `REDIS_PORT` | `6379` | Redis server port |
| `REDIS_PASSWORD` | — | Redis password |
| `REDIS_DB` | `0` | Redis database number |
| `AGENT_ID` | hostname | Agent identifier (auto-detected) |
| `PING_COUNT` | `3` | ICMP packets sent per IP |
| `PING_TIMEOUT` | `5` | Per-ping wait timeout in seconds |
| `PING_MAX_CONCURRENCY` | `50` | Max concurrent pings |
| `HEARTBEAT_INTERVAL` | `30` | Heartbeat frequency in seconds |
| `LOGLEVEL` | `INFO` | Logging level |

## License

Same as Cockpit-NG project
