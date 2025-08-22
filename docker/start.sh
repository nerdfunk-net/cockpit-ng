#!/bin/bash
set -e

echo "=== Cockpit-NG Container Startup ==="
echo "Starting both backend and frontend services..."

# Create necessary directories
mkdir -p /app/data/settings
mkdir -p /app/data/git
mkdir -p /app/data/cache
mkdir -p /var/log/supervisor

# Set proper permissions
chown -R root:root /app/data
chmod -R 755 /app/data

# Start supervisor to manage both services
echo "Starting supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
