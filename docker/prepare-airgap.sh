#!/bin/bash
# prepare-airgap.sh - Prepare all artifacts for air-gapped deployment
# Run this script on a machine with internet access

set -e

echo "=== Preparing Cockpit-NG for Air-Gapped Deployment ==="

# Create directories for air-gap artifacts
mkdir -p docker/airgap-artifacts
mkdir -p docker/wheelhouse
mkdir -p docker/frontend-build

echo "Step 1: Building base Docker image with system dependencies..."
docker build -t cockpit-base:latest -f docker/Dockerfile.base .
docker save cockpit-base:latest -o docker/airgap-artifacts/cockpit-base.tar
echo "✓ Base image saved to docker/airgap-artifacts/cockpit-base.tar"

echo "Step 2: Creating Python wheelhouse..."
python3 -m venv .venv-temp
source .venv-temp/bin/activate
pip install --upgrade pip wheel
pip wheel -r backend/requirements.txt -w docker/wheelhouse --no-deps
pip wheel -r backend/requirements.txt -w docker/wheelhouse
deactivate
rm -rf .venv-temp
echo "✓ Python wheels saved to docker/wheelhouse/"

echo "Step 3: Building frontend..."
cd frontend
npm ci
npm run build
echo "✓ Frontend built successfully"

# Copy built frontend to docker context
cp -r .next ../docker/frontend-build/
cp -r public ../docker/frontend-build/
cp -r node_modules ../docker/frontend-build/
echo "✓ Frontend artifacts copied to docker/frontend-build/"

cd ..

echo "Step 4: Creating deployment package..."
# Create a complete package for transfer
tar -czf docker/airgap-artifacts/cockpit-ng-airgap.tar.gz \
    docker/wheelhouse \
    docker/frontend-build \
    docker/Dockerfile.airgap \
    docker/supervisord.conf \
    docker/start.sh \
    backend \
    frontend/package*.json \
    frontend/next.config.ts \
    frontend/postcss.config.mjs \
    frontend/tsconfig.json

echo "✓ Deployment package created: docker/airgap-artifacts/cockpit-ng-airgap.tar.gz"

echo ""
echo "=== Air-Gap Preparation Complete ==="
echo ""
echo "Files to transfer to air-gapped environment:"
echo "  - docker/airgap-artifacts/cockpit-base.tar (base image)"
echo "  - docker/airgap-artifacts/cockpit-ng-airgap.tar.gz (application)"
echo ""
echo "Total size:"
du -sh docker/airgap-artifacts/
echo ""
echo "Next steps in air-gapped environment:"
echo "  1. Load base image: docker load -i cockpit-base.tar"
echo "  2. Extract app: tar -xzf cockpit-ng-airgap.tar.gz"
echo "  3. Build app: docker build -t cockpit-ng:airgap -f docker/Dockerfile.airgap ."
echo "  4. Run: docker run -p 3000:3000 -p 8000:8000 cockpit-ng:airgap"
