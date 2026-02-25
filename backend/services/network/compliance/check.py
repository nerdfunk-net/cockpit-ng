"""Compliance check service for verifying device compliance.

Performs SSH login checks, SNMP credential validation, and configuration pattern matching.
"""

from __future__ import annotations
import logging
from typing import Dict, List, Any, Optional
from netmiko import ConnectHandler
from pysnmp.hlapi.v3arch import (
    SnmpEngine,
    CommunityData,
    UsmUserData,
    UdpTransportTarget,
    ContextData,
    ObjectType,
    ObjectIdentity,
    get_cmd,
    usmHMACMD5AuthProtocol,
    usmHMACSHAAuthProtocol,
    usmDESPrivProtocol,
    usmAesCfb128Protocol,
    usmAesCfb192Protocol,
    usmAesCfb256Protocol,
    usmNoAuthProtocol,
    usmNoPrivProtocol,
)
import asyncio
import re

logger = logging.getLogger(__name__)


class ComplianceCheckService:
    """Service for performing compliance checks on network devices."""

    @staticmethod
    def check_ssh_login(
        device_ip: str,
        device_type: str,
        username: str,
        password: str,
        timeout: int = 10,
    ) -> Dict[str, Any]:
        """
        Check if SSH login is successful for a device.

        Args:
            device_ip: IP address of the device
            device_type: Device type (e.g., 'cisco_ios', 'juniper_junos')
            username: Username for SSH login
            password: Password for SSH login
            timeout: Connection timeout in seconds

        Returns:
            Dictionary with success status, message, and details
        """
        try:
            # Prepare Netmiko connection parameters
            device_params = {
                "device_type": device_type,
                "host": device_ip,
                "username": username,
                "password": password,
                "timeout": timeout,
                "conn_timeout": timeout,
            }

            # Attempt to connect
            with ConnectHandler(**device_params) as connection:
                # Get prompt to verify connection
                prompt = connection.find_prompt()

                return {
                    "success": True,
                    "status": "pass",
                    "message": "SSH login successful",
                    "details": {
                        "prompt": prompt,
                        "username": username,
                    },
                }

        except Exception as e:
            error_msg = str(e)
            logger.warning(
                "SSH login failed for %s with user %s: %s", device_ip, username, error_msg
            )

            return {
                "success": False,
                "status": "fail",
                "message": f"SSH login failed: {error_msg}",
                "details": {
                    "username": username,
                    "error": error_msg,
                },
            }

    @staticmethod
    def _get_snmp_auth_protocol(protocol: str):
        """Map protocol string to pysnmp auth protocol."""
        protocol_map = {
            "MD5": usmHMACMD5AuthProtocol,
            "SHA": usmHMACSHAAuthProtocol,
            "SHA-224": usmHMACSHAAuthProtocol,  # Use SHA for now
            "SHA-256": usmHMACSHAAuthProtocol,  # Use SHA for now
            "SHA-384": usmHMACSHAAuthProtocol,  # Use SHA for now
            "SHA-512": usmHMACSHAAuthProtocol,  # Use SHA for now
        }
        return protocol_map.get(protocol, usmNoAuthProtocol)

    @staticmethod
    def _get_snmp_priv_protocol(protocol: str):
        """Map protocol string to pysnmp privacy protocol."""
        protocol_map = {
            "DES": usmDESPrivProtocol,
            "AES": usmAesCfb128Protocol,
            "AES-128": usmAesCfb128Protocol,
            "AES-192": usmAesCfb192Protocol,
            "AES-256": usmAesCfb256Protocol,
        }
        return protocol_map.get(protocol, usmNoPrivProtocol)

    @staticmethod
    async def check_snmp_v1_v2c_async(
        device_ip: str, community: str, version: int = 2, timeout: int = 5
    ) -> Dict[str, Any]:
        """
        Check SNMP v1 or v2c access to a device (async).

        Args:
            device_ip: IP address of the device
            community: SNMP community string
            version: SNMP version (1 or 2)
            timeout: Connection timeout in seconds

        Returns:
            Dictionary with success status, message, and details
        """
        try:
            # Create SNMP command using v7 API
            error_indication, error_status, error_index, var_binds = await get_cmd(
                SnmpEngine(),
                CommunityData(community, mpModel=version - 1),  # 0 for v1, 1 for v2c
                await UdpTransportTarget.create((device_ip, 161), timeout=timeout),
                ContextData(),
                ObjectType(ObjectIdentity("SNMPv2-MIB", "sysDescr", 0)),
                lookupMib=False,
                lexicographicMode=False,
            )

            # Check for errors
            if error_indication:
                return {
                    "success": False,
                    "status": "fail",
                    "message": f"SNMP query failed: {error_indication}",
                    "details": {
                        "community": community,
                        "version": f"v{version}",
                        "error": str(error_indication),
                    },
                }
            elif error_status:
                return {
                    "success": False,
                    "status": "fail",
                    "message": f"SNMP error: {error_status.prettyPrint()} at {error_index}",
                    "details": {
                        "community": community,
                        "version": f"v{version}",
                        "error": error_status.prettyPrint(),
                    },
                }
            else:
                # Extract system description
                sys_descr = None
                for var_bind in var_binds:
                    sys_descr = var_bind[1].prettyPrint()

                return {
                    "success": True,
                    "status": "pass",
                    "message": "SNMP query successful",
                    "details": {
                        "community": community,
                        "version": f"v{version}",
                        "sysDescr": sys_descr,
                    },
                }

        except Exception as e:
            error_msg = str(e)
            logger.warning("SNMP v%s check failed for %s: %s", version, device_ip, error_msg)

            return {
                "success": False,
                "status": "fail",
                "message": f"SNMP v{version} check failed: {error_msg}",
                "details": {
                    "community": community,
                    "version": f"v{version}",
                    "error": error_msg,
                },
            }

    @staticmethod
    def check_snmp_v1_v2c(
        device_ip: str, community: str, version: int = 2, timeout: int = 5
    ) -> Dict[str, Any]:
        """
        Check SNMP v1 or v2c access to a device (synchronous wrapper).
        """
        return asyncio.run(
            ComplianceCheckService.check_snmp_v1_v2c_async(
                device_ip, community, version, timeout
            )
        )

    @staticmethod
    async def check_snmp_v3_async(
        device_ip: str,
        username: str,
        auth_protocol: Optional[str] = None,
        auth_password: Optional[str] = None,
        priv_protocol: Optional[str] = None,
        priv_password: Optional[str] = None,
        timeout: int = 5,
    ) -> Dict[str, Any]:
        """
        Check SNMP v3 access to a device (async).

        Args:
            device_ip: IP address of the device
            username: SNMPv3 username
            auth_protocol: Authentication protocol (MD5, SHA, SHA-256, etc.)
            auth_password: Authentication password
            priv_protocol: Privacy/encryption protocol (DES, AES, AES-256, etc.)
            priv_password: Privacy password
            timeout: Connection timeout in seconds

        Returns:
            Dictionary with success status, message, and details
        """
        try:
            # Normalize empty strings to None
            auth_password = auth_password if auth_password else None
            priv_password = priv_password if priv_password else None
            auth_protocol = auth_protocol if auth_protocol else None
            priv_protocol = priv_protocol if priv_protocol else None

            # Determine authentication and privacy levels
            # If no auth password, force noAuth regardless of protocol setting
            auth_proto = (
                ComplianceCheckService._get_snmp_auth_protocol(auth_protocol)
                if auth_protocol and auth_password
                else usmNoAuthProtocol
            )
            # If no priv password OR no auth, force noPriv (privacy requires auth)
            priv_proto = (
                ComplianceCheckService._get_snmp_priv_protocol(priv_protocol)
                if priv_protocol and priv_password and auth_password
                else usmNoPrivProtocol
            )

            # Debug logging
            logger.debug("SNMPv3 check for %s", device_ip)
            logger.debug("  Username: %s", username)
            logger.debug("  Auth Protocol: %s (mapped to %s)", auth_protocol, auth_proto)
            logger.debug("  Auth Password: %s", '***set***' if auth_password else 'None')
            logger.debug("  Priv Protocol: %s (mapped to %s)", priv_protocol, priv_proto)
            logger.debug("  Priv Password: %s", '***set***' if priv_password else 'None')

            # Create USM user data for SNMPv3
            # Only pass passwords if they exist and corresponding protocol is not noAuth/noPriv
            usm_user = UsmUserData(
                username,
                auth_password if auth_proto != usmNoAuthProtocol else None,
                priv_password if priv_proto != usmNoPrivProtocol else None,
                authProtocol=auth_proto,
                privProtocol=priv_proto,
            )

            logger.debug("  Created UsmUserData for user: %s", username)

            # Create SNMP command using v7 API
            logger.debug("  Sending SNMPv3 GET request to %s:161...", device_ip)
            error_indication, error_status, error_index, var_binds = await get_cmd(
                SnmpEngine(),
                usm_user,
                await UdpTransportTarget.create((device_ip, 161), timeout=timeout),
                ContextData(),
                ObjectType(ObjectIdentity("SNMPv2-MIB", "sysName", 0)),
                lookupMib=False,
                lexicographicMode=False,
            )

            # Check for errors
            if error_indication:
                logger.warning(
                    "  SNMPv3 query failed with error_indication: %s", error_indication
                )
                return {
                    "success": False,
                    "status": "fail",
                    "message": f"SNMP v3 query failed: {error_indication}",
                    "details": {
                        "username": username,
                        "auth_protocol": auth_protocol,
                        "priv_protocol": priv_protocol,
                        "error": str(error_indication),
                    },
                }
            elif error_status:
                logger.warning(
                    "  SNMPv3 query failed with error_status: %s at index %s", error_status.prettyPrint(), error_index
                )
                return {
                    "success": False,
                    "status": "fail",
                    "message": f"SNMP v3 error: {error_status.prettyPrint()} at {error_index}",
                    "details": {
                        "username": username,
                        "auth_protocol": auth_protocol,
                        "priv_protocol": priv_protocol,
                        "error": error_status.prettyPrint(),
                    },
                }
            else:
                # Extract system description
                sys_descr = None
                for var_bind in var_binds:
                    sys_descr = var_bind[1].prettyPrint()

                logger.debug(
                    "  SNMPv3 query successful! sysDescr: %s...", sys_descr[:50] if sys_descr else 'N/A'
                )

                return {
                    "success": True,
                    "status": "pass",
                    "message": "SNMP v3 query successful",
                    "details": {
                        "username": username,
                        "auth_protocol": auth_protocol,
                        "priv_protocol": priv_protocol,
                        "sysDescr": sys_descr,
                    },
                }

        except Exception as e:
            error_msg = str(e)
            logger.warning(
                "SNMP v3 check failed for %s with user %s: %s", device_ip, username, error_msg
            )

            return {
                "success": False,
                "status": "fail",
                "message": f"SNMP v3 check failed: {error_msg}",
                "details": {
                    "username": username,
                    "auth_protocol": auth_protocol,
                    "priv_protocol": priv_protocol,
                    "error": error_msg,
                },
            }

    @staticmethod
    def check_snmp_v3(
        device_ip: str,
        username: str,
        auth_protocol: Optional[str] = None,
        auth_password: Optional[str] = None,
        priv_protocol: Optional[str] = None,
        priv_password: Optional[str] = None,
        timeout: int = 5,
    ) -> Dict[str, Any]:
        """
        Check SNMP v3 access to a device (synchronous wrapper).
        """
        return asyncio.run(
            ComplianceCheckService.check_snmp_v3_async(
                device_ip,
                username,
                auth_protocol,
                auth_password,
                priv_protocol,
                priv_password,
                timeout,
            )
        )

    @staticmethod
    def check_configuration_pattern(
        device_ip: str,
        configuration: str,
        pattern: str,
        pattern_type: str,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Check if a configuration pattern matches or doesn't match (mock implementation).

        Args:
            device_ip: IP address of the device
            configuration: Device configuration text
            pattern: Regex pattern to match
            pattern_type: 'must_match' or 'must_not_match'
            description: Pattern description

        Returns:
            Dictionary with success status, message, and details
        """
        try:
            # Compile regex pattern
            regex = re.compile(pattern, re.MULTILINE)
            matches = regex.findall(configuration)

            if pattern_type == "must_match":
                # Pattern MUST be present
                if matches:
                    return {
                        "success": True,
                        "status": "pass",
                        "message": "Pattern matched as expected",
                        "details": {
                            "pattern": pattern,
                            "pattern_type": pattern_type,
                            "description": description,
                            "matches": len(matches),
                            "match_samples": matches[:3],  # First 3 matches
                        },
                    }
                else:
                    return {
                        "success": False,
                        "status": "fail",
                        "message": "Required pattern not found in configuration",
                        "details": {
                            "pattern": pattern,
                            "pattern_type": pattern_type,
                            "description": description,
                            "matches": 0,
                        },
                    }
            else:  # must_not_match
                # Pattern MUST NOT be present
                if matches:
                    return {
                        "success": False,
                        "status": "fail",
                        "message": "Forbidden pattern found in configuration",
                        "details": {
                            "pattern": pattern,
                            "pattern_type": pattern_type,
                            "description": description,
                            "matches": len(matches),
                            "match_samples": matches[:3],  # First 3 matches
                        },
                    }
                else:
                    return {
                        "success": True,
                        "status": "pass",
                        "message": "Forbidden pattern not found (as expected)",
                        "details": {
                            "pattern": pattern,
                            "pattern_type": pattern_type,
                            "description": description,
                            "matches": 0,
                        },
                    }

        except re.error as e:
            return {
                "success": False,
                "status": "error",
                "message": f"Invalid regex pattern: {str(e)}",
                "details": {
                    "pattern": pattern,
                    "pattern_type": pattern_type,
                    "description": description,
                    "error": str(e),
                },
            }
        except Exception as e:
            error_msg = str(e)
            logger.error(
                "Configuration pattern check failed for %s: %s", device_ip, error_msg
            )

            return {
                "success": False,
                "status": "error",
                "message": f"Pattern check failed: {error_msg}",
                "details": {
                    "pattern": pattern,
                    "pattern_type": pattern_type,
                    "description": description,
                    "error": error_msg,
                },
            }

    @staticmethod
    def check_configuration_mock(
        device_ip: str, device_name: str, patterns: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Mock implementation of configuration checking.

        This is a placeholder that generates mock results.
        Real implementation would fetch actual device configuration.

        Args:
            device_ip: IP address of the device
            device_name: Device name
            patterns: List of regex patterns to check

        Returns:
            Dictionary with check results
        """
        # Mock configuration
        mock_config = f"""!
hostname {device_name}
!
logging buffered 51200
logging console informational
!
snmp-server community public RO
snmp-server location DataCenter
!
interface GigabitEthernet0/0
 ip address {device_ip} 255.255.255.0
!
line vty 0 4
 transport input ssh
 login local
!
end
"""

        pattern_results = []
        for pattern_info in patterns:
            result = ComplianceCheckService.check_configuration_pattern(
                device_ip=device_ip,
                configuration=mock_config,
                pattern=pattern_info["pattern"],
                pattern_type=pattern_info["pattern_type"],
                description=pattern_info.get("description"),
            )
            pattern_results.append(result)

        # Calculate overall status
        all_passed = all(r["success"] for r in pattern_results)

        return {
            "success": all_passed,
            "status": "pass" if all_passed else "fail",
            "message": f"Configuration check {'passed' if all_passed else 'failed'}",
            "total_patterns": len(patterns),
            "passed": sum(1 for r in pattern_results if r["success"]),
            "failed": sum(1 for r in pattern_results if not r["success"]),
            "pattern_results": pattern_results,
            "note": "This is a mock implementation using sample configuration",
        }
