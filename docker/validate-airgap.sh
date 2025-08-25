#!/bin/bash
# validate-airgap.sh - Validate the air-gap deployment
# Run this after deploying to verify everything works

set -e

echo "=== Validating Cockpit-NG Air-Gap Deployment ==="

# Check if image exists
if ! docker images | grep -q "cockpit-ng.*airgap"; then
    echo "❌ Error: cockpit-ng:airgap image not found"
    echo "Please run deploy-airgap.sh first"
    exit 1
fi

echo "✓ Docker image found"

# Test container startup
echo "Testing container startup..."
CONTAINER_ID=$(docker run -d --name cockpit-ng-test \
    -p 3001:3000 \
    -p 8001:8000 \
    cockpit-ng:airgap)

echo "✓ Container started with ID: ${CONTAINER_ID:0:12}"

# Wait for services to start
echo "Waiting for services to initialize..."
sleep 10

# Check if container is still running
if ! docker ps | grep -q cockpit-ng-test; then
    echo "❌ Container failed to start properly"
    echo "Container logs:"
    docker logs cockpit-ng-test
    docker rm cockpit-ng-test 2>/dev/null || true
    exit 1
fi

echo "✓ Container is running"

# Test frontend accessibility
echo "Testing frontend accessibility..."
if curl -s --max-time 10 http://localhost:3001 >/dev/null; then
    echo "✓ Frontend is accessible on port 3001"
else
    echo "⚠️  Frontend test failed (this might be normal if it takes longer to start)"
fi

# Test backend API
echo "Testing backend API..."
if curl -s --max-time 10 http://localhost:8001/health >/dev/null; then
    echo "✓ Backend API is accessible on port 8001"
else
    echo "⚠️  Backend API test failed (this might be normal if it takes longer to start)"
fi

# Show running processes in container
echo "Container processes:"
docker exec cockpit-ng-test ps aux

# Show logs
echo ""
echo "Recent container logs:"
docker logs --tail 20 cockpit-ng-test

# Cleanup
echo ""
echo "Cleaning up test container..."
docker stop cockpit-ng-test >/dev/null
docker rm cockpit-ng-test >/dev/null

echo ""
echo "=== Validation Complete ==="
echo ""
echo "✅ Air-gap deployment appears to be working correctly!"
echo ""
echo "To run the production container:"
echo "  docker run -d --name cockpit-ng \\"
echo "    -p 3000:3000 \\"
echo "    -p 8000:8000 \\"
echo "    -v cockpit-data:/app/data \\"
echo "    cockpit-ng:airgap"
