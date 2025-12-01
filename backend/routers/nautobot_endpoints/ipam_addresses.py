"""
Nautobot IPAM IP Address endpoints.
"""

from __future__ import annotations
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services import nautobot_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ipam/ip-addresses", tags=["nautobot-ipam-addresses"])


# IPAM IP Address Endpoints
# =============================================================================


@router.get("", summary="🔶 REST: List IP Addresses")
async def get_ipam_ip_addresses(
    address: Optional[str] = None,
    namespace: Optional[str] = None,
    parent: Optional[str] = None,
    status: Optional[str] = None,
    dns_name: Optional[str] = None,
    device: Optional[str] = None,
    interface: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
):
    """
    Get IP addresses from Nautobot IPAM.

    **🔶 This endpoint uses REST API** to query Nautobot IPAM IP addresses.

    Query parameters:
    - address: Filter by IP address (e.g., "192.168.1.1")
    - namespace: Filter by namespace name
    - parent: Filter by parent prefix ID
    - status: Filter by status (e.g., "active", "reserved", "deprecated")
    - dns_name: Filter by DNS name
    - device: Filter by device name or ID
    - interface: Filter by interface name or ID
    - limit: Maximum number of results
    - offset: Pagination offset
    """
    try:
        # Build query parameters
        params = {}
        if address:
            params["address"] = address
        if namespace:
            params["namespace"] = namespace
        if parent:
            params["parent"] = parent
        if status:
            params["status"] = status
        if dns_name:
            params["dns_name"] = dns_name
        if device:
            params["device"] = device
        if interface:
            params["interface"] = interface
        if limit:
            params["limit"] = limit
        if offset:
            params["offset"] = offset

        # Build endpoint URL with query parameters
        endpoint = "ipam/ip-addresses/"
        if params:
            query_string = "&".join([f"{k}={v}" for k, v in params.items()])
            endpoint = f"{endpoint}?{query_string}"

        result = await nautobot_service.rest_request(endpoint, method="GET")

        logger.info(
            f"Retrieved {result.get('count', 0)} IP addresses from Nautobot IPAM"
        )
        return result

    except Exception as e:
        logger.error(f"Failed to get IPAM IP addresses: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve IPAM IP addresses: {str(e)}",
        )


@router.get("/detailed", summary="🔷 GraphQL: Get Detailed IP Address Information")
async def get_ipam_ip_addresses_detailed(
    address: str,
    get_address: bool = True,
    get_config_context: bool = False,
    get_custom_field_data: bool = False,
    get__custom_field_data: bool = False,
    get_description: bool = False,
    get_device_type: bool = False,
    get_dns_name: bool = False,
    get_host: bool = False,
    get_hostname: bool = False,
    get_id: bool = False,
    get_interfaces: bool = False,
    get_interface_assignments: bool = False,
    get_ip_version: bool = False,
    get_location: bool = False,
    get_mask_length: bool = False,
    get_name: bool = False,
    get_parent: bool = False,
    get_platform: bool = False,
    get_primary_ip4_for: bool = False,
    get_primary_ip4: bool = False,
    get_role: bool = False,
    get_serial: bool = False,
    get_status: bool = False,
    get_tags: bool = False,
    get_tenant: bool = False,
    get_type: bool = False,
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
):
    """
    Get detailed IP address information from Nautobot using GraphQL.

    **🔷 This endpoint uses GraphQL** to query detailed IP address information including:
    - Basic IP address details (address, DNS name, description, type)
    - Parent prefix information
    - Interface assignments
    - Device information (if IP is primary for device)
    - Device interfaces, platform, role, location
    - Tags, custom fields, config context
    - Connected circuits, VLANs, cables

    Query parameters control which fields are returned:
    - address: IP address to query (required, e.g., "192.168.1.1/24")
    - get_*: Boolean flags to control which fields are included (default: only address)

    Common usage:
    - Basic info: ?address=192.168.1.1&get_dns_name=true&get_description=true
    - Device info: ?address=192.168.1.1&get_primary_ip4_for=true&get_name=true&get_location=true
    - Full details: ?address=192.168.1.1&get_primary_ip4_for=true&get_interfaces=true&get_tags=true
    """
    try:
        # GraphQL query with conditional field inclusion
        query = """
        query IPaddresses(
          $get_address: Boolean = true,
          $get_config_context: Boolean = false,
          $get_custom_field_data: Boolean = false,
          $get__custom_field_data: Boolean = false,
          $get_description: Boolean = false,
          $get_device_type: Boolean = false,
          $get_dns_name: Boolean = false,
          $get_host: Boolean = false,
          $get_hostname: Boolean = false,
          $get_id: Boolean = false,
          $get_interfaces: Boolean = false,
          $get_interface_assignments: Boolean = false,
          $get_ip_version: Boolean = false,
          $get_location: Boolean = false,
          $get_mask_length: Boolean = false,
          $get_name: Boolean = false,
          $get_parent: Boolean = false,
          $get_platform: Boolean = false,
          $get_primary_ip4_for: Boolean = false,
          $get_primary_ip4: Boolean = false,
          $get_role: Boolean = false,
          $get_serial: Boolean = false,
          $get_status:  Boolean = false,
          $get_tags: Boolean = false,
          $get_tenant: Boolean = false,
          $get_type: Boolean = false,
          $address_filter: [String]
        )
        {
          ip_addresses(address: $address_filter)
          {
            id @include(if: $get_id)
            address @include(if: $get_address)
            description @include(if: $get_description)
            dns_name @include(if: $get_dns_name)
            type @include(if: $get_type)
            tags @include(if: $get_tags)
            {
              id @include(if: $get_id)
              name
            }
            parent @include(if: $get_parent)
            {
              id @include(if: $get_id)
              network
              prefix
              prefix_length
              namespace {
                id @include(if: $get_id)
                name
              }
              _custom_field_data @include(if: $get__custom_field_data)
              custom_field_data : _custom_field_data @include(if: $get_custom_field_data)
            }
            interfaces @include(if: $get_interfaces)
            {
              id @include(if: $get_id)
              name
              device {
                id @include(if: $get_id)
                name
              }
              description
              enabled
              mac_address
              type
              mode
              ip_addresses {
                address
                role {
                  id @include(if: $get_id)
                  name
                }
                tags {
                  name
                  content_types {
                    id @include(if: $get_id)
                    app_label
                    model
                  }
                }
              }
            }
            interface_assignments @include(if: $get_interface_assignments)
            {
              id @include(if: $get_id)
              is_standby
              is_default
              is_destination
              interface {
                id @include(if: $get_id)
                name
                description
                type
                status {
                  id @include(if: $get_id)
                  name
                }
                device {
                  id @include(if: $get_id)
                  name
                }
                child_interfaces {
                  id @include(if: $get_id)
                  name
                }
              }
            }
            primary_ip4_for @include(if: $get_primary_ip4_for) {
              id @include(if: $get_id)
              name @include(if: $get_name)
              hostname: name @include(if: $get_hostname)
              role @include(if: $get_role)
              {
                id @include(if: $get_id)
                name
              }
              device_type @include(if: $get_device_type)
              {
                id @include(if: $get_id)
                model
              }
              platform @include(if: $get_platform)
              {
                id @include(if: $get_id)
                name
                manufacturer {
                  id @include(if: $get_id)
                  name
                }
              }
              tags @include(if: $get_tags)
              {
                id @include(if: $get_id)
                name
                content_types {
                  id @include(if: $get_id)
                  app_label
                  model
                }
              }
              tenant @include(if: $get_tenant)
              {
                id @include(if: $get_id)
                name
                tenant_group {
                  name
                }
              }
              serial @include(if: $get_serial)
              status @include(if: $get_status)
              {
                id @include(if: $get_id)
                name
              }
              config_context @include(if: $get_config_context)
              _custom_field_data @include(if: $get__custom_field_data)
              custom_field_data : _custom_field_data @include(if: $get_custom_field_data)
              primary_ip4 @include(if: $get_primary_ip4)
              {
                id @include(if: $get_id)
                description @include(if: $get_description)
                ip_version @include(if: $get_ip_version)
                address @include(if: $get_address)
                host @include(if: $get_host)
                mask_length @include(if: $get_mask_length)
                dns_name @include(if: $get_dns_name)
                parent @include(if: $get_parent)
                {
                  id @include(if: $get_id)
                  prefix
                }
                status @include(if: $get_status)
                {
                  id @include(if: $get_id)
                  name
                }
                interfaces @include(if: $get_interfaces)
                {
                  id @include(if: $get_id)
                  name
                  description
                  enabled
                  mac_address
                  type
                  mode
                }
              }
              interfaces @include(if: $get_interfaces)
              {
                id @include(if: $get_id)
                name
                device {
                  name
                }
                description
                enabled
                mac_address
                type
                mode
                ip_addresses
                {
                  address
                  role {
                    id @include(if: $get_id)
                    name
                  }
                  tags
                  {
                    id @include(if: $get_id)
                    name
                    content_types {
                      id
                      app_label
                      model
                    }
                  }
                }
                connected_circuit_termination
                {
                  circuit {
                    cid
                    commit_rate
                    provider {
                      name
                    }
                  }
                }
                tagged_vlans
                {
                  name
                  vid
                }
                untagged_vlan
                {
                  name
                  vid
                }
                cable
                {
                  termination_a_type
                  status
                  {
                    name
                  }
                  color
                }
                tags
                {
                  name
                  content_types
                  {
                    id
                    app_label
                    model
                  }
                }
                lag {
                  name
                  enabled
                }
                member_interfaces {
                  name
                }
              }
              location @include(if: $get_location) {
                name
              }
            }
          }
        }
        """

        # Build variables from query parameters
        variables = {
            "address_filter": [address],
            "get_address": get_address,
            "get_config_context": get_config_context,
            "get_custom_field_data": get_custom_field_data,
            "get__custom_field_data": get__custom_field_data,
            "get_description": get_description,
            "get_device_type": get_device_type,
            "get_dns_name": get_dns_name,
            "get_host": get_host,
            "get_hostname": get_hostname,
            "get_id": get_id,
            "get_interfaces": get_interfaces,
            "get_interface_assignments": get_interface_assignments,
            "get_ip_version": get_ip_version,
            "get_location": get_location,
            "get_mask_length": get_mask_length,
            "get_name": get_name,
            "get_parent": get_parent,
            "get_platform": get_platform,
            "get_primary_ip4_for": get_primary_ip4_for,
            "get_primary_ip4": get_primary_ip4,
            "get_role": get_role,
            "get_serial": get_serial,
            "get_status": get_status,
            "get_tags": get_tags,
            "get_tenant": get_tenant,
            "get_type": get_type,
        }

        result = await nautobot_service.graphql_query(query, variables)

        if "errors" in result:
            logger.error(f"GraphQL errors: {result['errors']}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"GraphQL query failed: {result['errors']}",
            )

        ip_addresses = result.get("data", {}).get("ip_addresses", [])

        logger.info(f"Retrieved detailed information for IP address: {address}")

        return {"count": len(ip_addresses), "ip_addresses": ip_addresses}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get detailed IP address information: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve detailed IP address information: {str(e)}",
        )


@router.get("/{ip_address_id}", summary="🔶 REST: Get IP Address")
async def get_ipam_ip_address(
    ip_address_id: str,
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
):
    """
    Get a specific IP address by ID from Nautobot IPAM.

    Parameters:
    - ip_address_id: The UUID of the IP address
    """
    try:
        endpoint = f"ipam/ip-addresses/{ip_address_id}/"
        result = await nautobot_service.rest_request(endpoint, method="GET")

        logger.info(f"Retrieved IP address {ip_address_id} from Nautobot IPAM")
        return result

    except Exception as e:
        logger.error(f"Failed to get IPAM IP address {ip_address_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND
            if "404" in str(e)
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve IPAM IP address: {str(e)}",
        )


@router.post("", summary="🔶 REST: Create IP Address")
async def create_ipam_ip_address(
    ip_address_data: dict,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
):
    """
    Create a new IP address in Nautobot IPAM.

    Request body should contain:
    - address: The IP address with mask (e.g., "192.168.1.1/24" or "192.168.1.1")
    - namespace: Namespace ID (optional, defaults to Global)
    - status: Status ID or name (e.g., "active")
    - type: Address type (e.g., "host", "anycast", "loopback")
    - parent: (optional) Parent prefix ID
    - dns_name: (optional) DNS name
    - description: (optional) Description
    - tags: (optional) List of tag IDs

    Example:
    {
        "address": "192.168.1.100/24",
        "namespace": "global",
        "status": "active",
        "type": "host",
        "dns_name": "server.example.com",
        "description": "Application server"
    }
    """
    try:
        # Validate required fields
        if "address" not in ip_address_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required field: address",
            )

        endpoint = "ipam/ip-addresses/"
        result = await nautobot_service.rest_request(
            endpoint, method="POST", data=ip_address_data
        )

        logger.info(
            f"Created IP address {ip_address_data.get('address')} in Nautobot IPAM"
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create IPAM IP address: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create IPAM IP address: {str(e)}",
        )


@router.put("/{ip_address_id}", summary="🔶 REST: Update IP Address (Full)")
@router.patch("/{ip_address_id}", summary="🔶 REST: Update IP Address (Partial)")
async def update_ipam_ip_address(
    ip_address_id: str,
    ip_address_data: dict,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
):
    """
    Update an existing IP address in Nautobot IPAM.

    Parameters:
    - ip_address_id: The UUID of the IP address to update

    Request body can contain any updatable fields:
    - address: The IP address with mask
    - namespace: Namespace ID
    - status: Status ID
    - type: Address type
    - parent: Parent prefix ID
    - dns_name: DNS name
    - description: Description
    - tags: List of tag IDs
    """
    try:
        endpoint = f"ipam/ip-addresses/{ip_address_id}/"

        # Use PATCH for partial updates
        result = await nautobot_service.rest_request(
            endpoint, method="PATCH", data=ip_address_data
        )

        logger.info(f"Updated IP address {ip_address_id} in Nautobot IPAM")
        return result

    except Exception as e:
        logger.error(f"Failed to update IPAM IP address {ip_address_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND
            if "404" in str(e)
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update IPAM IP address: {str(e)}",
        )


@router.delete("/{ip_address_id}", summary="🔶 REST: Delete IP Address")
async def delete_ipam_ip_address(
    ip_address_id: str,
    current_user: dict = Depends(require_permission("nautobot.locations", "delete")),
):
    """
    Delete an IP address from Nautobot IPAM.

    Parameters:
    - ip_address_id: The UUID of the IP address to delete
    """
    try:
        endpoint = f"ipam/ip-addresses/{ip_address_id}/"
        result = await nautobot_service.rest_request(endpoint, method="DELETE")

        logger.info(f"Deleted IP address {ip_address_id} from Nautobot IPAM")
        return result

    except Exception as e:
        logger.error(f"Failed to delete IPAM IP address {ip_address_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND
            if "404" in str(e)
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete IPAM IP address: {str(e)}",
        )
