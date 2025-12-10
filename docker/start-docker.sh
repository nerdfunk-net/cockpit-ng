#!/bin/bash
set -e

echo "🚀 Cockpit-NG Docker Setup"
echo "========================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating environment configuration..."
    cp .env.example .env
    echo "✅ Created .env file from template"
    echo "⚠️  Please edit .env with your actual configuration values before continuing"
    echo ""
    echo "Required configurations:"
    echo "  - NAUTOBOT_URL: Your Nautobot instance URL"
    echo "  - NAUTOBOT_TOKEN: Your Nautobot API token"
    echo "  - SECRET_KEY: A secure secret key for the application"
    echo ""
    read -p "Press Enter after updating .env file, or Ctrl+C to exit..."
fi

echo "🔨 Building Docker image..."
docker-compose build

echo "🚀 Starting Cockpit-NG..."
docker-compose up -d

echo ""
echo "✅ Cockpit-NG is starting up!"
echo ""
echo "Services will be available at:"
echo "  🌐 Frontend: http://localhost:3000"
echo "  🔧 Backend API: http://localhost:8000"
echo "  📚 API Docs: http://localhost:8000/docs"
echo ""
echo "📊 To monitor the startup:"
echo "  docker-compose logs -f"
echo ""
echo "🔍 To check service status:"
echo "  docker-compose ps"
echo ""
echo "🛑 To stop the services:"
echo "  docker-compose down"
echo ""

# Wait a moment and check if services are running
sleep 5
echo "Checking service status..."
docker-compose ps
