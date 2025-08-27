"""
MCP execute endpoint implementation.
"""

import logging
from fastapi import APIRouter, HTTPException, status, Header
from models.mcp import MCPRequest, MCPResponse, ErrorModel
from services.dispatcher import dispatch
from services.client import HTTPError
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/mcp/v1", tags=["mcp"])


def validate_api_key(x_api_key: str = Header(None, alias="X-Api-Key")) -> str:
    """Validate API key from header."""
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required in X-Api-Key header",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    # For now, we'll implement a simple validation
    # In production, this should validate against user API keys in the database
    from config import settings
    
    # Check if API key is in configured list (fallback)
    if settings.api_keys_list and x_api_key not in settings.api_keys_list:
        # If configured API keys exist but key is not in list, reject
        if settings.api_keys_list:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
                headers={"WWW-Authenticate": "ApiKey"},
            )
    
    # TODO: Validate against user API keys in database
    # This would require importing the backend authentication logic
    
    return x_api_key


@router.post("/execute", response_model=MCPResponse)
async def execute_mcp_request(
    request: MCPRequest,
    api_key: str = Header(None, alias="X-Api-Key", description="API key for authentication")
) -> MCPResponse:
    """Execute MCP request."""
    
    # Validate API key
    try:
        validate_api_key(api_key)
    except HTTPException as e:
        return MCPResponse(
            id=request.id,
            status="error",
            error=ErrorModel(
                code="AUTH_ERROR",
                message=e.detail,
                details={"status_code": e.status_code}
            )
        )
    
    # Generate request ID if not provided
    if not request.id:
        request.id = str(uuid.uuid4())
    
    logger.info(f"Processing MCP request {request.id}: {request.action}")
    
    try:
        # Dispatch request to handler
        result = await dispatch(request)
        
        return MCPResponse(
            id=request.id,
            status="ok",
            result=result
        )
        
    except ValueError as e:
        logger.error(f"Validation error for request {request.id}: {e}")
        return MCPResponse(
            id=request.id,
            status="error",
            error=ErrorModel(
                code="VALIDATION_ERROR",
                message=str(e),
                details={"action": request.action, "params": request.params}
            )
        )
        
    except HTTPError as e:
        logger.error(f"HTTP error for request {request.id}: {e}")
        return MCPResponse(
            id=request.id,
            status="error",
            error=ErrorModel(
                code="HTTP_ERROR",
                message=f"Backend API error: {e.detail}",
                details={"status_code": e.status_code, "action": request.action}
            )
        )
        
    except ConnectionError as e:
        logger.error(f"Connection error for request {request.id}: {e}")
        return MCPResponse(
            id=request.id,
            status="error",
            error=ErrorModel(
                code="CONNECTION_ERROR",
                message="Failed to connect to backend API",
                details={"action": request.action, "error": str(e)}
            )
        )
        
    except Exception as e:
        logger.error(f"Unexpected error for request {request.id}: {e}", exc_info=True)
        return MCPResponse(
            id=request.id,
            status="error",
            error=ErrorModel(
                code="INTERNAL_ERROR",
                message="Internal server error",
                details={"action": request.action}
            )
        )