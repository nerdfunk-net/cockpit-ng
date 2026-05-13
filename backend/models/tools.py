"""Pydantic models for tool endpoints (certificates, schema, etc.)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class CertificateInfo(BaseModel):
    filename: str
    path: str
    size: int
    exists_in_system: bool


class ScanResponse(BaseModel):
    success: bool
    certificates: list[CertificateInfo]
    certs_directory: str
    message: Optional[str] = None


class AddCertificateRequest(BaseModel):
    filename: str


class AddCertificateResponse(BaseModel):
    success: bool
    message: str
    output: Optional[str] = None
    error: Optional[str] = None
    command_output: Optional[str] = None
