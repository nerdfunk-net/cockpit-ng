"""
Action dispatcher for MCP requests.
Maps action names to handler functions.
"""

import logging
from typing import Dict, Any, Callable, Awaitable
from models.mcp import MCPRequest
from services.client import (
    get_devices, scan_network, backup_device_config, 
    sync_devices, compare_configs
)

logger = logging.getLogger(__name__)


async def handle_inventory_list(params: Dict[str, Any]) -> Dict[str, Any]:
    """List devices in inventory."""
    try:
        devices = await get_devices()
        return {
            "action": "inventory.list",
            "devices": devices.get("devices", []),
            "count": len(devices.get("devices", []))
        }
    except Exception as e:
        logger.error(f"Error listing inventory: {e}")
        raise


async def handle_inventory_sync(params: Dict[str, Any]) -> Dict[str, Any]:
    """Sync device inventory."""
    try:
        result = await sync_devices()
        return {
            "action": "inventory.sync",
            "result": result,
            "message": "Inventory sync completed"
        }
    except Exception as e:
        logger.error(f"Error syncing inventory: {e}")
        raise


async def handle_scan_network(params: Dict[str, Any]) -> Dict[str, Any]:
    """Scan network for devices."""
    network_range = params.get("network_range")
    if not network_range:
        raise ValueError("network_range parameter is required")
    
    try:
        result = await scan_network(network_range)
        return {
            "action": "scan.network",
            "network_range": network_range,
            "result": result,
            "message": f"Network scan started for {network_range}"
        }
    except Exception as e:
        logger.error(f"Error scanning network {network_range}: {e}")
        raise


async def handle_backup_device(params: Dict[str, Any]) -> Dict[str, Any]:
    """Backup device configuration."""
    device_id = params.get("device_id")
    if not device_id:
        raise ValueError("device_id parameter is required")
    
    try:
        result = await backup_device_config(device_id)
        return {
            "action": "backup.device",
            "device_id": device_id,
            "result": result,
            "message": f"Backup completed for device {device_id}"
        }
    except Exception as e:
        logger.error(f"Error backing up device {device_id}: {e}")
        raise


async def handle_compare_configs(params: Dict[str, Any]) -> Dict[str, Any]:
    """Compare device configurations."""
    device_id = params.get("device_id")
    config1 = params.get("config1")
    config2 = params.get("config2")
    
    if not all([device_id, config1, config2]):
        raise ValueError("device_id, config1, and config2 parameters are required")
    
    try:
        result = await compare_configs(device_id, config1, config2)
        return {
            "action": "compare.configs",
            "device_id": device_id,
            "result": result,
            "message": f"Configuration comparison completed for device {device_id}"
        }
    except Exception as e:
        logger.error(f"Error comparing configs for device {device_id}: {e}")
        raise


async def handle_onboard_device(params: Dict[str, Any]) -> Dict[str, Any]:
    """Onboard a new device."""
    # This is a placeholder for device onboarding logic
    device_info = params.get("device_info", {})
    
    logger.info(f"Onboarding device: {device_info}")
    
    return {
        "action": "onboard.device",
        "device_info": device_info,
        "status": "pending",
        "message": "Device onboarding initiated"
    }


# Action handler registry
ACTION_HANDLERS: Dict[str, Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]] = {
    "inventory.list": handle_inventory_list,
    "inventory.sync": handle_inventory_sync,
    "scan.network": handle_scan_network,
    "backup.device": handle_backup_device,
    "compare.configs": handle_compare_configs,
    "onboard.device": handle_onboard_device,
}


async def dispatch(request: MCPRequest) -> Dict[str, Any]:
    """Dispatch MCP request to appropriate handler."""
    action = request.action
    params = request.params
    
    logger.info(f"Dispatching action: {action} with params: {params}")
    
    # Find handler for action
    handler = ACTION_HANDLERS.get(action)
    if not handler:
        available_actions = list(ACTION_HANDLERS.keys())
        raise ValueError(f"Unknown action '{action}'. Available actions: {available_actions}")
    
    # Execute handler
    try:
        result = await handler(params)
        logger.info(f"Action {action} completed successfully")
        return result
    except Exception as e:
        logger.error(f"Action {action} failed: {e}")
        raise