"""
Compliance check router for performing device compliance verification.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from models.settings import ComplianceCheckRequest
from services.network.compliance.check import ComplianceCheckService
import compliance_manager as compliance

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/compliance", tags=["compliance-check"])


@router.post("/check")
async def check_compliance(
    check_request: ComplianceCheckRequest,
    current_user: dict = Depends(require_permission("compliance.check", "execute")),
):
    """
    Perform compliance checks on selected devices.

    This endpoint:
    1. Tests SSH logins using credentials from the database (by ID)
    2. Tests SNMP access using SNMP mappings from the database (by ID)
    3. Checks device configurations against regex patterns (mock implementation)

    The frontend sends credential IDs, and the backend retrieves the actual
    username/password combinations from the encrypted database.
    """
    try:
        logger.info(
            f"Starting compliance check for {len(check_request.devices)} devices"
        )

        # Validate that at least one check type is enabled
        if not (
            check_request.check_ssh_logins
            or check_request.check_snmp_credentials
            or check_request.check_configuration
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one check type must be enabled",
            )

        # Validate that credentials are selected for enabled checks
        if check_request.check_ssh_logins and not check_request.selected_login_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No login credentials selected for SSH check",
            )

        if check_request.check_snmp_credentials and not check_request.selected_snmp_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No SNMP mappings selected for SNMP check",
            )

        if check_request.check_configuration and not check_request.selected_regex_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No regex patterns selected for configuration check",
            )

        # Load credentials and patterns from database
        login_credentials = []
        snmp_mappings = []
        regex_patterns = []

        if check_request.check_ssh_logins:
            for cred_id in check_request.selected_login_ids:
                # Load with decryption to get actual passwords
                cred = compliance.get_login_credential_by_id(
                    cred_id, decrypt_password=True
                )
                if cred and cred["is_active"]:
                    login_credentials.append(cred)

        if check_request.check_snmp_credentials:
            for snmp_id in check_request.selected_snmp_ids:
                # Load with decryption to get actual passwords
                snmp = compliance.get_snmp_mapping_by_id(
                    snmp_id, decrypt_passwords=True
                )
                if snmp and snmp["is_active"]:
                    snmp_mappings.append(snmp)

        if check_request.check_configuration:
            for pattern_id in check_request.selected_regex_ids:
                pattern = compliance.get_regex_pattern_by_id(pattern_id)
                if pattern and pattern["is_active"]:
                    regex_patterns.append(pattern)

        # Perform compliance checks
        results = []
        service = ComplianceCheckService()

        for device in check_request.devices:
            device_ip = device.primary_ip4
            if not device_ip:
                # Skip devices without IP
                results.append(
                    {
                        "device_id": device.id,
                        "device_name": device.name,
                        "status": "skipped",
                        "message": "No primary IP address",
                        "checks": {},
                    }
                )
                continue

            # Strip CIDR notation if present (e.g., "192.168.1.1/24" -> "192.168.1.1")
            if "/" in device_ip:
                device_ip = device_ip.split("/")[0]

            device_result = {
                "device_id": device.id,
                "device_name": device.name,
                "device_ip": device_ip,
                "status": "checking",
                "checks": {},
            }

            # SSH Login Checks
            if check_request.check_ssh_logins:
                ssh_results = []
                for cred in login_credentials:
                    # Determine device type for Netmiko
                    device_type = "cisco_ios"  # Default
                    if device.platform:
                        platform_lower = device.platform.lower()
                        if "juniper" in platform_lower or "junos" in platform_lower:
                            device_type = "juniper_junos"
                        elif "arista" in platform_lower or "eos" in platform_lower:
                            device_type = "arista_eos"
                        elif "cisco" in platform_lower:
                            if "nxos" in platform_lower:
                                device_type = "cisco_nxos"
                            elif "xr" in platform_lower:
                                device_type = "cisco_xr"
                            else:
                                device_type = "cisco_ios"

                    result = service.check_ssh_login(
                        device_ip=device_ip,
                        device_type=device_type,
                        username=cred["username"],
                        password=cred["password"],
                    )
                    # Add credential name to result details
                    result["details"]["credential_name"] = cred.get(
                        "name", cred["username"]
                    )
                    ssh_results.append(result)

                device_result["checks"]["ssh_logins"] = {
                    "enabled": True,
                    "results": ssh_results,
                    "total": len(ssh_results),
                    "passed": sum(1 for r in ssh_results if r["success"]),
                    "failed": sum(1 for r in ssh_results if not r["success"]),
                }

            # SNMP Credential Checks
            if check_request.check_snmp_credentials:
                snmp_results = []
                for snmp in snmp_mappings:
                    if snmp["snmp_version"] in ["v1", "v2c"]:
                        # v1 or v2c check
                        version = 1 if snmp["snmp_version"] == "v1" else 2
                        result = await service.check_snmp_v1_v2c_async(
                            device_ip=device_ip,
                            community=snmp["snmp_community"],
                            version=version,
                        )
                    else:
                        # v3 check
                        result = await service.check_snmp_v3_async(
                            device_ip=device_ip,
                            username=snmp["snmp_v3_user"],
                            auth_protocol=snmp["snmp_v3_auth_protocol"],
                            auth_password=snmp["snmp_v3_auth_password"],
                            priv_protocol=snmp["snmp_v3_priv_protocol"],
                            priv_password=snmp["snmp_v3_priv_password"],
                        )
                    # Add SNMP mapping name to result details
                    result["details"]["mapping_name"] = snmp.get(
                        "name", snmp["device_type"]
                    )
                    snmp_results.append(result)

                device_result["checks"]["snmp_credentials"] = {
                    "enabled": True,
                    "results": snmp_results,
                    "total": len(snmp_results),
                    "passed": sum(1 for r in snmp_results if r["success"]),
                    "failed": sum(1 for r in snmp_results if not r["success"]),
                }

            # Configuration Checks (Mock)
            if check_request.check_configuration:
                config_result = service.check_configuration_mock(
                    device_ip=device_ip,
                    device_name=device.name,
                    patterns=regex_patterns,
                )

                device_result["checks"]["configuration"] = {
                    "enabled": True,
                    "result": config_result,
                }

            # Determine overall device status
            all_checks_passed = True
            if check_request.check_ssh_logins:
                if device_result["checks"]["ssh_logins"]["passed"] == 0:
                    all_checks_passed = False
            if check_request.check_snmp_credentials:
                if device_result["checks"]["snmp_credentials"]["passed"] == 0:
                    all_checks_passed = False
            if check_request.check_configuration:
                if not device_result["checks"]["configuration"]["result"]["success"]:
                    all_checks_passed = False

            device_result["status"] = "pass" if all_checks_passed else "fail"
            results.append(device_result)

        # Calculate summary
        summary = {
            "total_devices": len(check_request.devices),
            "devices_checked": len([r for r in results if r["status"] != "skipped"]),
            "devices_passed": len([r for r in results if r["status"] == "pass"]),
            "devices_failed": len([r for r in results if r["status"] == "fail"]),
            "devices_skipped": len([r for r in results if r["status"] == "skipped"]),
            "checks_performed": {
                "ssh_logins": check_request.check_ssh_logins,
                "snmp_credentials": check_request.check_snmp_credentials,
                "configuration": check_request.check_configuration,
            },
        }

        logger.info(
            f"Compliance check completed: {summary['devices_passed']} passed, "
            f"{summary['devices_failed']} failed, {summary['devices_skipped']} skipped"
        )

        return {
            "success": True,
            "message": "Compliance check completed",
            "summary": summary,
            "results": results,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error performing compliance check: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Compliance check failed: {str(e)}",
        )
