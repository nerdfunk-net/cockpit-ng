#!/bin/bash

echo "=== Cockpit-NG Docker Deployment Test ==="
echo

# Test container status
echo "1. Checking container status..."
if docker ps | grep -q "cockpit-ng.*healthy"; then
    echo "✅ Container is running and healthy"
else
    echo "❌ Container is not healthy"
    exit 1
fi

# Test frontend health
echo
echo "2. Testing frontend health endpoint..."
FRONTEND_HEALTH=$(curl -s http://localhost:3000/api/health)
if echo "$FRONTEND_HEALTH" | grep -q "healthy"; then
    echo "✅ Frontend health check passed"
    echo "   Response: $FRONTEND_HEALTH"
else
    echo "❌ Frontend health check failed"
    exit 1
fi

# Test backend health through proxy
echo
echo "3. Testing backend health endpoint (via frontend proxy)..."
BACKEND_HEALTH=$(curl -s http://localhost:3000/api/proxy/health)
if echo "$BACKEND_HEALTH" | grep -q "healthy"; then
    echo "✅ Backend health check passed"
    echo "   Response: $BACKEND_HEALTH"
else
    echo "❌ Backend health check failed"
    exit 1
fi

# Test frontend accessibility
echo
echo "4. Testing frontend main page..."
FRONTEND_PAGE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$FRONTEND_PAGE" = "200" ]; then
    echo "✅ Frontend main page accessible (HTTP $FRONTEND_PAGE)"
else
    echo "❌ Frontend main page not accessible (HTTP $FRONTEND_PAGE)"
    exit 1
fi

# Test API proxy functionality
echo
echo "5. Testing API proxy functionality..."
API_RESPONSE=$(curl -s http://localhost:3000/api/proxy/nautobot/namespaces)
if echo "$API_RESPONSE" | grep -q "Not authenticated\|Connection\|namespaces"; then
    echo "✅ API proxy working (authentication or connection response received)"
    echo "   Response: $API_RESPONSE"
else
    echo "❌ API proxy not working"
    echo "   Response: $API_RESPONSE"
    exit 1
fi

echo
echo "=== All tests passed! Cockpit-NG is running successfully in Docker ==="
echo
echo "Access the application at:"
echo "  Frontend: http://localhost:3000"
echo "  Backend API docs: http://localhost:3000/api/proxy/docs"
echo
echo "Health monitoring endpoints:"
echo "  Frontend: http://localhost:3000/api/health"
echo "  Backend: http://localhost:3000/api/proxy/health"
echo
