# Cockpit Nmap Agent — Docker Image

Air-gap ready Docker image for the [Cockpit Nmap Agent](../cockpit_agent_nmap/). The container bundles the `nmap` binary, Python dependencies, and agent source so it can run without network access at runtime.

The image listens for scan commands from Cockpit via Redis and executes nmap against target hosts.

## Build the image

The Dockerfile copies files from `scripts/cockpit_agent_nmap/` using paths relative to the **repository root**. Run build commands from the repo root — **not** from this `docker_nmap_image` directory.

### Option 1: prepare script (recommended for air-gap)

From the repository root:

```bash
./scripts/docker_nmap_image/prepare-agent-image.sh
```

This builds `cockpit-agent-nmap:latest` and saves a compressed artifact to `scripts/docker_nmap_image/airgap-artifacts/cockpit-agent-nmap.tar.gz` for transfer to disconnected hosts.

### Option 2: docker build

From the repository root:

```bash
docker build \
  -t cockpit-agent-nmap:latest \
  -f scripts/docker_nmap_image/Dockerfile \
  .
```

### Option 3: docker compose

`docker compose build` is run from **this directory**, but compose already sets the build context to the repo root (`../..`). You do not need to `cd` to the repo root for compose — only for a plain `docker build`.

```bash
cd scripts/docker_nmap_image
docker compose build
```

## Run the container

1. Copy `.env.example` to `.env` and set `REDIS_HOST`, `REDIS_PASSWORD`, `AGENT_ID`, and `COCKPIT_SHARED_SECRET` (must match Cockpit **Settings → Agents**).
2. Ensure the external `backend` Docker network exists (same as other Cockpit agent images).
3. Start the agent:

```bash
cd scripts/docker_nmap_image
docker compose up -d
```

For local testing with a bundled Redis:

```bash
docker compose --profile dev up -d
```

Set `REDIS_HOST=redis` in `.env` when using the dev profile.

## Air-gap deployment

1. Build on a connected host using `prepare-agent-image.sh`.
2. Transfer `airgap-artifacts/cockpit-agent-nmap.tar.gz` to the target host.
3. Load the image:

```bash
gunzip cockpit-agent-nmap.tar.gz
docker load -i cockpit-agent-nmap.tar
```

4. Copy this directory (or at least `docker-compose.yaml` and `.env`) to the target host, configure `.env`, and run `docker compose up -d`.

## Notes

- **NET_RAW**: Compose adds `cap_add: NET_RAW` so SYN and UDP scans work without running as root. Connect scans (`NMAP_DEFAULT_SCAN_TYPE=connect`) work without it.
- **Agent registration**: Register the agent in Cockpit with type **Nmap** and the same `AGENT_ID` and shared secret as in `.env`.
