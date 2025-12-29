"""
Certificate management router for CA certificate operations.

This router handles scanning for certificates and adding them to the system CA store.
"""

from __future__ import annotations
import logging
import subprocess
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel

from core.auth import require_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/certificates", tags=["certificates"])

# Default certificate directories
CONFIG_CERTS_DIR = Path("../config/certs")
SYSTEM_CA_DIR = Path("/usr/local/share/ca-certificates")


class CertificateInfo(BaseModel):
    """Certificate file information."""

    filename: str
    path: str
    size: int
    exists_in_system: bool


class ScanResponse(BaseModel):
    """Response for certificate scan operation."""

    success: bool
    certificates: list[CertificateInfo]
    certs_directory: str
    message: Optional[str] = None


class AddCertificateRequest(BaseModel):
    """Request to add a certificate to system CA store."""

    filename: str


class AddCertificateResponse(BaseModel):
    """Response from adding certificate to system CA store."""

    success: bool
    message: str
    output: Optional[str] = None
    error: Optional[str] = None
    command_output: Optional[str] = None


@router.get("/scan", response_model=ScanResponse)
async def scan_certificates(
    current_user: dict = Depends(require_permission("settings.nautobot", "read")),
) -> ScanResponse:
    """
    Scan the config/certs directory for .crt files.

    Returns a list of certificate files found in the directory.
    """
    try:
        certs_dir = CONFIG_CERTS_DIR.resolve()

        # Create directory if it doesn't exist
        certs_dir.mkdir(parents=True, exist_ok=True)

        certificates: list[CertificateInfo] = []

        # Scan for .crt files
        for cert_file in certs_dir.glob("*.crt"):
            if cert_file.is_file():
                # Check if certificate exists in system CA directory
                system_cert_path = SYSTEM_CA_DIR / cert_file.name
                exists_in_system = system_cert_path.exists()

                certificates.append(
                    CertificateInfo(
                        filename=cert_file.name,
                        path=str(cert_file),
                        size=cert_file.stat().st_size,
                        exists_in_system=exists_in_system,
                    )
                )

        # Sort by filename
        certificates.sort(key=lambda c: c.filename.lower())

        return ScanResponse(
            success=True,
            certificates=certificates,
            certs_directory=str(certs_dir),
            message=f"Found {len(certificates)} certificate(s)",
        )

    except PermissionError as e:
        logger.error(f"Permission error scanning certificates: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied accessing certificate directory: {e}",
        )
    except Exception as e:
        logger.error(f"Error scanning certificates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to scan certificates: {e}",
        )


@router.post("/upload")
async def upload_certificate(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
) -> dict:
    """
    Upload a certificate file to the config/certs directory.

    The file must have a .crt extension.
    """
    try:
        # Validate file extension
        if not file.filename or not file.filename.endswith(".crt"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Certificate file must have .crt extension",
            )

        # Sanitize filename - only allow safe characters
        safe_filename = "".join(
            c for c in file.filename if c.isalnum() or c in ".-_"
        ).rstrip()
        if not safe_filename.endswith(".crt"):
            safe_filename += ".crt"

        certs_dir = CONFIG_CERTS_DIR.resolve()
        certs_dir.mkdir(parents=True, exist_ok=True)

        dest_path = certs_dir / safe_filename

        # Check if file already exists
        if dest_path.exists():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Certificate '{safe_filename}' already exists",
            )

        # Read and validate content (basic check for PEM format)
        content = await file.read()
        content_str = content.decode("utf-8", errors="ignore")

        if "-----BEGIN CERTIFICATE-----" not in content_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid certificate format. Expected PEM-encoded certificate.",
            )

        # Write file
        with open(dest_path, "wb") as f:
            f.write(content)

        logger.info(f"Certificate uploaded: {safe_filename}")

        return {
            "success": True,
            "message": f"Certificate '{safe_filename}' uploaded successfully",
            "filename": safe_filename,
            "path": str(dest_path),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading certificate: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload certificate: {e}",
        )


@router.post("/add-to-system", response_model=AddCertificateResponse)
async def add_certificate_to_system(
    request: AddCertificateRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
) -> AddCertificateResponse:
    """
    Add a certificate to the system CA store.

    This operation:
    1. Copies the certificate to /usr/local/share/ca-certificates/
    2. Runs update-ca-certificates to update the system trust store

    Requires appropriate system permissions (typically root/sudo).
    """
    try:
        # Validate filename (prevent path traversal)
        filename = Path(request.filename).name
        if not filename.endswith(".crt"):
            return AddCertificateResponse(
                success=False,
                message="Certificate file must have .crt extension",
            )

        certs_dir = CONFIG_CERTS_DIR.resolve()
        source_path = certs_dir / filename

        # Verify source certificate exists
        if not source_path.exists():
            return AddCertificateResponse(
                success=False,
                message=f"Certificate '{filename}' not found in {certs_dir}",
            )

        # Destination path
        dest_path = SYSTEM_CA_DIR / filename
        command_outputs: list[str] = []

        try:
            # Ensure system CA directory exists
            SYSTEM_CA_DIR.mkdir(parents=True, exist_ok=True)

            # Copy certificate to system CA directory
            shutil.copy2(source_path, dest_path)
            command_outputs.append(f"Copied {filename} to {SYSTEM_CA_DIR}")

            # Run update-ca-certificates
            result = subprocess.run(
                ["update-ca-certificates"],
                capture_output=True,
                text=True,
                timeout=60,
            )

            command_outputs.append("\n--- update-ca-certificates output ---")
            if result.stdout:
                command_outputs.append(result.stdout)
            if result.stderr:
                command_outputs.append(f"stderr: {result.stderr}")
            command_outputs.append(f"Return code: {result.returncode}")

            if result.returncode == 0:
                logger.info(f"Certificate {filename} added to system CA store")
                return AddCertificateResponse(
                    success=True,
                    message=f"Certificate '{filename}' added to system CA store successfully",
                    command_output="\n".join(command_outputs),
                )
            else:
                logger.warning(
                    f"update-ca-certificates returned non-zero: {result.returncode}"
                )
                return AddCertificateResponse(
                    success=False,
                    message="Certificate copied but update-ca-certificates failed",
                    error=result.stderr or "Unknown error",
                    command_output="\n".join(command_outputs),
                )

        except PermissionError as e:
            logger.error(f"Permission denied adding certificate to system: {e}")
            return AddCertificateResponse(
                success=False,
                message="Permission denied. This operation requires root/sudo privileges.",
                error=str(e),
                command_output="\n".join(command_outputs) if command_outputs else None,
            )
        except subprocess.TimeoutExpired:
            logger.error("update-ca-certificates timed out")
            return AddCertificateResponse(
                success=False,
                message="update-ca-certificates command timed out",
                command_output="\n".join(command_outputs) if command_outputs else None,
            )
        except FileNotFoundError as e:
            logger.error(f"update-ca-certificates not found: {e}")
            return AddCertificateResponse(
                success=False,
                message="update-ca-certificates command not found. Is ca-certificates package installed?",
                error=str(e),
            )

    except Exception as e:
        logger.error(f"Error adding certificate to system: {e}")
        return AddCertificateResponse(
            success=False,
            message=f"Failed to add certificate to system: {e}",
            error=str(e),
        )


@router.delete("/{filename}")
async def delete_certificate(
    filename: str,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
) -> dict:
    """
    Delete a certificate from the config/certs directory.

    Note: This does NOT remove the certificate from the system CA store.
    """
    try:
        # Validate filename (prevent path traversal)
        safe_filename = Path(filename).name
        if not safe_filename.endswith(".crt"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Certificate file must have .crt extension",
            )

        certs_dir = CONFIG_CERTS_DIR.resolve()
        cert_path = certs_dir / safe_filename

        if not cert_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Certificate '{safe_filename}' not found",
            )

        # Delete the file
        cert_path.unlink()
        logger.info(f"Certificate deleted: {safe_filename}")

        return {
            "success": True,
            "message": f"Certificate '{safe_filename}' deleted successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting certificate: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete certificate: {e}",
        )
