#!/bin/bash
# Convenience script to run Docker commands from project root
# All Docker files have been consolidated into the ./docker directory

set -e

echo "🐳 Cockpit-NG Docker Runner"
echo "=========================="

# Change to docker directory
cd docker

# Check for required files
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found in ./docker directory"
    exit 1
fi

# Display available options
echo "Available Docker configurations:"
echo "  1. Basic Development (docker-compose.yml) - requires internet"
echo "  2. All-in-One Air-Gap (prepare-all-in-one.sh) - self-contained"
echo ""

# If no arguments provided, show help
if [ $# -eq 0 ]; then
    echo "Usage:"
    echo "  $0 up                    # Start development environment (needs internet)"
    echo "  $0 down                  # Stop containers"
    echo "  $0 build                 # Build containers"
    echo "  $0 logs                  # View logs"
    echo "  $0 all-in-one           # Build air-gap production image"
    echo ""
    echo "Or run commands directly from ./docker/ directory"
    exit 0
fi

# Handle different commands
case "$1" in
    "up")
        echo "🚀 Starting Cockpit-NG with docker-compose..."
        docker compose up -d
        echo "✅ Cockpit-NG started!"
        echo "   Frontend: http://localhost:3000"
        echo "   Backend:  http://localhost:8000"
        ;;
    "down")
        echo "🛑 Stopping Cockpit-NG..."
        docker compose down
        echo "✅ Cockpit-NG stopped!"
        ;;
    "build")
        echo "🔨 Building Cockpit-NG containers..."
        docker compose build
        echo "✅ Build complete!"
        ;;
    "logs")
        echo "📝 Showing Cockpit-NG logs..."
        docker compose logs -f
        ;;
    "all-in-one")
        echo "📦 Building all-in-one air-gap image..."
        ./prepare-all-in-one.sh
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo "Run '$0' without arguments to see usage"
        exit 1
        ;;
esac