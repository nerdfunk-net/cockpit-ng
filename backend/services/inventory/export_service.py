"""
Inventory export service — template rendering and inventory analysis.

Extracted from InventoryService as part of Phase 4 decomposition.
See: doc/refactoring/REFACTORING_SERVICES.md — Phase 4
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Set

from models.inventory import DeviceInfo

logger = logging.getLogger(__name__)


class InventoryExportService:
    """Renders Ansible inventory output and analyses device sets."""

    async def render_inventory(
        self,
        devices: List[DeviceInfo],
        template_name: str,
        template_category: str,
    ) -> tuple[str, int]:
        """
        Render *devices* through a Jinja2 template and return the content string.

        Returns:
            Tuple of (inventory_content, device_count)
        """
        try:
            all_devices = []
            for device in devices:
                device_name = device.name or "Unnamed Device"
                all_devices.append(
                    {
                        "name": device_name,
                        "uuid": device.id,
                        "location": device.location,
                        "role": device.role,
                        "tags": device.tags,
                        "device_type": device.device_type,
                        "manufacturer": device.manufacturer,
                        "platform": device.platform,
                        "primary_ip4": device.primary_ip4,
                        "status": device.status,
                    }
                )

            from template_manager import template_manager

            inventory_content = template_manager.render_template(
                template_name=template_name,
                category=template_category,
                data={"all_devices": all_devices, "total_devices": len(all_devices)},
            )
            return inventory_content, len(devices)

        except Exception as e:
            logger.error("Error rendering inventory: %s", e)
            raise

    async def analyze_devices(self, devices: List[DeviceInfo]) -> Dict[str, Any]:
        """
        Analyse *devices* and return aggregated distinct values.

        Fetches detailed device info from Nautobot for each device.

        Returns:
            Dict with keys: locations, tags, custom_fields, statuses, roles, device_count
        """
        if not devices:
            return {
                "locations": [],
                "tags": [],
                "custom_fields": {},
                "statuses": [],
                "roles": [],
                "device_count": 0,
            }

        import service_factory
        device_query_service = service_factory.build_device_query_service()

        locations_set: Set[str] = set()
        tags_set: Set[str] = set()
        custom_fields_dict: Dict[str, Set[str]] = {}
        statuses_set: Set[str] = set()
        roles_set: Set[str] = set()

        for i, device in enumerate(devices):
            try:
                logger.debug(
                    "Analyzing device %s/%s: %s (%s)",
                    i + 1,
                    len(devices),
                    device.name,
                    device.id,
                )
                device_details = await device_query_service.get_device_details(
                    device.id, use_cache=True
                )

                if device_details.get("location"):
                    location_name = device_details["location"].get("name")
                    if location_name:
                        locations_set.add(location_name)

                for tag in device_details.get("tags") or []:
                    tag_name = tag.get("name")
                    if tag_name:
                        tags_set.add(tag_name)

                for field_key, field_value in (
                    device_details.get("_custom_field_data") or {}
                ).items():
                    if field_value is not None:
                        if field_key not in custom_fields_dict:
                            custom_fields_dict[field_key] = set()
                        if isinstance(field_value, list):
                            custom_fields_dict[field_key].update(
                                str(v) for v in field_value if v
                            )
                        else:
                            custom_fields_dict[field_key].add(str(field_value))

                if device_details.get("status"):
                    status_name = device_details["status"].get("name")
                    if status_name:
                        statuses_set.add(status_name)

                if device_details.get("role"):
                    role_name = device_details["role"].get("name")
                    if role_name:
                        roles_set.add(role_name)

            except Exception as e:
                logger.error(
                    "Error analyzing device %s (%s): %s", device.name, device.id, e
                )

        logger.info(
            "Analysis complete: %s locations, %s tags, %s custom field types, "
            "%s statuses, %s roles",
            len(locations_set),
            len(tags_set),
            len(custom_fields_dict),
            len(statuses_set),
            len(roles_set),
        )

        return {
            "locations": sorted(locations_set),
            "tags": sorted(tags_set),
            "custom_fields": {
                key: sorted(values) for key, values in custom_fields_dict.items()
            },
            "statuses": sorted(statuses_set),
            "roles": sorted(roles_set),
            "device_count": len(devices),
        }
