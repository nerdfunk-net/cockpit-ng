# Cockpit Ansible Agent

Lightweight Python agent that runs on remote hosts to gather Ansible facts on behalf of Cockpit. Receives commands from the Cockpit backend via Redis Pub/Sub, runs `ansible-playbook` against the specified target, and returns the collected facts as JSON.

## Features

- **Ansible Facts Gathering**: Run `get_facts.yml` against any IP address without a pre-existing inventory file
- **Cisco Network Facts**: Run `get_cisco_facts.yml` against Cisco IOS/NX-OS devices (`ansible_network_os` from platform network driver)
- **Open Port Scanning**: Run `scan_open_ports.yml` to list a host's listening TCP/UDP ports
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

**Authentication is required** — you must provide either `ansible_password` or `use_sshkey: true`.

#### Parameters

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ip_address` | string | required | Target host IP address |
| `ansible_user` | string | required | SSH user for Ansible to connect as |
| `ansible_password` | string | — | SSH password. Required unless `use_sshkey` is set |
| `use_sshkey` | bool | `false` | Use the agent host's default SSH key (`~/.ssh/id_rsa`). Required unless `ansible_password` is set |
| `ansible_ssh_private_key_file` | string | — | Path to a specific SSH private key on the agent host (only used together with `use_sshkey: true`) |
| `ansible_port` | int | `22` | SSH port |

#### Example — password authentication

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

#### Example — SSH key authentication (default key)

Uses the agent host's default SSH key (`~/.ssh/id_rsa` or whatever `ssh-agent` has loaded):

```json
{
  "command_id": "uuid-here",
  "command": "get_facts",
  "params": {
    "ip_address": "192.168.1.1",
    "ansible_user": "netops",
    "use_sshkey": true,
    "ansible_port": 22
  }
}
```

#### Example — SSH key authentication (specific key file)

Specify the exact private key the agent should use:

```json
{
  "command_id": "uuid-here",
  "command": "get_facts",
  "params": {
    "ip_address": "192.168.1.1",
    "ansible_user": "netops",
    "use_sshkey": true,
    "ansible_ssh_private_key_file": "/opt/cockpit-agent/.ssh/id_ed25519",
    "ansible_port": 22
  }
}
```

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

---

### `get_cisco_facts` — Gather Cisco IOS / NX-OS Facts

Runs `get_cisco_facts.yml` against the specified IP using `ansible.netcommon.network_cli`. Requires `ansible_network_os` so the playbook can select `cisco.ios.ios_facts` or `cisco.nxos.nxos_facts`.

The Cockpit backend maps Nautobot `platform.network_driver` → `ansible_network_os` before sending the command:

| network_driver | ansible_network_os |
|----------------|--------------------|
| `cisco_ios`    | `cisco.ios.ios`    |
| `cisco_nxos`   | `cisco.nxos.nxos`  |

**Authentication is required** — same modes as `get_facts`.

#### Parameters

Same connection parameters as `get_facts`, plus:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ansible_network_os` | string | required | `cisco.ios.ios` or `cisco.nxos.nxos` |

#### Example — Cisco IOS (password auth)

```json
{
  "command_id": "uuid-here",
  "command": "get_cisco_facts",
  "params": {
    "ip_address": "192.168.1.1",
    "ansible_user": "admin",
    "ansible_password": "secret",
    "ansible_network_os": "cisco.ios.ios",
    "ansible_port": 22
  }
}
```

#### Example — Cisco NX-OS (SSH key)

```json
{
  "command_id": "uuid-here",
  "command": "get_cisco_facts",
  "params": {
    "ip_address": "192.168.1.2",
    "ansible_user": "netops",
    "use_sshkey": true,
    "ansible_network_os": "cisco.nxos.nxos"
  }
}
```

**Response:** same shape as `get_facts`, with an extra `ansible_network_os` field in `output`. Hostname is resolved from `ansible_net_hostname` → `net_hostname` → `ansible_hostname` → `ip_address`.

---

### `get_open_ports` — Scan Open TCP/UDP Ports

Runs `scan_open_ports.yml` against the specified IP address using `ansible-playbook -i "IP,"` (no inventory file required). Returns each listening TCP/UDP port together with its bind address, discovered via `ss -tln`/`ss -uln` (no root required — no process/PID attribution). The bind address matters for security review: a port bound to `0.0.0.0`/`::`/`*` is reachable from any interface, while one bound to `127.0.0.1`/`::1` or a specific IP is not.

**Authentication is required** — same modes as `get_facts`: you must provide either `ansible_password` or `use_sshkey: true`.

#### Parameters

Identical connection parameters to `get_facts` (see table above): `ip_address`, `ansible_user`, `ansible_password`, `use_sshkey`, `ansible_ssh_private_key_file`, `ansible_port`.

#### Example — password authentication

```json
{
  "command_id": "uuid-here",
  "command": "get_open_ports",
  "params": {
    "ip_address": "192.168.1.1",
    "ansible_user": "root",
    "ansible_password": "secret",
    "ansible_port": 22
  }
}
```

**Response:**
```json
{
  "command_id": "uuid-here",
  "status": "success",
  "output": {
    "tcp_ports": [
      { "address": "0.0.0.0", "port": 22 },
      { "address": "127.0.0.1", "port": 80 }
    ],
    "udp_ports": [
      { "address": "0.0.0.0", "port": 68 }
    ],
    "ip_address": "192.168.1.1",
    "hostname": "router1.example.com"
  },
  "error": null,
  "execution_time_ms": 1876,
  "timestamp": 1711620000
}
```

## Manual Testing

```bash
# Check agent registration
redis-cli -h cockpit.example.com -a your_password HGETALL agents:$(hostname)

# Subscribe to responses (open in a separate terminal)
redis-cli -h cockpit.example.com -a your_password SUBSCRIBE cockpit-agent-response:$(hostname)

# Send echo command
redis-cli -h cockpit.example.com -a your_password PUBLISH cockpit-agent:$(hostname) \
  '{"command_id":"1","command":"echo","params":{"message":"hello"}}'

# Send get_facts command (password auth)
redis-cli -h cockpit.example.com -a your_password PUBLISH cockpit-agent:$(hostname) \
  '{"command_id":"2","command":"get_facts","params":{"ip_address":"192.168.1.1","ansible_user":"root","ansible_password":"secret"}}'

# Send get_facts command (SSH key auth)
redis-cli -h cockpit.example.com -a your_password PUBLISH cockpit-agent:$(hostname) \
  '{"command_id":"3","command":"get_facts","params":{"ip_address":"192.168.1.1","ansible_user":"netops","use_sshkey":true}}'

# Send get_open_ports command (password auth)
redis-cli -h cockpit.example.com -a your_password PUBLISH cockpit-agent:$(hostname) \
  '{"command_id":"4","command":"get_open_ports","params":{"ip_address":"192.168.1.1","ansible_user":"root","ansible_password":"secret"}}'

# Send get_cisco_facts command (Cisco IOS, SSH key)
redis-cli -h cockpit.example.com -a your_password PUBLISH cockpit-agent:$(hostname) \
  '{"command_id":"5","command":"get_cisco_facts","params":{"ip_address":"192.168.1.1","ansible_user":"admin","use_sshkey":true,"ansible_network_os":"cisco.ios.ios"}}'
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
# Test connectivity manually as the agent user (password auth)
sudo -u cockpit-agent ansible all -i "192.168.1.1," -m ping \
  -e "ansible_user=root ansible_password=secret"

# Test connectivity manually as the agent user (SSH key auth)
sudo -u cockpit-agent ansible all -i "192.168.1.1," -m ping \
  -e "ansible_user=netops"

# Test with a specific key file
sudo -u cockpit-agent ansible all -i "192.168.1.1," -m ping \
  -e "ansible_user=netops ansible_ssh_private_key_file=/opt/cockpit-agent/.ssh/id_ed25519"
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
