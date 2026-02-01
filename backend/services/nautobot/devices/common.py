"""
Device Common Service - Facade for backward compatibility.

DEPRECATED: This facade provides backward compatibility for existing code.
New code should inject specific resolvers/managers directly.

This service will be removed in a future version.
"""

import logging
from typing import Optional, List, Dict, Any, Tuple
from services.nautobot import NautobotService
from services.nautobot.resolvers import (
    DeviceResolver,
    MetadataResolver,
    NetworkResolver,
)
from services.nautobot.managers import (
    IPManager,
    InterfaceManager,
    PrefixManager,
    DeviceManager,
)
from services.nautobot.common.validators import (
    is_valid_uuid,
    validate_ip_address,
    validate_mac_address,
    validate_required_fields,
)
from services.nautobot.common.utils import (
    flatten_nested_fields,
    extract_nested_value,
    normalize_tags,
    prepare_update_data,
)
from services.nautobot.common.exceptions import (
    is_duplicate_error,
    handle_already_exists_error,
)

logger = logging.getLogger(__name__)


class DeviceCommonService:
    """
    Common service providing shared utilities for device operations.

    DEPRECATED: This is a facade for backward compatibility.
    New code should inject DeviceResolver, MetadataResolver, NetworkResolver,
    IPManager, InterfaceManager, PrefixManager, or DeviceManager directly.
    """

    def __init__(self, nautobot_service: NautobotService):
        """
        Initialize the common service.

        Args:
            nautobot_service: NautobotService instance for API calls
        """
        self.nautobot = nautobot_service

        # Initialize resolvers
        self.device_resolver = DeviceResolver(nautobot_service)
        self.metadata_resolver = MetadataResolver(nautobot_service)
        self.network_resolver = NetworkResolver(nautobot_service)

        # Initialize managers
        self.ip_manager = IPManager(
            nautobot_service,
            self.network_resolver,
            self.metadata_resolver,
        )
        self.prefix_manager = PrefixManager(
            nautobot_service,
            self.network_resolver,
            self.metadata_resolver,
        )
        self.interface_manager = InterfaceManager(
            nautobot_service,
            self.network_resolver,
            self.metadata_resolver,
            self.ip_manager,
        )
        self.device_manager = DeviceManager(
            nautobot_service,
            self.device_resolver,
            self.network_resolver,
        )

    # ========================================================================
    # DEVICE RESOLUTION METHODS (delegated to DeviceResolver)
    # ========================================================================

    async def resolve_device_by_name(self, device_name: str) -> Optional[str]:
        """Delegate to DeviceResolver."""
        return await self.device_resolver.resolve_device_by_name(device_name)

    async def resolve_device_by_ip(self, ip_address: str) -> Optional[str]:
        """Delegate to DeviceResolver."""
        return await self.device_resolver.resolve_device_by_ip(ip_address)

    async def resolve_device_id(
        self,
        device_id: Optional[str] = None,
        device_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> Optional[str]:
        """Delegate to DeviceResolver."""
        return await self.device_resolver.resolve_device_id(
            device_id, device_name, ip_address
        )

    async def find_interface_with_ip(
        self, device_name: str, ip_address: str
    ) -> Optional[Tuple[str, str]]:
        """Delegate to DeviceResolver."""
        return await self.device_resolver.find_interface_with_ip(
            device_name, ip_address
        )

    async def resolve_device_type_id(
        self, model: str, manufacturer: Optional[str] = None
    ) -> Optional[str]:
        """Delegate to DeviceResolver."""
        return await self.device_resolver.resolve_device_type_id(model, manufacturer)

    async def get_device_type_display(self, device_type_id: str) -> Optional[str]:
        """Delegate to DeviceResolver."""
        return await self.device_resolver.get_device_type_display(device_type_id)

    # ========================================================================
    # METADATA RESOLUTION METHODS (delegated to MetadataResolver)
    # ========================================================================

    async def resolve_status_id(
        self, status_name: str, content_type: str = "dcim.device"
    ) -> str:
        """Delegate to MetadataResolver."""
        return await self.metadata_resolver.resolve_status_id(status_name, content_type)

    async def resolve_role_id(self, role_name: str) -> Optional[str]:
        """Delegate to MetadataResolver."""
        return await self.metadata_resolver.resolve_role_id(role_name)

    async def resolve_platform_id(self, platform_name: str) -> Optional[str]:
        """Delegate to MetadataResolver."""
        return await self.metadata_resolver.resolve_platform_id(platform_name)

    async def get_platform_name(self, platform_id: str) -> Optional[str]:
        """Delegate to MetadataResolver."""
        return await self.metadata_resolver.get_platform_name(platform_id)

    async def resolve_location_id(self, location_name: str) -> Optional[str]:
        """Delegate to MetadataResolver."""
        return await self.metadata_resolver.resolve_location_id(location_name)

    # ========================================================================
    # NETWORK RESOLUTION METHODS (delegated to NetworkResolver)
    # ========================================================================

    async def resolve_namespace_id(self, namespace_name: str) -> str:
        """Delegate to NetworkResolver."""
        return await self.network_resolver.resolve_namespace_id(namespace_name)

    async def resolve_ip_address(
        self, ip_address: str, namespace_id: str
    ) -> Optional[str]:
        """Delegate to NetworkResolver."""
        return await self.network_resolver.resolve_ip_address(ip_address, namespace_id)

    async def resolve_interface_by_name(
        self, device_id: str, interface_name: str
    ) -> Optional[str]:
        """Delegate to NetworkResolver."""
        return await self.network_resolver.resolve_interface_by_name(
            device_id, interface_name
        )

    # ========================================================================
    # VALIDATION METHODS (pure functions from common.validators)
    # ========================================================================

    def validate_required_fields(
        self, data: Dict[str, Any], required_fields: List[str]
    ) -> None:
        """Delegate to validators.validate_required_fields."""
        return validate_required_fields(data, required_fields)

    def validate_ip_address(self, ip: str) -> bool:
        """Delegate to validators.validate_ip_address."""
        return validate_ip_address(ip)

    def validate_mac_address(self, mac: str) -> bool:
        """Delegate to validators.validate_mac_address."""
        return validate_mac_address(mac)

    def _is_valid_uuid(self, uuid_str: str) -> bool:
        """Delegate to validators.is_valid_uuid."""
        return is_valid_uuid(uuid_str)

    # ========================================================================
    # DATA PROCESSING METHODS (pure functions from common.utils)
    # ========================================================================

    def flatten_nested_fields(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Delegate to utils.flatten_nested_fields."""
        return flatten_nested_fields(data)

    def extract_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """Delegate to utils.extract_nested_value."""
        return extract_nested_value(data, path)

    def normalize_tags(self, tags: Any) -> List[str]:
        """Delegate to utils.normalize_tags."""
        return normalize_tags(tags)

    def prepare_update_data(
        self,
        row: Dict[str, str],
        headers: List[str],
        excluded_fields: Optional[List[str]] = None,
    ) -> Tuple[Dict[str, Any], Optional[Dict[str, str]], Optional[str]]:
        """Delegate to utils.prepare_update_data."""
        return prepare_update_data(row, headers, excluded_fields)

    # ========================================================================
    # IP ADDRESS METHODS (delegated to IPManager)
    # ========================================================================

    async def ensure_ip_address_exists(
        self,
        ip_address: str,
        namespace_id: str,
        status_name: str = "active",
        add_prefixes_automatically: bool = False,
        use_assigned_ip_if_exists: bool = False,
        **kwargs,
    ) -> str:
        """Delegate to IPManager."""
        return await self.ip_manager.ensure_ip_address_exists(
            ip_address,
            namespace_id,
            status_name,
            add_prefixes_automatically,
            use_assigned_ip_if_exists,
            **kwargs,
        )

    async def assign_ip_to_interface(
        self, ip_id: str, interface_id: str, is_primary: bool = False
    ) -> dict:
        """Delegate to IPManager."""
        return await self.ip_manager.assign_ip_to_interface(
            ip_id, interface_id, is_primary
        )

    # ========================================================================
    # PREFIX METHODS (delegated to PrefixManager)
    # ========================================================================

    async def ensure_prefix_exists(
        self,
        prefix: str,
        namespace: str = "Global",
        status: str = "active",
        prefix_type: str = "network",
        location: Optional[str] = None,
        description: Optional[str] = None,
        **kwargs,
    ) -> str:
        """Delegate to PrefixManager."""
        return await self.prefix_manager.ensure_prefix_exists(
            prefix, namespace, status, prefix_type, location, description, **kwargs
        )

    # ========================================================================
    # INTERFACE METHODS (delegated to InterfaceManager)
    # ========================================================================

    async def ensure_interface_exists(
        self,
        device_id: str,
        interface_name: str,
        interface_type: str = "virtual",
        interface_status: str = "active",
        **kwargs,
    ) -> str:
        """Delegate to InterfaceManager."""
        return await self.interface_manager.ensure_interface_exists(
            device_id, interface_name, interface_type, interface_status, **kwargs
        )

    async def ensure_interface_with_ip(
        self,
        device_id: str,
        ip_address: str,
        interface_name: str = "Loopback",
        interface_type: str = "virtual",
        interface_status: str = "active",
        ip_namespace: str = "Global",
        add_prefixes_automatically: bool = False,
        use_assigned_ip_if_exists: bool = False,
    ) -> str:
        """Delegate to InterfaceManager."""
        return await self.interface_manager.ensure_interface_with_ip(
            device_id,
            ip_address,
            interface_name,
            interface_type,
            interface_status,
            ip_namespace,
            add_prefixes_automatically,
            use_assigned_ip_if_exists,
        )

    async def update_interface_ip(
        self,
        device_id: str,
        device_name: str,
        old_ip: Optional[str],
        new_ip: str,
        namespace: str,
        add_prefixes_automatically: bool = False,
        use_assigned_ip_if_exists: bool = False,
    ) -> str:
        """Delegate to InterfaceManager."""
        return await self.interface_manager.update_interface_ip(
            device_id,
            device_name,
            old_ip,
            new_ip,
            namespace,
            add_prefixes_automatically,
            use_assigned_ip_if_exists,
        )

    # ========================================================================
    # DEVICE OPERATIONS (delegated to DeviceManager)
    # ========================================================================

    async def get_device_details(
        self, device_id: str, depth: int = 0
    ) -> Dict[str, Any]:
        """Delegate to DeviceManager."""
        return await self.device_manager.get_device_details(device_id, depth)

    async def extract_primary_ip_address(
        self, device_data: Dict[str, Any]
    ) -> Optional[str]:
        """Delegate to DeviceManager."""
        return await self.device_manager.extract_primary_ip_address(device_data)

    async def assign_primary_ip_to_device(
        self, device_id: str, ip_address_id: str
    ) -> bool:
        """Delegate to DeviceManager."""
        return await self.device_manager.assign_primary_ip_to_device(
            device_id, ip_address_id
        )

    async def verify_device_updates(
        self,
        device_id: str,
        expected_updates: Dict[str, Any],
        actual_device: Dict[str, Any],
    ) -> Tuple[bool, List[Dict[str, Any]]]:
        """Delegate to DeviceManager."""
        return await self.device_manager.verify_device_updates(
            device_id, expected_updates, actual_device
        )

    # ========================================================================
    # ERROR HANDLING (delegated to common.exceptions)
    # ========================================================================

    def is_duplicate_error(self, error: Exception) -> bool:
        """Delegate to exceptions.is_duplicate_error."""
        return is_duplicate_error(error)

    def handle_already_exists_error(
        self, error: Exception, resource_type: str
    ) -> Dict[str, Any]:
        """Delegate to exceptions.handle_already_exists_error."""
        return handle_already_exists_error(error, resource_type)
