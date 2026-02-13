"""
CheckMK sync services.

This package contains services for:
- Nautobot to CheckMK synchronization
- Background sync operations
- Sync database operations

The main facade class NautobotToCheckMKService provides a unified interface
to all sync operations while delegating to specialized service modules.
"""

from typing import Dict, Any, List

from .queries import DeviceQueryService
from .comparison import DeviceComparisonService
from .operations import DeviceSyncOperations
from models.nb2cmk import (
    DeviceList,
    DeviceListWithStatus,
    DeviceComparison,
    DeviceOperationResult,
    DeviceUpdateResult,
    DefaultSiteResponse,
)


class NautobotToCheckMKService:
    """Facade for Nautobot to CheckMK device synchronization.

    This class provides a unified interface to all sync operations while
    delegating to specialized service modules:
    - DeviceQueryService: GraphQL queries for device data
    - DeviceComparisonService: Configuration comparison logic
    - DeviceSyncOperations: Device add/update operations
    """

    def __init__(self):
        """Initialize facade with all service dependencies."""
        self.query_service = DeviceQueryService()
        self.comparison_service = DeviceComparisonService(self.query_service)
        self.operations_service = DeviceSyncOperations(self.query_service)

    # Query methods - delegate to DeviceQueryService
    async def get_devices_for_sync(self) -> DeviceList:
        """Get all devices from Nautobot for CheckMK sync.

        Returns:
            DeviceList with device data

        Raises:
            HTTPException: If GraphQL query fails or other errors occur
        """
        return await self.query_service.get_devices_for_sync()

    async def get_device_normalized(self, device_id: str) -> Dict[str, Any]:
        """Get normalized device config from Nautobot for CheckMK comparison.

        Args:
            device_id: Nautobot device ID

        Returns:
            Normalized device configuration dictionary

        Raises:
            HTTPException: If device not found or normalization fails
        """
        return await self.query_service.get_device_normalized(device_id)

    # Comparison methods - delegate to DeviceComparisonService
    async def get_devices_diff(self) -> DeviceListWithStatus:
        """Get all devices from Nautobot with CheckMK comparison status.

        Returns:
            DeviceListWithStatus with comparison information

        Raises:
            HTTPException: If operation fails
        """
        return await self.comparison_service.get_devices_diff()

    async def compare_device_config(self, device_id: str) -> DeviceComparison:
        """Compare normalized Nautobot device config with CheckMK host config.

        Args:
            device_id: Nautobot device ID

        Returns:
            DeviceComparison with comparison results

        Raises:
            HTTPException: If comparison fails
        """
        return await self.comparison_service.compare_device_config(device_id)

    def _compare_configurations(
        self, nb_config: Dict[str, Any], cmk_config: Dict[str, Any]
    ) -> List[str]:
        """Compare Nautobot and CheckMK configurations and return differences.

        Args:
            nb_config: Normalized Nautobot configuration
            cmk_config: CheckMK configuration

        Returns:
            List of difference descriptions
        """
        return self.comparison_service._compare_configurations(nb_config, cmk_config)

    @staticmethod
    def filter_diff_by_ignored_attributes(
        diff_text: str, ignored_attributes: List[str]
    ) -> str:
        """Filter diff text to remove differences related to ignored attributes.

        Args:
            diff_text: The raw diff text with all differences
            ignored_attributes: List of attribute names to ignore

        Returns:
            Filtered diff text with ignored attributes removed
        """
        return DeviceComparisonService.filter_diff_by_ignored_attributes(
            diff_text, ignored_attributes
        )

    def get_filtered_attributes(self, nb_attributes, cmk_attributes) -> List[str]:
        """Get the list of attributes that are ignored during comparison.

        Returns:
            List of attribute names
        """
        return self.comparison_service.get_filtered_attributes(
            nb_attributes, cmk_attributes
        )

    # Operations methods - delegate to DeviceSyncOperations
    async def add_device_to_checkmk(self, device_id: str) -> DeviceOperationResult:
        """Add a device from Nautobot to CheckMK using normalized config.

        Args:
            device_id: Nautobot device ID

        Returns:
            DeviceOperationResult with operation details

        Raises:
            HTTPException: If operation fails
        """
        return await self.operations_service.add_device_to_checkmk(device_id)

    async def update_device_in_checkmk(self, device_id: str) -> DeviceUpdateResult:
        """Update/sync a device from Nautobot to CheckMK using normalized config.

        Args:
            device_id: Nautobot device ID

        Returns:
            DeviceUpdateResult with operation details

        Raises:
            HTTPException: If operation fails
        """
        return await self.operations_service.update_device_in_checkmk(device_id)

    def get_default_site(self) -> DefaultSiteResponse:
        """Get the default site from CheckMK configuration.

        Returns:
            DefaultSiteResponse with default site name
        """
        return self.operations_service.get_default_site()


# Global instance for dependency injection
nb2cmk_service = NautobotToCheckMKService()

# Export all classes and the singleton
__all__ = [
    "NautobotToCheckMKService",
    "DeviceQueryService",
    "DeviceComparisonService",
    "DeviceSyncOperations",
    "nb2cmk_service",
]
