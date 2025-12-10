#!/bin/bash
# deploy-all-in-one.sh - Deploy the all-in-one image in air-gapped environment
# Run this script in the air-gapped environment after transferring the image

set -e

echo "🔒 Deploying Cockpit-NG All-in-One in Air-Gapped Environment"
echo "==========================================================="

# Configuration
IMAGE_NAME="cockpit-ng"
IMAGE_TAG="all-in-one"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
CONTAINER_NAME="cockpit-ng"

# Function to check if file exists
check_file() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        echo "❌ Error: $file not found!"
        echo "   Please transfer the image file to this location"
        return 1
    fi
    return 0
}

# Look for compressed or uncompressed image file
COMPRESSED_FILE="docker/airgap-artifacts/${IMAGE_NAME}-${IMAGE_TAG}.tar.gz"
UNCOMPRESSED_FILE="docker/airgap-artifacts/${IMAGE_NAME}-${IMAGE_TAG}.tar"

if [[ -f "$COMPRESSED_FILE" ]]; then
    echo "📦 Found compressed image: $COMPRESSED_FILE"
    echo "🗜️ Decompressing image..."
    gunzip "$COMPRESSED_FILE"
    IMAGE_FILE="$UNCOMPRESSED_FILE"
elif [[ -f "$UNCOMPRESSED_FILE" ]]; then
    echo "📦 Found image: $UNCOMPRESSED_FILE"
    IMAGE_FILE="$UNCOMPRESSED_FILE"
else
    echo "❌ Error: No image file found!"
    echo "   Expected: $COMPRESSED_FILE or $UNCOMPRESSED_FILE"
    echo ""
    echo "   Please transfer one of these files:"
    echo "   - ${IMAGE_NAME}-${IMAGE_TAG}.tar.gz (compressed)"
    echo "   - ${IMAGE_NAME}-${IMAGE_TAG}.tar (uncompressed)"
    exit 1
fi

echo "📏 Image file size: $(du -h "$IMAGE_FILE" | cut -f1)"

echo ""
echo "📥 Loading Docker image..."
docker load -i "$IMAGE_FILE"

echo ""
echo "✅ Image loaded successfully!"

# Check if image was loaded
if ! docker images | grep -q "$IMAGE_NAME.*$IMAGE_TAG"; then
    echo "❌ Error: Image not found after loading"
    exit 1
fi

echo "📋 Loaded image details:"
docker images "$FULL_IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo ""
echo "🚀 Starting Cockpit-NG container..."

# Stop and remove existing container if it exists
if docker ps -a | grep -q "$CONTAINER_NAME"; then
    echo "🔄 Stopping existing container..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
fi

# Create and start the container
docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p 3000:3000 \
    -p 8000:8000 \
    -v cockpit-data:/app/data \
    "$FULL_IMAGE_NAME"

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check if container is running
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo "✅ Container is running successfully!"
    
    # Show container details
    echo ""
    echo "📊 Container Status:"
    docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    echo "🌐 Access URLs:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend API: http://localhost:8000"
    echo "   Health Check: http://localhost:8000/health"
    
    echo ""
    echo "📋 Useful Commands:"
    echo "   View logs: docker logs $CONTAINER_NAME"
    echo "   Follow logs: docker logs -f $CONTAINER_NAME"
    echo "   Stop: docker stop $CONTAINER_NAME"
    echo "   Restart: docker restart $CONTAINER_NAME"
    echo "   Shell access: docker exec -it $CONTAINER_NAME /bin/bash"
    
    echo ""
    echo "📂 Data Volume:"
    echo "   Name: cockpit-data"
    echo "   Mount: /app/data"
    echo "   Backup: docker run --rm -v cockpit-data:/data -v \$(pwd):/backup alpine tar czf /backup/cockpit-backup.tar.gz /data"
    
else
    echo "❌ Container failed to start!"
    echo ""
    echo "🔍 Container logs:"
    docker logs "$CONTAINER_NAME" 2>&1 || echo "No logs available"
    
    echo ""
    echo "🔍 Container status:"
    docker ps -a --filter "name=$CONTAINER_NAME"
    
    exit 1
fi

echo ""
echo "🎉 Cockpit-NG All-in-One Deployment Complete!"
echo "============================================="
