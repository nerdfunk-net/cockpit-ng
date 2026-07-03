# Cockpit Ansible Agent — Docker Image

Air-gap ready Docker image for the [Cockpit Ansible Agent](../cockpit_agent_ansible/). The container bundles `ansible`, `openssh-client`, `sshpass`, Python dependencies, and agent playbooks so it can run without network access at runtime.

The image listens for commands from Cockpit via Redis and runs Ansible playbooks against target hosts.

## Build the image

The Dockerfile copies files from `scripts/cockpit_agent_ansible/` using paths relative to the **repository root**. Run build commands from the repo root — **not** from this `docker_ansible_image` directory.

### Option 1: prepare script (recommended for air-gap)

From the repository root:

```bash
./scripts/docker_ansible_image/prepare-agent-image.sh
```

This builds `cockpit-agent-ansible:latest` and saves a compressed artifact to `scripts/docker_ansible_image/airgap-artifacts/cockpit-agent-ansible.tar.gz` for transfer to disconnected hosts.

### Option 2: docker build

From the repository root:

```bash
docker build \
  -t cockpit-agent-ansible:latest \
  -f scripts/docker_ansible_image/Dockerfile \
  .
```

### Option 3: docker compose

`docker compose build` is run from **this directory**, but compose already sets the build context to the repo root (`../..`). You do not need to `cd` to the repo root for compose — only for a plain `docker build`.

```bash
cd scripts/docker_ansible_image
docker compose build
```

## Run the container

1. Copy `.env.example` to `.env` and set `REDIS_HOST`, `REDIS_PASSWORD`, and `AGENT_ID`.
2. Set `SSH_KEY_DIR` to the host directory containing SSH private keys (mounted read-only into the container at `/root/.ssh`).
3. Ensure the external `backend` Docker network exists (same as other Cockpit agent images).
4. Start the agent:

```bash
cd scripts/docker_ansible_image
docker compose up -d
```

For local testing with a bundled Redis:

```bash
docker compose --profile dev up -d
```

Set `REDIS_HOST=redis` in `.env` when using the dev profile.

## Air-gap deployment

1. Build on a connected host using `prepare-agent-image.sh`.
2. Transfer `airgap-artifacts/cockpit-agent-ansible.tar.gz` to the target host.
3. Load the image:

```bash
gunzip cockpit-agent-ansible.tar.gz
docker load -i cockpit-agent-ansible.tar
```

4. Copy this directory (or at least `docker-compose.yaml` and `.env`) to the target host, configure `.env`, and run `docker compose up -d`.

## Notes

- **SSH keys**: Private keys on the host must have mode `0600`. The container mounts them read-only for key-based authentication to target hosts. `sshpass` is included for password-based Ansible connections when configured.
- **Playbooks**: Agent playbooks (e.g. `get_facts.yml`) are baked into the image at `/app`.
- **Agent registration**: Register the agent in Cockpit with type **Ansible** and the same `AGENT_ID` as in `.env`.
