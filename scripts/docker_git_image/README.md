# Cockpit Git Agent — Docker Image

Air-gap ready Docker image for the [Cockpit Git Agent](../cockpit_agent_git/). The container bundles `git`, the Docker CLI (client only), `openssh-client`, Python dependencies, and agent source so it can run without network access at runtime.

The image listens for commands from Cockpit via Redis and runs `git_pull` / `git_status` against a mounted repository and `docker_restart` against the host Docker daemon (via the mounted socket).

## Build the image

The Dockerfile copies files from `scripts/cockpit_agent_git/` using paths relative to the **repository root**. Run build commands from the repo root — **not** from this `docker_git_image` directory.

### Option 1: prepare script (recommended for air-gap)

From the repository root:

```bash
./scripts/docker_git_image/prepare-agent-image.sh
```

This builds `cockpit-agent-git:latest` and saves a compressed artifact to `scripts/docker_git_image/airgap-artifacts/cockpit-agent-git.tar.gz` for transfer to disconnected hosts.

### Option 2: docker build

From the repository root:

```bash
docker build \
  -t cockpit-agent-git:latest \
  -f scripts/docker_git_image/Dockerfile \
  .
```

### Option 3: docker compose

`docker compose build` is run from **this directory**, but compose already sets the build context to the repo root (`../..`). You do not need to `cd` to the repo root for compose — only for a plain `docker build`.

```bash
cd scripts/docker_git_image
docker compose build
```

## Run the container

1. Copy `.env.example` to `.env` and set `REDIS_HOST`, `REDIS_PASSWORD`, `AGENT_ID`, and `COCKPIT_SHARED_SECRET` (must match Cockpit **Settings → Agents**).
2. Set `GIT_REPO_HOST_PATH` to the host directory of the git repo to manage, and keep `GIT_REPO_PATH` aligned with the in-container path.
3. Set `DOCKER_CONTAINER_NAME` to the host container that should be restarted after pulls.
4. Optionally set `SSH_KEY_DIR` if git remotes use SSH.
5. Ensure the external `backend` Docker network exists (same as other Cockpit agent images).
6. Start the agent:

```bash
cd scripts/docker_git_image
docker compose up -d
```

For local testing with a bundled Redis:

```bash
docker compose --profile dev up -d
```

Set `REDIS_HOST=redis` in `.env` when using the dev profile.

## Air-gap deployment

1. Build on a connected host using `prepare-agent-image.sh`.
2. Transfer `airgap-artifacts/cockpit-agent-git.tar.gz` to the target host.
3. Load the image:

```bash
gunzip cockpit-agent-git.tar.gz
docker load -i cockpit-agent-git.tar
```

4. Copy this directory (or at least `docker-compose.yaml` and `.env`) to the target host, configure `.env`, and run `docker compose up -d`.

## Notes

- **Docker socket**: `/var/run/docker.sock` is mounted so `docker_restart` can restart containers on the **host** daemon. The image ships the Docker CLI only (no dockerd).
- **Git repo mount**: The host path in `GIT_REPO_HOST_PATH` is mounted at `GIT_REPO_PATH`. That path must appear in the agent’s allowed list (`GIT_REPO_PATH` env).
- **SSH keys**: Private keys on the host must have mode `0600` when using SSH remotes for `git pull`.
- **Agent registration**: Register the agent in Cockpit with type **git-based** and the same `AGENT_ID` and shared secret as in `.env`.
