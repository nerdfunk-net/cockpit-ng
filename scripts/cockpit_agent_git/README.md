# Cockpit Git Agent

Lightweight Python agent that runs on remote hosts to execute git and docker commands on behalf of Cockpit. Receives commands from the Cockpit backend via Redis Pub/Sub, runs them locally against configured repositories/containers, and returns the result.

## Features

- **Git Pull / Status**: Pull or inspect whitelisted git repositories
- **Docker Restart**: Restart a configured Docker container (used after config deploy/activation)
- **Redis Pub/Sub**: Real-time command delivery via Redis
- **Health Monitoring**: Automatic heartbeat every 30s
- **Command Buffering**: Queue commands locally when Redis is unavailable
- **Pluggable Architecture**: Easy to add custom commands
- **Secure**: Whitelisted paths, no shell injection, validation

## Architecture

```
Cockpit Backend → Redis Pub/Sub → Cockpit Git Agent → git / docker CLI
                                           ↓
                                     Send Response
```

## Installation

### Prerequisites

- Python 3.9+
- Redis access to Cockpit Redis server
- Git (for `git_pull` / `git_status`)
- Docker (for `docker_restart`)

### Step 1: Create Agent User

```bash
sudo useradd -r -s /bin/bash -d /opt/cockpit-agent-git cockpit-agent
sudo usermod -aG docker cockpit-agent
sudo mkdir -p /opt/cockpit-agent-git
sudo chown cockpit-agent:cockpit-agent /opt/cockpit-agent-git
```

### Step 2: Install Agent

```bash
sudo cp -r scripts/cockpit_agent_git/* /opt/cockpit-agent-git/
sudo chown -R cockpit-agent:cockpit-agent /opt/cockpit-agent-git

sudo -u cockpit-agent python3 -m venv /opt/cockpit-agent-git/venv
sudo -u cockpit-agent /opt/cockpit-agent-git/venv/bin/pip install -r /opt/cockpit-agent-git/requirements.txt
```

### Step 3: Configure

```bash
sudo cp /opt/cockpit-agent-git/.env.example /opt/cockpit-agent-git/.env
sudo nano /opt/cockpit-agent-git/.env
```

**Required settings:**
```bash
REDIS_HOST=cockpit.example.com
REDIS_PASSWORD=your_redis_password
COCKPIT_SHARED_SECRET=your_shared_secret
GIT_REPO_PATH=/opt/app/config
DOCKER_CONTAINER_NAME=app
```

### Step 4: Install systemd Service

```bash
sudo cp /opt/cockpit-agent-git/cockpit-agent-git.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cockpit-agent-git
sudo systemctl start cockpit-agent-git
sudo systemctl status cockpit-agent-git
```

## Supported Commands

### `echo` — Health Check

```json
{
  "command_id": "test-1",
  "command": "echo",
  "params": {
    "message": "hello"
  }
}
```

### `git_pull` — Pull a Whitelisted Repository

```json
{
  "command_id": "pull-1",
  "command": "git_pull",
  "params": {
    "repository_path": "/opt/app/config",
    "branch": "main"
  }
}
```

If `repository_path` is omitted, the first path in `GIT_REPO_PATH` is used.

### `git_status` — Status of a Whitelisted Repository

```json
{
  "command_id": "status-1",
  "command": "git_status",
  "params": {
    "repository_path": "/opt/app/config"
  }
}
```

### `docker_restart` — Restart Configured Container

```json
{
  "command_id": "restart-1",
  "command": "docker_restart",
  "params": {}
}
```

Uses `DOCKER_CONTAINER_NAME` from `.env` (first entry if a comma-separated list).

## Security

- **Whitelisting**: Only paths in `GIT_REPO_PATH` are allowed for git commands
- **No Shell Injection**: `subprocess` with list args
- **Timeouts**: `COMMAND_TIMEOUT` for git, `DOCKER_TIMEOUT` for docker
- **User Isolation**: Runs as non-root `cockpit-agent` user (docker group for socket access)
- **HMAC Auth**: Commands must be signed with `COCKPIT_SHARED_SECRET`

## Troubleshooting

### Agent won't start

```bash
sudo journalctl -u cockpit-agent-git -n 50
```

### Git pull fails

```bash
sudo -u cockpit-agent git -C /opt/app/config pull
```

### Docker restart fails

```bash
sudo -u cockpit-agent docker restart app
# User not in docker group → usermod -aG docker cockpit-agent
# Docker not running → systemctl start docker
# Container missing → docker ps -a
```

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| REDIS_HOST | localhost | Redis server host |
| REDIS_PORT | 6379 | Redis server port |
| REDIS_PASSWORD | - | Redis password |
| REDIS_DB | 0 | Redis database number |
| AGENT_ID | hostname | Agent identifier (auto-detected) |
| COCKPIT_SHARED_SECRET | - | Shared secret for HMAC (required) |
| GIT_REPO_PATH | /opt/app/config | Allowed git repo path(s), comma-separated |
| DOCKER_CONTAINER_NAME | app | Docker container name(s), comma-separated |
| HEARTBEAT_INTERVAL | 30 | Heartbeat interval (seconds) |
| COMMAND_TIMEOUT | 30 | Git command timeout (seconds) |
| DOCKER_TIMEOUT | 60 | Docker command timeout (seconds) |
| LOGLEVEL | INFO | Logging level |

## License

Same as Cockpit-NG project
