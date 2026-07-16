#!/bin/bash
# prepare-agent-image.sh - Build air-gap ready Cockpit Git Agent image
# Run this script on a machine with internet access, then transfer the artifact.

set -e

echo "Building Cockpit Git Agent Image for Air-Gap Deployment"
echo "======================================================="

IMAGE_NAME="cockpit-agent-git"
IMAGE_TAG="latest"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
ARTIFACT_DIR="scripts/docker_git_image/airgap-artifacts"
OUTPUT_FILE="${ARTIFACT_DIR}/${IMAGE_NAME}.tar"

mkdir -p "${ARTIFACT_DIR}"

echo "  Image:  ${FULL_IMAGE_NAME}"
echo "  Output: ${OUTPUT_FILE}"
echo ""

# Detect proxy environment variables
PROXY_ARGS=""
if [ -n "${HTTP_PROXY}" ]; then
    PROXY_ARGS="${PROXY_ARGS} --build-arg HTTP_PROXY=${HTTP_PROXY}"
    echo "  HTTP Proxy:  ${HTTP_PROXY}"
fi
if [ -n "${HTTPS_PROXY}" ]; then
    PROXY_ARGS="${PROXY_ARGS} --build-arg HTTPS_PROXY=${HTTPS_PROXY}"
    echo "  HTTPS Proxy: ${HTTPS_PROXY}"
fi
if [ -n "${NO_PROXY}" ]; then
    PROXY_ARGS="${PROXY_ARGS} --build-arg NO_PROXY=${NO_PROXY}"
    echo "  No Proxy:    ${NO_PROXY}"
fi

if [ -z "${PROXY_ARGS}" ]; then
    echo "  No proxy detected — building with direct internet access"
fi
echo ""

# Must be run from the repo root (build context)
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${REPO_ROOT}"

echo "Building image..."
docker build \
    -t "${FULL_IMAGE_NAME}" \
    -f scripts/docker_git_image/Dockerfile \
    --no-cache \
    ${PROXY_ARGS} \
    .

echo ""
echo "Saving image to tar file..."
docker save "${FULL_IMAGE_NAME}" -o "${OUTPUT_FILE}"

echo "Compressing..."
gzip -f "${OUTPUT_FILE}"
COMPRESSED_FILE="${OUTPUT_FILE}.gz"

echo ""
echo "Build complete!"
echo "==============="
echo ""
echo "Transfer file: ${COMPRESSED_FILE}"
echo "File size:     $(du -h "${COMPRESSED_FILE}" | cut -f1)"
echo ""
echo "Air-Gap Deployment Instructions:"
echo "  1. Transfer ${COMPRESSED_FILE} to the target host"
echo "  2. gunzip cockpit-agent-git.tar.gz"
echo "  3. docker load -i cockpit-agent-git.tar"
echo "  4. Copy scripts/docker_git_image/.env.example to .env and configure:"
echo "       REDIS_HOST, REDIS_PASSWORD, AGENT_ID, COCKPIT_SHARED_SECRET,"
echo "       GIT_REPO_HOST_PATH, GIT_REPO_PATH, DOCKER_CONTAINER_NAME"
echo "  5. cd scripts/docker_git_image && docker compose up -d"
echo ""
echo "Or run directly:"
echo "  docker run -d \\"
echo "       -v /var/run/docker.sock:/var/run/docker.sock \\"
echo "       -v /opt/app/config:/opt/app/config \\"
echo "       -v ~/.ssh:/root/.ssh:ro \\"
echo "       -e REDIS_HOST=<host> \\"
echo "       -e REDIS_PORT=6379 \\"
echo "       -e REDIS_PASSWORD=<password> \\"
echo "       -e COCKPIT_SHARED_SECRET=<secret> \\"
echo "       -e AGENT_ID=<probe-hostname> \\"
echo "       -e GIT_REPO_PATH=/opt/app/config \\"
echo "       -e DOCKER_CONTAINER_NAME=<container> \\"
echo "       --restart unless-stopped \\"
echo "       ${FULL_IMAGE_NAME}"
echo ""

docker images "${FULL_IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
