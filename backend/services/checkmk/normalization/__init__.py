"""Device normalization service for converting Nautobot device data to CheckMK format."""

from .device_normalizer import DeviceNormalizationService

# Global instance for backward compatibility
device_normalization_service = DeviceNormalizationService()

__all__ = ["DeviceNormalizationService", "device_normalization_service"]
