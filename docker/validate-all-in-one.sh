#!/bin/bash
# validate-all-in-one.sh - Validate the all-in-one deployment
# Run this after deploying to verify everything works correctly

set -e

echo "🔍 Validating Cockpit-NG All-in-One Deployment"
echo "=============================================="

# Configuration
CONTAINER_NAME="cockpit-ng"
FRONTEND_URL="http://localhost:3000"
BACKEND_URL="http://localhost:8000"
HEALTH_URL="http://localhost:8000/health"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status="$1"
    local message="$2"
    case "$status" in
        "pass") echo -e "${GREEN}✅ $message${NC}" ;;
        "fail") echo -e "${RED}❌ $message${NC}" ;;
        "warn") echo -e "${YELLOW}⚠️ $message${NC}" ;;
        *) echo "$message" ;;
    esac
}

# Test 1: Check if image exists
echo "🐳 Checking Docker image..."
if docker images | grep -q "cockpit-ng.*all-in-one"; then
    print_status "pass" "Docker image found"
else
    print_status "fail" "Docker image not found"
    exit 1
fi

# Test 2: Check if container is running
echo ""
echo "📦 Checking container status..."
if docker ps | grep -q "$CONTAINER_NAME"; then
    print_status "pass" "Container is running"
    
    # Get container details
    CONTAINER_ID=$(docker ps --filter "name=$CONTAINER_NAME" --format "{{.ID}}")
    CONTAINER_STATUS=$(docker ps --filter "name=$CONTAINER_NAME" --format "{{.Status}}")
    echo "   Container ID: ${CONTAINER_ID:0:12}"
    echo "   Status: $CONTAINER_STATUS"
else
    print_status "fail" "Container is not running"
    
    # Check if container exists but is stopped
    if docker ps -a | grep -q "$CONTAINER_NAME"; then
        print_status "warn" "Container exists but is stopped"
        echo ""
        echo "📋 Container logs:"
        docker logs --tail 20 "$CONTAINER_NAME"
    fi
    exit 1
fi

# Test 3: Check container processes
echo ""
echo "🔄 Checking container processes..."
PROCESSES=$(docker exec "$CONTAINER_NAME" ps aux | wc -l)
if [ "$PROCESSES" -gt 5 ]; then
    print_status "pass" "Multiple processes running ($((PROCESSES-1)) processes)"
else
    print_status "warn" "Few processes running ($((PROCESSES-1)) processes)"
fi

# Show key processes
echo "   Key processes:"
docker exec "$CONTAINER_NAME" ps aux | grep -E "(supervisor|python|node|npm)" | head -5 | while read line; do
    echo "   - $line"
done

# Test 4: Check port bindings
echo ""
echo "🌐 Checking port bindings..."
PORTS=$(docker port "$CONTAINER_NAME")
if echo "$PORTS" | grep -q "3000"; then
    print_status "pass" "Frontend port 3000 is bound"
else
    print_status "fail" "Frontend port 3000 is not bound"
fi

if echo "$PORTS" | grep -q "8000"; then
    print_status "pass" "Backend port 8000 is bound"
else
    print_status "fail" "Backend port 8000 is not bound"
fi

# Test 5: Check health endpoint
echo ""
echo "🏥 Testing backend health endpoint..."
if curl -s --max-time 10 --connect-timeout 5 "$HEALTH_URL" >/dev/null 2>&1; then
    print_status "pass" "Backend health endpoint responding"
    
    # Get health details
    HEALTH_RESPONSE=$(curl -s --max-time 5 "$HEALTH_URL" 2>/dev/null || echo "Failed to get response")
    echo "   Response: $HEALTH_RESPONSE"
else
    print_status "fail" "Backend health endpoint not responding"
fi

# Test 6: Check frontend accessibility
echo ""
echo "🎨 Testing frontend accessibility..."
if curl -s --max-time 10 --connect-timeout 5 "$FRONTEND_URL" >/dev/null 2>&1; then
    print_status "pass" "Frontend is accessible"
else
    print_status "warn" "Frontend not accessible (may still be starting)"
fi

# Test 7: Check data volume
echo ""
echo "💾 Checking data volume..."
if docker volume ls | grep -q "cockpit-data"; then
    print_status "pass" "Data volume exists"
    
    # Check volume size
    VOLUME_SIZE=$(docker run --rm -v cockpit-data:/data alpine du -sh /data 2>/dev/null | cut -f1 || echo "unknown")
    echo "   Volume size: $VOLUME_SIZE"
else
    print_status "warn" "Data volume not found (may be created on first run)"
fi

# Test 8: Check log files
echo ""
echo "📄 Checking application logs..."
if docker exec "$CONTAINER_NAME" ls /var/log/supervisor/ >/dev/null 2>&1; then
    print_status "pass" "Log directory exists"
    
    # List log files
    echo "   Log files:"
    docker exec "$CONTAINER_NAME" ls -la /var/log/supervisor/ | while read line; do
        echo "   - $line"
    done
else
    print_status "warn" "Log directory not found"
fi

# Test 9: Memory and CPU usage
echo ""
echo "📊 Checking resource usage..."
STATS=$(docker stats "$CONTAINER_NAME" --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" | tail -1)
if [ -n "$STATS" ]; then
    print_status "pass" "Resource stats available"
    echo "   CPU/Memory: $STATS"
else
    print_status "warn" "Could not get resource stats"
fi

# Test 10: Network connectivity (internal)
echo ""
echo "🌐 Testing internal network connectivity..."
if docker exec "$CONTAINER_NAME" curl -s --max-time 5 localhost:3000 >/dev/null 2>&1; then
    print_status "pass" "Internal frontend connectivity working"
else
    print_status "warn" "Internal frontend connectivity failed"
fi

if docker exec "$CONTAINER_NAME" curl -s --max-time 5 localhost:8000/health >/dev/null 2>&1; then
    print_status "pass" "Internal backend connectivity working"
else
    print_status "warn" "Internal backend connectivity failed"
fi

echo ""
echo "📋 Validation Summary"
echo "===================="
echo "Container: $CONTAINER_NAME"
echo "Image: cockpit-ng:all-in-one"
echo "Frontend URL: $FRONTEND_URL"
echo "Backend URL: $BACKEND_URL"
echo "Health URL: $HEALTH_URL"

echo ""
echo "🎯 Quick Access Commands:"
echo "========================"
echo "View logs: docker logs -f $CONTAINER_NAME"
echo "Container shell: docker exec -it $CONTAINER_NAME /bin/bash"
echo "Restart: docker restart $CONTAINER_NAME"
echo "Stop: docker stop $CONTAINER_NAME"

echo ""
echo "🔍 Validation Complete!"

# Return appropriate exit code
if docker ps | grep -q "$CONTAINER_NAME" && curl -s --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    print_status "pass" "All critical tests passed!"
    exit 0
else
    print_status "warn" "Some tests failed - check the logs"
    exit 1
fi
