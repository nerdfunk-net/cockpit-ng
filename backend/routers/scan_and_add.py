from __future__ import annotations
"""API router for Scan & Add wizard operations."""

import asyncio
import os
import json
import logging
from typing import List, Optional, Dict, Any, Union

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, validator
import ipaddress

from core.auth import verify_token
from services.scan_service import scan_service
from services.nautobot import nautobot_service
from template_manager import template_manager
from jinja2 import Environment, BaseLoader
from git_repositories_manager import GitRepositoryManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scan", tags=["scan"], dependencies=[Depends(verify_token)])


# Request/Response Models
class ScanStartRequest(BaseModel):
    cidrs: List[str] = Field(..., max_items=10, description="List of CIDR networks to scan")
    credential_ids: List[int] = Field(..., description="List of credential IDs to try")
    discovery_mode: str = Field(default="napalm", description="Discovery mode: napalm or ssh-login")
    parser_template_ids: Optional[List[int]] = Field(default=None, description="Template IDs to use for parsing 'show version' output (textfsm)")

    @validator("discovery_mode")
    def validate_discovery_mode(cls, v: str):
        if v not in ["napalm", "ssh-login"]:
            raise ValueError("discovery_mode must be 'napalm' or 'ssh-login'")
        return v

    @validator("cidrs")
    def validate_cidrs(cls, v: List[str]):
        if not v:
            raise ValueError("At least one CIDR required")

        cleaned = []
        seen = set()

        for cidr in v:
            try:
                network = ipaddress.ip_network(cidr, strict=False)
            except Exception:
                raise ValueError(f"Invalid CIDR format: {cidr}")

            # Enforce /22 minimum (max ~1024 hosts per spec)
            if network.prefixlen < 22:
                raise ValueError(f"CIDR too large (minimum /22): {cidr}")

            # Deduplicate
            if cidr not in seen:
                seen.add(cidr)
                cleaned.append(cidr)

        return cleaned

    @validator("credential_ids")
    def validate_credentials(cls, v: List[int]):
        if not v:
            raise ValueError("At least one credential ID required")
        return v


class ScanStartResponse(BaseModel):
    job_id: str
    total_targets: int
    state: str


class ScanProgress(BaseModel):
    total: int
    scanned: int
    alive: int
    authenticated: int
    unreachable: int
    auth_failed: int
    driver_not_supported: int


class ScanStatusResponse(BaseModel):
    job_id: str
    state: str
    progress: ScanProgress
    results: List[Dict[str, Any]]


class OnboardDevice(BaseModel):
    ip: str
    credential_id: int
    device_type: str  # 'cisco' | 'linux'
    hostname: Optional[str] = None
    platform: Optional[str] = None

    # Cisco-specific fields
    location: Optional[str] = None
    namespace: Optional[str] = "Global"
    role: Optional[str] = None
    status: Optional[str] = "Active"
    interface_status: Optional[str] = "Active"
    ip_status: Optional[str] = "Active"


class OnboardRequest(BaseModel):
    devices: List[OnboardDevice]
    # Linux onboarding extras (optional; used when onboarding Linux/servers)
    git_repository_id: Optional[int] = None
    git_repository_name: Optional[str] = None
    inventory_template_id: Optional[int] = None
    filename: Optional[str] = None
    # Optional Git actions
    auto_commit: Optional[bool] = False
    auto_push: Optional[bool] = False
    commit_message: Optional[str] = None


class OnboardResponse(BaseModel):
    accepted: int
    cisco_queued: int
    linux_added: int
    inventory_path: Optional[str] = None
    job_ids: List[str] = Field(default_factory=list)


# API Endpoints
@router.post("/start", response_model=ScanStartResponse)
async def start_scan(request: ScanStartRequest):
    """Start a new network scan job."""
    try:
        job = await scan_service.start_job(
            request.cidrs,
            request.credential_ids,
            request.discovery_mode,
            parser_template_ids=request.parser_template_ids,
        )

        return ScanStartResponse(
            job_id=job.job_id,
            total_targets=job.total_targets,
            state=job.state
        )
    except Exception as e:
        logger.error(f"Failed to start scan: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start scan: {str(e)}"
        )


@router.get("/{job_id}/status", response_model=ScanStatusResponse)
async def get_scan_status(job_id: str):
    """Get status and results of a scan job."""
    job = await scan_service.get_job(job_id)

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found"
        )

    return ScanStatusResponse(
        job_id=job.job_id,
        state=job.state,
        progress=ScanProgress(
            total=job.total_targets,
            scanned=job.scanned,
            alive=job.alive,
            authenticated=job.authenticated,
            unreachable=job.unreachable,
            auth_failed=job.auth_failed,
            driver_not_supported=job.driver_not_supported
        ),
        results=[
            {
                "ip": result.ip,
                "credential_id": result.credential_id,
                "device_type": result.device_type,
                "hostname": result.hostname,
                "platform": result.platform
            }
            for result in job.results
        ]
    )


@router.post("/{job_id}/onboard", response_model=OnboardResponse)
async def onboard_devices(job_id: str, request: OnboardRequest):
    """Onboard selected devices from scan results."""
    # Verify job exists
    job = await scan_service.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found"
        )

    # Validate devices against scan results
    result_ips = {result.ip for result in job.results}
    valid_devices = [device for device in request.devices if device.ip in result_ips]

    if not valid_devices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid devices selected for onboarding"
        )

    # Separate Cisco and Linux devices
    cisco_devices = [d for d in valid_devices if d.device_type == "cisco"]
    linux_devices = [d for d in valid_devices if d.device_type == "linux"]

    cisco_queued = 0
    linux_added = 0
    inventory_path = None
    job_ids = []

    # Handle Cisco device onboarding via Nautobot
    if cisco_devices:
        try:
            cisco_queued, cisco_job_ids = await _onboard_cisco_devices(cisco_devices)
            job_ids.extend(cisco_job_ids)
        except Exception as e:
            logger.error(f"Cisco onboarding failed: {e}")
            # Continue with Linux devices even if Cisco fails

    # Handle Linux device inventory creation
    if linux_devices:
        try:
            linux_added, inventory_path = await _create_linux_inventory(
                linux_devices,
                job_id,
                git_repository_id=request.git_repository_id,
                git_repository_name=request.git_repository_name,
                inventory_template_id=request.inventory_template_id,
                filename=request.filename,
                auto_commit=bool(request.auto_commit),
                auto_push=bool(request.auto_push),
                commit_message=request.commit_message,
            )
        except Exception as e:
            logger.error(f"Linux inventory creation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create Linux inventory: {str(e)}"
            )

    return OnboardResponse(
        accepted=len(valid_devices),
        cisco_queued=cisco_queued,
        linux_added=linux_added,
        inventory_path=inventory_path,
        job_ids=job_ids
    )


async def _onboard_cisco_devices(cisco_devices: List[OnboardDevice]) -> tuple[int, List[str]]:
    """Onboard Cisco devices via Nautobot API."""
    job_ids = []
    queued_count = 0

    for device in cisco_devices:
        try:
            # Prepare device data for Nautobot onboarding
            device_data = {
                "ip_address": device.ip,
                "hostname": device.hostname or device.ip,
                "platform": device.platform or "cisco_ios",
                "location": device.location,
                "namespace": device.namespace or "Global",
                "role": device.role or "network",
                "status": device.status or "Active",
                "interface_status": device.interface_status or "Active",
                "ip_status": device.ip_status or "Active"
            }

            # Call Nautobot onboarding API
            response = await nautobot_service.onboard_device(device_data)

            if response.get("job_id"):
                job_ids.append(response["job_id"])
                queued_count += 1
                logger.info(f"Cisco device {device.ip} queued for onboarding with job {response['job_id']}")
            else:
                logger.warning(f"Cisco device {device.ip} onboarding returned no job ID")

        except Exception as e:
            logger.error(f"Failed to onboard Cisco device {device.ip}: {e}")
            # Continue with other devices

    return queued_count, job_ids


async def _create_linux_inventory(
    linux_devices: List[OnboardDevice],
    job_id: str,
    *,
    git_repository_id: Optional[int] = None,
    git_repository_name: Optional[str] = None,
    inventory_template_id: Optional[int] = None,
    filename: Optional[str] = None,
    auto_commit: bool = False,
    auto_push: bool = False,
    commit_message: Optional[str] = None,
) -> tuple[int, str]:
    """Create inventory file for Linux devices using a selected template and save it into a Git repo if provided.

    Returns: (linux_added_count, written_path)
    """
    # Build devices data for template rendering
    devices_list = []  # This will also serve as all_devices (list of dicts)
    for device in linux_devices:
        # Normalize platform: avoid passing through 'detect'
        platform_val = (device.platform or "linux")
        if isinstance(platform_val, str) and platform_val.lower() in ("detect", "auto", "auto-detect"):
            platform_val = "linux"

        d = {
            "primary_ip4": device.ip,
            "name": device.hostname or device.ip,
            "credential_id": device.credential_id,
            "platform": platform_val,
            "location": device.location,
            "role": device.role or "server",
            "status": device.status or "Active",
        }
        devices_list.append(d)

    # Debug: print all_devices structure to console for troubleshooting template rendering
    try:
        logger.info(
            "[Scan&Add] all_devices list built (count=%d):\n%s",
            len(devices_list),
            json.dumps(devices_list, indent=2, sort_keys=True)
        )
    except Exception as e:
        logger.warning(f"Failed to log all_devices map: {e}")

    # Render template content
    rendered_content: str
    if inventory_template_id:
        try:
            content = template_manager.get_template_content(inventory_template_id)
            if not content:
                raise ValueError(f"Template content not found for ID {inventory_template_id}")
            env = Environment(loader=BaseLoader())
            template = env.from_string(content)
            # all_devices must be a list of dicts; pass devices_list for both for compatibility
            rendered_content = template.render(
                all_devices=devices_list,
                devices=devices_list,
                total_devices=len(devices_list),
            )
        except Exception as e:
            logger.warning(f"Template rendering failed, using JSON fallback: {e}")
            rendered_content = json.dumps({"all_devices": devices_list, "devices": devices_list}, indent=2)
    else:
        # Fallback to JSON if no template selected
        rendered_content = json.dumps({"all_devices": devices_list, "devices": devices_list}, indent=2)

    # Determine output path
    written_path: str
    base_dir: str
    repo_info: Optional[Dict[str, Any]] = None
    if git_repository_id or git_repository_name:
        # Resolve repository
        git_mgr = GitRepositoryManager()
        repo: Optional[Dict[str, Any]] = None
        if git_repository_id:
            try:
                repo = git_mgr.get_repository(int(git_repository_id))
            except Exception:
                repo = None
        if not repo and git_repository_name:
            try:
                # Find by name
                repos = git_mgr.get_repositories()
                for r in repos:
                    if str(r.get("name", "")).lower() == str(git_repository_name).lower():
                        repo = r
                        break
            except Exception:
                repo = None
        if not repo:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected Git repository not found")

        # Compute repo directory under data/git/<path or name>
        from config import settings as config_settings
        sub_path = (repo.get('path') or repo.get('name') or '').lstrip('/') or f"repo_{repo.get('id')}"
        base_dir = os.path.join(config_settings.data_directory, 'git', sub_path)
        os.makedirs(base_dir, exist_ok=True)
        repo_info = repo
    else:
        # Legacy fallback directory
        base_dir = os.path.join("data", "inventory")
        os.makedirs(base_dir, exist_ok=True)

    # Decide filename
    out_name = (filename or f"inventory_{job_id}.yaml").strip()
    # Prevent path traversal
    out_name = out_name.lstrip('/').replace('..', '__')
    written_path = os.path.join(base_dir, out_name)
    # Ensure parent directory exists if filename contains subdirs
    os.makedirs(os.path.dirname(written_path), exist_ok=True)

    # Write file
    with open(written_path, 'w', encoding='utf-8') as f:
        f.write(rendered_content)

    logger.info(
        f"Created Linux inventory file: {written_path} with {len(linux_devices)} devices"
        + (f" in repo '{repo_info.get('name')}'" if repo_info else "")
    )

    # Optionally commit and push to the selected Git repository
    if repo_info and (auto_commit or auto_push):
        try:
            from git import Repo, GitCommandError
        except Exception as e:
            logger.warning(f"GitPython not available, skipping commit/push: {e}")
            return len(linux_devices), written_path

        repo_dir = base_dir
        git_dir = os.path.join(repo_dir, ".git")
        if not os.path.isdir(git_dir):
            logger.warning("Selected repository directory is not a Git repo (.git missing); skipping commit/push")
            return len(linux_devices), written_path

        committed = False
        pushed = False
        commit_hash = None
        try:
            repo = Repo(repo_dir)
            rel_file = os.path.relpath(written_path, repo_dir)
            # stage file
            repo.index.add([rel_file])
            if auto_commit:
                # If not provided, use the filename as commit message per requirement
                default_msg = os.path.basename(written_path)
                msg = (commit_message or default_msg)
                commit = repo.index.commit(msg)
                commit_hash = getattr(commit, "hexsha", None)
                committed = True
                logger.info(f"Committed inventory file to Git: {rel_file} ({commit_hash[:8] if commit_hash else 'no-hash'})")

            if auto_push:
                try:
                    origin = repo.remotes.origin
                except Exception:
                    origin = None
                if not origin:
                    logger.warning("No 'origin' remote configured; skipping push")
                else:
                    # Resolve credentials similar to sync flow
                    try:
                        from urllib.parse import urlparse, quote as urlquote
                        resolved_username = repo_info.get("username")
                        resolved_token = repo_info.get("token")
                        cred_name = repo_info.get("credential_name")
                        if cred_name:
                            try:
                                import credentials_manager as cred_mgr  # lazy import
                                creds = cred_mgr.list_credentials(include_expired=False)
                                match = next((c for c in creds if c.get("name") == cred_name and c.get("type") == "token"), None)
                                if match:
                                    resolved_username = match.get("username") or resolved_username
                                    try:
                                        resolved_token = cred_mgr.get_decrypted_password(match["id"]) or resolved_token
                                    except Exception as de:
                                        logger.error(f"Failed to decrypt token for credential '{cred_name}': {de}")
                            except Exception as ce:
                                logger.error(f"Credential lookup error: {ce}")

                        remote_url = repo_info.get("url") or ""
                        parsed = urlparse(remote_url)
                        auth_url = remote_url
                        if parsed.scheme in ["http", "https"] and resolved_token:
                            user_enc = urlquote(str(resolved_username or "git"), safe="")
                            token_enc = urlquote(str(resolved_token), safe="")
                            auth_url = f"{parsed.scheme}://{user_enc}:{token_enc}@{parsed.netloc}{parsed.path}"
                    except Exception as prep_e:
                        logger.error(f"Failed to prepare push authentication: {prep_e}")
                        remote_url = repo_info.get("url") or ""
                        auth_url = remote_url

                    # Update remote URL with auth for push if needed (execute regardless of prep outcome)
                    try:
                        if auth_url != remote_url:
                            origin.set_url(auth_url)
                    except Exception as e:
                        logger.debug(f"Skipping remote URL auth update: {e}")

                    # SSL verify toggle
                    ssl_env_set = False
                    try:
                        if not repo_info.get("verify_ssl", True):
                            os.environ["GIT_SSL_NO_VERIFY"] = "1"
                            ssl_env_set = True
                        branch = repo_info.get("branch") or "main"
                        origin.push(branch)
                        pushed = True
                        logger.info(f"Pushed commit to remote '{origin.name}' branch '{branch}'")
                    except Exception as pe:
                        logger.error(f"Git push failed: {pe}")
                    finally:
                        if ssl_env_set:
                            try:
                                del os.environ["GIT_SSL_NO_VERIFY"]
                            except Exception:
                                pass

        except Exception as ge:
            logger.error(f"Git commit/push step failed: {ge}")

        # Summary log
        logger.info(
            "Git actions summary — committed: %s%s, pushed: %s",
            str(committed),
            f" ({commit_hash[:8]})" if commit_hash else "",
            str(pushed),
        )

    return len(linux_devices), written_path


@router.delete("/{job_id}")
async def delete_scan_job(job_id: str):
    """Delete a scan job (cleanup endpoint)."""
    job = await scan_service.get_job(job_id)

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found"
        )

    # Remove job from service
    scan_service._jobs.pop(job_id, None)

    return {"message": f"Scan job {job_id} deleted successfully"}


@router.get("/jobs")
async def list_scan_jobs():
    """List all active scan jobs."""
    scan_service._purge_expired()

    jobs = []
    for job in scan_service._jobs.values():
        jobs.append({
            "job_id": job.job_id,
            "state": job.state,
            "created": job.created,
            "total_targets": job.total_targets,
            "authenticated": job.authenticated
        })

    return {"jobs": jobs}
