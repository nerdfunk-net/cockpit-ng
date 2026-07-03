# Cockpit Nmap Agent

Lightweight Python agent that runs nmap port scans on behalf of Cockpit. Receives scan requests from the Cockpit backend via Redis Pub/Sub and returns structured JSON with open TCP/UDP ports.

## Features

- **Network Port Scanning**: Scan a target IP or hostname using nmap
- **Structured JSON output**: TCP/UDP port lists compatible with Cockpit's open-ports parser
- **Redis Pub/Sub**: Real-time command delivery via Redis
- **Health Monitoring**: Automatic heartbeat every 30s
- **Pluggable Architecture**: Easy to add custom commands

## Architecture

```
Cockpit Backend → Redis Pub/Sub → Cockpit Nmap Agent → nmap(target)
                                          ↓
                                    Send JSON Response
```

## Installation

### Prerequisites

- Python 3.9+
- Redis access to Cockpit Redis server
- `nmap` binary installed on the agent host

```bash
# Debian/Ubuntu
sudo apt-get install nmap

# RHEL/CentOS
sudo yum install nmap
```

### Step 1: Create Agent User

```bash
sudo useradd -r -s /bin/bash -d /opt/cockpit-agent-nmap cockpit-agent
sudo mkdir -p /opt/cockpit-agent-nmap
sudo chown cockpit-agent:cockpit-agent /opt/cockpit-agent-nmap
```

### Step 2: Install Agent

```bash
sudo cp -r scripts/cockpit_agent_nmap/* /opt/cockpit-agent-nmap/
sudo chown -R cockpit-agent:cockpit-agent /opt/cockpit-agent-nmap

sudo -u cockpit-agent python3 -m venv /opt/cockpit-agent-nmap/venv
sudo -u cockpit-agent /opt/cockpit-agent-nmap/venv/bin/pip install -r /opt/cockpit-agent-nmap/requirements.txt
```

### Step 3: Configure

```bash
sudo cp /opt/cockpit-agent-nmap/.env.example /opt/cockpit-agent-nmap/.env
sudo nano /opt/cockpit-agent-nmap/.env
```

**Required settings:**

```bash
COCKPIT_SHARED_SECRET=<same secret configured in Cockpit Settings → Agents>
REDIS_HOST=cockpit.example.com
REDIS_PASSWORD=your_redis_password
AGENT_ID=nmap-probe-01
```

Register the same `AGENT_ID` and shared secret in Cockpit under **Settings → Agents**.

### Step 4: Install systemd Service

```bash
sudo cp /opt/cockpit-agent-nmap/cockpit-agent-nmap.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cockpit-agent-nmap
sudo systemctl start cockpit-agent-nmap
sudo systemctl status cockpit-agent-nmap
```

## Scan Types

| Type | nmap flag | Requires root |
|------|-----------|---------------|
| `connect` | `-sT` | No (default) |
| `syn` | `-sS` | Yes |
| `udp` | `-sU` | Yes |

For SYN and UDP scans, run the agent as root or grant the `cap_net_raw` capability to the nmap binary.

## Supported Commands

### `echo` — Health Check

```json
{
  "command_id": "test-1",
  "command": "echo",
  "params": { "message": "hello" }
}
```

### `scan_ports` — Port Scan

```json
{
  "command_id": "scan-1",
  "command": "scan_ports",
  "params": {
    "ip_address": "192.168.1.10",
    "ports": "22,80,443,8080",
    "scan_type": "connect",
    "service_detection": false,
    "timeout": 120
  }
}
```

**Response output:**

```json
{
  "ip_address": "192.168.1.10",
  "hostname": "server01.example.com",
  "host_status": "up",
  "tcp_ports": [
    { "address": "*", "port": 22 },
    { "address": "*", "port": 80 }
  ],
  "udp_ports": [],
  "scan_arguments": "-sT -Pn -p 22,80,443,8080",
  "services": []
}
```

## Cockpit API

From Cockpit, trigger a scan via:

```
POST /api/cockpit-agent/nmap/scan-ports
```

Or use **Agents → Operating** in the UI and click **Scan** on an nmap agent.

## Troubleshooting

- **Agent offline**: Check Redis connectivity and `COCKPIT_SHARED_SECRET` matches Cockpit settings
- **nmap not found**: Install nmap or set `NMAP_PATH` in `.env`
- **Operation not permitted**: Use `connect` scan type, or run as root for SYN/UDP scans
- **Scan timeout**: Increase `NMAP_TIMEOUT` or narrow the port range
