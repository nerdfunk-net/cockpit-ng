# Cockpit Get Data Agent — Docker Image

Air-gap ready Docker image for the [Cockpit Get Data Agent](../cockpit_agent_get_data/). The container bundles `openssh-client`, `sshpass`, Python dependencies, and agent source so it can run without network access at runtime.

The image listens for commands from Cockpit via Redis and runs a fixed SSH/SFTP pipeline defined in `config.yaml`.

## Build the image

The Dockerfile copies files from `scripts/cockpit_agent_get_data/` using paths relative to the **repository root**. Run build commands from the repo root — **not** from this `docker_get_data_image` directory.

### Option 1: prepare script (recommended for air-gap)

From the repository root:

```bash
./scripts/docker_get_data_image/prepare-agent-image.sh
```

This builds `cockpit-agent-get-data:latest` and saves a compressed artifact to `scripts/docker_get_data_image/airgap-artifacts/cockpit-agent-get-data.tar.gz` for transfer to disconnected hosts.

### Option 2: docker build

From the repository root:

```bash
docker build \
  -t cockpit-agent-get-data:latest \
  -f scripts/docker_get_data_image/Dockerfile \
  .
```

### Option 3: docker compose

`docker compose build` is run from **this directory**, but compose already sets the build context to the repo root (`../..`). You do not need to `cd` to the repo root for compose — only for a plain `docker build`.

```bash
cd scripts/docker_get_data_image
docker compose build
```

## Run the container

1. Copy `.env.example` to `.env` and set `REDIS_HOST`, `REDIS_PASSWORD`, `AGENT_ID`, and `COCKPIT_SHARED_SECRET` (must match Cockpit **Settings → Agents**).
2. Copy `../cockpit_agent_get_data/config.yaml` to this directory (or create your own) and edit the pipeline for your targets.
3. Set `SSH_KEY_DIR` to the host directory containing SSH private keys (mounted read-only into the container at `/root/.ssh`).
4. Ensure the external `backend` Docker network exists (same as other Cockpit agent images).
5. Start the agent:

```bash
cd scripts/docker_get_data_image
docker compose up -d
```

For local testing with a bundled Redis:

```bash
docker compose --profile dev up -d
```

Set `REDIS_HOST=redis` in `.env` when using the dev profile.

## Air-gap deployment

1. Build on a connected host using `prepare-agent-image.sh`.
2. Transfer `airgap-artifacts/cockpit-agent-get-data.tar.gz` to the target host.
3. Load the image:

```bash
gunzip cockpit-agent-get-data.tar.gz
docker load -i cockpit-agent-get-data.tar
```

4. Copy this directory (or at least `docker-compose.yaml`, `.env`, and `config.yaml`) to the target host, configure `.env` and `config.yaml`, and run `docker compose up -d`.

## Notes

- **SSH keys**: Private keys on the host must have mode `0600`. The container mounts them read-only for key-based authentication to target hosts. `sshpass` is included for password-based connections when configured in `config.yaml`.
- **Pipeline config**: Mount `config.yaml` read-only at `/app/config.yaml` (default in compose). Only steps declared in this file run — Redis cannot inject arbitrary remote commands.
- **Agent registration**: Register the agent in Cockpit with type **Get Data** and the same `AGENT_ID` and shared secret as in `.env`.
