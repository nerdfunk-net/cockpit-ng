#!/bin/bash

# Test script to demonstrate LOG_LEVEL functionality
echo "Testing LOG_LEVEL environment variable support..."
echo ""

# Test 1: Default INFO level
echo "=== Test 1: Default LOG_LEVEL (INFO) ==="
echo "Building container with default LOG_LEVEL=INFO..."
docker build -t cockpit-test -f docker/Dockerfile.all-in-one .
echo ""
echo "Starting container with default LOG_LEVEL..."
echo "You should see INFO messages but NO DEBUG messages:"
docker run --rm -p 8000:8000 --name cockpit-test-info cockpit-test &
CONTAINER_PID=$!
sleep 10
echo "Stopping container..."
docker stop cockpit-test-info
wait $CONTAINER_PID 2>/dev/null
echo ""

# Test 2: DEBUG level
echo "=== Test 2: LOG_LEVEL=DEBUG ==="
echo "Starting container with LOG_LEVEL=DEBUG..."
echo "You should see both INFO and DEBUG messages:"
docker run --rm -p 8000:8000 -e LOG_LEVEL=DEBUG --name cockpit-test-debug cockpit-test &
CONTAINER_PID=$!
sleep 10
echo "Stopping container..."
docker stop cockpit-test-debug
wait $CONTAINER_PID 2>/dev/null
echo ""

echo "LOG_LEVEL testing completed!"
echo ""
echo "Usage instructions:"
echo "- Default (INFO): docker run cockpit-ng"
echo "- Debug mode:     docker run -e LOG_LEVEL=DEBUG cockpit-ng"
echo "- Quiet mode:     docker run -e LOG_LEVEL=WARNING cockpit-ng"
echo ""
echo "Available log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL"
