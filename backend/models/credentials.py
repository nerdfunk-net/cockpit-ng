from __future__ import annotations

from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, validator

ALLOWED_TYPES = {"ssh", "tacacs", "generic", "token"}

class CredentialCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    username: str = Field(min_length=1, max_length=128)
    type: str
    password: str = Field(min_length=1)
    valid_until: Optional[date] = None

    @validator("type")
    def validate_type(cls, v: str) -> str:
        if v not in ALLOWED_TYPES:
            raise ValueError("Invalid credential type")
        return v

class CredentialUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    type: Optional[str] = None
    password: Optional[str] = None
    valid_until: Optional[date] = None

    @validator("type")
    def validate_type(cls, v: str) -> str:
        if v is not None and v not in ALLOWED_TYPES:
            raise ValueError("Invalid credential type")
        return v
