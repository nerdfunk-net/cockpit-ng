"""
Nautobot to CheckMK comparison router for device synchronization and comparison.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import verify_token, verify_admin_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/nb2cmk", tags=["nb2cmk"])


# Device Sync Endpoints

@router.get("/devices", response_model=dict)
async def get_devices_for_sync(
    current_user: dict = Depends(verify_token),
):
    """Get all devices from Nautobot for CheckMK sync"""
    try:
        from services.nautobot import nautobot_service
        
        # Use GraphQL query to get all devices from Nautobot
        query = """
        query all_devices {
          devices {
            id
            name
            role {
              name
            }
            location {
              name
            }
            status {
              name
            }
          }
        }
        """
        
        result = await nautobot_service.graphql_query(query, {})
        if "errors" in result:
            logger.error(f"GraphQL errors: {result['errors']}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GraphQL errors: {result['errors']}",
            )

        nautobot_devices = result["data"]["devices"]
        
        # Transform the data to match frontend expectations (only Name, Role, Status, Location)
        devices = []
        for device in nautobot_devices:
            devices.append({
                "id": str(device.get("id", "")),
                "name": device.get("name", ""),
                "role": device.get("role", {}).get("name", "") if device.get("role") else "",
                "status": device.get("status", {}).get("name", "") if device.get("status") else "",
                "location": device.get("location", {}).get("name", "") if device.get("location") else ""
            })
        
        return {
            "devices": devices,
            "total": len(devices),
            "message": f"Retrieved {len(devices)} devices from Nautobot"
        }
        
    except Exception as e:
        logger.error(f"Error getting devices for CheckMK sync: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get devices for CheckMK sync: {str(e)}",
        )


@router.get("/devices/{device_id}/normalized")
async def get_device_normalized(device_id: str, current_user: dict = Depends(verify_token)):
    """Get normalized device config from Nautobot for CheckMK comparison."""
    try:
        from services.nautobot import nautobot_service
        
        # Fetch device data from Nautobot including custom fields
        query = """
        query getDevice($deviceId: ID!) {
          device(id: $deviceId) {
            id
            name
            primary_ip4 {
              address
            }
            location {
              name
            }
            role {
              name
            }
            platform {
              name
            }
            status {
              name
            }
            _custom_field_data
          }
        }
        """
        variables = {"deviceId": device_id}
        result = await nautobot_service.graphql_query(query, variables)

        if "errors" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GraphQL errors: {result['errors']}",
            )

        device_data = result["data"]["device"]
        
        if not device_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device with ID {device_id} not found",
            )

        # create the root extension dictionary
        extensions = {
            "folder": "",
            "attributes": {},
            "internal": {},
        }
        
        # Set hostname in internal dict (needed for CheckMK queries but not for comparison)
        extensions["internal"]["hostname"] = device_data.get("name", "")

        # Set folder using get_folder function
        extensions["folder"] = get_folder(device_data)

        # Set ipaddress from primary_ip4 (remove CIDR netmask for CheckMK compatibility)
        primary_ip4 = device_data.get("primary_ip4")
        if primary_ip4 and primary_ip4.get("address"):
            ip_address = primary_ip4.get("address")
            # Remove CIDR notation (e.g., "192.168.1.1/24" becomes "192.168.1.1")
            extensions["attributes"]["ipaddress"] = ip_address.split('/')[0] if '/' in ip_address else ip_address
        else:
            extensions["attributes"]["ipaddress"] = ""

        # Handle SNMP community mapping from custom fields
        custom_field_data = device_data.get("_custom_field_data", {})
        snmp_credentials = custom_field_data.get("snmp_credentials")
        
        if snmp_credentials:
            # Load SNMP mapping from yaml file
            import yaml
            import os
            
            config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "../config", "snmp_mapping.yaml")
            
            try:
                with open(config_path, 'r') as f:
                    snmp_mapping = yaml.safe_load(f)
                
                if snmp_credentials in snmp_mapping:
                    snmp_config = snmp_mapping[snmp_credentials]
                    
                    # Map SNMP configuration to normalized format
                    snmp_community = {
                        "type": snmp_config.get("type", ""),
                        "auth_protocol": snmp_config.get("auth_protocol_long", ""),
                        "security_name": snmp_config.get("username", ""),
                        "auth_password": snmp_config.get("auth_password", ""),
                        "privacy_protocol": snmp_config.get("privacy_protocol_long", ""),
                        "privacy_password": snmp_config.get("privacy_password", "")
                    }

                    extensions["attributes"]["snmp_community"] = snmp_community

                    # Add tag_snmp_ds for SNMP version 2 or 3
                    snmp_version = snmp_config.get("version")
                    if snmp_version in [2, 3]:
                        extensions["attributes"]["tag_snmp_ds"] = "snmp-v2"
                else:
                    logger.warning(f"SNMP credentials key '{snmp_credentials}' not found in mapping")
                    extensions["attributes"]["snmp_community"] = {}

            except Exception as e:
                logger.error(f"Error reading SNMP mapping file: {str(e)}")
                extensions["attributes"]["snmp_community"] = {}
        else:
            # No SNMP credentials configured
            extensions["attributes"]["snmp_community"] = {}

        return extensions
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting normalized device config for {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get normalized device config: {str(e)}",
        )


def parse_folder_value(folder_template: str, device_data: dict) -> str:
    """Parse folder template variables and return the processed folder path.
    
    Supports variables like {_custom_field_data.net} and direct device attributes.
    """
    import re
    
    folder_path = folder_template
    custom_field_data = device_data.get("_custom_field_data", {})
    
    # Find all template variables in the format {key} or {_custom_field_data.key}
    template_vars = re.findall(r'\{([^}]+)\}', folder_path)
    
    for var in template_vars:
        if var.startswith("_custom_field_data."):
            # Extract the custom field key
            custom_field_key = var.replace("_custom_field_data.", "")
            custom_field_value = custom_field_data.get(custom_field_key, "")
            folder_path = folder_path.replace(f"{{{var}}}", str(custom_field_value))
        elif var in device_data:
            # Direct device attribute
            device_value = device_data.get(var, "")
            folder_path = folder_path.replace(f"{{{var}}}", str(device_value))
    
    return folder_path


def get_folder(device_data: dict) -> str:
    """Get the correct CheckMK folder for a device based on configuration rules.
    
    Priority order: by_name > by_ip > by_location > default
    """
    try:
        import yaml
        import os
        import ipaddress
        
        # Load CheckMK configuration
        checkmk_config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "../config", "checkmk.yaml")
        
        with open(checkmk_config_path, 'r') as f:
            checkmk_config = yaml.safe_load(f)
        
        folders_config = checkmk_config.get("folders", {})
        
        device_name = device_data.get("name", "")
        device_location = device_data.get("location", {}).get("name", "") if device_data.get("location") else ""
        primary_ip4 = device_data.get("primary_ip4")
        device_ip = ""
        
        # Extract IP address from primary_ip4
        if primary_ip4 and primary_ip4.get("address"):
            ip_address = primary_ip4.get("address")
            device_ip = ip_address.split('/')[0] if '/' in ip_address else ip_address
        
        # 1. Check by_name first (highest priority)
        by_name_config = folders_config.get("by_name", {})
        if device_name and device_name in by_name_config:
            folder_template = by_name_config[device_name]
            return parse_folder_value(folder_template, device_data)
        
        # 2. Check by_ip (second priority)
        by_ip_config = folders_config.get("by_ip", {})
        if device_ip and by_ip_config:
            try:
                device_ip_obj = ipaddress.ip_address(device_ip)
                
                # Check each CIDR network in by_ip config
                for cidr_network, folder_template in by_ip_config.items():
                    try:
                        network = ipaddress.ip_network(cidr_network, strict=False)
                        if device_ip_obj in network:
                            return parse_folder_value(folder_template, device_data)
                    except ipaddress.AddressValueError:
                        logger.warning(f"Invalid CIDR network in config: {cidr_network}")
                        continue
                        
            except ipaddress.AddressValueError:
                logger.warning(f"Invalid device IP address: {device_ip}")
        
        # 3. Check by_location (third priority)
        by_location_config = folders_config.get("by_location", {})
        if device_location and by_location_config and device_location in by_location_config:
            folder_template = by_location_config[device_location]
            return parse_folder_value(folder_template, device_data)
        
        # 4. Use default folder (lowest priority) with template processing
        default_folder_template = folders_config.get("default", "/")
        return parse_folder_value(default_folder_template, device_data)
        
    except Exception as e:
        logger.error(f"Error determining folder for device: {str(e)}")
        return "/"


@router.get("/get_diff", response_model=dict)
async def get_devices_diff(
    current_user: dict = Depends(verify_token),
):
    """Get all devices from Nautobot with CheckMK comparison status"""
    try:
        from services.nautobot import nautobot_service
        
        # Use GraphQL query to get all devices from Nautobot
        query = """
        query all_devices {
          devices {
            id
            name
            role {
              name
            }
            location {
              name
            }
            status {
              name
            }
          }
        }
        """
        
        result = await nautobot_service.graphql_query(query, {})
        if "errors" in result:
            logger.error(f"GraphQL errors: {result['errors']}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GraphQL errors: {result['errors']}",
            )

        nautobot_devices = result["data"]["devices"]
        
        # Process each device and get comparison status
        devices_with_status = []
        for device in nautobot_devices:
            device_info = {
                "id": str(device.get("id", "")),
                "name": device.get("name", ""),
                "role": device.get("role", {}).get("name", "") if device.get("role") else "",
                "status": device.get("status", {}).get("name", "") if device.get("status") else "",
                "location": device.get("location", {}).get("name", "") if device.get("location") else "",
                "checkmk_status": "unknown"
            }
            
            # Try to get comparison status for this device
            try:
                device_id = str(device.get("id", ""))
                if device_id:
                    comparison_result = await compare_device_config(device_id, current_user)
                    device_info["checkmk_status"] = comparison_result["result"]
                    device_info["diff"] = comparison_result.get("diff", "")
                    device_info["normalized_config"] = comparison_result.get("normalized_config", {})
                    device_info["checkmk_config"] = comparison_result.get("checkmk_config", {})
                else:
                    device_info["checkmk_status"] = "error"
            except Exception as e:
                logger.warning(f"Error comparing device {device.get('name', 'unknown')}: {str(e)}")
                device_info["checkmk_status"] = "error"
            
            devices_with_status.append(device_info)
        
        return {
            "devices": devices_with_status,
            "total": len(devices_with_status),
            "message": f"Retrieved {len(devices_with_status)} devices with CheckMK comparison status"
        }
        
    except Exception as e:
        logger.error(f"Error getting devices diff: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get devices diff: {str(e)}",
        )


@router.get("/devices/{device_id}/compare")
async def compare_device_config(device_id: str, current_user: dict = Depends(verify_token)):
    """Compare normalized Nautobot device config with CheckMK host config."""
    try:
        # Get normalized config from our own endpoint
        normalized_config = await get_device_normalized(device_id, current_user)
        
        # Get hostname from internal dict
        internal_data = normalized_config.get("internal", {})
        hostname = internal_data.get("hostname")
        
        if not hostname:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Device has no hostname configured",
            )
        
        # Get CheckMK host config using internal API
        try:
            # Import the CheckMK router function
            from routers.checkmk import get_host
            
            # Create admin user context for CheckMK call (since CheckMK endpoints require admin)
            admin_user = {**current_user, "permissions": 15}  # Admin permissions
            
            # Call internal CheckMK API to get host data
            try:
                checkmk_response = await get_host(hostname, False, admin_user)
                # Extract the actual data from the CheckMKOperationResponse
                checkmk_data = checkmk_response.data if hasattr(checkmk_response, 'data') else checkmk_response
            except HTTPException as e:
                if e.status_code == 404:
                    return {
                        "result": "host_not_found",
                        "diff": f"Host '{hostname}' not found in CheckMK",
                        "normalized_config": normalized_config,
                        "checkmk_config": None
                    }
                else:
                    raise e
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting CheckMK host data for {hostname}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get CheckMK host data: {str(e)}",
            )
        
        # Extract attributes from CheckMK data
        checkmk_extensions = checkmk_data.get("extensions", {})
        
        # Remove meta_data key from CheckMK config before comparison
        if "meta_data" in checkmk_extensions['attributes']:
            del checkmk_extensions['attributes']["meta_data"]

        # Load CheckMK configuration to get comparison attributes
        try:
            import yaml
            import os
            
            checkmk_config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "../config", "checkmk.yaml")
            
            with open(checkmk_config_path, 'r') as f:
                checkmk_config = yaml.safe_load(f)
            
            # Get the list of attributes to compare
            compare_keys = checkmk_config.get("compare", [])
            
            # Get the list of attributes to ignore
            ignore_attributes = checkmk_config.get("ignore_attributes", [])
            
        except Exception as e:
            logger.error(f"Error reading CheckMK config file: {str(e)}")
            # Default to comparing all keys if config can't be read
            compare_keys = ["attributes", "folder"]
            ignore_attributes = []

        # Create clean copies for comparison (remove internal dicts)
        nb_config_for_comparison = {k: v for k, v in normalized_config.items() if k != "internal"}
        cmk_config_for_comparison = {k: v for k, v in checkmk_extensions.items() if k != "internal"}

        # Compare the configurations (only compare specified keys from config)
        differences = []
        
        for compare_key in compare_keys:
            if compare_key == "attributes":
                # Special handling for attributes (compare nested values)
                nb_attributes = nb_config_for_comparison.get("attributes", {})
                cmk_attributes = cmk_config_for_comparison.get("attributes", {})
                
                # Filter out ignored attributes
                nb_attributes_filtered = {k: v for k, v in nb_attributes.items() if k not in ignore_attributes}
                cmk_attributes_filtered = {k: v for k, v in cmk_attributes.items() if k not in ignore_attributes}
                
                # Compare attributes (only non-ignored ones)
                for key, nb_value in nb_attributes_filtered.items():
                    if key in cmk_attributes_filtered:
                        cmk_value = cmk_attributes_filtered[key]
                        if nb_value != cmk_value:
                            differences.append(f"attributes.'{key}': Nautobot='{nb_value}' vs CheckMK='{cmk_value}'")
                    else:
                        differences.append(f"attributes.'{key}': Present in Nautobot ('{nb_value}') but missing in CheckMK")
                
                # Check for attributes in CheckMK that are not in normalized config (only non-ignored ones)
                for key, cmk_value in cmk_attributes_filtered.items():
                    if key not in nb_attributes_filtered:
                        differences.append(f"attributes.'{key}': Present in CheckMK ('{cmk_value}') but missing in Nautobot")
                        
            else:
                # Direct comparison for other keys (like folder)
                nb_value = nb_config_for_comparison.get(compare_key)
                cmk_value = cmk_config_for_comparison.get(compare_key)
                
                if nb_value != cmk_value:
                    differences.append(f"'{compare_key}': Nautobot='{nb_value}' vs CheckMK='{cmk_value}'")
        
        # Determine result
        if differences:
            result = "diff"
            diff_text = "; ".join(differences)
        else:
            result = "equal"
            diff_text = ""
        
        return {
            "result": result,
            "diff": diff_text,
            "normalized_config": nb_config_for_comparison,
            "checkmk_config": cmk_config_for_comparison
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparing device configs for {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare device configs: {str(e)}",
        )