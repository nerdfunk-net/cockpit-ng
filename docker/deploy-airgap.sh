#!/bin/bash
# deploy-airgap.sh - Deploy in air-gapped environment
# Run this script in the air-gapped environment after transferring artifacts

set -e

echo "=== Deploying Cockpit-NG in Air-Gapped Environment ==="

# Check if required files exist
if [[ ! -f "docker/airgap-artifacts/cockpit-base.tar" ]]; then
    echo "Error: cockpit-base.tar not found!"
    echo "Please transfer docker/airgap-artifacts/cockpit-base.tar to this location"
    exit 1
fi

if [[ ! -f "docker/airgap-artifacts/cockpit-ng-airgap.tar.gz" ]]; then
    echo "Error: cockpit-ng-airgap.tar.gz not found!"
    echo "Please transfer docker/airgap-artifacts/cockpit-ng-airgap.tar.gz to this location"
    exit 1
fi

echo "Step 1: Loading base image..."
docker load -i docker/airgap-artifacts/cockpit-base.tar
echo "✓ Base image loaded"

echo "Step 2: Extracting application..."
tar -xzf docker/airgap-artifacts/cockpit-ng-airgap.tar.gz
echo "✓ Application extracted"

echo "Step 3: Building final image..."
cp docker/.dockerignore.airgap .dockerignore
docker build -t cockpit-ng:airgap -f docker/Dockerfile.airgap .
rm .dockerignore
echo "✓ Image built successfully"

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "To run Cockpit-NG:"
echo "  docker run -d --name cockpit-ng \\"
echo "    -p 3000:3000 \\"
echo "    -p 8000:8000 \\"
echo "    -v cockpit-data:/app/data \\"
echo "    cockpit-ng:airgap"
echo ""
echo "Access the application at:"
echo "  Frontend: http://localhost:3000"
echo "  Backend API: http://localhost:8000"
