"""
MCP Server FastAPI application.
"""

import logging
import sys
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import uuid
import time

# Add parent directory to Python path to import backend modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from config import settings
from routes import health, mcp

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting MCP Server")
    logger.info(f"Server will run on {settings.mcp_server_host}:{settings.mcp_server_port}")
    logger.info(f"Cockpit API URL: {settings.cockpit_api_url}")
    yield
    # Shutdown
    logger.info("Shutting down MCP Server")


# Create FastAPI app
app = FastAPI(
    title="MCP Server",
    description="Model Control Protocol server for Cockpit API automation",
    version="1.0.0",
    lifespan=lifespan
)


# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Add trusted host middleware for security
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]  # Configure appropriately for production
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Add request ID to all requests."""
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    # Add request ID to response headers
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    
    return response


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    """Log all requests and responses."""
    start_time = time.time()
    
    logger.info(
        f"Request: {request.method} {request.url.path} - "
        f"Request ID: {getattr(request.state, 'request_id', 'unknown')}"
    )
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    logger.info(
        f"Response: {response.status_code} - "
        f"Duration: {process_time:.3f}s - "
        f"Request ID: {getattr(request.state, 'request_id', 'unknown')}"
    )
    
    return response


# Include routers
app.include_router(health.router)
app.include_router(mcp.router)


@app.get("/")
async def root():
    """Root endpoint with basic server information."""
    return {
        "service": "MCP Server",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "readiness": "/readyz", 
            "mcp_execute": "/mcp/v1/execute"
        },
        "documentation": "/docs"
    }


@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    """Custom 404 handler."""
    return {
        "error": "Not Found",
        "message": f"The requested resource {request.url.path} was not found",
        "status_code": 404,
        "request_id": getattr(request.state, 'request_id', 'unknown')
    }


@app.exception_handler(500)
async def internal_server_error_handler(request: Request, exc: Exception):
    """Custom 500 handler."""
    logger.error(f"Internal server error: {exc}", exc_info=True)
    return {
        "error": "Internal Server Error",
        "message": "An unexpected error occurred",
        "status_code": 500,
        "request_id": getattr(request.state, 'request_id', 'unknown')
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=settings.mcp_server_host,
        port=settings.mcp_server_port,
        reload=True,
        log_level=settings.log_level.lower()
    )