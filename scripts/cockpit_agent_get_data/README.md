# Cockpit Get Data Agent

Lightweight Python agent that runs a **fixed SSH/SFTP pipeline** defined in `config.yaml`. The Cockpit backend triggers execution via Redis Pub/Sub; the agent connects to remote hosts with OpenSSH (`ssh` / `sftp`) and returns collected data as JSON.

## Features

- **Config-driven pipeline**: Commands are declared in `config.yaml` and loaded at startup — nothing else can run
- **Step types**: `execute` (remote shell command via SSH) and `sftp_get` (download a file via SFTP)
- **Ordered execution**: Steps run sequentially; a failure stops the pipeline
- **Redis Pub/Sub**: Real-time command delivery and response publishing
- **Health monitoring**: Automatic heartbeat every 30s
- **HMAC authentication**: Signed commands from the backend

## Architecture

```
Cockpit Backend → Redis Pub/Sub → Get Data Agent → ssh / sftp → remote host(s)
                                           ↓
                                   Return files + step results
```

## Installation

### Prerequisites

- Python 3.9+
- OpenSSH client (`ssh`, `sftp`) on the agent host
- `sshpass` only if using password authentication in `config.yaml`
- Redis access to the Cockpit Redis server
- SSH access from the agent host to configured targets (keys in `~/.ssh/` or paths in config)

### Step 1: Create Agent User

```bash
sudo useradd -r -s /bin/bash -d /opt/cockpit-agent-get-data cockpit-agent
sudo mkdir -p /opt/cockpit-agent-get-data
sudo chown cockpit-agent:cockpit-agent /opt/cockpit-agent-get-data
```

### Step 2: Install Agent

```bash
sudo cp -r scripts/cockpit_agent_get_data/* /opt/cockpit-agent-get-data/
sudo chown -R cockpit-agent:cockpit-agent /opt/cockpit-agent-get-data

sudo -u cockpit-agent python3 -m venv /opt/cockpit-agent-get-data/venv
sudo -u cockpit-agent /opt/cockpit-agent-get-data/venv/bin/pip install -r /opt/cockpit-agent-get-data/requirements.txt
```

### Step 3: Configure Pipeline (`config.yaml`)

Edit `/opt/cockpit-agent-get-data/config.yaml` before starting the agent:

```yaml
---
commands:
  - type: execute
    host: netcup
    username: mp
    ssh_key: true
    command: ls -l > /tmp/data
  - type: sftp_get
    host: netcup
    username: mp
    ssh_key: true
    src_file: /tmp/data
    dst_file: /tmp/cockpit/data_1
result:
  - key: data1
    file: /tmp/cockpit/data_1
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | yes | `execute` or `sftp_get` |
| `host` | yes | Target hostname, IP, or SSH config alias (`~/.ssh/config`) |
| `username` | yes | SSH username |
| `ssh_key` | no (default `true`) | Use SSH key authentication |
| `ssh_key_file` | no | Path to a specific private key |
| `password` | no | Password auth (requires `sshpass`; set `ssh_key: false`) |
| `port` | no (default `22`) | SSH port |
| `command` | execute only | Remote shell command (run on the remote host) |
| `src_file` | sftp_get only | Remote file path to download |
| `dst_file` | sftp_get only | Local path on the agent host where the file is saved |
| `result` | yes | Non-empty list of keyed result files (see below) |
| `result[].key` | yes | JSON key sent back to Cockpit (letters, digits, underscore) |
| `result[].file` | yes | Local file whose contents are mapped to that key |

### Step 4: Configure Environment (`.env`)

```bash
sudo cp /opt/cockpit-agent-get-data/.env.example /opt/cockpit-agent-get-data/.env
sudo nano /opt/cockpit-agent-get-data/.env
```

**Required settings:**

```bash
COCKPIT_SHARED_SECRET=<same secret as in Cockpit Settings → Agents>
REDIS_HOST=cockpit.example.com
REDIS_PASSWORD=your_redis_password
```

Register the agent in Cockpit with type **Get Data** and the same `AGENT_ID` / shared secret.

### Step 5: Install systemd Service

```bash
sudo cp /opt/cockpit-agent-get-data/cockpit-agent-get-data.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cockpit-agent-get-data
sudo systemctl start cockpit-agent-get-data
sudo systemctl status cockpit-agent-get-data
```

## Supported Redis Commands

Only two commands are accepted from the backend:

### `echo` — Health Check

```json
{
  "command_id": "test-1",
  "command": "echo",
  "params": { "message": "hello" }
}
```

### `get_data` — Run Pipeline

Triggers the full `config.yaml` pipeline. **Params are ignored** — the pipeline is not overridable via Redis.

```json
{
  "command_id": "uuid-here",
  "command": "get_data",
  "params": {}
}
```

**Success response:**

```json
{
  "command_id": "uuid-here",
  "status": "success",
  "output": {
    "steps": [
      {
        "type": "execute",
        "host": "netcup",
        "command": "ls -l > /tmp/data",
        "status": "success",
        "stdout": null,
        "stderr": null
      },
      {
        "type": "sftp_get",
        "host": "netcup",
        "src_file": "/tmp/data",
        "dst_file": "/tmp/cockpit/data_1",
        "status": "success",
        "size_bytes": 1234
      }
    ],
    "result": {
      "data1": "total 8\n-rw-r--r-- 1 mp mp 123 Apr  9 12:00 file.txt\n"
    }
  },
  "error": null,
  "execution_time_ms": 2100,
  "timestamp": 1711620000
}
```

From Cockpit, use `POST /api/cockpit-agent/get-data` or the generic command API with `command: "get_data"`.

## Local Testing (without Redis)

Use `run_local.py` to run the same pipeline as the agent without Cockpit or Redis:

```bash
cd scripts/cockpit_agent_get_data

# Human-readable summary + result file content
python run_local.py

# Debug logging (SSH/SFTP commands)
python run_local.py -v

# Alternate config file
python run_local.py --config /path/to/config.yaml

# Only print the result file body (e.g. for piping)
python run_local.py --content-only

# Full JSON output (same shape as the Redis response)
python run_local.py --json
```

Exit code is `0` on success, `1` on pipeline or config errors. No `COCKPIT_SHARED_SECRET` or Redis connection is required.

## Manual Testing (with Redis)

```bash
# Check agent registration
redis-cli -h cockpit.example.com -a your_password HGETALL agents:$(hostname)

# Subscribe to responses (separate terminal)
redis-cli -h cockpit.example.com -a your_password SUBSCRIBE cockpit-agent-response:$(hostname)

# Send echo (unsigned — agent rejects without valid HMAC in production)
# Use the Cockpit API or sign messages with COCKPIT_SHARED_SECRET
```

## Security

- **No arbitrary remote commands**: Only steps in `config.yaml` run; Redis cannot inject shell commands
- **No shell on agent host**: Remote work uses `ssh`/`sftp` with argument lists (`shell=False` on the agent)
- **HMAC-signed commands**: Backend messages must include a valid signature and fresh timestamp
- **Host keys**: Set `SSH_HOST_KEY_CHECKING=true` in production when host keys are managed
- **Credentials in config.yaml**: Keep `config.yaml` readable only by the agent user (`chmod 600`)

## Troubleshooting

### Agent won't start

```bash
sudo journalctl -u cockpit-agent-get-data -n 50
# Common: missing COCKPIT_SHARED_SECRET, invalid config.yaml, Redis unreachable
```

### SSH connection fails

```bash
# Test as the agent user
sudo -u cockpit-agent ssh -l mp netcup 'echo ok'
sudo -u cockpit-agent sftp -o User=mp netcup
```

### Pipeline step fails

Check journal logs for the failing step index. Execute steps stop the pipeline on non-zero SSH exit codes.

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis server host |
| `REDIS_PORT` | `6379` | Redis server port |
| `REDIS_PASSWORD` | — | Redis password |
| `REDIS_DB` | `0` | Redis database number |
| `COCKPIT_SHARED_SECRET` | — | HMAC shared secret (required) |
| `AGENT_ID` | hostname | Agent identifier |
| `CONFIG_PATH` | `./config.yaml` | Path to pipeline config |
| `COMMAND_TIMEOUT` | `60` | Per-step SSH/SFTP timeout (seconds) |
| `SSH_HOST_KEY_CHECKING` | `False` | Verify SSH host keys |
| `HEARTBEAT_INTERVAL` | `30` | Heartbeat frequency (seconds) |
| `LOGLEVEL` | `INFO` | Logging level |

## License

Same as Cockpit-NG project
