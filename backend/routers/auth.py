"""
Authentication router for login and token management.
"""

from __future__ import annotations
from datetime import timedelta
from fastapi import APIRouter, HTTPException, status, Depends
from models.auth import UserLogin, LoginResponse
from core.auth import create_access_token, verify_token

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/login", response_model=LoginResponse)
async def login(user_data: UserLogin):
    """
    Authenticate user against stored credentials.
    """
    from config import settings
    import credentials_manager as cred_mgr

    # Try to authenticate against stored credentials
    try:
        credentials = cred_mgr.list_credentials(include_expired=False)
        authenticated = False
        
        for cred in credentials:
            if cred['username'] == user_data.username and cred['status'] == 'active':
                try:
                    stored_password = cred_mgr.get_decrypted_password(cred['id'])
                    if stored_password == user_data.password:
                        authenticated = True
                        break
                except Exception:
                    continue  # Skip this credential if decryption fails
        
        if authenticated:
            access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
            access_token = create_access_token(
                data={"sub": user_data.username}, expires_delta=access_token_expires
            )

            return LoginResponse(
                access_token=access_token,
                token_type="bearer",
                expires_in=settings.access_token_expire_minutes * 60,
                user={
                    "username": user_data.username,
                    "role": "admin"  # All authenticated users are admin for now
                }
            )
    except Exception as e:
        # Log the error but don't expose it to the user
        pass

    # No valid authentication found
    raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(current_user: str = Depends(verify_token)):
    """Issue a new access token for the currently authenticated user.

    Uses the same expiration policy as login. Since we don't have a user DB,
    we reconstruct a minimal user payload based on the username.
    """
    from config import settings

    try:
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={"sub": current_user}, expires_delta=access_token_expires
        )

        # All authenticated users are admin
        role = "admin"

        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.access_token_expire_minutes * 60,
            user={
                "username": current_user,
                "role": role,
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token refresh failed: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )
