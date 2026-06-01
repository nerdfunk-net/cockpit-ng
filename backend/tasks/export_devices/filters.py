from typing import Any, Dict, List


def filter_device_properties(
    devices: List[Dict[str, Any]], properties: List[str]
) -> List[Dict[str, Any]]:
    """Filter devices to only include specified properties."""
    filtered_devices = []

    for device in devices:
        filtered_device: Dict[str, Any] = {}
        for prop in properties:
            if prop == "namespace":
                # Namespace is nested: primary_ip4 -> parent -> namespace -> name
                namespace_name = None
                primary_ip4 = device.get("primary_ip4")
                if isinstance(primary_ip4, dict):
                    parent = primary_ip4.get("parent")
                    if isinstance(parent, dict):
                        ns = parent.get("namespace")
                        if isinstance(ns, dict):
                            namespace_name = ns.get("name")
                filtered_device["namespace"] = namespace_name
            elif prop in device:
                filtered_device[prop] = device[prop]
            else:
                filtered_device[prop] = None

        filtered_devices.append(filtered_device)

    return filtered_devices
