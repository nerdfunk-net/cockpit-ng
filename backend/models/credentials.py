from __future__ import annotations

from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator

ALLOWED_TYPES = {"ssh", "tacacs", "generic", "token", "ssh_key"}


class CredentialCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    username: str = Field(min_length=1, max_length=128)
    type: str
    password: Optional[str] = None  # Optional for ssh_key type
    ssh_private_key: Optional[str] = None  # Required for ssh_key type
    ssh_passphrase: Optional[str] = None  # Optional passphrase for ssh_key
    valid_until: Optional[date] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ALLOWED_TYPES:
            raise ValueError("Invalid credential type")
        return v

    @model_validator(mode="after")
    def validate_credential_data(self):
        if self.type == "ssh_key":
            if not self.ssh_private_key:
                raise ValueError("SSH private key is required for ssh_key type")
        else:
            if not self.password:
                raise ValueError("Password is required for non-ssh_key types")
        return self


class CredentialUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    type: Optional[str] = None
    password: Optional[str] = None
    ssh_private_key: Optional[str] = None  # For updating ssh_key credentials
    ssh_passphrase: Optional[str] = None  # Optional passphrase for ssh_key
    valid_until: Optional[date] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v is not None and v not in ALLOWED_TYPES:
            raise ValueError("Invalid credential type")
        return v
