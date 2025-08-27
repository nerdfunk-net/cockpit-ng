"""
Core authentication functions and dependencies.
"""

from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from passlib.context import CryptContext

from models.auth import TokenData


# Security setup
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    from config import settings

    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Get password hash."""
    return pwd_context.hash(password)


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT token and return user info."""
    from config import settings

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(credentials.credentials, settings.secret_key, 
                           algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        permissions: int = payload.get("permissions", 0)
        
        if username is None:
            raise credentials_exception
            
        return {
            "username": username,
            "user_id": user_id,
            "permissions": permissions
        }
    except jwt.InvalidTokenError:
        raise credentials_exception


def verify_admin_token(user_info: dict = Depends(verify_token)) -> dict:
    """Verify token and ensure user has admin permissions."""
    from user_db_manager import PERMISSIONS_ADMIN
    
    # Check if user has full admin permissions (exact match)
    user_permissions = user_info["permissions"]
    if user_permissions != PERMISSIONS_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    return user_info


# Backward compatibility function for existing code
def get_current_username(user_info: dict = Depends(verify_token)) -> str:
    """Extract username from user info for backward compatibility."""
    return user_info["username"]
