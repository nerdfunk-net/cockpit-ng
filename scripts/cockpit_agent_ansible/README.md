# Cockpit Ansible Agent

Lightweight Python agent that runs on remote hosts to gather Ansible facts on behalf of Cockpit. Receives commands from the Cockpit backend via Redis Pub/Sub, runs `ansible-playbook` against the specified target, and returns the collected facts as JSON.

## Features

- **Ansible Facts Gathering**: Run `get_facts.yml` against any IP address without a pre-existing inventory file
- **Redis Pub/Sub**: Real-time command delivery via Redis
- **Health Monitoring**: Automatic heartbeat every 30s
- **Command Buffering**: Queue commands locally when Redis is unavailable
- **Pluggable Architecture**: Easy to add custom commands

## Architecture

```
Cockpit Backend → Redis Pub/Sub → Cockpit Ansible Agent → ansible-playbook -i "IP,"
                                           ↓
                                     Send Facts JSON
```

## Installation

### Prerequisites

- Python 3.9+
- Ansible installed in the Python environment (`pip install ansible`)
- Redis access to Cockpit Redis server
- SSH access from the agent host to the target devices

### Step 1: Create Agent User

```bash
sudo useradd -r -s /bin/bash -d /opt/cockpit-agent cockpit-agent
sudo mkdir -p /opt/cockpit-agent
sudo chown cockpit-agent:cockpit-agent /opt/cockpit-agent
```

### Step 2: Install Agent

```bash
sudo cp -r scripts/cockpit_agent_ansible/* /opt/cockpit-agent/
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

### `get_facts` — Gather Ansible Facts

Runs `get_facts.yml` against the specified IP address using `ansible-playbook -i "IP,"` (no inventory file required). Returns the full `hostvars` dict for the target host.

**Request:**
```json
{
  "command_id": "uuid-here",
  "command": "get_facts",
  "params": {
    "ip_address": "192.168.1.1",
    "ansible_user": "root",
    "ansible_password": "secret",
    "ansible_port": 22
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ip_address` | string | required | Target host IP address |
| `ansible_user` | string | required | SSH user for Ansible to connect as |
| `ansible_password` | string | optional | SSH password (omit when using key auth) |
| `ansible_ssh_private_key_file` | string | optional | Path to SSH private key on the agent host |
| `ansible_port` | int | `22` | SSH port |

**Response:**
```json
{
  "command_id": "uuid-here",
  "status": "success",
  "output": {
    "facts": {
      "ansible_hostname": "router1",
      "ansible_fqdn": "router1.example.com",
      "ansible_distribution": "Ubuntu",
      "ansible_interfaces": ["lo", "eth0"],
      "..."
    },
    "ip_address": "192.168.1.1",
    "hostname": "router1.example.com"
  },
  "error": null,
  "execution_time_ms": 4231,
  "timestamp": 1711620000
}
```

`hostname` is resolved from `ansible_fqdn` → `ansible_hostname` → `ip_address` (fallback).

## Manual Testing

```bash
# Check agent registration
redis-cli -h cockpit.example.com -a your_password HGETALL agents:$(hostname)

# Subscribe to responses (open in a separate terminal)
redis-cli -h cockpit.example.com -a your_password SUBSCRIBE cockpit-agent-response:$(hostname)

# Send echo command
redis-cli -h cockpit.example.com -a your_password PUBLISH cockpit-agent:$(hostname) \
  '{"command_id":"1","command":"echo","params":{"message":"hello"}}'

# Send get_facts command
redis-cli -h cockpit.example.com -a your_password PUBLISH cockpit-agent:$(hostname) \
  '{"command_id":"2","command":"get_facts","params":{"ip_address":"192.168.1.1","ansible_user":"root","ansible_password":"secret"}}'
```

## Security

- **No shell injection**: `asyncio.create_subprocess_exec()` with a list of arguments — `shell=False`
- **No inventory file**: Target IP passed directly via `-i "IP,"` — no writable inventory files on disk
- **Credentials in memory only**: SSH password/key passed as Ansible extra-vars at runtime, never written to disk
- **Host key checking**: Disabled by default for dynamic targets; set `ANSIBLE_HOST_KEY_CHECKING=True` in production if known-hosts are managed

## Troubleshooting

### Agent won't start

```bash
sudo journalctl -u cockpit-agent -n 50
# Common: Redis connection failed → check REDIS_HOST/PASSWORD
```

### Playbook fails with SSH error

```bash
# Test connectivity manually as the agent user
sudo -u cockpit-agent ansible all -i "192.168.1.1," -m ping \
  -e "ansible_user=root ansible_password=secret"
```

### Facts file not created

The playbook writes the facts file to a temp path and the agent reads it back. If the playbook exits 0 but no file is created, check that the `delegate_to: localhost` task has write permission to `/tmp`.

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
| `ANSIBLE_PLAYBOOK_DIR` | agent directory | Directory containing `get_facts.yml` |
| `ANSIBLE_TIMEOUT` | `60` | Max seconds to wait for `ansible-playbook` |
| `ANSIBLE_HOST_KEY_CHECKING` | `False` | Enable SSH host key verification |
| `HEARTBEAT_INTERVAL` | `30` | Heartbeat frequency in seconds |
| `LOGLEVEL` | `INFO` | Logging level |

## License

Same as Cockpit-NG project
